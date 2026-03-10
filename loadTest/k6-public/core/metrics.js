import { Rate } from 'k6/metrics';

export const unexpectedFailRate = new Rate('unexpected_fail_rate');
