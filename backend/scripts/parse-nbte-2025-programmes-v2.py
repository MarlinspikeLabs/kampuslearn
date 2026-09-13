#!/usr/bin/env python3

import json
import re
from pathlib import Path
from collections import Counter, defaultdict
from difflib import SequenceMatcher

BASE = Path(
    "backend/data/academic-reference/nbte-programmes"
)

TXT = BASE / "25th-edition-2025-directory.txt"
POLYS = BASE / "production-polytechnics.json"

OUT = BASE / "nbte-2025-polytechnic-programmes-v2.json"
AUDIT = BASE / "nbte-2025-polytechnic-programmes-v2-audit.json"

SOURCE_URL = (
    "https://web.nbte.gov.ng/sites/default/files/"
    "2025-11/25th%20Edition%202025%20Directory.pdf"
)

lines = TXT.read_text(
    encoding="utf-8",
    errors="ignore"
).splitlines()

polytechnics = json.loads(
    POLYS.read_text(encoding="utf-8")
)

# -------------------------------------------------
# Normalisation
# -------------------------------------------------

def clean(s):
    s = str(s or "")
    s = s.replace("’", "'")
    s = s.replace("‘", "'")
    s = s.replace("–", "-")
    s = s.replace("—", "-")
    return re.sub(r"\s+", " ", s).strip()

def norm(s):
    s = clean(s).lower()

    replacements = {
        "&": " and ",
        "polytecnic": "polytechnic",
        "polytchnic": "polytechnic",
        "institiute": "institute",
    }

    for a,b in replacements.items():
        s = s.replace(a,b)

    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()

    return s

def tokens(s):
    ignore = {
        "the","of","and","for","state",
        "federal","college","institute",
        "polytechnic","technology"
    }

    return {
        x for x in norm(s).split()
        if x not in ignore and len(x) > 1
    }

def similarity(a,b):
    na = norm(a)
    nb = norm(b)

    if na == nb:
        return 1.0

    # Exact containment is strong when strings are substantial.
    if len(na) > 12 and len(nb) > 12:
        if na in nb or nb in na:
            return 0.96

    seq = SequenceMatcher(None, na, nb).ratio()

    ta = tokens(a)
    tb = tokens(b)

    if ta and tb:
        jac = len(ta & tb) / len(ta | tb)
    else:
        jac = 0

    return max(seq, (seq * 0.55) + (jac * 0.45))

# -------------------------------------------------
# Find candidate institution headings
# -------------------------------------------------

HEADER_RE = re.compile(
    r"\bS/N\b.*\bProgrammes\b",
    re.I
)

PAGE_NO_RE = re.compile(
    r"^(?:\d+|[IVXLCDM]+)$",
    re.I
)

CATEGORY_RE = re.compile(
    r"^[A-Z]\.?\s+[A-Z,&()/'’`\-\s]+$"
)

def bad_heading(s):
    s = clean(s)

    if not s:
        return True

    if PAGE_NO_RE.fullmatch(s):
        return True

    if HEADER_RE.search(s):
        return True

    if CATEGORY_RE.fullmatch(s):
        return True

    if s.upper() in {
        "STATE",
        "FEDERAL",
        "PRIVATE",
        "TECHNOLOGY"
    }:
        return True

    if s.lower().startswith("institutional administration"):
        return True

    return False

candidates = []

for i,line in enumerate(lines):

    if not HEADER_RE.search(clean(line)):
        continue

    # Search backwards before the table header.
    previous = []

    j = i - 1

    while j >= 0 and len(previous) < 4:
        text = clean(lines[j])

        if text:
            previous.append((j,text))

        j -= 1

    # Prefer the nearest plausible line.
    # Also construct 2-line institution names.
    opts = []

    for pos,text in previous:
        if not bad_heading(text):
            opts.append((pos,text))

    if len(opts) >= 2:
        # PDF sometimes wraps institution names.
        p1,t1 = opts[1]
        p2,t2 = opts[0]

        if p2 == p1 + 1:
            opts.append(
                (p1, clean(t1 + " " + t2))
            )

    for pos,text in opts:
        candidates.append({
            "line_index": pos,
            "line_number": pos + 1,
            "heading": text,
            "header_line": i + 1
        })

# De-duplicate candidates by line/text.
unique = {}

for c in candidates:
    unique[
        (c["line_index"], norm(c["heading"]))
    ] = c

candidates = sorted(
    unique.values(),
    key=lambda x:x["line_index"]
)

# -------------------------------------------------
# Reconcile candidates to the 190 production polys
# -------------------------------------------------

matches = []
unmatched = []
ambiguous = []

for poly in polytechnics:

    scored = []

    for c in candidates:
        score = similarity(
            poly["name"],
            c["heading"]
        )

        if score >= 0.72:
            scored.append(
                (score,c)
            )

    scored.sort(
        key=lambda x:x[0],
        reverse=True
    )

    if not scored:
        unmatched.append(poly)
        continue

    best_score,best = scored[0]

    second_score = (
        scored[1][0]
        if len(scored) > 1
        else 0
    )

    # Production name must map confidently.
    if best_score < 0.80:
        unmatched.append({
            **poly,
            "best_candidate": best["heading"],
            "best_score": round(best_score,4)
        })
        continue

    # Multiple close but different headings = hold.
    if (
        len(scored) > 1
        and second_score >= best_score - 0.025
        and norm(scored[1][1]["heading"])
            != norm(best["heading"])
    ):
        ambiguous.append({
            "institution": poly,
            "best": {
                "score": round(best_score,4),
                **best
            },
            "second": {
                "score": round(second_score,4),
                **scored[1][1]
            }
        })
        continue

    matches.append({
        "institution_id": poly["id"],
        "production_name": poly["name"],
        "state": poly.get("state"),
        "pdf_name": best["heading"],
        "score": round(best_score,4),
        "start_line_index": best["line_index"],
        "start_line_number": best["line_number"]
    })

# -------------------------------------------------
# Determine ALL plausible institution boundaries
#
# Candidate table headers create boundaries, but
# page-number/category junk was filtered above.
# -------------------------------------------------

boundary_indexes = sorted({
    c["line_index"]
    for c in candidates
})

def next_boundary(start):
    for x in boundary_indexes:
        if x > start:
            return x

    return len(lines)

# -------------------------------------------------
# Programme parser
# -------------------------------------------------

STATUS_RE = re.compile(
    r"""
    ^\s*
    (?P<left>.*?)
    \s+
    (?P<status>
       Accredited
       |Interim
       |Expired(?:\s*\*)?
    )
    \s+
    (?P<stream>-|\d+)
    \s+
    (?P<expiry>\d{2}/\d{2}/+?\d{4})
    \s*$
    """,
    re.I | re.X
)

PROGRAMME_RE = re.compile(
    r"""
    ^\s*
    (?:
       \d+
       [.,]?
       \s*
    )?
    (?P<award>
       ND
       |HND
       |H\s+ND
    )
    \s+
    (?P<body>.+?)
    \s*$
    """,
    re.I | re.X
)

YEAR_RE = re.compile(
    r"""
    ^(?P<name>.+?)
    \s+
    (?P<years>
       (?:\(\d{4}\)|\d{4})
       (?:
          \s*
          \d{4}
       )?
    )
    \s*$
    """,
    re.X
)

CATEGORY_START_RE = re.compile(
    r"^[A-Z]\.?\s+(.+)$"
)

def iso_date(s):
    s = clean(s).replace("//","/")

    m = re.fullmatch(
        r"(\d{2})/(\d{2})/(\d{4})",
        s
    )

    if not m:
        return None

    d,mn,y = m.groups()

    return f"{y}-{mn}-{d}"

def status_value(s):
    s = clean(s).lower()

    if s.startswith("expired"):
        return "expired"

    if s.startswith("interim"):
        return "interim"

    return "accredited"

records = []
parse_failures = []

for inst in matches:

    start = inst["start_line_index"]
    end = next_boundary(start)

    category = None
    last = None

    for idx in range(start + 1,end):

        line = clean(lines[idx])

        if not line:
            continue

        if HEADER_RE.search(line):
            continue

        if PAGE_NO_RE.fullmatch(line):
            continue

        sec = CATEGORY_START_RE.match(line)

        if (
            sec
            and line == line.upper()
            and "ND " not in line
            and "HND " not in line
        ):
            candidate_category = clean(
                sec.group(1)
            )

            if len(candidate_category) > 4:
                category = candidate_category

            last = None
            continue

        sm = STATUS_RE.match(line)

        if sm:
            left = clean(
                sm.group("left")
            )

            # PDF extraction artifact: H ND => HND
            left = re.sub(
                r"\bH\s+ND\b",
                "HND",
                left,
                flags=re.I
            )

            pm = PROGRAMME_RE.match(left)

            if not pm:
                if re.search(
                    r"\b(?:ND|HND|H\s+ND)\b",
                    left,
                    re.I
                ):
                    parse_failures.append({
                        "institution_id":
                            inst["institution_id"],
                        "institution":
                            inst["production_name"],
                        "pdf_name":
                            inst["pdf_name"],
                        "line":
                            idx + 1,
                        "text":
                            line
                    })

                last = None
                continue

            award = (
                pm.group("award")
                .replace(" ","")
                .upper()
            )

            body = clean(
                pm.group("body")
            )

            years = None
            name = body

            ym = YEAR_RE.match(body)

            if ym:
                name = clean(
                    ym.group("name")
                )
                years = clean(
                    ym.group("years")
                )

            r = {
                "institution_id":
                    inst["institution_id"],
                "institution_name":
                    inst["production_name"],
                "pdf_institution_name":
                    inst["pdf_name"],
                "category":
                    category,
                "programme_name":
                    name,
                "award_type":
                    award,
                "year_granted_text":
                    years,
                "accreditation_status":
                    status_value(
                        sm.group("status")
                    ),
                "approved_stream":
                    None
                    if sm.group("stream") == "-"
                    else int(sm.group("stream")),
                "expiration_date":
                    iso_date(
                        sm.group("expiry")
                    ),
                "expiration_date_raw":
                    clean(
                        sm.group("expiry")
                    ),
                "source_line":
                    idx + 1,
                "regulator":
                    "NBTE",
                "source_url":
                    SOURCE_URL
            }

            records.append(r)
            last = r
            continue

        # Wrapped programme-name continuation.
        if last:
            if (
                not HEADER_RE.search(line)
                and not PAGE_NO_RE.fullmatch(line)
                and not STATUS_RE.match(line)
                and not re.match(
                    r"^\d+[.,]?\s+(?:ND|HND)\b",
                    line,
                    re.I
                )
            ):
                # Avoid category / admin rows.
                if (
                    "institutional administration"
                    not in line.lower()
                    and not (
                        line == line.upper()
                        and len(line) > 8
                    )
                ):
                    last["programme_name"] = clean(
                        last["programme_name"]
                        + " "
                        + line
                    )

# -------------------------------------------------
# Deduplicate within institution/programme/award
# -------------------------------------------------

dedup = {}
duplicate_records = []

for r in records:

    key = (
        r["institution_id"],
        norm(r["programme_name"]),
        r["award_type"]
    )

    if key in dedup:
        duplicate_records.append({
            "existing": dedup[key],
            "duplicate": r
        })

        # Keep the later/current-looking source row.
        # We DO NOT silently discard conflicting
        # accreditation status; it is reported.
        continue

    dedup[key] = r

records = list(dedup.values())

# -------------------------------------------------
# Audit
# -------------------------------------------------

per_inst = Counter(
    r["institution_id"]
    for r in records
)

status_counts = Counter(
    r["accreditation_status"]
    for r in records
)

award_counts = Counter(
    r["award_type"]
    for r in records
)

matched_no_programmes = [
    x for x in matches
    if per_inst[x["institution_id"]] == 0
]

OUT.write_text(
    json.dumps({
        "source_url":SOURCE_URL,
        "regulator":"NBTE",
        "edition":"25th Edition 2025",
        "matched_institutions":matches,
        "records":records
    },indent=2,ensure_ascii=False),
    encoding="utf-8"
)

AUDIT.write_text(
    json.dumps({
        "production_polytechnics":
            len(polytechnics),
        "matched":
            len(matches),
        "unmatched":
            unmatched,
        "ambiguous":
            ambiguous,
        "matched_without_programmes":
            matched_no_programmes,
        "records":
            len(records),
        "award_counts":
            dict(award_counts),
        "status_counts":
            dict(status_counts),
        "parse_failures":
            parse_failures,
        "parse_failure_count":
            len(parse_failures),
        "duplicate_programme_keys":
            duplicate_records,
        "duplicate_programme_key_count":
            len(duplicate_records)
    },indent=2,ensure_ascii=False),
    encoding="utf-8"
)

print("\n=== NBTE POLYTECHNIC PARSER V2 ===")
print("Production polytechnics:",len(polytechnics))
print("Matched:",len(matches))
print("Unmatched:",len(unmatched))
print("Ambiguous:",len(ambiguous))
print(
    "Matched without programmes:",
    len(matched_no_programmes)
)
print("Programme records:",len(records))
print("Awards:",dict(award_counts))
print("Statuses:",dict(status_counts))
print("Parse failures:",len(parse_failures))
print(
    "Duplicate programme keys:",
    len(duplicate_records)
)

print("\nTop parsed institutions:")

by_name = defaultdict(int)

for r in records:
    by_name[r["institution_name"]] += 1

for name,count in sorted(
    by_name.items(),
    key=lambda x:x[1],
    reverse=True
)[:20]:
    print(f"{count:4}  {name}")

print("\nOutput:",OUT)
print("Audit:",AUDIT)
