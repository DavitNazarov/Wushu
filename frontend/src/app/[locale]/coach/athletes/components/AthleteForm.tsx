'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/primitives/input';
import { Label } from '@/components/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import { EMPTY_SEX, type AthleteFormState } from '../athletes.types';

type Props = {
  form: AthleteFormState;
  setForm: React.Dispatch<React.SetStateAction<AthleteFormState>>;
  isGeorgian: boolean;
  docIdError: string | null;
  setDocIdError: (v: string | null) => void;
};

export function AthleteForm({ form, setForm, isGeorgian, docIdError, setDocIdError }: Props) {
  const t = useTranslations('coach.athletes');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{isGeorgian ? t('fields.firstNameEn') : t('fields.firstName')} *</Label>
          <Input
            type="text"
            value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            className="h-10 bg-[var(--color-surface)]"
          />
        </div>
        <div className="space-y-1.5">
          <Label>{isGeorgian ? t('fields.lastNameEn') : t('fields.lastName')} *</Label>
          <Input
            type="text"
            value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            className="h-10 bg-[var(--color-surface)]"
          />
        </div>
      </div>

      {isGeorgian && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t('fields.firstNameKa')} *</Label>
            <Input
              type="text"
              value={form.firstNameKa}
              onChange={(e) => setForm((f) => ({ ...f, firstNameKa: e.target.value }))}
              className="h-10 bg-[var(--color-surface)]"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.lastNameKa')} *</Label>
            <Input
              type="text"
              value={form.lastNameKa}
              onChange={(e) => setForm((f) => ({ ...f, lastNameKa: e.target.value }))}
              className="h-10 bg-[var(--color-surface)]"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t('fields.dateOfBirth')} *</Label>
          <Input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
            className="h-10 bg-[var(--color-surface)]"
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('fields.sex')}</Label>
          <Select
            value={form.sex || EMPTY_SEX}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, sex: v === EMPTY_SEX ? '' : (v as 'MALE' | 'FEMALE') }))
            }
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SEX}>—</SelectItem>
              <SelectItem value="MALE">{t('fields.sexOptions.male')}</SelectItem>
              <SelectItem value="FEMALE">{t('fields.sexOptions.female')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>
          {isGeorgian ? t('fields.nationalId') : t('fields.passportNumber')} *
        </Label>
        <Input
          type="text"
          inputMode={isGeorgian ? 'numeric' : undefined}
          maxLength={isGeorgian ? 11 : undefined}
          value={form.documentId}
          onChange={(e) => {
            const val = isGeorgian
              ? e.target.value.replace(/\D/g, '').slice(0, 11)
              : e.target.value;
            setForm((f) => ({ ...f, documentId: val }));
            setDocIdError(null);
          }}
          className="h-10 bg-[var(--color-surface)]"
          placeholder={isGeorgian ? '00000000000' : ''}
        />
        {isGeorgian && (
          <p className="text-[12px] text-[var(--color-text-muted)]">
            {t('fields.nationalIdHint')}
          </p>
        )}
        {docIdError && (
          <p className="text-[12px] text-[var(--color-danger)]">{docIdError}</p>
        )}
      </div>
    </div>
  );
}
