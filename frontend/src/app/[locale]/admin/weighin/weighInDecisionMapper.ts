import type {
  WeighInAllowedAction,
  WeighInPreviewResponse,
} from '@/types/weighin';

export type DecisionTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

export function mapDecisionPreview(input: {
  preview: WeighInPreviewResponse;
  t: (key: string, values?: Record<string, unknown>) => string;
}): {
  tone: DecisionTone;
  title: string;
  description: string;
} {
  const { preview, t } = input;

  if (!preview.recordingAllowed && preview.recordingBlockedCode) {
    return {
      tone: 'warning',
      title: t('decisionBlockedTitle'),
      description: t('decisionBlockedDescription'),
    };
  }

  if (preview.underLimitKg != null) {
    return {
      tone: 'danger',
      title: t('decisionUnderLimitTitle'),
      description: t('decisionUnderLimitDescription', {
        value: preview.underLimitKg.toFixed(1),
        min:
          preview.currentCategory.minWeightKgExcl != null
            ? preview.currentCategory.minWeightKgExcl.toFixed(1)
            : '0',
      }),
    };
  }

  if (preview.decisionState === 'AUTO_PASS') {
    return {
      tone: 'success',
      title: t('decisionAutoPassTitle'),
      description: t('decisionAutoPassDescription'),
    };
  }
  if (preview.decisionState === 'REWEIGH_ALLOWED') {
    const deadline = preview.openOneHourWindow?.deadlineAt
      ? new Date(preview.openOneHourWindow.deadlineAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;
    return {
      tone: 'warning',
      title: t('decisionReweighTitle'),
      description: deadline
        ? t('decisionReweighUntil', { time: deadline })
        : t('decisionReweighDescription'),
    };
  }
  if (preview.decisionState === 'MOVE_UP_AVAILABLE') {
    return {
      tone: 'info',
      title: t('decisionMoveUpTitle'),
      description: preview.nextCategory?.name
        ? t('decisionMoveUpDescriptionWithCategory', {
            category: preview.nextCategory.name,
          })
        : t('decisionMoveUpDescription'),
    };
  }
  if (preview.decisionState === 'DISQUALIFY_REQUIRED') {
    return {
      tone: 'danger',
      title: t('decisionDisqualifyTitle'),
      description: t('decisionDisqualifyDescription'),
    };
  }
  if (preview.decisionState === 'MANUAL_DECISION_REQUIRED') {
    return {
      tone: 'info',
      title: t('decisionManualTitle'),
      description: t('decisionManualDescription'),
    };
  }
  return {
    tone: 'neutral',
    title: t('decisionRecordedTitle'),
    description: t('decisionRecordedDescription'),
  };
}

export function actionLabel(
  action: WeighInAllowedAction,
  t: (key: string, values?: Record<string, unknown>) => string,
): string {
  if (action.code === 'MOVE_UP' && action.targetCategoryName) {
    return t('actionMoveToCategory', { category: action.targetCategoryName });
  }
  if (action.code === 'RECORD_WEIGH_IN') return t('actionRecordWeighIn');
  if (action.code === 'RECORD_REWEIGH') return t('actionRecordReweigh');
  if (action.code === 'RECORD_FAIL') return t('actionRecordFail');
  if (action.code === 'RECORD_DISQUALIFICATION') {
    return t('actionRecordDisqualification');
  }
  if (action.code === 'SUBMIT_MANUAL_DECISION') {
    return t('actionSubmitManualDecision');
  }
  return t('actionManualOverride');
}
