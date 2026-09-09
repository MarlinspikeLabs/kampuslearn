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
| Proposed new institutions against the snapshot | 7 |
| Existing institutions receiving blank-field updates | 71 |
| Institution entries held for review | 453 |
| Proposed new faculties/schools | 9 |
| Proposed new departments | 76 |
| Existing individual courses preserved | 67 |
| New individual course modules inserted | 0 |

Counts are from the original offline snapshot, now applying required short_name/state/city fields and their 20/60/80 character limits. These supersede the previous 395-addition preview. The live dry run reads the actual schema and current records, so live counts may differ. The earlier live 78-addition preview is also superseded until rerun with this correction. The 80 original institution rows, 11 faculties, 6 schools, 32 departments and 67 courses remain intact.

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
- Generated REF institution labels have been removed. Only seven short labels have been verified in this correction; all others are null in the reference. Unknown required labels block new institution inserts. Existing database labels are never overwritten. R-prefixed faculty/department codes remain local identifiers, not official codes; this correction does not alter them.
- National academic structure and course completion remains outstanding. The complete list of missing institutional fields is in each institutions.json entry and in the report's coverage section.

The importer inserts only a reviewed subset and does not modify existing filled-in values. Review snapshot-plan.json for the concrete proposed changes; run the live dry run before applying.

## Verified institution short labels (initial batch only)

| Institution | Short label | Official source |
| --- | --- | --- |
| Federal University Otuoke | FUO | https://ecampus.fuotuoke.edu.ng/ |
| Federal University Oye-Ekiti | FUOYE | https://ecampus.fuoye.edu.ng/ |
| Federal University Wukari | FUWUKARI | https://fuwukari.edu.ng/postgraduate/ |
| National Open University of Nigeria | NOUN | https://nou.edu.ng/ |
| Imo State University | IMSU | https://www.imsu.edu.ng/ |
| Miva Open University | Miva | https://miva.edu.ng/ |
| Kwara State Polytechnic | KWARAPOLY | https://portal.kwarastatepolytechnic.edu.ng/ |

Verified on 9 September 2026. FUO is the abbreviation used by Otuoke's official campus portal; no automatic initials are derived from institution names. Miva is the institution's published short brand. Source URLs and verification dates are recorded per entry. Verification is not complete for the remaining institutions.

New dry-run holds include `missing_fields` and `invalid_fields` when field validation fails. Identity/duplicate holds take priority. An existing record can still receive a verified blank city/state/website update even if the reference lacks a short label, because its existing database label is preserved. The database schema is not relaxed and placeholder cities are not inserted.
