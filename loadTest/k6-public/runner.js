import { sleep } from 'k6';

import { rand } from './core/helpers.js';

export function runLoadProfile(context, buildEndpoints) {
  const endpoints = buildEndpoints(context);

  if (!endpoints.length) {
    throw new Error(
      'No endpoints available for this profile. Check the matching credentials and config.'
    );
  }

  const executeRequest = rand(endpoints);
  executeRequest();

  sleep(1);
}
