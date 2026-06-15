// Seed users (from backend/prisma/seed-mock-data.ts). The suite assumes the
// mock data seed has been run (SEED_MOCK_DATA=1). DEFAULT_PASSWORD is shared.
export const SEED_PASSWORD = 'Password123!';

export const ADMIN = {
  email: 'admin@geowushu.ge',
  password: SEED_PASSWORD,
  role: 'admin' as const,
};

// A Georgian coach bound to a single club (Tbilisi Wushu Club) — used to
// verify own-club scoping.
export const COACH = {
  email: 'davit.k@tbilisiwushu.ge',
  password: SEED_PASSWORD,
  role: 'coach' as const,
  clubName: 'Tbilisi Wushu Club',
};

export const STORAGE = {
  admin: 'e2e/.auth/admin.json',
  coach: 'e2e/.auth/coach.json',
};
