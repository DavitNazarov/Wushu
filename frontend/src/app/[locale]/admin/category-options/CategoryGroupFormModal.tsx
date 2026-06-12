'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import { useToast } from '@/components/ui/Toast';
import { apiPatch, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type { CategoryOptionGroupInput, CategoryOptionGroupRow } from '@/types/api';
import { INPUT_CLASS } from '../category-templates/categoryTemplate.constants';
import { formatWeightRange } from './categoryOptions.utils';

type SexValue = 'MALE' | 'FEMALE' | 'OPEN';
type WeightRow = { id?: string; name: string; max: string; open: boolean };

type Props = {
  mode: 'create' | 'edit';
  open: boolean;
  onClose: () => void;
  group?: CategoryOptionGroupRow | null;
};

const emptyRow = (): WeightRow => ({ name: '', max: '', open: false });

function rowsFromGroup(group: CategoryOptionGroupRow): WeightRow[] {
  return [...group.options]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((option) => ({
      id: option.id,
      name: option.name,
      max: option.maxWeightKgIncl == null ? '' : String(option.maxWeightKgIncl),
      open: option.maxWeightKgIncl == null,
    }));
}

export function CategoryGroupFormModal({ mode, open, onClose, group }: Props) {
  const t = useTranslations('admin.categoryOptions');
  const tCommon = useTranslations('common');
  const tIdentity = useTranslations('athleteProfile.identity');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [nameEn, setNameEn] = useState('');
  const [nameKa, setNameKa] = useState('');
  const [sex, setSex] = useState<SexValue>('OPEN');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [roundMinutes, setRoundMinutes] = useState('2');
  const [isActive, setIsActive] = useState(true);
  const [rows, setRows] = useState<WeightRow[]>([emptyRow()]);

  // (Re)initialise whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && group) {
      setNameEn(group.name);
      setNameKa(group.nameKa ?? '');
      setSex(group.sex ?? 'OPEN');
      setMinAge(group.minAge == null ? '' : String(group.minAge));
      setMaxAge(group.maxAge == null ? '' : String(group.maxAge));
      setRoundMinutes(String(group.roundDurationSeconds / 60));
      setIsActive(group.isActive);
      setRows(group.options.length ? rowsFromGroup(group) : [emptyRow()]);
    } else {
      setNameEn('');
      setNameKa('');
      setSex('OPEN');
      setMinAge('');
      setMaxAge('');
      setRoundMinutes('2');
      setIsActive(true);
      setRows([emptyRow()]);
    }
  }, [open, mode, group]);

  // A division's lower bound is the previous division's upper bound (contiguous,
  // ascending) — null for the first division and for any open-ended division.
  function minForRow(index: number): number | null {
    if (index === 0) return null;
    const prev = rows[index - 1];
    if (prev.open) return null;
    const value = Number.parseFloat(prev.max);
    return Number.isFinite(value) ? value : null;
  }

  const validation = useMemo(() => {
    const rowErrors: (string | null)[] = rows.map(() => null);
    const roundN = Number.parseFloat(roundMinutes);
    const minA = minAge.trim() === '' ? null : Number.parseInt(minAge, 10);
    const maxA = maxAge.trim() === '' ? null : Number.parseInt(maxAge, 10);

    let formError: string | null = null;
    if (!Number.isFinite(roundN) || roundN <= 0) formError = t('errors.roundRequired');
    else if (minA != null && maxA != null && maxA < minA)
      formError = t('errors.ageRange');

    rows.forEach((row, index) => {
      const prev = index === 0 ? null : rows[index - 1];
      if (!row.name.trim()) {
        rowErrors[index] = t('errors.weightNameRequired');
        return;
      }
      if (row.open) {
        if (index !== rows.length - 1) rowErrors[index] = t('errors.openMustBeLast');
        return;
      }
      const maxV = Number.parseFloat(row.max);
      if (!Number.isFinite(maxV) || maxV <= 0) {
        rowErrors[index] = t('errors.weightMaxRequired');
        return;
      }
      if (prev && !prev.open) {
        const prevMax = Number.parseFloat(prev.max);
        if (Number.isFinite(prevMax) && maxV <= prevMax)
          rowErrors[index] = t('errors.weightAscending');
      }
    });

    const valid =
      !formError &&
      nameEn.trim().length > 0 &&
      rows.length > 0 &&
      rowErrors.every((error) => error === null);

    return { rowErrors, formError, valid };
  }, [rows, roundMinutes, minAge, maxAge, nameEn, t]);

  function updateRow(index: number, patch: Partial<WeightRow>) {
    setRows((current) =>
      current.map((row, idx) => (idx === index ? { ...row, ...patch } : row)),
    );
  }

  function toggleOpen(index: number, openEnded: boolean) {
    setRows((current) =>
      current.map((row, idx) =>
        idx === index ? { ...row, open: openEnded, max: openEnded ? '' : row.max } : row,
      ),
    );
  }

  function removeRow(index: number) {
    setRows((current) =>
      current.length > 1 ? current.filter((_, idx) => idx !== index) : current,
    );
  }

  function buildPayload(): CategoryOptionGroupInput {
    return {
      name: nameEn.trim(),
      nameKa: nameKa.trim() || null,
      sex: sex === 'OPEN' ? null : sex,
      minAge: minAge.trim() === '' ? null : Number.parseInt(minAge, 10),
      maxAge: maxAge.trim() === '' ? null : Number.parseInt(maxAge, 10),
      roundDurationSeconds: Math.round(Number.parseFloat(roundMinutes) * 60),
      isActive,
      weights: rows.map((row, index) => ({
        id: row.id,
        name: row.name.trim(),
        minWeightKgExcl: minForRow(index),
        maxWeightKgIncl: row.open ? null : Number.parseFloat(row.max),
      })),
    };
  }

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'edit' && group
        ? apiPatch(`/api/category-option-groups/${group.id}`, buildPayload())
        : apiPost('/api/category-option-groups', buildPayload()),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['category-option-groups'] }),
        queryClient.invalidateQueries({ queryKey: ['category-options'] }),
      ]);
      toast(tCommon('saveSuccess'));
      onClose();
    },
    onError: (error) =>
      toast(getCompactErrorMessage(error, tCommon('saveFailed')), 'error'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? t('edit.title') : t('new')}
      description={t('formDescription')}
      widthClassName="max-w-2xl"
      footer={
        <>
          <SecondaryButton disabled={mutation.isPending} onClick={onClose}>
            {tCommon('cancel')}
          </SecondaryButton>
          <PrimaryButton
            disabled={mutation.isPending || !validation.valid}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? tCommon('loading') : tCommon('save')}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-5">
        {/* Group identity */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('fields.nameEn')} required>
            <input
              className={INPUT_CLASS}
              value={nameEn}
              onChange={(event) => setNameEn(event.target.value)}
              placeholder={t('placeholders.nameEn')}
              autoFocus
            />
          </Field>
          <Field label={t('fields.nameKa')} hint={t('hints.nameKa')}>
            <input
              className={INPUT_CLASS}
              value={nameKa}
              onChange={(event) => setNameKa(event.target.value)}
              placeholder={t('placeholders.nameKa')}
              lang="ka"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t('fields.sex')}>
            <Select value={sex} onValueChange={(value) => setSex(value as SexValue)}>
              <SelectTrigger className="h-10 bg-[var(--color-surface)] px-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">{t('openDivision')}</SelectItem>
                <SelectItem value="MALE">{tIdentity('sexValue.MALE')}</SelectItem>
                <SelectItem value="FEMALE">{tIdentity('sexValue.FEMALE')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('fields.minAge')}>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              className={INPUT_CLASS}
              value={minAge}
              onChange={(event) => setMinAge(event.target.value)}
              placeholder={t('placeholders.any')}
            />
          </Field>
          <Field label={t('fields.maxAge')}>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              className={INPUT_CLASS}
              value={maxAge}
              onChange={(event) => setMaxAge(event.target.value)}
              placeholder={t('placeholders.any')}
            />
          </Field>
          <Field label={t('fields.roundMinutes')} required>
            <input
              type="number"
              min={0}
              step="0.5"
              inputMode="decimal"
              className={INPUT_CLASS}
              value={roundMinutes}
              onChange={(event) => setRoundMinutes(event.target.value)}
            />
          </Field>
        </div>

        {validation.formError && (
          <p className="text-[12px] text-[var(--color-danger)]">{validation.formError}</p>
        )}

        {/* Weight divisions repeater */}
        <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-[var(--color-text)]">
                {t('weights.title')}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                {t('weights.help')}
              </p>
            </div>
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)]">
              {t('weightCount', { count: rows.length })}
            </span>
          </div>

          <div className="space-y-2">
            {rows.map((row, index) => {
              const min = minForRow(index);
              const error = validation.rowErrors[index];
              return (
                <div
                  key={row.id ?? `new-${index}`}
                  className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      className={`${INPUT_CLASS} sm:flex-1`}
                      value={row.name}
                      onChange={(event) => updateRow(index, { name: event.target.value })}
                      placeholder={t('weights.namePlaceholder')}
                      aria-label={t('weights.nameLabel')}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        inputMode="decimal"
                        disabled={row.open}
                        className={`${INPUT_CLASS} w-28 tabular-nums disabled:opacity-50`}
                        value={row.max}
                        onChange={(event) => updateRow(index, { max: event.target.value })}
                        placeholder={t('weights.maxPlaceholder')}
                        aria-label={t('weights.maxLabel')}
                      />
                      <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[12px] text-[var(--color-text-muted)]">
                        <input
                          type="checkbox"
                          checked={row.open}
                          onChange={(event) => toggleOpen(index, event.target.checked)}
                          className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                        />
                        {t('weights.openEnded')}
                      </label>
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        disabled={rows.length === 1}
                        aria-label={t('weights.remove')}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--color-border)] text-[var(--color-text-muted)] transition hover:border-[var(--color-danger)]/40 hover:text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] tabular-nums text-[var(--color-text-muted)]">
                      {formatWeightRange(min, row.open ? null : Number.parseFloat(row.max) || null)}
                    </span>
                    {error && (
                      <span className="text-[11px] text-[var(--color-danger)]">{error}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setRows((current) => [...current, emptyRow()])}
            className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[var(--color-border)] py-2 text-[12px] font-medium text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
          >
            <Plus className="h-4 w-4" />
            {t('weights.add')}
          </button>
        </div>

        {mode === 'edit' && (
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
            />
            {t('fields.active')}
          </label>
        )}
      </div>
    </Modal>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">
        {label}
        {required && <span className="ml-0.5 text-[var(--color-danger)]">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}
