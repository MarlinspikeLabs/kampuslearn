#!/usr/bin/env python3

import json
import re
from pathlib import Path
from collections import Counter, defaultdict

SOURCE_TXT = Path(
    "backend/data/academic-reference/nbte-programmes/"
    "25th-edition-2025-directory.txt"
)

OUT_JSON = Path(
    "backend/data/academic-reference/nbte-programmes/"
    "nbte-2025-programmes.json"
)

AUDIT_JSON = Path(
    "backend/data/academic-reference/nbte-programmes/"
    "nbte-2025-programmes-audit.json"
)

SOURCE_URL = (
    "https://web.nbte.gov.ng/sites/default/files/"
    "2025-11/25th%20Edition%202025%20Directory.pdf"
)

# Status + stream + expiry appear at the far right of programme rows.
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
    (?P<expiry>
        \d{2}/\d{2}/+?\d{4}
    )
    \s*$
    """,
    re.I | re.X
)

# Programme body begins with ND or HND after an optional serial number.
PROGRAMME_RE = re.compile(
    r"""
    ^\s*
    (?:(?P<serial>\d+)\.?\s+)?
    (?P<award>ND|HND)
    \s+
    (?P<body>.+?)
    \s*$
    """,
    re.I | re.X
)

YEAR_TAIL_RE = re.compile(
    r"""
    ^(?P<name>.+?)
    \s+
    (?P<year>
       \(?\d{4}\)?
       (?:
          \s+
          \d{4}
       )?
    )
    \s*$
    """,
    re.X
)

SECTION_RE = re.compile(
    r"""
    ^\s*
    [A-Z]\.?
    \s+
    (?P<section>[A-Z0-9,&()/'’`\-\s]+)
    \s*$
    """,
    re.X
)

HEADER_RE = re.compile(
    r"\bS/N\b.*\bProgrammes\b",
    re.I
)

SKIP_PHRASES = (
    "year granted",
    "accreditation status",
    "approved stream",
    "expiration date",
    "institutional administration",
)

def clean_space(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()

def clean_expiry(s):
    """
    Fix PDF artefact like 01/10//2027 -> 01/10/2027.
    Preserve as ISO YYYY-MM-DD when safely parseable.
    """
    s = clean_space(s).replace("//", "/")

    m = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})", s)
    if not m:
        return None

    day, month, year = m.groups()

    return f"{year}-{month}-{day}"

def normalize_status(s):
    s = clean_space(s).lower()

    if s.startswith("accredited"):
        return "accredited"

    if s.startswith("interim"):
        return "interim"

    if s.startswith("expired"):
        return "expired"

    return s

def looks_like_institution_header(lines, i):
    """
    Actual institution section is followed shortly by the S/N Programmes header.
    This prevents matching the table of contents.
    """
    raw = clean_space(lines[i])

    if not raw:
        return False

    # Programme/category/header rows cannot be institution headers.
    if re.match(r"^(ND|HND)\b", raw, re.I):
        return False

    if re.match(r"^\d+\.", raw):
        return False

    # Look ahead for S/N + Programmes within next 6 non-empty lines.
    seen = 0

    for j in range(i + 1, min(len(lines), i + 10)):
        nxt = clean_space(lines[j])

        if not nxt:
            continue

        seen += 1

        if HEADER_RE.search(nxt):
            return True

        if seen >= 6:
            break

    return False

def append_continuation(record, line):
    text = clean_space(line)

    if not text:
        return

    # Do not accidentally append page numbers/header artefacts.
    if re.fullmatch(r"[IVXLCDM]+|\d+", text):
        return

    if any(x in text.lower() for x in SKIP_PHRASES):
        return

    if HEADER_RE.search(text):
        return

    if SECTION_RE.match(text):
        return

    # New programme row should never be consumed as continuation.
    if PROGRAMME_RE.match(text):
        return

    record["programme_name"] = clean_space(
        record["programme_name"] + " " + text
    )

lines = SOURCE_TXT.read_text(
    encoding="utf-8",
    errors="ignore"
).splitlines()

records = []

current_institution = None
current_category = None
last_record = None

institution_headers = []
candidate_programme_lines = []
unparsed_programme_lines = []

for i, raw_line in enumerate(lines):
    line = clean_space(raw_line)

    if not line:
        continue

    # Actual institution heading.
    if looks_like_institution_header(lines, i):
        current_institution = line
        current_category = None
        last_record = None

        institution_headers.append({
            "line": i + 1,
            "institution": current_institution
        })

        continue

    if not current_institution:
        continue

    # Category heading e.g. "C. ENGINEERING AND RELATED TECHNOLOGY"
    sec = SECTION_RE.match(line)

    if sec:
        section = clean_space(sec.group("section"))

        # Avoid treating random table text as category.
        if len(section) >= 4:
            current_category = section

        last_record = None
        continue

    # Detect programme-looking lines for parser audit.
    if re.search(r"\b(?:ND|HND)\b", line, re.I):
        candidate_programme_lines.append({
            "line": i + 1,
            "institution": current_institution,
            "text": line
        })

    status_match = STATUS_RE.match(line)

    if status_match:
        left = clean_space(status_match.group("left"))

        programme_match = PROGRAMME_RE.match(left)

        if not programme_match:
            # Could be a wrapped/non-programme administrative row.
            if re.search(r"\b(?:ND|HND)\b", left, re.I):
                unparsed_programme_lines.append({
                    "line": i + 1,
                    "institution": current_institution,
                    "text": line,
                    "reason": "status row contains ND/HND but programme prefix not parsed"
                })

            last_record = None
            continue

        award = programme_match.group("award").upper()
        body = clean_space(programme_match.group("body"))

        year_text = None
        programme_name = body

        y = YEAR_TAIL_RE.match(body)

        if y:
            programme_name = clean_space(y.group("name"))
            year_text = clean_space(y.group("year"))

        expiry_raw = clean_space(status_match.group("expiry"))

        record = {
            "institution_name": current_institution,
            "category": current_category,
            "programme_name": programme_name,
            "award_type": award,
            "year_granted_text": year_text,
            "accreditation_status": normalize_status(
                status_match.group("status")
            ),
            "approved_stream": (
                None
                if status_match.group("stream") == "-"
                else int(status_match.group("stream"))
            ),
            "expiration_date": clean_expiry(expiry_raw),
            "expiration_date_raw": expiry_raw,
            "regulator": "NBTE",
            "source_url": SOURCE_URL,
            "source_line": i + 1
        }

        records.append(record)
        last_record = record
        continue

    # Wrapped programme name continuation:
    # only after a successfully parsed ND/HND row.
    if last_record:
        append_continuation(last_record, line)

# -----------------------------
# Cleanup
# -----------------------------

for r in records:
    # Fix common whitespace/punctuation extraction artefacts only.
    r["programme_name"] = clean_space(
        r["programme_name"]
        .replace("’", "'")
        .replace("`", "'")
    )

# Exact duplicate records can occur from weird PDF extraction.
dedup = {}
duplicates = []

for r in records:
    key = (
        r["institution_name"].lower(),
        r["award_type"],
        r["programme_name"].lower(),
        r["accreditation_status"],
        r["expiration_date"]
    )

    if key in dedup:
        duplicates.append({
            "first": dedup[key]["source_line"],
            "duplicate": r["source_line"],
            "institution": r["institution_name"],
            "programme": r["programme_name"]
        })
        continue

    dedup[key] = r

records = list(dedup.values())

# -----------------------------
# Audit
# -----------------------------

status_counts = Counter(
    r["accreditation_status"]
    for r in records
)

award_counts = Counter(
    r["award_type"]
    for r in records
)

institution_counts = Counter(
    r["institution_name"]
    for r in records
)

missing_expiry = [
    r for r in records
    if not r["expiration_date"]
]

missing_category = [
    r for r in records
    if not r["category"]
]

audit = {
    "source": str(SOURCE_TXT),
    "source_url": SOURCE_URL,
    "institution_headers_detected": len(institution_headers),
    "institutions_with_nd_hnd_records": len(institution_counts),
    "records": len(records),
    "award_counts": dict(award_counts),
    "status_counts": dict(status_counts),
    "missing_expiration_date": len(missing_expiry),
    "missing_category": len(missing_category),
    "exact_duplicates_removed": len(duplicates),
    "candidate_nd_hnd_lines": len(candidate_programme_lines),
    "unparsed_nd_hnd_lines": len(unparsed_programme_lines),
    "duplicates": duplicates[:100],
    "unparsed_examples": unparsed_programme_lines[:100],
}

OUT_JSON.write_text(
    json.dumps(
        {
            "source_url": SOURCE_URL,
            "edition": "25th Edition 2025",
            "regulator": "NBTE",
            "records": records
        },
        indent=2,
        ensure_ascii=False
    ),
    encoding="utf-8"
)

AUDIT_JSON.write_text(
    json.dumps(
        audit,
        indent=2,
        ensure_ascii=False
    ),
    encoding="utf-8"
)

print("\n=== NBTE 2025 PROGRAMME PARSER ===")
print("Institution headers detected:", len(institution_headers))
print("Institutions with ND/HND:", len(institution_counts))
print("ND/HND records:", len(records))
print("Awards:", dict(award_counts))
print("Statuses:", dict(status_counts))
print("Missing expiration:", len(missing_expiry))
print("Missing category:", len(missing_category))
print("Exact duplicates removed:", len(duplicates))
print("Candidate ND/HND lines:", len(candidate_programme_lines))
print("Unparsed ND/HND lines:", len(unparsed_programme_lines))

print("\nTop institutions by programme count:")

for name, count in institution_counts.most_common(20):
    print(f"{count:4}  {name}")

print("\nOutput:", OUT_JSON)
print("Audit:", AUDIT_JSON)
