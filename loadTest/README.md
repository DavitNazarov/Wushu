# Load Tests

## Available scripts

- `loadTest/k6-public.js` — public APIs only
- `loadTest/k6-public.js` — public APIs only
- `loadTest/k6-user.js` — public/user traffic only
- `loadTest/k6-coach.js` — coach APIs only
- `loadTest/k6-admin.js` — admin APIs only

Configuration file: `loadTest/k6-public/.env`

Behavior:
- values are loaded from `loadTest/k6-public/.env`
- CLI `__ENV` values passed to `k6 run -e KEY=value` override the file
- `k6-public.js` does not require auth credentials
- `USER_EMAIL` and `USER_PASSWORD` are used by `k6-user.js`
- thresholds now use `unexpected_fail_rate`, not built-in `http_req_failed`
- `RUN_CONTACT_FORM=false` by default because `/api/forms/contact` is rate-limited
- if IDs such as `EVENT_ID` or `FIGHT_ID` are empty, `setup()` tries to discover them automatically

Example:

```bash
k6 run loadTest/k6-public.js
k6 run loadTest/k6-user.js
k6 run loadTest/k6-coach.js
k6 run loadTest/k6-admin.js
```

Override a single value from the command line:

```bash
k6 run -e VUS=20 -e DURATION=30s loadTest/k6-public.js
```
