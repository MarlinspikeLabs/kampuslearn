#!/usr/bin/env python3
"""Raise only KampusLearn vhost request limits; nginx -t and rollback on errors."""
import argparse, dataclasses, os, re, shutil, subprocess, tempfile, time
from pathlib import Path

@dataclasses.dataclass
class Node:
    words: list
    start: int
    end: int
    opening: int = 0
    children: list = dataclasses.field(default_factory=list)

def parse(text):
    # Keep source offsets so edits preserve comments and unrelated configuration.
    pattern=r'''\s+|\#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[{};]|(?:\\.|[^\s{};#"'])+'''
    tokens=[]
    for m in re.finditer(pattern,text):
        v=m.group()
        if not v.isspace() and not v.startswith('#'):tokens.append((v,m.start(),m.end()))
    def block(i,closing=False):
        nodes=[]
        while i<len(tokens):
            if tokens[i][0]=='}':
                if not closing:raise ValueError('Unexpected closing brace')
                return nodes,i+1,tokens[i][2]
            start=tokens[i][1];words=[]
            while i<len(tokens) and tokens[i][0] not in ['{','}',';']:
                words.append(tokens[i][0].strip('\'"'));i+=1
            if i==len(tokens) or not words:raise ValueError('Unsupported or incomplete Nginx configuration')
            v,a,b=tokens[i]
            if v==';':nodes.append(Node(words,start,b));i+=1
            elif v=='{':
                children,i,end=block(i+1,True);nodes.append(Node(words,start,end,b,children))
            else:raise ValueError('Directive missing semicolon')
        if closing:raise ValueError('Unclosed block')
        return nodes,i,len(text)
    return block(0)[0]

def walk(nodes):
    for n in nodes:
        yield n
        yield from walk(n.children)

def revised(text):
    edits=[];matches=0
    for server in walk(parse(text)):
        if server.words!=['server']:continue
        names=[w for n in server.children if n.words[0]=='server_name' for w in n.words[1:]]
        if 'kampuslearn.academy' not in names:continue
        # Never change a shared vhost serving other products.
        if any(n not in ['kampuslearn.academy','www.kampuslearn.academy'] for n in names):
            raise ValueError('KampusLearn shares a server block with another domain; inspect this vhost manually')
        matches+=1
        own=[n for n in server.children if n.words[0]=='client_max_body_size']
        if not own:edits.append((server.opening,server.opening,'\n    client_max_body_size 64m; # KampusLearn: 50 MB file plus multipart overhead\n'))
        for n in walk(server.children):
            if n.words[0]=='client_max_body_size' and n.words!=['client_max_body_size','64m']:
                edits.append((n.start,n.end,'client_max_body_size 64m;'))
    for start,end,value in sorted(edits,reverse=True):text=text[:start]+value+text[end:]
    return text,matches

def run(args):
    return subprocess.run(args,check=True,capture_output=True,text=True)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true',help='Back up, patch, validate, reload and check the upload proxy')
    args=parser.parse_args()
    if os.geteuid()!=0:raise RuntimeError('Run this script with sudo on the Ubuntu VPS')
    dump=run(['nginx','-T']).stdout
    paths=list(dict.fromkeys(Path(p).resolve() for p in re.findall(r'^# configuration file (.+):$',dump,re.M)))
    changed={};matched=0
    for p in paths:
        old=p.read_text();new,count=revised(old);matched+=count
        if count and not p.is_relative_to('/etc/nginx'):raise RuntimeError('KampusLearn vhost is outside /etc/nginx; inspect configuration manually')
        if new!=old:changed[p]=(old,new)
    if not matched:raise RuntimeError('No exact kampuslearn.academy server_name found; no files changed')
    print(f'Found {matched} KampusLearn server blocks; {len(changed)} configuration files need changes.')
    for p in changed:print('Set request limit to 64 MB:',p)
    if not args.apply:
        print('Preview only. Run again with --apply to change and validate Nginx.');return
    backup=Path('/var/backups')/('kampuslearn-nginx-'+str(time.time_ns()))
    backup.mkdir(mode=0o700,parents=True)
    applied=[]
    try:
        for p,(old,new) in changed.items():
            dest=backup/p.relative_to('/etc/nginx');dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
            applied.append(p);p.write_text(new)
        run(['nginx','-t']);run(['systemctl','reload','nginx'])
        # Authentication runs before Multer. This creates no content or user records.
        with tempfile.TemporaryDirectory(prefix='kl-upload-check-') as temp:
            probe=Path(temp)/'proxy-check.txt';probe.write_bytes(b'x'*(2*1024*1024))
            status=run(['curl','--silent','--show-error','--max-time','30','--resolve','kampuslearn.academy:443:127.0.0.1','--output','/dev/null','--write-out','%{http_code}','--form','file=@'+str(probe),'https://kampuslearn.academy/api/admin-upload/material']).stdout
            if status!='401':raise RuntimeError('2 MB unauthenticated proxy check returned HTTP '+status+'; expected 401')
        print('Nginx upload limit updated. 2 MB request reached authentication (HTTP 401).')
        print('The application still enforces 50 MB per file. Retry your upload in Admin.')
        print('Nginx backup:',backup)
    except Exception:
        for p in applied:shutil.copy2(backup/p.relative_to('/etc/nginx'),p)
        if applied:
            try:run(['nginx','-t']);run(['systemctl','reload','nginx'])
            except Exception:print('Automatic Nginx restoration needs attention. Backup:',backup)
        raise

if __name__=='__main__':
    try:main()
    except subprocess.CalledProcessError as e:raise SystemExit((e.stderr or str(e)).strip())
    except Exception as e:raise SystemExit(str(e))
