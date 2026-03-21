import { validateCategoryTemplateStructure } from './category-template-structure.validator';

describe('validateCategoryTemplateStructure', () => {
  it('accepts a valid age/weight structure', () => {
    expect(() =>
      validateCategoryTemplateStructure([
        {
          code: 'adult',
          name: 'Adult',
          minAge: 18,
          maxAge: 40,
          roundDurationSeconds: 120,
          sortOrder: 1,
          weightCategories: [
            {
              name: '60kg',
              minWeightKgExcl: null,
              maxWeightKgIncl: 60,
              sortOrder: 1,
            },
            {
              name: '65kg',
              minWeightKgExcl: 60,
              maxWeightKgIncl: 65,
              sortOrder: 2,
            },
            {
              name: '+65kg',
              minWeightKgExcl: 65,
              maxWeightKgIncl: null,
              sortOrder: 3,
            },
          ],
        },
      ]),
    ).not.toThrow();
  });

  it('rejects open weight category when it is not the last one', () => {
    expect(() =>
      validateCategoryTemplateStructure([
        {
          code: 'adult',
          name: 'Adult',
          minAge: 18,
          maxAge: 40,
          roundDurationSeconds: 120,
          sortOrder: 1,
          weightCategories: [
            {
              name: '+65kg',
              minWeightKgExcl: 65,
              maxWeightKgIncl: null,
              sortOrder: 1,
            },
            {
              name: '70kg',
              minWeightKgExcl: 65,
              maxWeightKgIncl: 70,
              sortOrder: 2,
            },
          ],
        },
      ]),
    ).toThrow('OPEN_WEIGHT_CATEGORY_MUST_BE_LAST');
  });
});
