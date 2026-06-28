import { z } from 'zod';
import { eachDayOfInterval, format, isValid, parse } from 'date-fns';
import { EventPolicyInputSchema } from '../event-policies/event-policy.schemas';

const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnly(value: string): Date | null {
  if (!DATE_RE.test(value)) return null;
  const d = parse(value, 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : null;
}

function parseDateTime(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(dateStr: string, days: number): string {
  const date = parseDateOnly(dateStr);
  if (!date) return dateStr;
  date.setDate(date.getDate() + days);
  return format(date, 'yyyy-MM-dd');
}

function isIanaTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function listDaysInclusive(
  startDate: string,
  endDate: string,
): string[] {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end) return [];

  const days = eachDayOfInterval({ start, end });
  return days.map((d) => format(d, 'yyyy-MM-dd'));
}

const DateOnlyString = z
  .string()
  .regex(DATE_RE, 'Invalid date format, expected YYYY-MM-DD');

const DateTimeString = z
  .string()
  .min(1, 'Date-time is required')
  .refine(
    (value) => parseDateTime(value) !== null,
    'Invalid datetime; expected ISO datetime string',
  );

const LegacyDatesSchema = z.object({
  range: z.object({
    startDate: DateOnlyString,
    endDate: DateOnlyString,
  }),
  registrationDays: z.array(DateOnlyString),
  fightDays: z.array(DateOnlyString),
});

const CanonicalDatesSchema = z.object({
  registrationStartDate: DateTimeString,
  registrationEndDate: DateTimeString,
  weighInStartDate: DateTimeString.optional(),
  weighInEndDate: DateTimeString.optional(),
  competitionStartDate: DateTimeString,
  competitionEndDate: DateTimeString,
});

export const CreateEventSchema = z
  .object({
    name: z.string().min(1, 'name is required'),
    nameKa: z.string().trim().min(1).optional().nullable(),
    slug: z
      .string()
      .min(1, 'slug is required')
      .regex(
        KEBAB_RE,
        'slug must be lowercase kebab-case (e.g. geo-wushu-open-2026)',
      ),
    location: z.string().min(1, 'location is required'),
    entryFee: z
      .number()
      .int('entryFee must be a whole number')
      .nonnegative('entryFee cannot be negative')
      .optional()
      .nullable(),
    timezone: z
      .string()
      .trim()
      .min(1, 'timezone is required')
      .refine(
        (value) => isIanaTimeZone(value),
        'Invalid timezone; expected IANA format (e.g. Asia/Tbilisi)',
      )
      .default('Asia/Tbilisi'),
    autoAdvanceStage: z.boolean().optional().default(false),
    accessType: z.enum(['OPEN', 'CLOSED']),
    categoryTemplateId: z.string().min(1).optional(),
    rulesetId: z.string().min(1).optional(),
    dates: z.union([LegacyDatesSchema, CanonicalDatesSchema]),
    registrationWindow: z
      .object({
        opensAt: DateOnlyString,
        closesAt: DateOnlyString.optional(),
      })
      .optional(),
    policies: EventPolicyInputSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if ('range' in val.dates) {
      const { range, registrationDays, fightDays } = val.dates;

      const start = parseDateOnly(range.startDate);
      const end = parseDateOnly(range.endDate);
      if (!start || !end) {
        if (!start) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['dates', 'range', 'startDate'],
            message: 'Invalid startDate; expected calendar date YYYY-MM-DD',
          });
        }
        if (!end) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['dates', 'range', 'endDate'],
            message: 'Invalid endDate; expected calendar date YYYY-MM-DD',
          });
        }
        return;
      }

      if (end < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dates', 'range', 'endDate'],
          message: 'endDate must be on or after startDate',
        });
        return;
      }

      const eventDays = listDaysInclusive(range.startDate, range.endDate);
      const daySet = new Set(eventDays);

      if (!registrationDays.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dates', 'registrationDays'],
          message: 'At least one registration/weigh-in day is required',
        });
      }

      if (!fightDays.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dates', 'fightDays'],
          message: 'At least one fight day is required',
        });
      }

      function validateDayList(days: string[], path: string[]) {
        const seen = new Set<string>();
        for (const d of days) {
          const parsed = parseDateOnly(d);
          if (!parsed) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path,
              message: `Invalid date "${d}", expected YYYY-MM-DD`,
            });
            continue;
          }
          if (!daySet.has(d)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path,
              message: `Date "${d}" must be within the event range`,
            });
          }
          if (seen.has(d)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path,
              message: `Duplicate date "${d}" is not allowed`,
            });
          }
          seen.add(d);
        }
      }

      validateDayList(registrationDays, ['dates', 'registrationDays']);
      validateDayList(fightDays, ['dates', 'fightDays']);

      if (registrationDays.length && fightDays.length) {
        const maxReg = [...registrationDays].sort().at(-1)!;
        const minFight = [...fightDays].sort().at(0)!;
        if (maxReg > minFight) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['dates', 'registrationDays'],
            message:
              'Registration/weigh-in days must be on or before the first fight day.',
          });
        }
      }

      const rw = val.registrationWindow;
      if (rw && rw.closesAt) {
        if (rw.opensAt > rw.closesAt) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['registrationWindow', 'opensAt'],
            message:
              'Registration opening date must be on or before the closing date.',
          });
        }

        const latestRegistrationCloseDay = addDays(range.startDate, -1);
        if (rw.closesAt > latestRegistrationCloseDay) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['registrationWindow', 'closesAt'],
            message: `Registration must close on or before the day before event start (${latestRegistrationCloseDay}).`,
          });
        }
      }

      return;
    }

    const dates = val.dates;
    const registrationStart = parseDateTime(dates.registrationStartDate)!;
    const registrationEnd = parseDateTime(dates.registrationEndDate)!;
    const competitionStart = parseDateTime(dates.competitionStartDate)!;
    const competitionEnd = parseDateTime(dates.competitionEndDate)!;
    const weighInStart = dates.weighInStartDate
      ? parseDateTime(dates.weighInStartDate)
      : null;
    const weighInEnd = dates.weighInEndDate
      ? parseDateTime(dates.weighInEndDate)
      : null;

    if (registrationStart > registrationEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dates', 'registrationEndDate'],
        message:
          'registrationStartDate must be on or before registrationEndDate',
      });
    }

    if (registrationEnd > competitionStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dates', 'registrationEndDate'],
        message:
          'registrationEndDate must be on or before competitionStartDate',
      });
    }

    if (competitionStart > competitionEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dates', 'competitionEndDate'],
        message: 'competitionStartDate must be on or before competitionEndDate',
      });
    }

    if (
      (dates.weighInStartDate && !dates.weighInEndDate) ||
      (!dates.weighInStartDate && dates.weighInEndDate)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dates', 'weighInEndDate'],
        message:
          'weighInStartDate and weighInEndDate must be provided together',
      });
    }

    if (weighInStart && weighInEnd) {
      if (weighInStart > weighInEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dates', 'weighInEndDate'],
          message: 'weighInStartDate must be on or before weighInEndDate',
        });
      }

      if (weighInEnd > competitionStart) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dates', 'weighInEndDate'],
          message: 'weighInEndDate must be on or before competitionStartDate',
        });
      }
    }
  });

export type CreateEventDto = z.infer<typeof CreateEventSchema>;
export const UpdateEventSchema = CreateEventSchema;
export type UpdateEventDto = CreateEventDto;

export type LegacyDatesDto = z.infer<typeof LegacyDatesSchema>;
export type CanonicalDatesDto = z.infer<typeof CanonicalDatesSchema>;

export function isLegacyDatesInput(
  dates: CreateEventDto['dates'],
): dates is LegacyDatesDto {
  return 'range' in dates;
}
