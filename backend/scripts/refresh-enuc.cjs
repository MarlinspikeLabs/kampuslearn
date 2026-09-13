'use strict';

const fs = require('node:fs');
const path = require('node:path');

const OUT = path.resolve(
  __dirname,
  '../data/academic-reference/enuc-current.json'
);

const URL = 'https://enuc.nuc.edu.ng/nus';

const norm = s => String(s || '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function slug(s) {
  return norm(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

(async () => {
  const res = await fetch(URL, {
    headers: {
      'User-Agent': 'KampusLearn academic reference updater'
    }
  });

  if (!res.ok) {
    throw new Error(`eNUC returned HTTP ${res.status}`);
  }

  const html = await res.text();

  const rows = [];

  // eNUC currently renders its university table in the returned HTML.
  // Capture table rows, then strip tags from individual cells.
  const trPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdPattern = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;

  let tr;

  while ((tr = trPattern.exec(html))) {
    const cells = [];
    let td;

    while ((td = tdPattern.exec(tr[1]))) {
      const text = norm(
        td[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&#39;/g, "'")
          .replace(/&#x27;/gi, "'")
          .replace(/&quot;/g, '"')
          .replace(/&nbsp;/g, ' ')
          .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
          .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      );

      cells.push(text);
    }

    // Expected:
    // index, university name, year, ownership, state, action
    if (
      cells.length >= 5 &&
      /^\d+$/.test(cells[0]) &&
      cells[1] &&
      /^\d{4}$/.test(cells[2]) &&
      /^(Federal|State|Private)$/i.test(cells[3]) &&
      cells[4]
    ) {
      rows.push({
        source_key: `enuc:${cells[0]}`,
        name: cells[1],
        year_established: Number(cells[2]),
        ownership: cells[3].toLowerCase(),
        state: cells[4],
        type: 'university',
        source_url: URL,
        checked_at: new Date().toISOString().slice(0, 10),
        aliases: [],
        short_name: null,
        city: null,
        website_url: null,
        stable_key: slug(cells[1])
      });
    }
  }

  if (rows.length < 300) {
    throw new Error(
      `Parsed only ${rows.length} universities; refusing to write incomplete reference data`
    );
  }

  const counts = {};

  for (const x of rows) {
    counts[x.ownership] = (counts[x.ownership] || 0) + 1;
  }

  const output = {
    schema_version: 2,
    source: 'NUC eNUC',
    source_url: URL,
    checked_at: new Date().toISOString().slice(0, 10),
    counts,
    universities: rows
  };

  fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n');

  console.log('Written:', OUT);
  console.log('Total:', rows.length);
  console.table(
    Object.entries(counts).map(([ownership, count]) => ({
      ownership,
      count
    }))
  );
})();
