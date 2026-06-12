import { escapeHtml, formatGeneratedStamp, loadLogoDataUri } from './pdf-assets';
import { LABELS, type Lang } from './pdf-i18n';
import type {
  ProtocolColumn,
  ProtocolSlot,
  ResultsPdfModel,
  ResultsProtocol,
  SchedulePdfModel,
  WeighinPdfModel,
  WeighinSheet,
} from './pdf-export.types';

// Pure HTML/CSS builders for the three exports. Each returns a full standalone
// document; assets (logo, fonts) are inlined or system so Chromium needs no
// network. Layouts mirror the federation's reference templates.

const FONT_STACK =
  "'Noto Sans Georgian','Noto Sans','DejaVu Sans','Helvetica Neue',Arial,sans-serif";

const RED = '#ff0000';
const BLUE = '#4a86e8';
const TITLE_RED = '#cc0000';
const INFO_BLUE = '#1155cc';

function logoImg(className: string): string {
  const uri = loadLogoDataUri();
  if (!uri) return `<div class="${className} logo-empty"></div>`;
  return `<img class="${className}" src="${uri}" alt="logo" />`;
}

function baseStyles(page: string): string {
  return `
    * { box-sizing: border-box; }
    @page { ${page} }
    html, body { margin: 0; padding: 0; }
    body { font-family: ${FONT_STACK}; color: #111; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .event-name { font-weight: 700; color: ${TITLE_RED}; }
    .logo-empty { background: transparent; }
    table { border-collapse: collapse; width: 100%; }
  `;
}

function htmlDoc(pageCss: string, extraCss: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseStyles(pageCss)}${extraCss}</style>
</head>
<body>${body}</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Weigh-in form — portrait, one category sheet per page.
// ─────────────────────────────────────────────────────────────────────────────

const WEIGHIN_MIN_ROWS = 10;

export function renderWeighinHtml(model: WeighinPdfModel, lang: Lang): string {
  const L = LABELS[lang];
  const css = `
    .sheet { page-break-after: always; padding: 0 4mm; }
    .sheet:last-child { page-break-after: auto; }
    .wi-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    .wi-logo { width: 80px; height: 80px; object-fit: contain; flex: 0 0 80px; }
    .wi-title { flex: 1; text-align: center; }
    .wi-title .event-name { font-size: 16px; }
    .wi-sub { display: flex; justify-content: space-around; margin-top: 4px; font-size: 12px; }
    .wi-band { display: flex; border: 1px solid #000; margin: 6px 0; }
    .wi-band > div { flex: 1; text-align: center; padding: 5px; font-weight: 600; }
    .wi-band > div + div { border-left: 1px solid #000; }
    .wi-table th, .wi-table td { border: 1px solid #000; padding: 5px 6px; font-size: 11px; }
    .wi-table th { background: #f1f1f1; font-weight: 600; }
    .wi-table td.c { text-align: center; }
    .wi-table .col-n { width: 6%; }
    .wi-table .col-name { width: 30%; }
    .wi-table .col-country { width: 14%; }
    .wi-table .col-dob { width: 16%; }
    .wi-table .col-pre, .wi-table .col-weight { width: 11%; }
    .wi-table .col-comment { width: 12%; }
    .wi-row-empty td { height: 22px; }
  `;
  const body = model.sheets.length
    ? model.sheets.map((s) => weighinSheet(model, s, lang)).join('')
    : `<div class="sheet"><div class="wi-head">${logoImg('wi-logo')}<div class="wi-title"><div class="event-name">${escapeHtml(model.header.eventName)}</div></div></div><p style="text-align:center;color:#666">${escapeHtml(L.wiEmpty)}</p></div>`;
  return htmlDoc('size: A4 portrait; margin: 10mm;', css, body);
}

function weighinSheet(
  model: WeighinPdfModel,
  sheet: WeighinSheet,
  lang: Lang,
): string {
  const L = LABELS[lang];
  const dataRows = sheet.rows
    .map(
      (r) => `<tr>
      <td class="c">${r.index}</td>
      <td>${escapeHtml(r.name)}</td>
      <td class="c">${escapeHtml(r.country)}</td>
      <td class="c">${escapeHtml(r.dob)}</td>
      <td class="c">${escapeHtml(r.preWeight)}</td>
      <td class="c">${escapeHtml(r.weight)}</td>
      <td class="c">${escapeHtml(r.comment)}</td>
    </tr>`,
    )
    .join('');
  const padCount = Math.max(0, WEIGHIN_MIN_ROWS - sheet.rows.length);
  const emptyRows = Array.from({ length: padCount })
    .map(
      (_, i) =>
        `<tr class="wi-row-empty"><td class="c">${sheet.rows.length + i + 1}</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`,
    )
    .join('');

  return `<section class="sheet">
    <div class="wi-head">
      ${logoImg('wi-logo')}
      <div class="wi-title">
        <div class="event-name">${escapeHtml(model.header.eventName)}</div>
        <div class="wi-sub"><span>${escapeHtml(model.header.location)}</span><span>${escapeHtml(model.header.dateRange)}</span></div>
      </div>
      <div style="flex:0 0 80px"></div>
    </div>
    <div class="wi-band">
      <div>${escapeHtml(sheet.sex)}</div>
      <div>${escapeHtml(sheet.ageGroupName)}</div>
      <div>${escapeHtml(sheet.weightName)}</div>
    </div>
    <table class="wi-table">
      <thead><tr>
        <th class="col-n">${escapeHtml(L.wiN)}</th>
        <th class="col-name">${escapeHtml(L.wiName)}</th>
        <th class="col-country">${escapeHtml(L.wiCountry)}</th>
        <th class="col-dob">${escapeHtml(L.wiDob)}</th>
        <th class="col-pre">${escapeHtml(L.wiPre)}</th>
        <th class="col-weight">${escapeHtml(L.wiWeight)}</th>
        <th class="col-comment">${escapeHtml(L.wiComment)}</th>
      </tr></thead>
      <tbody>${dataRows}${emptyRows}</tbody>
    </table>
  </section>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schedule — landscape, chunked into fixed-height pages with a repeated header.
// ─────────────────────────────────────────────────────────────────────────────

const SCHEDULE_ROWS_PER_PAGE = 13;

export function renderScheduleHtml(model: SchedulePdfModel, lang: Lang): string {
  const css = `
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .sc-top { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
    .sc-startend { display: flex; gap: 22px; font-size: 12px; text-align: center; flex: 0 0 auto; }
    .sc-startend .lbl { font-weight: 600; }
    .sc-logo { width: 70px; height: 70px; object-fit: contain; flex: 0 0 70px; }
    .sc-titles { flex: 1; text-align: center; }
    .sc-titles .event-name { font-size: 15px; }
    .sc-meta { display: flex; justify-content: space-around; align-items: center; margin-top: 4px; font-size: 12px; }
    .sc-meta .disc { font-weight: 700; font-style: italic; }
    .sc-table th, .sc-table td { border: 1px solid #000; padding: 5px 7px; font-size: 11px; }
    .sc-table th { color: #fff; font-weight: 600; text-align: center; }
    .sc-table th.bout, .sc-table td.bout { width: 5%; text-align: center; color: #111; }
    .sc-table th.bout { background: #f1f1f1; color: #111; }
    .sc-table th.country, .sc-table td.country { width: 7%; text-align: center; }
    .sc-table th.coach, .sc-table td.coach { width: 19%; }
    .sc-table th.name { width: 19%; }
    .sc-table th.red, .sc-table td.red-name { background: ${RED}; color: #fff; font-weight: 700; }
    .sc-table th.blue, .sc-table td.blue-name { background: ${BLUE}; color: #fff; font-weight: 700; }
    .sc-table td.empty-red { background: ${RED}; }
    .sc-table td.empty-blue { background: ${BLUE}; }
    .sc-foot { margin-top: 6px; font-size: 10px; color: #444; }
  `;

  const stamp = formatGeneratedStamp();
  const chunks: SchedulePdfModel['bouts'][] = [];
  for (let i = 0; i < model.bouts.length; i += SCHEDULE_ROWS_PER_PAGE) {
    chunks.push(model.bouts.slice(i, i + SCHEDULE_ROWS_PER_PAGE));
  }
  if (chunks.length === 0) chunks.push([]);

  const body = chunks
    .map((chunk) => schedulePage(model, chunk, stamp, lang))
    .join('');
  return htmlDoc('size: A4 landscape; margin: 8mm;', css, body);
}

function schedulePage(
  model: SchedulePdfModel,
  bouts: SchedulePdfModel['bouts'],
  stamp: string,
  lang: Lang,
): string {
  const L = LABELS[lang];
  const rows = bouts
    .map(
      (b) => `<tr>
      <td class="bout">${b.boutNo}</td>
      <td class="${b.red.name ? 'red-name' : 'empty-red'}">${escapeHtml(b.red.name)}</td>
      <td class="country">${escapeHtml(b.red.country)}</td>
      <td class="coach">${escapeHtml(b.red.coach)}</td>
      <td class="${b.blue.name ? 'blue-name' : 'empty-blue'}">${escapeHtml(b.blue.name)}</td>
      <td class="country">${escapeHtml(b.blue.country)}</td>
      <td class="coach">${escapeHtml(b.blue.coach)}</td>
    </tr>`,
    )
    .join('');

  return `<section class="page">
    <div class="sc-top">
      ${logoImg('sc-logo')}
      <div class="sc-titles">
        <div class="event-name">${escapeHtml(model.header.eventName)}</div>
        <div class="sc-meta">
          <span>${escapeHtml(model.header.dateRange)}</span>
          <span class="disc">${escapeHtml(model.discipline ?? '')}</span>
          <span>${escapeHtml(model.header.location)}</span>
        </div>
      </div>
      <div style="flex:0 0 70px"></div>
    </div>
    <table class="sc-table">
      <thead><tr>
        <th class="bout">${escapeHtml(L.scBout)}</th>
        <th class="red name">${escapeHtml(L.scRed)}</th>
        <th class="country">${escapeHtml(L.scCountry)}</th>
        <th class="coach">${escapeHtml(L.scCoach)}</th>
        <th class="blue name">${escapeHtml(L.scBlue)}</th>
        <th class="country">${escapeHtml(L.scCountry)}</th>
        <th class="coach">${escapeHtml(L.scCoach)}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="sc-foot">${stamp}</div>
  </section>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Results protocols — landscape, one weight category per page:
// bracket tree (left) + info header & placement table (right).
// ─────────────────────────────────────────────────────────────────────────────

const PLACEMENT_MIN_ROWS = 4;

export function renderResultsHtml(model: ResultsPdfModel, lang: Lang): string {
  const L = LABELS[lang];
  const css = `
    .protocol { page-break-after: always; height: 100%; }
    .protocol:last-child { page-break-after: auto; }
    .pr-title { text-align: center; }
    .pr-title .event-name { font-size: 14px; }
    .pr-no { text-align: center; font-weight: 600; margin: 2px 0 8px; }
    .pr-no span { display: inline-block; min-width: 30px; }
    .pr-body { display: flex; gap: 10px; }
    .pr-left { flex: 1.45; }
    .pr-right { flex: 1; }
    .pr-info { display: grid; grid-template-columns: auto 1fr 86px; align-items: center; gap: 2px 10px; margin-bottom: 12px; }
    .pr-info .k { font-weight: 700; text-align: center; }
    .pr-info .v { text-align: center; }
    .pr-info .pr-logo { grid-row: 1 / span 4; width: 86px; height: 86px; object-fit: contain; }
    .pr-info .dateplace { display: contents; }
    .pr-info .dp-k { color: ${INFO_BLUE}; }
    .pl-table th, .pl-table td { border: 1px solid #000; padding: 4px 6px; font-size: 10px; }
    .pl-table th { color: ${INFO_BLUE}; font-weight: 600; text-align: center; }
    .pl-table td.c { text-align: center; }
    .pl-empty td { height: 18px; }
    .pr-sign { display: flex; align-items: center; gap: 16px; margin-top: 16px; padding-left: 4px; font-size: 11px; }
    .pr-sign-label { font-weight: 700; }
    .pr-sign-img { height: 46px; max-width: 200px; object-fit: contain; }

    /* Bracket: round columns interleaved with connector columns. */
    .bracket { display: flex; align-items: stretch; min-height: 340px; }
    .round { display: flex; flex-direction: column; flex: 1; min-width: 116px; }
    .conns { display: flex; flex-direction: column; flex: 0 0 16px; }
    .rnd-label { height: 13px; line-height: 13px; text-align: center; font-size: 9px; color: #888; }
    .round-body, .conns-body { flex: 1; display: flex; flex-direction: column; }
    .match { flex: 1; position: relative; display: flex; flex-direction: column; justify-content: center; }
    .match-box { display: flex; align-items: stretch; }
    .slots { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .slot { display: flex; align-items: center; border: 1px solid #999; border-bottom: none; min-height: 17px; font-size: 10px; }
    .slots .slot:last-child { border-bottom: 1px solid #999; }
    .slot .seed { width: 14px; flex: 0 0 14px; text-align: center; border-right: 1px solid #ccc; color: #555; align-self: stretch; line-height: 16px; }
    .slot .nm { flex: 1; min-width: 0; padding: 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .slot .ctry { width: 30px; flex: 0 0 30px; text-align: center; border-left: 1px solid #ccc; align-self: stretch; line-height: 16px; }
    .slot.red .nm { color: ${RED}; }
    .slot.blue .nm { color: ${BLUE}; }
    .slot.win .nm { font-weight: 700; }
    .scores { flex: 0 0 15px; display: flex; flex-direction: column; }
    .scores .sc { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 9px; border: 1px solid #999; border-left: none; border-top: none; background: #fff; }
    .scores .sc:first-child { border-top: 1px solid #999; }
    .boutno { position: absolute; left: 0; top: 50%; transform: translate(-100%, -50%); font-size: 9px; color: #333; background: #fff; padding: 0 2px; z-index: 2; }
    /* connector cell: a ']' (top+right+bottom borders over the middle 50%) that
       joins two incoming matches, plus a horizontal stub out to the next round. */
    .conn { flex: 1; position: relative; }
    .conn::before { content: ""; position: absolute; top: 25%; bottom: 25%; left: 0; right: 50%; border: 1px solid #aaa; border-left: 0; }
    .conn::after { content: ""; position: absolute; top: 50%; left: 50%; right: 0; height: 0; border-top: 1px solid #aaa; }
  `;

  const body = model.protocols.length
    ? model.protocols.map((p) => protocolPage(model, p, lang)).join('')
    : `<div class="protocol"><div class="pr-title"><div class="event-name">${escapeHtml(model.header.eventName)}</div></div><p style="text-align:center;color:#666">${escapeHtml(L.rEmpty)}</p></div>`;
  return htmlDoc('size: A4 landscape; margin: 8mm;', css, body);
}

function protocolPage(
  model: ResultsPdfModel,
  p: ResultsProtocol,
  lang: Lang,
): string {
  const L = LABELS[lang];
  const placementRows = p.placements
    .map(
      (r) => `<tr>
      <td>${escapeHtml(r.name)}</td>
      <td class="c">${escapeHtml(r.weight)}</td>
      <td class="c">${escapeHtml(r.country)}</td>
      <td>${escapeHtml(r.coach)}</td>
      <td class="c">${escapeHtml(r.place)}</td>
    </tr>`,
    )
    .join('');
  const pad = Math.max(0, PLACEMENT_MIN_ROWS - p.placements.length);
  const emptyRows = Array.from({ length: pad })
    .map(() => `<tr class="pl-empty"><td></td><td></td><td></td><td></td><td></td></tr>`)
    .join('');
  const signFooter = model.signature
    ? `<div class="pr-sign"><span class="pr-sign-label">${escapeHtml(L.headJudge)}</span><span class="pr-sign-name">${escapeHtml(model.signature.judgeName)}</span><img class="pr-sign-img" src="${escapeHtml(model.signature.image)}" alt="signature" /></div>`
    : '';

  return `<section class="protocol">
    <div class="pr-title"><div class="event-name">${escapeHtml(model.header.eventName)}</div></div>
    <div class="pr-no">${escapeHtml(L.rProtocol)} <span>${p.protocolNo}</span></div>
    <div class="pr-body">
      <div class="pr-left">${p.isBracket ? bracketHtml(p.columns) : `<div style="color:#888;font-size:11px">${escapeHtml(L.rRoundRobin)}</div>`}</div>
      <div class="pr-right">
        <div class="pr-info">
          <div class="k">${escapeHtml(L.rGender)}</div><div class="v">${escapeHtml(p.sex)}</div>${logoImg('pr-logo')}
          <div class="k">${escapeHtml(L.rAge)}</div><div class="v">${escapeHtml(p.ageGroupName)}</div>
          <div class="k">${escapeHtml(L.rWeight)}</div><div class="v">${escapeHtml(p.weightName)}</div>
          <div class="k dp-k">${escapeHtml(L.rDate)}</div><div class="v">${escapeHtml(model.header.dateRange)}</div>
          <div class="k dp-k">${escapeHtml(L.rPlace)}</div><div class="v">${escapeHtml(model.header.location)}</div>
        </div>
        <table class="pl-table">
          <thead><tr>
            <th>${escapeHtml(L.plName)}</th><th>${escapeHtml(L.plWeight)}</th><th>${escapeHtml(L.plCountry)}</th><th>${escapeHtml(L.plCoach)}</th><th>${escapeHtml(L.plPlace)}</th>
          </tr></thead>
          <tbody>${placementRows}${emptyRows}</tbody>
        </table>
      </div>
    </div>
    ${signFooter}
  </section>`;
}

function bracketHtml(columns: ProtocolColumn[]): string {
  if (columns.length === 0) return '';
  const parts: string[] = [];
  columns.forEach((col, idx) => {
    const isFinal = idx === columns.length - 1;
    const body = col.matches.map((m) => matchHtml(m)).join('');
    parts.push(
      `<div class="round${isFinal ? ' final' : ''}"><div class="rnd-label">${escapeHtml(col.label)}</div><div class="round-body">${body}</div></div>`,
    );
    if (!isFinal) {
      // One connector cell per match in the *next* round; each joins the two
      // matches of this round that feed it.
      const cells = Array.from({ length: columns[idx + 1].matches.length })
        .map(() => '<div class="conn"></div>')
        .join('');
      parts.push(
        `<div class="conns"><div class="rnd-label">&nbsp;</div><div class="conns-body">${cells}</div></div>`,
      );
    }
  });
  return `<div class="bracket">${parts.join('')}</div>`;
}

function matchHtml(m: ProtocolColumn['matches'][number]): string {
  const hasScore = m.redScore != null || m.blueScore != null;
  const score = hasScore
    ? `<div class="scores"><div class="sc">${escapeHtml(m.redScore ?? '')}</div><div class="sc">${escapeHtml(m.blueScore ?? '')}</div></div>`
    : `<div class="scores empty"></div>`;
  const bout = m.boutNo != null ? `<div class="boutno">${m.boutNo}</div>` : '';
  return `<div class="match">${bout}<div class="match-box"><div class="slots">${slotHtml(m.red, 'red')}${slotHtml(m.blue, 'blue')}</div>${score}</div></div>`;
}

function slotHtml(slot: ProtocolSlot | null, corner: 'red' | 'blue'): string {
  if (!slot) {
    return `<div class="slot ${corner}"><div class="seed"></div><div class="nm"></div><div class="ctry"></div></div>`;
  }
  const win = slot.isWinner ? ' win' : '';
  const isAthlete = slot.kind === 'ATHLETE';
  const nmClass = isAthlete ? corner : 'placeholder';
  return `<div class="slot ${nmClass}${win}">
    <div class="seed">${slot.seed ?? ''}</div>
    <div class="nm">${escapeHtml(slot.name)}</div>
    <div class="ctry">${escapeHtml(slot.country)}</div>
  </div>`;
}
