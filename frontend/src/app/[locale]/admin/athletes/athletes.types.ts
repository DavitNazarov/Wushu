export type AthleteFormState = {
  firstName: string;
  lastName: string;
  firstNameKa: string;
  lastNameKa: string;
  dateOfBirth: string;
  documentId: string;
  sex: 'MALE' | 'FEMALE' | '';
  clubId: string;
  clubIds: string[];
  // Only used for club-less athletes; ignored (derived from club) when a club
  // is selected.
  countryId: string;
  cityId: string;
};

export const EMPTY_ATHLETE_FORM: AthleteFormState = {
  firstName: '',
  lastName: '',
  firstNameKa: '',
  lastNameKa: '',
  dateOfBirth: '',
  documentId: '',
  sex: '',
  clubId: '',
  clubIds: [],
  countryId: '',
  cityId: '',
};

export const PAGE_SIZE = 10;
export const EMPTY_SEX = '__empty_sex__';
export const EMPTY_CLUB = '__empty_club__';
export const EMPTY_COUNTRY = '__empty_country__';
export const EMPTY_REGION = '__empty_region__';

export const ATHLETES_CARD_CLASS =
  'rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]';
