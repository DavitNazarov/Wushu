// View-model types consumed by the PDF templates. The data assembler
// (PdfExportService) maps live Prisma data into these shapes; the templates
// (pdf-templates.ts) are pure string builders over them.

export type PdfEventHeader = {
  eventName: string;
  location: string; // "Batumi, Georgia"
  dateRange: string; // "August 1 - 6, 2025"
  organisationName: string;
};

// ── Weigh-in form ────────────────────────────────────────────────────────────

type WeighinSheetRow = {
  index: number;
  name: string;
  country: string; // full country name
  dob: string; // dd/mm/yyyy
  preWeight: string; // registered weight-category label
  weight: string; // final accepted weigh-in weight
  comment: string; // weigh-in decision label
};

export type WeighinSheet = {
  sex: string; // "Male" / "Female"
  ageGroupName: string; // "Children 9 - 11"
  weightName: string; // "< 45 KG"
  rows: WeighinSheetRow[];
};

export type WeighinPdfModel = {
  header: PdfEventHeader;
  sheets: WeighinSheet[];
};

// ── Schedule ─────────────────────────────────────────────────────────────────

type ScheduleSide = {
  name: string;
  country: string; // short tag (Geo)
  coach: string;
};

export type ScheduleBoutRow = {
  boutNo: number; // sequential running-order number
  red: ScheduleSide;
  blue: ScheduleSide;
};

export type SchedulePdfModel = {
  header: PdfEventHeader;
  discipline: string | null; // "Sanda" — null when unknown
  bouts: ScheduleBoutRow[];
};

// ── Results protocols ────────────────────────────────────────────────────────

export type ProtocolSlot = {
  kind: 'ATHLETE' | 'WINNER_PLACEHOLDER' | 'BYE' | 'TBD';
  name: string; // athlete name or "Winner of N" / "BYE"
  country: string; // short tag
  seed: number | null; // derived bracket position
  isWinner: boolean;
};

type ProtocolMatch = {
  boutNo: number | null;
  red: ProtocolSlot | null;
  blue: ProtocolSlot | null;
  redScore: string | null;
  blueScore: string | null;
};

export type ProtocolColumn = {
  label: string; // stage label (FINAL / SEMIFINAL / ...)
  matches: ProtocolMatch[];
};

export type ProtocolPlacementRow = {
  name: string;
  weight: string; // actual weigh-in weight
  country: string; // full country name
  coach: string;
  place: string; // "First" / "Second" / "Third"
};

export type ResultsProtocol = {
  protocolNo: number;
  sex: string;
  ageGroupName: string;
  weightName: string;
  isBracket: boolean; // false for round-robin (no tree)
  columns: ProtocolColumn[]; // bracket rounds, opening -> final
  placements: ProtocolPlacementRow[];
};

export type ProtocolSignature = {
  judgeName: string; // localized head-judge full name
  image: string; // signature as a data: URL
};

export type ResultsPdfModel = {
  header: PdfEventHeader;
  protocols: ResultsProtocol[];
  signature: ProtocolSignature | null;
};
