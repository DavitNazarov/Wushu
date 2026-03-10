import { options } from '../core/config.js';
import { buildCoachMutationEndpoints } from '../groups/mutations.js';
import { buildCoachReadEndpoints } from '../groups/reads.js';
import { runLoadProfile } from '../runner.js';
import { createSetup } from '../setup/index.js';

const setup = createSetup({
  admin: false,
  user: false,
  coach: true,
  judge: false,
  requireCoach: true,
});

export { options, setup };

export default function runCoachLoadTest(context) {
  const coachContext = {
    ...context,
    adminToken: '',
  };

  runLoadProfile(coachContext, (profileContext) => [
    ...buildCoachReadEndpoints(profileContext),
    ...buildCoachMutationEndpoints(profileContext),
  ]);
}
