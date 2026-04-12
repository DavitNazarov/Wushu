'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { Label } from '@/components/ui/primitives/label';
import { Input } from '@/components/ui/primitives/input';
import { useToast } from '@/components/ui/Toast';
import { ApiError, apiPost } from '@/lib/api/client';
import { CategoryPicker } from '@/components/registration/CategoryPicker';

interface Props {
  open: boolean;
  onClose: () => void;
  eventId: string;
  registrationId: string;
  athleteName: string;
  currentCategory: string;
}

export function DrawReassignModal({
  open,
  onClose,
  eventId,
  registrationId,
  athleteName,
  currentCategory,
}: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [ageGroupId, setAgeGroupId] = useState('');
  const [weightCategoryId, setWeightCategoryId] = useState('');
  const [reason, setReason] = useState('');

  function resetForm() {
    setAgeGroupId('');
    setWeightCategoryId('');
    setReason('');
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  const reassignMut = useMutation({
    mutationFn: () =>
      apiPost(`/api/registrations/${registrationId}/category`, {
        eventWeightCategoryId: weightCategoryId,
        override: true,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['draw-overview', eventId] });
      void qc.invalidateQueries({ queryKey: ['draw-category-details', eventId] });
      toast('Athlete reassigned successfully');
      handleClose();
    },
    onError: (e: unknown) =>
      toast(e instanceof ApiError ? e.message : 'Reassignment failed', 'error'),
  });

  const canSubmit = !!weightCategoryId && reason.trim().length > 0 && !reassignMut.isPending;

  return (
    <Modal open={open} onClose={handleClose} title={`Reassign: ${athleteName}`}>
      <div className="space-y-4">
        {/* Current category info */}
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Current category
          </p>
          <p className="mt-0.5 text-[14px] font-medium text-[var(--color-text)]">
            {currentCategory}
          </p>
        </div>

        {/* Target category */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            New category
          </Label>
          <CategoryPicker
            eventId={eventId}
            ageGroupId={ageGroupId}
            weightCategoryId={weightCategoryId}
            onAgeGroupChange={setAgeGroupId}
            onWeightCategoryChange={setWeightCategoryId}
            disabled={reassignMut.isPending}
          />
        </div>

        {/* Reason — required by backend for override */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Reason <span className="text-[var(--color-danger,#ef4444)]">*</span>
          </Label>
          <Input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Single athlete — moved up to next weight class"
            className="h-10 bg-[var(--color-surface)]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton onClick={handleClose}>Cancel</SecondaryButton>
          <button
            onClick={() => reassignMut.mutate()}
            disabled={!canSubmit}
            className="h-9 rounded-[var(--radius-input)] bg-[var(--color-primary)] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {reassignMut.isPending ? 'Saving…' : 'Reassign'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
