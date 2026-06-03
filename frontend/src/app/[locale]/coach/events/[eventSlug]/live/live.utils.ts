import { localizedFullName } from '@/lib/bilingual';
import type { AthleteSlot } from './live.types';

export function fighterName(slot: AthleteSlot | undefined, locale: string): string {
  if (!slot) return 'TBD';
  return localizedFullName(slot.firstName, slot.lastName, slot.firstNameKa, slot.lastNameKa, locale);
}
