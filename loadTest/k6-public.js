import runPublicLoadTest, {
  options,
  setup,
} from './k6-public/profiles/public.js';

export { options, setup };
export default runPublicLoadTest;
