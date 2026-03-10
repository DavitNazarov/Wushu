import { options } from '../core/config.js';
import { buildDestructiveEndpoints } from '../groups/destructive.js';
import { buildAdminMutationEndpoints } from '../groups/mutations.js';
import { buildAdminReadEndpoints } from '../groups/reads.js';
import { runLoadProfile } from '../runner.js';
import { createSetup } from '../setup/index.js';

const setup = createSetup({
  admin: true,
  user: false,
  coach: false,
  judge: false,
  discoverAdminEventId: true,
  discoverAdminIds: true,
  requireAdmin: true,
  requireEventId: true,
});

export { options, setup };

export default function runAdminLoadTest(context) {
  runLoadProfile(context, (profileContext) => [
    ...buildAdminReadEndpoints(profileContext),
    ...buildAdminMutationEndpoints(profileContext),
    ...buildDestructiveEndpoints(profileContext),
  ]);
}
