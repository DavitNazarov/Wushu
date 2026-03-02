# P01.T00 — Add Supabase client

## Goal
Install and configure Supabase client with typed helpers.

## Steps
1. Install: `npm i @supabase/supabase-js`
2. Create `src/services/supabaseClient.ts` (reads env vars)
3. Create `src/services/authService.ts` (signIn/signOut/getSession)

## Acceptance
- [ ] Supabase client initializes without errors
- [ ] Auth service functions exist and are typed

## Notes
Read `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.local`. Do not commit secrets.

