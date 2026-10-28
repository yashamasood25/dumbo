# Dumbo

Tells you which credit card to tap before you pay, what your usual card would cost you, and when to pay down before your statement closes. No login, no bank link; all data stays on the device.

## Files
- `cards.js`: card database (20 cards). Edit rates here when issuers change them, then bump `DUMBO_VERIFIED`.
- `engine.js`: recommendation logic (caps, Q4 rotating bonuses, utilization, bonus goals, calendar reminders).
- `app.js`: UI. Set `POSTHOG_KEY` and `FEEDBACK_URL` at the top.
- `sw.js`: offline support. Bump `VERSION` on each deploy.

## Deploy (Vercel, free)
1. github.com → New repository `dumbo` → "uploading an existing file" → drag in everything in this folder → Commit.
2. vercel.com → Add New → Project → import `dumbo` → Framework preset: Other → Deploy.
3. Your app is live at `dumbo-<something>.vercel.app`. Every GitHub commit redeploys automatically.
