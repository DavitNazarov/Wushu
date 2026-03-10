import runUserLoadTest, {
  options,
  setup,
} from './k6-public/profiles/user.js';

export { options, setup };
export default runUserLoadTest;
