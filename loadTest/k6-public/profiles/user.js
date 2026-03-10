import { options } from '../core/config.js';
import { buildPublicGetEndpoints } from '../groups/public.js';
import {
  buildOptionalContactEndpoints,
  buildUserReadEndpoints,
} from '../groups/reads.js';
import { runLoadProfile } from '../runner.js';
import { createSetup } from '../setup/index.js';

const setup = createSetup({
  admin: false,
  user: true,
  coach: false,
  judge: false,
  discoverPublicEventId: true,
  discoverPublicNewsSlug: true,
  discoverPublicBracketCategoryId: true,
  discoverPublicMatName: true,
  requireUser: true,
  requireEventId: true,
});

export { options, setup };

export default function runUserLoadTest(context) {
  runLoadProfile(context, (profileContext) => [
    ...buildPublicGetEndpoints(profileContext),
    ...buildUserReadEndpoints(profileContext),
    ...buildOptionalContactEndpoints(profileContext),
  ]);
}
