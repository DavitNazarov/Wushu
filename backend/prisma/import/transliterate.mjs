// Georgian <-> Latin transliteration (best-effort, for display names only).
// Georgian national romanization (2002) for ka->en; phonetic approximation for en->ka.
// Used to fill the missing side of a bilingual name when the source workbook
// only provided one script. Imperfect by nature (Georgian collapses several
// Latin letters), but acceptable for historical registry display.

const KA_TO_LAT = {
  ა: 'a', ბ: 'b', გ: 'g', დ: 'd', ე: 'e', ვ: 'v', ზ: 'z', თ: 't',
  ი: 'i', კ: 'k', ლ: 'l', მ: 'm', ნ: 'n', ო: 'o', პ: 'p', ჟ: 'zh',
  რ: 'r', ს: 's', ტ: 't', უ: 'u', ფ: 'p', ქ: 'k', ღ: 'gh', ყ: 'q',
  შ: 'sh', ჩ: 'ch', ც: 'ts', ძ: 'dz', წ: 'ts', ჭ: 'ch', ხ: 'kh', ჯ: 'j', ჰ: 'h',
};

// Multi-char Latin digraphs first, then single letters.
const LAT_DIGRAPHS = [
  ['zh', 'ჟ'], ['gh', 'ღ'], ['sh', 'შ'], ['ch', 'ჩ'], ['ts', 'ც'],
  ['dz', 'ძ'], ['kh', 'ხ'], ['ph', 'ფ'], ['th', 'თ'], ['ya', 'ია'],
  ['yu', 'იუ'], ['kv', 'კვ'],
];
const LAT_SINGLE = {
  a: 'ა', b: 'ბ', c: 'კ', d: 'დ', e: 'ე', f: 'ფ', g: 'გ', h: 'ჰ',
  i: 'ი', j: 'ჯ', k: 'კ', l: 'ლ', m: 'მ', n: 'ნ', o: 'ო', p: 'პ',
  q: 'ყ', r: 'რ', s: 'ს', t: 'ტ', u: 'უ', v: 'ვ', w: 'ვ', x: 'ხ',
  y: 'ი', z: 'ზ',
};

export function isGeorgian(str) {
  return /[Ⴀ-ჿ]/.test(str || '');
}

export function isLatin(str) {
  return /[A-Za-z]/.test(str || '') && !isGeorgian(str);
}

// Title-case a token: first letter upper, rest lower (handles Latin only).
function titleCase(token) {
  if (!token) return token;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

export function kaToLatin(input) {
  if (!input) return input;
  let out = '';
  for (const ch of input) {
    out += KA_TO_LAT[ch] ?? ch;
  }
  // Title-case each whitespace-separated token.
  return out
    .split(/(\s+)/)
    .map((t) => (/\s+/.test(t) ? t : titleCase(t)))
    .join('')
    .trim();
}

export function latinToKa(input) {
  if (!input) return input;
  const lower = input.toLowerCase();
  let out = '';
  let i = 0;
  while (i < lower.length) {
    let matched = false;
    for (const [lat, ka] of LAT_DIGRAPHS) {
      if (lower.startsWith(lat, i)) {
        out += ka;
        i += lat.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const ch = lower[i];
    out += LAT_SINGLE[ch] ?? (/\s/.test(ch) ? ch : ch);
    i += 1;
  }
  return out.trim();
}

// Split a full name into { first, last }. First whitespace token = first name,
// remainder = last name. Single-token names get an empty last name (flagged
// upstream). Georgian names are kept as-is; Latin names title-cased.
export function splitName(full, { latin } = {}) {
  const clean = (full || '').replace(/\s+/g, ' ').trim();
  if (!clean) return { first: '', last: '' };
  const parts = clean.split(' ');
  const norm = (t) => (latin ? titleCase(t) : t);
  if (parts.length === 1) return { first: norm(parts[0]), last: '' };
  return { first: norm(parts[0]), last: parts.slice(1).map(norm).join(' ') };
}
