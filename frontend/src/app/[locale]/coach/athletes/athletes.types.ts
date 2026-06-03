export const EMPTY_SEX = '__none__';
export const PAGE_SIZE = 10;

export type AthleteFormState = {
  firstName: string;
  lastName: string;
  firstNameKa: string;
  lastNameKa: string;
  dateOfBirth: string;
  documentId: string;
  sex: 'MALE' | 'FEMALE' | '';
};

export const EMPTY_ATHLETE_FORM: AthleteFormState = {
  firstName: '',
  lastName: '',
  firstNameKa: '',
  lastNameKa: '',
  dateOfBirth: '',
  documentId: '',
  sex: '',
};
