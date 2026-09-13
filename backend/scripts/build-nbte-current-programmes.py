#!/usr/bin/env python3

import json
import re
from pathlib import Path
from collections import defaultdict, Counter
from datetime import date

BASE = Path(
    "backend/data/academic-reference/nbte-programmes"
)

SRC = BASE / "nbte-2025-polytechnic-programmes-v5.json"
SRC_AUDIT = BASE / "nbte-2025-polytechnic-programmes-v5-audit.json"

OUT = BASE / "nbte-2025-polytechnic-programmes-current.json"
AUDIT = BASE / "nbte-2025-polytechnic-programmes-current-audit.json"

SNAPSHOT_DATE = date(2026, 9, 12)

STATUS_RANK = {
    "accredited": 3,
    "interim": 2,
    "expired": 1
}

def clean(s):
    return re.sub(
        r"\s+",
        " ",
        str(s or "")
    ).strip()

def norm(s):
    s = clean(s).lower()
    s = s.replace("&", " and ")
    s = re.sub(
        r"[^a-z0-9]+",
        " ",
        s
    )
    return re.sub(
        r"\s+",
        " ",
        s
    ).strip()

def parse_date(s):
    if not s:
        return date.min

    try:
        y,m,d = map(
            int,
            s.split("-")
        )
        return date(y,m,d)

    except Exception:
        return date.min

main = json.loads(
    SRC.read_text(
        encoding="utf-8"
    )
)

raw_audit = json.loads(
    SRC_AUDIT.read_text(
        encoding="utf-8"
    )
)

# ------------------------------------------------
# Reconstruct full raw candidate set
# ------------------------------------------------

candidates = list(
    main["records"]
)

for group in raw_audit.get(
    "duplicate_programme_keys",
    []
):
    dup = group.get("duplicate")

    if dup:
        candidates.append(dup)

print(
    "Main V4 records:",
    len(main["records"])
)

print(
    "Recovered duplicate rows:",
    len(candidates) - len(main["records"])
)

print(
    "Total reconstructed candidates:",
    len(candidates)
)

# ------------------------------------------------
# Group by institution + award + normalized name
# ------------------------------------------------

groups = defaultdict(list)

for r in candidates:
    key = (
        r["institution_id"],
        r["award_type"],
        norm(
            r["programme_name"]
        )
    )

    groups[key].append(r)

selected = []
resolved = []

for key, rows in groups.items():

    if len(rows) == 1:
        winner = dict(rows[0])

    else:
        ordered = sorted(
            rows,
            key=lambda r: (
                parse_date(
                    r.get(
                        "expiration_date"
                    )
                ),
                STATUS_RANK.get(
                    r.get(
                        "accreditation_status"
                    ),
                    0
                ),
                -int(
                    r.get(
                        "source_line",
                        0
                    )
                )
            ),
            reverse=True
        )

        winner = dict(
            ordered[0]
        )

        resolved.append({
            "institution_id":
                winner["institution_id"],

            "institution_name":
                winner["institution_name"],

            "award_type":
                winner["award_type"],

            "programme_name":
                winner["programme_name"],

            "selected": {
                "status":
                    winner[
                        "accreditation_status"
                    ],

                "expiration_date":
                    winner[
                        "expiration_date"
                    ],

                "source_line":
                    winner[
                        "source_line"
                    ]
            },

            "discarded": [
                {
                    "status":
                        x[
                            "accreditation_status"
                        ],

                    "expiration_date":
                        x[
                            "expiration_date"
                        ],

                    "source_line":
                        x[
                            "source_line"
                        ]
                }
                for x in ordered[1:]
            ]
        })

    expiry = parse_date(
        winner.get(
            "expiration_date"
        )
    )

    winner[
        "source_accreditation_status"
    ] = winner[
        "accreditation_status"
    ]

    winner[
        "is_active_as_of_2026_09_12"
    ] = (
        winner[
            "accreditation_status"
        ]
        in (
            "accredited",
            "interim"
        )
        and expiry >= SNAPSHOT_DATE
    )

    selected.append(
        winner
    )

selected.sort(
    key=lambda r: (
        r[
            "institution_name"
        ].lower(),

        r[
            "award_type"
        ],

        r[
            "programme_name"
        ].lower()
    )
)

# ------------------------------------------------
# Verify uniqueness
# ------------------------------------------------

seen = set()
duplicates_remaining = []

for r in selected:
    key = (
        r["institution_id"],
        r["award_type"],
        norm(
            r["programme_name"]
        )
    )

    if key in seen:
        duplicates_remaining.append(
            r
        )

    seen.add(key)

# ------------------------------------------------
# Stats
# ------------------------------------------------

award_counts = Counter(
    r["award_type"]
    for r in selected
)

status_counts = Counter(
    r[
        "accreditation_status"
    ]
    for r in selected
)

active_counts = Counter(
    r[
        "is_active_as_of_2026_09_12"
    ]
    for r in selected
)

institutions = {
    r["institution_id"]
    for r in selected
}

# ------------------------------------------------
# Write
# ------------------------------------------------

OUT.write_text(
    json.dumps(
        {
            "source":
                str(SRC),

            "snapshot_date":
                SNAPSHOT_DATE.isoformat(),

            "duplicate_resolution_rule":
                (
                    "latest expiration_date; "
                    "then Accredited > Interim > Expired"
                ),

            "records":
                selected
        },
        indent=2,
        ensure_ascii=False
    ),
    encoding="utf-8"
)

AUDIT.write_text(
    json.dumps(
        {
            "v4_main_records":
                len(main["records"]),

            "recovered_duplicate_rows":
                len(candidates)
                - len(main["records"]),

            "reconstructed_candidates":
                len(candidates),

            "current_snapshot_records":
                len(selected),

            "duplicate_groups_resolved":
                len(resolved),

            "award_counts":
                dict(award_counts),

            "status_counts":
                dict(status_counts),

            "active_as_of_snapshot":
                {
                    str(k).lower():v
                    for k,v
                    in active_counts.items()
                },

            "institutions_with_programmes":
                len(institutions),

            "duplicates_remaining":
                len(
                    duplicates_remaining
                ),

            "resolved":
                resolved
        },
        indent=2,
        ensure_ascii=False
    ),
    encoding="utf-8"
)

print(
    "\n=== NBTE CURRENT SNAPSHOT V2 ==="
)

print(
    "V5 main records:",
    len(main["records"])
)

print(
    "Recovered duplicate rows:",
    len(candidates)
    - len(main["records"])
)

print(
    "Reconstructed candidates:",
    len(candidates)
)

print(
    "Current snapshot:",
    len(selected)
)

print(
    "Duplicate groups resolved:",
    len(resolved)
)

print(
    "Awards:",
    dict(award_counts)
)

print(
    "Statuses:",
    dict(status_counts)
)

print(
    "Active:",
    dict(active_counts)
)

print(
    "Institutions with programmes:",
    len(institutions)
)

print(
    "Duplicates remaining:",
    len(
        duplicates_remaining
    )
)

print("\nOutput:",OUT)
print("Audit:",AUDIT)
