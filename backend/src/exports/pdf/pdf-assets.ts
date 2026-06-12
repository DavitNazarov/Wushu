import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// ── Federation logo ──────────────────────────────────────────────────────────
// The three reference PDFs all carry the federation emblem in the header. We
// inline it as a data: URI so the render needs no network. Drop the asset at
// frontend/public/federation-logo.png (it ships in the Docker image — the
// Dockerfile copies frontend/public) or point PDF_LOGO_PATH at any file.
//
// Resolution is best-effort across the dev (cwd = backend/) and prod
// (cwd = repo root) working directories. Returns null when no file is found,
// in which case templates render an empty logo slot.

const LOGO_CANDIDATES = [
  process.env.PDF_LOGO_PATH,
  join(process.cwd(), 'frontend/public/federation-logo.png'),
  join(process.cwd(), '../frontend/public/federation-logo.png'),
  join(process.cwd(), 'frontend/public/federation-logo.svg'),
  join(process.cwd(), '../frontend/public/federation-logo.svg'),
  join(process.cwd(), 'public/federation-logo.png'),
].filter((p): p is string => Boolean(p));

let cachedLogo: string | null | undefined;

export function loadLogoDataUri(): string | null {
  if (cachedLogo !== undefined) return cachedLogo;
  for (const path of LOGO_CANDIDATES) {
    try {
      if (!existsSync(path)) continue;
      const buf = readFileSync(path);
      const mime = path.toLowerCase().endsWith('.svg')
        ? 'image/svg+xml'
        : path.toLowerCase().endsWith('.jpg') ||
            path.toLowerCase().endsWith('.jpeg')
          ? 'image/jpeg'
          : 'image/png';
      cachedLogo = `data:${mime};base64,${buf.toString('base64')}`;
      return cachedLogo;
    } catch {
      // try next candidate
    }
  }
  cachedLogo = null;
  return cachedLogo;
}

// ── Country code mapping ─────────────────────────────────────────────────────
// Clubs store an ISO 3166-1 alpha-2 country code (e.g. "GE"). The reference
// shows a full name in tables (Georgia) and a short 3-letter tag in bracket
// cells (Geo). We map the common federations and fall back to the raw code.

type CountryEntry = { name: string; short: string };

const COUNTRY_MAP: Record<string, CountryEntry> = {
  GE: { name: 'Georgia', short: 'Geo' },
  AM: { name: 'Armenia', short: 'Arm' },
  AZ: { name: 'Azerbaijan', short: 'Aze' },
  TR: { name: 'Türkiye', short: 'Tur' },
  RU: { name: 'Russia', short: 'Rus' },
  UA: { name: 'Ukraine', short: 'Ukr' },
  UZ: { name: 'Uzbekistan', short: 'Uzb' },
  KZ: { name: 'Kazakhstan', short: 'Kaz' },
  KG: { name: 'Kyrgyzstan', short: 'Kgz' },
  TJ: { name: 'Tajikistan', short: 'Tjk' },
  TM: { name: 'Turkmenistan', short: 'Tkm' },
  IN: { name: 'India', short: 'Ind' },
  IR: { name: 'Iran', short: 'Irn' },
  CN: { name: 'China', short: 'Chn' },
  BY: { name: 'Belarus', short: 'Blr' },
  GR: { name: 'Greece', short: 'Gre' },
  BG: { name: 'Bulgaria', short: 'Bul' },
  RO: { name: 'Romania', short: 'Rou' },
  PL: { name: 'Poland', short: 'Pol' },
  DE: { name: 'Germany', short: 'Ger' },
  FR: { name: 'France', short: 'Fra' },
  IT: { name: 'Italy', short: 'Ita' },
  US: { name: 'United States', short: 'Usa' },
};

export function countryShort(code: string | null | undefined): string {
  if (!code) return '';
  const trimmed = code.trim();
  const upper = trimmed.toUpperCase();
  if (COUNTRY_MAP[upper]) return COUNTRY_MAP[upper].short;
  // Fall back to a capitalised 3-letter slice of the raw code.
  const base = trimmed.length >= 3 ? trimmed.slice(0, 3) : trimmed;
  return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
}

// ── Generic formatting helpers ───────────────────────────────────────────────

// Escape user/DB text for safe interpolation into the HTML templates.
export function escapeHtml(value: string | null | undefined): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// "24/04/2014" — day/month/year, matching the reference date-of-birth column.
export function formatDob(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Compact weight like "29.7" -> "29,7" (comma decimal, matching the reference).
export function formatWeight(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '';
  return String(Math.round(value * 100) / 100).replace('.', ',');
}

// "August 1 - 6, 2025" / "August 1, 2025 - September 2, 2025".
export function formatDateRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): string {
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  if (s && Number.isNaN(s.getTime())) return '';
  if (!s) return '';
  const month = (d: Date) =>
    d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const sMonth = month(s);
  const sDay = s.getUTCDate();
  const sYear = s.getUTCFullYear();
  if (!e || Number.isNaN(e.getTime())) {
    return `${sMonth} ${sDay}, ${sYear}`;
  }
  const eMonth = month(e);
  const eDay = e.getUTCDate();
  const eYear = e.getUTCFullYear();
  if (sYear === eYear && sMonth === eMonth) {
    return `${sMonth} ${sDay} - ${eDay}, ${sYear}`;
  }
  if (sYear === eYear) {
    return `${sMonth} ${sDay} - ${eMonth} ${eDay}, ${sYear}`;
  }
  return `${sMonth} ${sDay}, ${sYear} - ${eMonth} ${eDay}, ${eYear}`;
}

// Today's date as "DD.MM.YY" for the generated-on footer.
export function formatGeneratedStamp(now: Date = new Date()): string {
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}
