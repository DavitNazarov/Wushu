import type { BracketParticipantSlotView } from '@/types/api';

export function resolveBracketParticipantLabel(input: {
  slot: BracketParticipantSlotView;
  tBracket: (key: string, values?: Record<string, string | number | Date>) => string;
}): string {
  if (input.slot.kind === 'ATHLETE' && input.slot.athlete) {
    return input.slot.athlete.athleteName;
  }
  if (input.slot.kind === 'WINNER_PLACEHOLDER' && input.slot.sourceBoutNo != null) {
    return input.tBracket('winnerOfMatch', { match: input.slot.sourceBoutNo });
  }
  if (input.slot.kind === 'BYE') {
    return input.tBracket('bye');
  }
  return input.tBracket('emptySlot');
}
