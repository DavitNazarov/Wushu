import runAdminLoadTest, {
  options,
  setup,
} from './k6-public/profiles/admin.js';

export { options, setup };
export default runAdminLoadTest;
