import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { runSeed } from './seed-category-templates';
import { runMockDataSeed } from './seed-mock-data';
import { runResultsSeed } from './seed-results';

async function main() {
  await runSeed();
  await runMockDataSeed();
  await runResultsSeed();
}

void main();
