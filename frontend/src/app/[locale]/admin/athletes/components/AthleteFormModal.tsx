'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { Input } from '@/components/ui/primitives/input';
import { Label } from '@/components/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import { localizedFullName, localizedName } from '@/lib/bilingual';
import type { AthleteRow, ClubRow, CountryRow, RegionRow } from '@/types/api';
import {
  EMPTY_CLUB,
  EMPTY_COUNTRY,
  EMPTY_REGION,
  EMPTY_SEX,
  type AthleteFormState,
} from '../athletes.types';

type Props = {
  open: boolean;
  onClose: () => void;
  editingAthlete: AthleteRow | null;
  form: AthleteFormState;
  setForm: React.Dispatch<React.SetStateAction<AthleteFormState>>;
  clubs: ClubRow[];
  countries: CountryRow[];
  regions: RegionRow[];
  showKaFields: boolean;
  docIdError: string | null;
  setDocIdError: (v: string | null) => void;
  formValid: boolean;
  saving: boolean;
  onSave: () => void;
  locale: string;
};

export function AthleteFormModal({
  open,
  onClose,
  editingAthlete,
  form,
  setForm,
  clubs,
  countries,
  regions,
  showKaFields,
  docIdError,
  setDocIdError,
  formValid,
  saving,
  onSave,
  locale,
}: Props) {
  const t = useTranslations('athletes');
  const tClubs = useTranslations('clubs');
  const tCommon = useTranslations('common');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingAthlete
        ? localizedFullName(editingAthlete.firstName, editingAthlete.lastName, editingAthlete.firstNameKa, editingAthlete.lastNameKa, locale)
        : t('new')}
      footer={
        <>
          <SecondaryButton onClick={onClose}>{tCommon('cancel')}</SecondaryButton>
          <PrimaryButton disabled={!formValid || saving} onClick={onSave}>
            {saving ? tCommon('loading') : tCommon('save')}
          </PrimaryButton>
        </>
      }
    >
      {editingAthlete && (
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/${locale}/admin/athletes/${editingAthlete.id}`}
            onClick={onClose}
            className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:underline"
          >
            {t('viewProfile')} →
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {/* English name row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{showKaFields ? t('fields.firstNameEn') : t('fields.firstName')} *</Label>
            <Input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              className="h-10 bg-[var(--color-surface)]"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{showKaFields ? t('fields.lastNameEn') : t('fields.lastName')} *</Label>
            <Input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              className="h-10 bg-[var(--color-surface)]"
            />
          </div>
        </div>

        {/* Georgian name row — shown when selected club is Georgian */}
        {showKaFields && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('fields.firstNameKa')}</Label>
              <Input
                type="text"
                value={form.firstNameKa}
                onChange={(e) => setForm((f) => ({ ...f, firstNameKa: e.target.value }))}
                className="h-10 bg-[var(--color-surface)]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.lastNameKa')}</Label>
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
          <Label>{t('fields.club')}</Label>
          <Select
            value={form.clubId || EMPTY_CLUB}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, clubId: v === EMPTY_CLUB ? '' : v }))
            }
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_CLUB}>—</SelectItem>
              {clubs.map((c) => (
                <SelectItem key={c.id} value={c.id}>{localizedName(c.name, c.nameKa, locale)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Region/country: derived from the club when set; chosen directly for
            a club-less athlete. */}
        {form.clubId ? (
          (() => {
            const selectedClub = clubs.find((c) => c.id === form.clubId);
            const region = selectedClub?.regionName
              ? localizedName(selectedClub.regionName, selectedClub.regionNameKa, locale)
              : null;
            const label = [region, selectedClub?.country].filter(Boolean).join(' · ');
            return label ? (
              <p className="text-[12px] text-[var(--color-text-muted)]">{label}</p>
            ) : null;
          })()
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{tClubs('fields.country')}</Label>
              <Select
                value={form.countryId || EMPTY_COUNTRY}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    countryId: v === EMPTY_COUNTRY ? '' : v,
                    regionId: '',
                  }))
                }
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder={tClubs('fields.selectCountry')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_COUNTRY}>—</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{localizedName(c.name, c.nameKa, locale)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{tClubs('fields.region')}</Label>
              <Select
                value={form.regionId || EMPTY_REGION}
                disabled={!form.countryId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, regionId: v === EMPTY_REGION ? '' : v }))
                }
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder={tClubs('fields.selectRegion')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_REGION}>—</SelectItem>
                  {regions
                    .filter((r) => r.countryId === form.countryId)
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>{localizedName(r.name, r.nameKa, locale)}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>{t('fields.documentId')} *</Label>
          <Input
            type="text"
            value={form.documentId}
            onChange={(e) => {
              setForm((f) => ({ ...f, documentId: e.target.value }));
              setDocIdError(null);
            }}
            className="h-10 bg-[var(--color-surface)]"
          />
          {docIdError && (
            <p className="text-[12px] text-[var(--color-danger)]">{docIdError}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
