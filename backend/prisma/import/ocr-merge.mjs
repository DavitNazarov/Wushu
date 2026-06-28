// Merge OCR'd IDs into id-extracted.json and print the next batch to process.
// Usage: node ocr-merge.mjs '{"0":"29950000141","3":"60250018288"}'
import { readFileSync, writeFileSync } from 'node:fs';
const work = JSON.parse(readFileSync('id-worklist.json', 'utf8'));
const byIndex = new Map(work.map((w) => [w.i, w]));
const extracted = JSON.parse(readFileSync('id-extracted.json', 'utf8'));

const pairs = JSON.parse(process.argv[2] || '{}');
for (const [idx, id] of Object.entries(pairs)) {
  const w = byIndex.get(Number(idx));
  if (!w) { console.log('!! no worklist index', idx); continue; }
  extracted[w.gid] = { id: String(id), country: w.country, name: w.name };
}
writeFileSync('id-extracted.json', JSON.stringify(extracted, null, 2));

const doneGids = new Set(Object.keys(extracted));
const remaining = work.filter((w) => !doneGids.has(w.gid));
console.log(`extracted so far: ${doneGids.size}/${work.length}  | remaining: ${remaining.length}`);
const BATCH = 12;
console.log(`=== NEXT BATCH (${Math.min(BATCH, remaining.length)}) ===`);
for (const w of remaining.slice(0, BATCH)) console.log(`${w.i}\t${w.country}\t${w.fileId}\t${w.name}`);
