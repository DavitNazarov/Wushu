// Whole-years age of an athlete on a given date, computed entirely in UTC.
//
// Used by category-eligibility checks (age groups) in both registration and
// weigh-in. Kept here, framework-free, as the single source of truth: the two
// callers previously carried byte-identical private copies with a "if you
// change one, change both" comment — exactly the drift hazard this removes.
//
// UTC throughout so the result never shifts by a day depending on the server's
// local timezone near midnight; DOB and the competition date are compared on
// their calendar year/month/day only. Standard "have they had their birthday
// yet this year" rule (drop a year when the month/day hasn't been reached).
export function computeAgeOnDate(dateOfBirth: Date, onDate: Date): number {
  let age = onDate.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDiff = onDate.getUTCMonth() - dateOfBirth.getUTCMonth();
  const dayDiff = onDate.getUTCDate() - dateOfBirth.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }
  return age;
}
