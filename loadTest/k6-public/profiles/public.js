import { options } from '../core/config.js';
import { buildPublicGetEndpoints } from '../groups/public.js';
import { runLoadProfile } from '../runner.js';
import { createSetup } from '../setup/index.js';

const setup = createSetup({
  admin: false,
  user: false,
  coach: false,
  judge: false,
  discoverPublicEventId: true,
  discoverPublicNewsSlug: true,
  discoverPublicBracketCategoryId: true,
  discoverPublicMatName: true,
  requireEventId: true,
});

export { options, setup };

export default function runPublicLoadTest(context) {
  runLoadProfile(context, (profileContext) => [
    ...buildPublicGetEndpoints(profileContext),
  ]);
}
