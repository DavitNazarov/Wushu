import {
  assertValidDefaultCategoryLibrary,
  DEFAULT_CATEGORY_OPTION_GROUPS,
} from './default-category-options';

describe('default category option library', () => {
  it('covers the reusable sanda default groups in stable order', () => {
    expect(DEFAULT_CATEGORY_OPTION_GROUPS.map((group) => group.code)).toEqual([
      'children-boys-sanda',
      'children-girls-sanda',
      'junior-boys-sanda',
      'junior-girls-sanda',
      'youth-boys-sanda',
      'youth-girls-sanda',
      'adults-men-sanda',
      'adults-women-sanda',
    ]);
  });

  it('passes category template validation', () => {
    expect(() => assertValidDefaultCategoryLibrary()).not.toThrow();
  });
});
