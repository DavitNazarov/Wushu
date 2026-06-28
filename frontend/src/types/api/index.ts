// Barrel for the API request/response types. The definitions live in domain
// modules (enums, catalog, competition, admin) but are re-exported here so the
// existing `import { ... } from '@/types/api'` paths across the app keep working
// unchanged.
export * from './enums';
export * from './catalog';
export * from './competition';
export * from './admin';
