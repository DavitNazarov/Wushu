import type { EventLifecycle } from '@/types/api';

type LifecycleTranslation = (key: string) => string;

type WeighInLifecycleStage =
  | 'REGISTRATION'
  | 'LOCKED'
  | 'WEIGHIN'
  | 'DRAW'
  | 'BRACKETS'
  | 'LIVE'
  | 'DONE';

export function buildWeighInLifecycleSteps(
  tEvents: LifecycleTranslation,
  tNav: LifecycleTranslation,
  tCommon: LifecycleTranslation,
) {
  return [
    { key: 'reg', stage: 'REGISTRATION', label: tEvents('lifecycle.REG_OPEN') },
    { key: 'lock', stage: 'LOCKED', label: tEvents('lifecycle.LOCKED') },
    { key: 'weighin', stage: 'WEIGHIN', label: tEvents('lifecycle.WEIGHIN') },
    { key: 'draw', stage: 'DRAW', label: tEvents('lifecycle.DRAWN') },
    { key: 'brackets', stage: 'BRACKETS', label: tNav('brackets') },
    { key: 'live', stage: 'LIVE', label: tEvents('lifecycle.LIVE') },
    { key: 'done', stage: 'DONE', label: tCommon('done') },
  ] as Array<{
    key: string;
    label: string;
    stage: WeighInLifecycleStage;
  }>;
}

export function resolveWeighInLifecycleStage(
  lifecycle: EventLifecycle | undefined,
): WeighInLifecycleStage {
  switch (lifecycle) {
    case 'REG_OPEN':
      return 'REGISTRATION';
    case 'LOCKED':
      return 'LOCKED';
    case 'WEIGHIN':
    case 'WEIGH_IN_COMPLETED':
      return 'WEIGHIN';
    case 'DRAWN':
      return 'DRAW';
    case 'PUBLISHED':
      return 'BRACKETS';
    case 'LIVE':
      return 'LIVE';
    default:
      return 'DONE';
  }
}
