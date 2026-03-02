# P04.T02 — Athlete invite + approval queue

## Goal
Optional athlete sign-in via invite token; coach approves profile changes.

## Steps
1. Add DB table `athlete_invites` + `athlete_profile_change_requests`
2. Create route `/[locale]/athlete-invite/[token]` to set password and claim profile
3. Create athlete settings page (limited fields) that creates change request
4. Create coach approval page to approve/reject requests

## Acceptance
- [ ] Invite claim works
- [ ] Edits require approval
- [ ] Records remain immutable

## Notes
If password setting is hard with Supabase in MVP, use magic link + set password flow supported by provider.

