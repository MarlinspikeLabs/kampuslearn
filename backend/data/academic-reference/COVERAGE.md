# Academic reference coverage — 9 September 2026

This is a sourced, partial enrichment release. Nationwide faculty, department and individual course-module coverage is not complete. Do not market this dataset as an exhaustive current catalogue.

| Measure | Count |
| --- | ---: |
| Regulator directory entries | 536 |
| Universities (NUC federal, state, private) | 328 |
| Polytechnics (NBTE) | 208 |
| Entries with a sourced state | 446 |
| Entries with an explicitly identified city | 144 |
| Entries with a listed website | 289 |
| Proposed new institutions against the snapshot | 395 |
| Existing institutions receiving blank-field updates | 71 |
| Institution entries held for review | 63 |
| Proposed new faculties/schools | 9 |
| Proposed new departments | 76 |
| Existing individual courses preserved | 67 |
| New individual course modules inserted | 0 |

Counts are from the offline snapshot. The live dry run also checks database nullability, so it may hold additional records. The 80 original institution rows, 11 faculties, 6 schools, 32 departments and 67 courses remain intact.

## Source directories

- [NUC federal universities](https://www.nuc.edu.ng/nigerian-univerisities/federal-univeristies/)
- [NUC state universities](https://www.nuc.edu.ng/nigerian-univerisities/state-univerisity/)
- [NUC private universities](https://www.nuc.edu.ng/nigerian-univerisities/private-univeristies/)
- [NBTE polytechnics](https://www.digitalnbte.nbte.gov.ng/Public/PUCPolytechnics) — public All Polytechnics lookup, with individual detail links stored per record.

Website values are addresses listed by the regulator, not a claim that each domain has been independently tested. State/city extraction uses explicit regulator names/addresses; it does not substitute LGA for city. Missing fields remain absent. Regulator records can themselves contain outdated names and locations; existing nonempty fields are not replaced.

## Structures

The reference contains 23 UNIMAID/Ramat faculty/school groups and 128 department names sourced from the institution pages linked in structures.json. Some match existing records; others are held because similarly named departments already belong elsewhere. No automatic relocation is performed. Current institution course handbooks are still needed for module codes, level, semester and credit units. An accredited degree programme is not treated as an individual course module.

Institution entries without a faculty/school and department are not yet ready for complete student registration. The import does not bypass registration requirements.

## Items requiring review

- Hallmark University and Eko University each have duplicate existing institution IDs. The importer does not select one arbitrarily or delete either.
- The MAPOLY record carries the short name MAUSTECH. NUC separately lists a Moshood Abiola university. Their identities/types are held for reconciliation rather than conflated.
- Borno State University is identified by NUC under its newer Kashim Ibrahim name. Existing BOSU names and IDs are preserved. The KIU page contains explicitly labelled sample programmes; those samples are not imported as departments or modules.
- Existing UNIMAID Science/Medicine and Ramat school groupings differ from some official pages. The detailed structure holds are listed in snapshot-plan.json.
- Generated REF institution labels and R-prefixed faculty/department codes are local identifiers, not verified official abbreviations. They can be edited after verification.
- National academic structure and course completion remains outstanding. The complete list of missing institutional fields is in each institutions.json entry and in the report's coverage section.

The importer inserts only a reviewed subset and does not modify existing filled-in values. Review snapshot-plan.json for the concrete proposed changes; run the live dry run before applying.
