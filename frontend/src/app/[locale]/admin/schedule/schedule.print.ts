import type { EventRow, ScheduleFightRow, ScheduleSessionRow } from '@/types/api';

/**
 * Builds a self-contained, print-optimised HTML document for the event schedule
 * and opens it in a new window for printing / "Save as PDF".
 *
 * The printed document is intentionally always rendered in GEORGIAN (labels +
 * preferred KA names) because it is an official federation document, regardless
 * of the admin UI locale. It has no external dependencies (no network fonts, no
 * inline scripts) so it prints reliably offline and is not affected by app
 * theming / dark mode.
 */

type PrintSession = {
  session: ScheduleSessionRow;
  fights: ScheduleFightRow[];
};

const GE = {
  documentTitle: 'მატჩების განრიგი',
  session: 'სესია',
  fightsCount: 'ბრძოლა',
  colNo: '№',
  colTime: 'დრო',
  colRed: 'წითელი კუთხე',
  colBlue: 'ლურჯი კუთხე',
  colRound: 'რაუნდი',
  colMat: 'მატი',
  colResult: 'შედეგი',
  noFights: 'ამ სესიაში ბრძოლები არ არის',
  generatedAt: 'გენერირებულია',
  timeApprox: 'დროები მითითებულია სავარაუდოდ',
  tbd: 'TBD',
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Prefer the Georgian variant, fall back to the base (English) value. */
function pickKa(base: string, ka?: string | null): string {
  const trimmed = ka?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : base;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatHm(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatGeoDate(iso: string): string {
  const d = new Date(iso);
  try {
    return d.toLocaleDateString('ka-GE', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return d.toLocaleDateString();
  }
}

function formatDateRange(startIso: string, endIso?: string | null): string {
  const start = formatGeoDate(startIso);
  if (!endIso) return start;
  const end = formatGeoDate(endIso);
  return start === end ? start : `${start} – ${end}`;
}

/** Evenly distribute fight start times across the session window (approximate). */
function fightStartTime(session: ScheduleSessionRow, index: number, total: number): Date {
  const start = new Date(session.startTime).getTime();
  const end = new Date(session.endTime).getTime();
  const span = Math.max(0, end - start);
  const slot = total > 0 ? span / total : 0;
  return new Date(start + slot * index);
}

function buildSessionRows(item: PrintSession, anyMat: boolean): string {
  const { session, fights } = item;
  const colSpan = anyMat ? 6 : 5;

  if (fights.length === 0) {
    return `<tr><td class="empty" colspan="${colSpan}">${GE.noFights}</td></tr>`;
  }

  return fights
    .map((fight, idx) => {
      const time = formatHm(fightStartTime(session, idx, fights.length));
      const red = escapeHtml(pickKa(fight.redDisplayName, fight.redDisplayNameKa) || GE.tbd);
      const blue = escapeHtml(pickKa(fight.blueDisplayName, fight.blueDisplayNameKa) || GE.tbd);
      const round = escapeHtml(`${fight.bracketRoundLabel} · #${fight.bracketFightNumber}`);
      const mat = anyMat ? `<td class="mat">${fight.matName ? escapeHtml(fight.matName) : '—'}</td>` : '';
      return `
        <tr>
          <td class="no">${idx + 1}</td>
          <td class="time">${time}</td>
          <td class="corner red"><span class="dot"></span>${red}</td>
          <td class="corner blue"><span class="dot"></span>${blue}</td>
          <td class="round">${round}</td>
          ${mat}
        </tr>`;
    })
    .join('');
}

function buildSessionBlock(item: PrintSession, anyMat: boolean): string {
  const { session, fights } = item;
  const range = `${formatHm(new Date(session.startTime))} – ${formatHm(new Date(session.endTime))}`;
  const matHeader = anyMat ? `<th class="mat">${GE.colMat}</th>` : '';
  return `
    <section class="session">
      <div class="session-head">
        <div class="session-title">${escapeHtml(session.name)}</div>
        <div class="session-meta">
          <span class="session-time">${range}</span>
          <span class="session-count">${fights.length} ${GE.fightsCount}</span>
        </div>
      </div>
      <table class="fights">
        <thead>
          <tr>
            <th class="no">${GE.colNo}</th>
            <th class="time">${GE.colTime}</th>
            <th class="corner">${GE.colRed}</th>
            <th class="corner">${GE.colBlue}</th>
            <th class="round">${GE.colRound}</th>
            ${matHeader}
          </tr>
        </thead>
        <tbody>
          ${buildSessionRows(item, anyMat)}
        </tbody>
      </table>
    </section>`;
}

function buildSchedulePrintHtml(event: EventRow | null, items: PrintSession[]): string {
  const anyMat = items.some((it) => it.fights.some((f) => !!f.matName));

  const eventName = event ? escapeHtml(pickKa(event.name, event.nameKa)) : '';
  const metaParts: string[] = [];
  if (event?.location) metaParts.push(escapeHtml(event.location));
  if (event) metaParts.push(escapeHtml(formatDateRange(event.competitionStartDate, event.competitionEndDate)));
  const metaLine = metaParts.join(' · ');

  const generated = formatGeoDate(new Date().toISOString());
  const sessionsHtml = items.map((it) => buildSessionBlock(it, anyMat)).join('\n');

  return `<!DOCTYPE html>
<html lang="ka">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${eventName ? `${eventName} — ` : ''}${GE.documentTitle}</title>
<style>
  @page {
    size: A4;
    margin: 14mm;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    color: #1a1a1a;
    font-family: -apple-system, "BPG Nino Mtavruli", "Noto Sans Georgian", "Helvetica Neue", Arial, "Segoe UI", sans-serif;
    font-size: 11px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc-head {
    border-bottom: 2px solid #111;
    padding-bottom: 10px;
    margin-bottom: 18px;
  }
  .doc-subtitle {
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #6b7280;
    margin: 0 0 4px;
  }
  .doc-title {
    font-size: 22px;
    font-weight: 700;
    margin: 0 0 4px;
    line-height: 1.2;
  }
  .doc-meta {
    font-size: 12px;
    color: #374151;
    margin: 0;
  }
  .session {
    margin-bottom: 18px;
    page-break-inside: auto;
  }
  .session + .session { page-break-before: always; }
  .session-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    background: #f3f4f6;
    border-left: 4px solid #111;
    padding: 7px 12px;
    margin-bottom: 8px;
  }
  .session-title { font-size: 15px; font-weight: 700; }
  .session-meta { display: flex; gap: 14px; align-items: baseline; }
  .session-time { font-size: 13px; font-weight: 600; color: #111; }
  .session-count {
    font-size: 11px;
    color: #4b5563;
    background: #fff;
    border: 1px solid #d1d5db;
    border-radius: 999px;
    padding: 1px 9px;
  }
  table.fights {
    width: 100%;
    border-collapse: collapse;
  }
  table.fights thead { display: table-header-group; }
  table.fights th {
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
    border-bottom: 1.5px solid #9ca3af;
    padding: 6px 8px;
    font-weight: 600;
  }
  table.fights td {
    padding: 6px 8px;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: middle;
  }
  table.fights tbody tr:nth-child(even) { background: #fafafa; }
  table.fights tr { page-break-inside: avoid; }
  td.no, th.no { width: 30px; text-align: center; color: #6b7280; font-weight: 700; }
  td.time, th.time { width: 52px; font-weight: 600; white-space: nowrap; }
  td.corner { font-weight: 600; }
  td.corner .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 7px;
    vertical-align: middle;
  }
  td.corner.red .dot { background: #c0392b; }
  td.corner.blue .dot { background: #1f6feb; }
  td.round, th.round { color: #4b5563; white-space: nowrap; }
  td.mat, th.mat { width: 64px; white-space: nowrap; }
  td.empty {
    text-align: center;
    color: #9ca3af;
    font-style: italic;
    padding: 16px 8px;
  }
  .doc-foot {
    margin-top: 22px;
    padding-top: 8px;
    border-top: 1px solid #d1d5db;
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #9ca3af;
  }
</style>
</head>
<body>
  <header class="doc-head">
    <p class="doc-subtitle">${GE.documentTitle}</p>
    ${eventName ? `<h1 class="doc-title">${eventName}</h1>` : ''}
    ${metaLine ? `<p class="doc-meta">${metaLine}</p>` : ''}
  </header>

  ${sessionsHtml}

  <footer class="doc-foot">
    <span>${GE.timeApprox}</span>
    <span>${GE.generatedAt}: ${generated}</span>
  </footer>
</body>
</html>`;
}

/**
 * Opens the print document in a new window and triggers the browser print
 * dialog. Returns false if the popup was blocked.
 */
export function openSchedulePrint(event: EventRow | null, items: PrintSession[]): boolean {
  const html = buildSchedulePrintHtml(event, items);
  const win = window.open('', '_blank');
  if (!win) return false;

  win.document.open();
  win.document.write(html);
  win.document.close();

  const triggerPrint = () => {
    win.focus();
    win.print();
  };

  if (win.document.readyState === 'complete') {
    setTimeout(triggerPrint, 150);
  } else {
    win.addEventListener('load', () => setTimeout(triggerPrint, 150));
  }

  return true;
}
