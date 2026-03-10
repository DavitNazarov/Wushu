import {
  isFinalWeighInStatus,
  isWeighInComplete,
} from './weighin-completion.helper';

describe('weighin-completion.helper', () => {
  it('treats PASSED, MOVED_UP, FAILED, OVERRIDE_APPROVED, DISQUALIFIED as final', () => {
    expect(isFinalWeighInStatus('PASSED')).toBe(true);
    expect(isFinalWeighInStatus('MOVED_UP')).toBe(true);
    expect(isFinalWeighInStatus('FAILED')).toBe(true);
    expect(isFinalWeighInStatus('OVERRIDE_APPROVED')).toBe(true);
    expect(isFinalWeighInStatus('DISQUALIFIED')).toBe(true);
  });

  it('treats NOT_WEIGHED and REWEIGH_ALLOWED as non-final', () => {
    expect(isFinalWeighInStatus('NOT_WEIGHED')).toBe(false);
    expect(isFinalWeighInStatus('REWEIGH_ALLOWED')).toBe(false);
  });

  it('is complete only when every status is final', () => {
    expect(
      isWeighInComplete([
        'PASSED',
        'MOVED_UP',
        'FAILED',
        'OVERRIDE_APPROVED',
        'DISQUALIFIED',
      ]),
    ).toBe(true);
    expect(isWeighInComplete(['PASSED', 'REWEIGH_ALLOWED'])).toBe(false);
    expect(isWeighInComplete([])).toBe(false);
    expect(isWeighInComplete(['PASSED', null, 'MOVED_UP'])).toBe(false);
  });
});
