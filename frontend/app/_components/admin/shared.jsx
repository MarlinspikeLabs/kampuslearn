'use client';
import {useEffect,useRef,useState} from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {X,RefreshCw,Search,ChevronLeft,ChevronRight} from 'lucide-react';
import s from './Admin.module.css';
export {api,s};
export const message=e=>{
 const detail=e.response?.data?.message;
 if(typeof detail==='string'&&detail.trim())return detail;
 if(e.response?.status===413)return 'The server rejected this upload because of its size. Files can be up to 50 MB; contact support if a smaller file fails.';
 if(e.code==='ECONNABORTED'||e.code==='ETIMEDOUT')return 'The request took too long. Check the content library before retrying the upload.';
 if(!e.response&&e.code==='ERR_NETWORK')return 'Connection interrupted. Check your internet connection and the content library before retrying.';
 return 'Unable to complete the request. Please try again.';
};
export const number=v=>Number(v||0).toLocaleString();
export const date=v=>v?new Date(v).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'}):'—';
export function useData(url){
 const [state,set]=useState({data:null,loading:true,error:''});const [tick,bump]=useState(0);
 useEffect(()=>{let active=true;const controller=new AbortController();set({data:null,loading:true,error:''});
 api.get(url,{signal:controller.signal}).then(r=>{if(active)set({data:r.data.data,loading:false,error:''});}).catch(e=>{if(active)set({data:null,loading:false,error:message(e)});});
 return()=>{active=false;controller.abort();};},[url,tick]);
 return {...state,reload:()=>bump(t=>t+1)};
}
export function useSearch(){const [value,setValue]=useState('');const [search,setSearch]=useState('');useEffect(()=>{const id=setTimeout(()=>setSearch(value),250);return()=>clearTimeout(id);},[value]);return [value,setValue,search];}
export function State({resource,children}){if(resource.loading)return <div className={s.empty} role="status"><RefreshCw size={22}/> Loading…</div>;if(resource.error)return <div className={s.empty} role="alert"><p>{resource.error}</p><button onClick={resource.reload}>Try again</button></div>;return children;}
export function Empty({children='No records yet.'}){return <div className={s.empty}>{children}</div>;}
export function SearchBox({value,onChange,placeholder='Search…'}){return <label className={s.search}><Search size={17}/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/></label>;}
export function Pager({data,page,setPage}){return <div className={s.pager}><span>{number(data?.total)} records · Page {page} of {data?.pages||1}</span><div><button aria-label="Previous page" disabled={page<=1} onClick={()=>setPage(page-1)}><ChevronLeft size={17}/></button><button aria-label="Next page" disabled={page>=(data?.pages||1)} onClick={()=>setPage(page+1)}><ChevronRight size={17}/></button></div></div>;}
export function Modal({title,onClose,children,wide=false}){
 const ref=useRef(null);const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const prev=document.activeElement;const old=document.body.style.overflow;document.body.style.overflow='hidden';ref.current?.focus();
 const key=e=>{if(e.key==='Escape'){e.preventDefault();close.current();}if(e.key==='Tab'){const nodes=[...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')];const first=nodes[0],last=nodes[nodes.length-1];if(!first){e.preventDefault();return;}if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===ref.current)){e.preventDefault();first.focus();}}};document.addEventListener('keydown',key);return()=>{document.body.style.overflow=old;document.removeEventListener('keydown',key);prev?.focus?.();};},[]);
 return <div className={s.overlay}><section className={`${s.modal} ${wide?s.wide:''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}><header><div><small>KAMPUSLEARN ADMIN</small><h2>{title}</h2></div><button aria-label="Close dialog" onClick={onClose}><X size={20}/></button></header><div className={s.modalBody}>{children}</div></section></div>;
}
export function Form({fields,initial={},onSave,onCancel,submit='Save changes'}){
 const [values,set]=useState(initial);const [busy,setBusy]=useState(false);const [err,setErr]=useState('');
 async function save(e){e.preventDefault();if(busy)return;setBusy(true);setErr('');try{await onSave(values);}catch(e){setErr(message(e));}finally{setBusy(false);}}
 return <form onSubmit={save} className={s.form}><fieldset disabled={busy}>{fields.map(f=><label key={f.key}>{f.label}{f.optional?' (optional)':''}{f.options?<select value={values[f.key]??''} required={!f.optional} disabled={f.disabled} onChange={e=>set({...values,[f.key]:e.target.value})}><option value="">Choose…</option>{f.options.map(o=><option key={typeof o==='string'?o:o.value} value={typeof o==='string'?o:o.value}>{typeof o==='string'?o:o.label}</option>)}</select>:f.type==='textarea'?<textarea rows={4} value={values[f.key]??''} onChange={e=>set({...values,[f.key]:e.target.value})}/>:<input type={f.type||'text'} required={!f.optional} min={f.min} max={f.max} minLength={f.minLength} maxLength={f.maxLength||250} autoComplete={f.type==='password'?'new-password':undefined} value={values[f.key]??''} disabled={f.disabled} onChange={e=>set({...values,[f.key]:e.target.value})}/>}</label>)}</fieldset>{err&&<p role="alert" className={s.error}>{err}</p>}<footer><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button className={s.primary} disabled={busy}>{busy?'Saving…':submit}</button></footer></form>;
}
export function Confirm({title,children,onClose,onConfirm}){const [busy,set]=useState(false);const [err,setErr]=useState('');return <Modal title={title} onClose={()=>!busy&&onClose()}><p>{children}</p>{err&&<p role="alert" className={s.error}>{err}</p>}<div className={s.actions}><button disabled={busy} onClick={onClose}>Cancel</button><button className={s.primary} disabled={busy} onClick={async()=>{set(true);try{await onConfirm();onClose();}catch(e){setErr(message(e));}finally{set(false);}}}>{busy?'Working…':'Confirm'}</button></div></Modal>;}
export function saved(text='Changes saved'){toast.success(text);}

