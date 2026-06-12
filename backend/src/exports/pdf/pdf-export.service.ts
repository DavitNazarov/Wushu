import { Injectable } from '@nestjs/common';
import type { WeighInStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BracketsService } from '../../draw/brackets.service';
import { ResultsService } from '../../results/results.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { SignatureTemplatesService } from '../../signature-templates/signature-templates.service';
import type {
  BracketParticipantSlotView,
  BracketRoundColumn,
} from '../../draw/brackets.types';
import type { CategoryPlacementRow } from '../../competition/competition.logic';
import { PdfRenderService } from './pdf-render.service';
import {
  countryShort,
  formatDateRange,
  formatDob,
  formatWeight,
} from './pdf-assets';
import {
  type Lang,
  byeLabel,
  decisionLabel,
  localizedFullName,
  placeLabel,
  roundLabel,
  sexLabel,
  winnerLabel,
} from './pdf-i18n';
import {
  renderResultsHtml,
  renderScheduleHtml,
  renderWeighinHtml,
} from './pdf-templates';
import type {
  PdfEventHeader,
  ProtocolColumn,
  ProtocolPlacementRow,
  ProtocolSignature,
  ProtocolSlot,
  ResultsPdfModel,
  ResultsProtocol,
  ScheduleBoutRow,
  SchedulePdfModel,
  WeighinPdfModel,
  WeighinSheet,
} from './pdf-export.types';

type ResultsCategory = Awaited<
  ReturnType<ResultsService['summaryForEvent']>
>['categories'][number];

type CountryInfo = {
  code: string | null;
  name: string | null;
  nameKa: string | null;
};

// Shared Prisma selects for a club's country + active coaches. Reused across
// the results / schedule / weigh-in models so the shape lives in one place.
const COUNTRY_SELECT = { code: true, name: true, nameKa: true } as const;
const CLUB_COUNTRY_COACHES_SELECT = {
  country: { select: COUNTRY_SELECT },
  coaches: {
    where: { role: 'coach' },
    select: { displayName: true },
    orderBy: { displayName: 'asc' },
  },
} as const;

// Assembles live event data into the PDF view-models (in the requested
// language) and renders each export to a PDF buffer. Reuses the existing read
// services so the output always reflects current data.
@Injectable()
export class PdfExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brackets: BracketsService,
    private readonly results: ResultsService,
    private readonly schedule: ScheduleService,
    private readonly signatures: SignatureTemplatesService,
    private readonly renderer: PdfRenderService,
  ) {}

  async generateResultsPdf(
    organisationId: string,
    eventId: string,
    lang: Lang,
    signatureTemplateId: string,
  ): Promise<Buffer> {
    const model = await this.buildResultsModel(
      organisationId,
      eventId,
      lang,
      signatureTemplateId,
    );
    return this.renderer.renderPdf(renderResultsHtml(model, lang), {
      landscape: true,
    });
  }

  async generateSchedulePdf(
    organisationId: string,
    eventId: string,
    lang: Lang,
  ): Promise<Buffer> {
    const model = await this.buildScheduleModel(organisationId, eventId, lang);
    return this.renderer.renderPdf(renderScheduleHtml(model, lang), {
      landscape: true,
    });
  }

  async generateWeighinPdf(
    organisationId: string,
    eventId: string,
    lang: Lang,
  ): Promise<Buffer> {
    const model = await this.buildWeighinModel(organisationId, eventId, lang);
    return this.renderer.renderPdf(renderWeighinHtml(model, lang), {
      landscape: false,
    });
  }

  // ── Shared lookups ───────────────────────────────────────────────────────

  private async buildHeader(
    organisationId: string,
    eventId: string,
    lang: Lang,
  ): Promise<PdfEventHeader> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organisationId },
      select: {
        name: true,
        nameKa: true,
        location: true,
        competitionStartDate: true,
        competitionEndDate: true,
        organisation: { select: { name: true } },
      },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');
    return {
      eventName: lang === 'ka' && event.nameKa ? event.nameKa : event.name,
      location: event.location ?? '',
      dateRange: formatDateRange(
        event.competitionStartDate,
        event.competitionEndDate,
      ),
      organisationName: event.organisation.name,
    };
  }

  // athleteId -> localized "First Last" for every athlete registered to the event.
  private async athleteNameMap(
    organisationId: string,
    eventId: string,
    lang: Lang,
  ): Promise<Map<string, string>> {
    const regs = await this.prisma.registration.findMany({
      where: { organisationId, eventId },
      select: {
        athleteId: true,
        athlete: {
          select: {
            firstName: true,
            lastName: true,
            firstNameKa: true,
            lastNameKa: true,
          },
        },
      },
    });
    const map = new Map<string, string>();
    for (const r of regs) {
      map.set(r.athleteId, localizedFullName(r.athlete, lang));
    }
    return map;
  }

  // athleteId -> { club country (bilingual), joined coach names }.
  private async athleteClubInfo(
    organisationId: string,
    athleteIds: Array<string | null | undefined>,
  ): Promise<Map<string, { country: CountryInfo | null; coach: string }>> {
    const ids = [...new Set(athleteIds.filter((id): id is string => !!id))];
    const map = new Map<
      string,
      { country: CountryInfo | null; coach: string }
    >();
    if (ids.length === 0) return map;
    const athletes = await this.prisma.athlete.findMany({
      where: { organisationId, id: { in: ids } },
      select: {
        id: true,
        club: { select: CLUB_COUNTRY_COACHES_SELECT },
      },
    });
    for (const a of athletes) {
      map.set(a.id, {
        country: a.club?.country ?? null,
        coach: (a.club?.coaches ?? []).map((c) => c.displayName).join(', '),
      });
    }
    return map;
  }

  // athleteId -> latest-attempt weigh-in weight + rolled-up status. The latest
  // attempt (highest attemptNo) is the binding weight — same convention used by
  // integrity.service and draw.readiness.queries.
  private async athleteWeights(
    organisationId: string,
    eventId: string,
  ): Promise<Map<string, { weightKg: number | null; status: WeighInStatus }>> {
    const regs = await this.prisma.registration.findMany({
      where: { organisationId, eventId },
      select: {
        athleteId: true,
        weighInStatus: true,
        weighIns: {
          orderBy: { attemptNo: 'desc' },
          take: 1,
          select: { weightKg: true },
        },
      },
    });
    const map = new Map<
      string,
      { weightKg: number | null; status: WeighInStatus }
    >();
    for (const r of regs) {
      map.set(r.athleteId, {
        weightKg: r.weighIns[0]?.weightKg ?? null,
        status: r.weighInStatus,
      });
    }
    return map;
  }

  // fightId -> global running-order number (the reference's "Bout N").
  private async scheduleOrderByFight(
    organisationId: string,
    eventId: string,
  ): Promise<Map<string, number | null>> {
    const rows = await this.schedule.getSchedule({ organisationId, eventId });
    const map = new Map<string, number | null>();
    for (const r of rows) map.set(r.id, r.scheduleOrder ?? null);
    return map;
  }

  // fightId -> rounds won by each corner (the "2 / 0" in bracket cells).
  private async roundWinsByFight(
    organisationId: string,
    eventId: string,
  ): Promise<Map<string, { red: number; blue: number }>> {
    const states = await this.prisma.timerState.findMany({
      where: { organisationId, fight: { eventId } },
      select: { fightId: true, redRoundWins: true, blueRoundWins: true },
    });
    const map = new Map<string, { red: number; blue: number }>();
    for (const s of states) {
      map.set(s.fightId, { red: s.redRoundWins, blue: s.blueRoundWins });
    }
    return map;
  }

  // eventWeightCategoryId -> localized age-group name.
  private async ageGroupNames(
    eventId: string,
    lang: Lang,
  ): Promise<Map<string, string>> {
    const cats = await this.prisma.eventWeightCategory.findMany({
      where: { eventAgeGroup: { eventId } },
      select: {
        id: true,
        eventAgeGroup: {
          select: {
            categoryTemplateAgeGroup: { select: { name: true, nameKa: true } },
          },
        },
      },
    });
    const map = new Map<string, string>();
    for (const c of cats) {
      const ag = c.eventAgeGroup.categoryTemplateAgeGroup;
      map.set(c.id, lang === 'ka' && ag?.nameKa ? ag.nameKa : (ag?.name ?? ''));
    }
    return map;
  }

  // ── Results protocols ──────────────────────────────────────────────────────

  private async buildResultsModel(
    organisationId: string,
    eventId: string,
    lang: Lang,
    signatureTemplateId: string,
  ): Promise<ResultsPdfModel> {
    const [header, summary, orderMap, roundWins, nameMap, ageGroups, signature] =
      await Promise.all([
        this.buildHeader(organisationId, eventId, lang),
        this.results.summaryForEvent(organisationId, eventId),
        this.scheduleOrderByFight(organisationId, eventId),
        this.roundWinsByFight(organisationId, eventId),
        this.athleteNameMap(organisationId, eventId, lang),
        this.ageGroupNames(eventId, lang),
        this.loadSignature(organisationId, signatureTemplateId, lang),
      ]);

    const placementIds: string[] = [];
    for (const c of summary.categories) {
      for (const p of [
        c.medalists.gold,
        c.medalists.silver,
        ...c.medalists.bronze,
      ]) {
        if (p?.athleteId) placementIds.push(p.athleteId);
      }
      for (const s of c.standings ?? []) placementIds.push(s.athleteId);
    }
    const [clubInfo, weights] = await Promise.all([
      this.athleteClubInfo(organisationId, placementIds),
      this.athleteWeights(organisationId, eventId),
    ]);

    const protocols: ResultsProtocol[] = [];
    let protocolNo = 0;
    for (const cat of summary.categories) {
      protocolNo++;
      const detail = await this.brackets.getCategoryDetails({
        organisationId,
        eventId,
        eventWeightCategoryId: cat.eventWeightCategoryId,
      });
      const isBracket = cat.competitionFormat !== 'ROUND_ROBIN';
      protocols.push({
        protocolNo,
        sex: sexLabel(detail.category.division, lang),
        ageGroupName:
          ageGroups.get(cat.eventWeightCategoryId) ?? cat.ageGroupName ?? '',
        weightName: cat.categoryName,
        isBracket,
        columns: isBracket
          ? this.buildColumns(detail.rounds, orderMap, roundWins, nameMap, lang)
          : [],
        placements: this.buildPlacements(cat, clubInfo, weights, nameMap, lang),
      });
    }

    return { header, protocols, signature };
  }

  // Loads the chosen head-judge signature (required for results export).
  private async loadSignature(
    organisationId: string,
    signatureTemplateId: string,
    lang: Lang,
  ): Promise<ProtocolSignature> {
    const tpl = await this.signatures.getForExport(
      organisationId,
      signatureTemplateId,
    );
    if (!tpl) throw new Error('SIGNATURE_TEMPLATE_NOT_FOUND');
    return {
      judgeName:
        lang === 'ka' && tpl.judgeNameKa ? tpl.judgeNameKa : tpl.judgeNameEn,
      image: tpl.signature,
    };
  }

  private buildColumns(
    rounds: BracketRoundColumn[],
    orderMap: Map<string, number | null>,
    roundWins: Map<string, { red: number; blue: number }>,
    nameMap: Map<string, string>,
    lang: Lang,
  ): ProtocolColumn[] {
    const sorted = [...rounds].sort((a, b) => a.round - b.round);

    const seedByAthlete = new Map<string, number>();
    let seq = 0;
    for (const round of sorted) {
      for (const m of round.matchups) {
        for (const slot of [m.slots.red, m.slots.blue]) {
          const aid = slot.athlete?.athleteId;
          if (aid && !seedByAthlete.has(aid)) seedByAthlete.set(aid, ++seq);
        }
      }
    }

    return sorted.map((round) => ({
      label: roundLabel(round.label, lang),
      matches: round.matchups.map((m) => {
        const rw = roundWins.get(m.fightId);
        let redScore: string | null;
        let blueScore: string | null;
        if (rw && (rw.red > 0 || rw.blue > 0)) {
          redScore = String(rw.red);
          blueScore = String(rw.blue);
        } else {
          [redScore, blueScore] = splitScore(m.score);
        }
        return {
          boutNo: orderMap.get(m.fightId) ?? m.boutNo ?? null,
          red: this.slotToProtocol(m.slots.red, m.winnerAthleteId, seedByAthlete, nameMap, lang),
          blue: this.slotToProtocol(m.slots.blue, m.winnerAthleteId, seedByAthlete, nameMap, lang),
          redScore,
          blueScore,
        };
      }),
    }));
  }

  private slotToProtocol(
    slot: BracketParticipantSlotView,
    winnerAthleteId: string | null,
    seedByAthlete: Map<string, number>,
    nameMap: Map<string, string>,
    lang: Lang,
  ): ProtocolSlot | null {
    if (slot.kind === 'ATHLETE' && slot.athlete) {
      return {
        kind: 'ATHLETE',
        name: nameMap.get(slot.athlete.athleteId) ?? slot.athlete.athleteName,
        country: countryShort(slot.athlete.country),
        seed: seedByAthlete.get(slot.athlete.athleteId) ?? null,
        isWinner:
          winnerAthleteId != null && winnerAthleteId === slot.athlete.athleteId,
      };
    }
    if (slot.kind === 'WINNER_PLACEHOLDER') {
      return {
        kind: 'WINNER_PLACEHOLDER',
        name: winnerLabel(slot.sourceBoutNo, lang),
        country: '',
        seed: null,
        isWinner: false,
      };
    }
    if (slot.kind === 'BYE') {
      return {
        kind: 'BYE',
        name: byeLabel(lang),
        country: '',
        seed: null,
        isWinner: false,
      };
    }
    return null;
  }

  private buildPlacements(
    cat: ResultsCategory,
    clubInfo: Map<string, { country: CountryInfo | null; coach: string }>,
    weights: Map<string, { weightKg: number | null; status: WeighInStatus }>,
    nameMap: Map<string, string>,
    lang: Lang,
  ): ProtocolPlacementRow[] {
    const rows: ProtocolPlacementRow[] = [];
    const push = (p: CategoryPlacementRow | null, rank: 1 | 2 | 3) => {
      if (!p || !p.athleteId) return;
      const info = clubInfo.get(p.athleteId);
      rows.push({
        name: nameMap.get(p.athleteId) ?? p.athleteName ?? '',
        weight: formatWeight(weights.get(p.athleteId)?.weightKg ?? null),
        country: localizedCountry(info?.country ?? null, lang),
        coach: info?.coach ?? '',
        place: placeLabel(rank, lang),
      });
    };
    push(cat.medalists.gold, 1);
    push(cat.medalists.silver, 2);
    for (const b of cat.medalists.bronze) push(b, 3);
    return rows;
  }

  // ── Schedule ────────────────────────────────────────────────────────────────

  private async buildScheduleModel(
    organisationId: string,
    eventId: string,
    lang: Lang,
  ): Promise<SchedulePdfModel> {
    const [header, scheduleRows, fights] = await Promise.all([
      this.buildHeader(organisationId, eventId, lang),
      this.schedule.getSchedule({ organisationId, eventId }),
      this.prisma.fight.findMany({
        where: { organisationId, eventId },
        select: {
          id: true,
          redAthlete: {
            select: {
              id: true,
              club: { select: CLUB_COUNTRY_COACHES_SELECT },
            },
          },
          blueAthlete: {
            select: {
              id: true,
              club: { select: CLUB_COUNTRY_COACHES_SELECT },
            },
          },
        },
      }),
    ]);

    const fightById = new Map(fights.map((f) => [f.id, f]));
    let counter = 0;
    const bouts: ScheduleBoutRow[] = [];
    for (const row of scheduleRows) {
      counter++;
      const f = fightById.get(row.id);
      const redName =
        lang === 'ka'
          ? (row.redDisplayNameKa ?? row.redDisplayName)
          : row.redDisplayName;
      const blueName =
        lang === 'ka'
          ? (row.blueDisplayNameKa ?? row.blueDisplayName)
          : row.blueDisplayName;
      bouts.push({
        boutNo: row.scheduleOrder ?? counter,
        red: {
          name: redName,
          country: f?.redAthlete ? shortCountry(f.redAthlete.club?.country) : '',
          coach: coachNames(f?.redAthlete?.club?.coaches),
        },
        blue: {
          name: blueName,
          country: f?.blueAthlete
            ? shortCountry(f.blueAthlete.club?.country)
            : '',
          coach: coachNames(f?.blueAthlete?.club?.coaches),
        },
      });
    }

    return { header, discipline: null, bouts };
  }

  // ── Weigh-in form ────────────────────────────────────────────────────────────

  private async buildWeighinModel(
    organisationId: string,
    eventId: string,
    lang: Lang,
  ): Promise<WeighinPdfModel> {
    const [header, categories] = await Promise.all([
      this.buildHeader(organisationId, eventId, lang),
      this.prisma.eventWeightCategory.findMany({
        where: { eventAgeGroup: { eventId } },
        select: {
          categoryTemplateWeight: { select: { name: true, sortOrder: true } },
          eventAgeGroup: {
            select: {
              categoryTemplateAgeGroup: {
                select: { name: true, nameKa: true, sortOrder: true },
              },
            },
          },
          initialRegistrations: {
            where: { organisationId, eventId },
            select: {
              weighInStatus: true,
              athlete: {
                select: {
                  firstName: true,
                  lastName: true,
                  firstNameKa: true,
                  lastNameKa: true,
                  dateOfBirth: true,
                  sex: true,
                  club: { select: { country: { select: COUNTRY_SELECT } } },
                },
              },
              weighIns: {
                orderBy: { attemptNo: 'desc' },
                take: 1,
                select: { weightKg: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
    ]);

    const withRegs = categories.filter((c) => c.initialRegistrations.length > 0);
    withRegs.sort((a, b) => {
      const ageA = a.eventAgeGroup.categoryTemplateAgeGroup?.sortOrder ?? 0;
      const ageB = b.eventAgeGroup.categoryTemplateAgeGroup?.sortOrder ?? 0;
      if (ageA !== ageB) return ageA - ageB;
      return (
        (a.categoryTemplateWeight.sortOrder ?? 0) -
        (b.categoryTemplateWeight.sortOrder ?? 0)
      );
    });

    const sheets: WeighinSheet[] = withRegs.map((cat) => {
      const ag = cat.eventAgeGroup.categoryTemplateAgeGroup;
      return {
        sex: sexLabel(cat.initialRegistrations[0]?.athlete.sex ?? null, lang),
        ageGroupName: lang === 'ka' && ag?.nameKa ? ag.nameKa : (ag?.name ?? ''),
        weightName: cat.categoryTemplateWeight.name,
        rows: cat.initialRegistrations.map((r, i) => ({
          index: i + 1,
          name: localizedFullName(r.athlete, lang),
          country: localizedCountry(r.athlete.club?.country ?? null, lang),
          dob: formatDob(r.athlete.dateOfBirth),
          preWeight: cat.categoryTemplateWeight.name,
          weight: formatWeight(r.weighIns[0]?.weightKg ?? null),
          comment: decisionLabel(r.weighInStatus, lang),
        })),
      };
    });

    return { header, sheets };
  }
}

function coachNames(
  coaches: Array<{ displayName: string }> | null | undefined,
): string {
  return (coaches ?? []).map((c) => c.displayName).join(', ');
}

// Localized full country name from the related Country row (name/nameKa).
function localizedCountry(c: CountryInfo | null, lang: Lang): string {
  if (!c) return '';
  return lang === 'ka' && c.nameKa ? c.nameKa : (c.name ?? '');
}

// 3-letter tag for bracket/schedule cells, derived from the country code (or
// the name as a fallback).
function shortCountry(c: CountryInfo | null | undefined): string {
  return countryShort(c?.code ?? c?.name ?? null);
}

// "2-0" / "10:8" -> ["2","0"]. Returns nulls when no score token is present.
function splitScore(score: string | null): [string | null, string | null] {
  if (!score) return [null, null];
  const m = score.match(/^(\d{1,2})\s*[-:]\s*(\d{1,2})$/);
  if (!m) return [null, null];
  return [m[1], m[2]];
}

