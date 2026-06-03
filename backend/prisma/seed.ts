import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { runSeed } from './seed-category-templates';

async function main() {
  await runSeed();

  if (process.env.SEED_MOCK_DATA === '1') {
    const { runMockDataSeed } = require('./seed-mock-data') as typeof import(
      './seed-mock-data'
    );
    const { runResultsSeed } = require('./seed-results') as typeof import(
      './seed-results'
    );
    await runMockDataSeed();
    await runResultsSeed();
  }
}

void main();
