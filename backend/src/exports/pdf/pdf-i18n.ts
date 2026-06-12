// Bilingual support for the PDF exports. Structural labels live in LABELS
// (consumed by the templates); the helpers localize data values (consumed by
// the assembler) so a model can be built in either language.

export type Lang = 'en' | 'ka';

export const LABELS: Record<
  Lang,
  {
    // weigh-in
    wiN: string;
    wiName: string;
    wiCountry: string;
    wiDob: string;
    wiPre: string;
    wiWeight: string;
    wiComment: string;
    wiEmpty: string;
    // schedule
    scBout: string;
    scRed: string;
    scBlue: string;
    scCountry: string;
    scCoach: string;
    // results
    rProtocol: string;
    rGender: string;
    rAge: string;
    rWeight: string;
    rDate: string;
    rPlace: string;
    plName: string;
    plWeight: string;
    plCountry: string;
    plCoach: string;
    plPlace: string;
    rEmpty: string;
    rRoundRobin: string;
    headJudge: string;
  }
> = {
  en: {
    wiN: 'N',
    wiName: 'Name And Surname',
    wiCountry: 'Country',
    wiDob: 'Date of Birth',
    wiPre: 'pre Weight',
    wiWeight: 'Weight',
    wiComment: 'Comment',
    wiEmpty: 'No registrations.',
    scBout: 'Bout N',
    scRed: 'Red side',
    scBlue: 'Blue Side',
    scCountry: 'Country',
    scCoach: 'Coach',
    rProtocol: 'Protocol N',
    rGender: 'Gender',
    rAge: 'Age',
    rWeight: 'Weight',
    rDate: 'Date',
    rPlace: 'Place',
    plName: 'Name and Surname',
    plWeight: 'Weight',
    plCountry: 'Country',
    plCoach: 'Coach',
    plPlace: 'Place',
    rEmpty: 'No results yet.',
    rRoundRobin: 'Round-robin — see standings.',
    headJudge: 'Head Judge',
  },
  ka: {
    wiN: 'N',
    wiName: 'სახელი და გვარი',
    wiCountry: 'ქვეყანა',
    wiDob: 'დაბადების თარიღი',
    wiPre: 'საწყისი წონა',
    wiWeight: 'წონა',
    wiComment: 'კომენტარი',
    wiEmpty: 'რეგისტრაცია არ არის.',
    scBout: 'ბრძოლა N',
    scRed: 'წითელი',
    scBlue: 'ლურჯი',
    scCountry: 'ქვეყანა',
    scCoach: 'მწვრთნელი',
    rProtocol: 'პროტოკოლის N',
    rGender: 'სქესი',
    rAge: 'ასაკი',
    rWeight: 'წონა',
    rDate: 'თარიღი',
    rPlace: 'ადგილი',
    plName: 'სახელი და გვარი',
    plWeight: 'წონა',
    plCountry: 'რეგიონი',
    plCoach: 'მწვრთნელი',
    plPlace: 'ადგილი',
    rEmpty: 'შედეგები ჯერ არ არის.',
    rRoundRobin: 'წრიული ტურნირი — იხ. ცხრილი.',
    headJudge: 'მთავარი მსაჯი',
  },
};

const SEX: Record<Lang, { MALE: string; FEMALE: string }> = {
  en: { MALE: 'Male', FEMALE: 'Female' },
  ka: { MALE: 'მამრობითი', FEMALE: 'მდედრობითი' },
};

export function sexLabel(
  sex: 'MALE' | 'FEMALE' | null | undefined,
  lang: Lang,
): string {
  if (!sex) return '';
  return SEX[lang][sex];
}

// 1 -> First / პირველი, 2 -> Second / მეორე, 3+ -> Third / მესამე.
const PLACE: Record<Lang, [string, string, string]> = {
  en: ['First', 'Second', 'Third'],
  ka: ['პირველი', 'მეორე', 'მესამე'],
};

export function placeLabel(rank: 1 | 2 | 3, lang: Lang): string {
  return PLACE[lang][rank - 1];
}

// Translate the EN round-stage label coming out of roundStageLabel().
const ROUND_KA: Record<string, string> = {
  FINAL: 'ფინალი',
  SEMIFINAL: 'ნახევარფინალი',
  QUARTERFINAL: 'მეოთხედფინალი',
};

export function roundLabel(enLabel: string, lang: Lang): string {
  if (lang === 'en') return enLabel;
  const key = enLabel.trim().toUpperCase().replace(/\s+/g, '');
  return ROUND_KA[key] ?? enLabel;
}

const DECISION: Record<Lang, Record<string, string>> = {
  en: {
    PASSED: 'Pass',
    MOVED_UP: 'Moved up',
    FAILED: 'Fail',
    OVERRIDE_APPROVED: 'Override',
    REWEIGH_ALLOWED: 'Reweigh',
    DISQUALIFIED: 'DQ',
  },
  ka: {
    PASSED: 'გავიდა',
    MOVED_UP: 'აიწია',
    FAILED: 'ვერ გავიდა',
    OVERRIDE_APPROVED: 'დამტკიცებული',
    REWEIGH_ALLOWED: 'ხელახალი აწონვა',
    DISQUALIFIED: 'დისკვალიფიკაცია',
  },
};

export function decisionLabel(status: string, lang: Lang): string {
  return DECISION[lang][status] ?? '';
}

// Bracket slot placeholders — mirror the frontend bracket strings
// (messages: bracketViewer.bye / winnerOfMatch, resultsWinner) so the EN/KA
// protocol PDFs read the same as the on-screen brackets.
const SLOT: Record<Lang, { winner: string; bye: string }> = {
  en: { winner: 'Winner', bye: 'BYE' },
  ka: { winner: 'გამარჯვებული', bye: 'თავისუფალი ადგილი' },
};

export function winnerLabel(sourceBoutNo: number | null, lang: Lang): string {
  if (sourceBoutNo == null) return SLOT[lang].winner;
  return lang === 'ka'
    ? `${sourceBoutNo}-ე ბრძოლის გამარჯვებული`
    : `Winner of ${sourceBoutNo}`;
}

export function byeLabel(lang: Lang): string {
  return SLOT[lang].bye;
}

export function localizedFullName(
  a: {
    firstName: string;
    lastName: string;
    firstNameKa?: string | null;
    lastNameKa?: string | null;
  },
  lang: Lang,
): string {
  if (lang === 'ka' && a.firstNameKa && a.lastNameKa) {
    return `${a.firstNameKa} ${a.lastNameKa}`.trim();
  }
  return `${a.firstName} ${a.lastName}`.trim();
}
