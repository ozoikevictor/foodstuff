# NaijaFresh frontend

React, TanStack Start, Tailwind CSS, and Nitro.

## Development

Use Node.js 24. Run `npm ci`, then `npm run dev`.
The local API runs separately from `../Backend` on port 3003.

## Checks

Run `npx tsc --noEmit`, `npm test`, and `npm run build`.

## Vercel

Import the GitHub repository and set Root Directory to `Frontend`.
Choose the TanStack Start framework preset and Node.js 24.
The checked-in `vercel.json` selects `npm ci` and `npm run build`.
Remove any manually entered `dist` Output Directory override and let Vercel
use the generated `.vercel/output` Build Output API files.

Keep `VITE_TAB_SESSION_TEST_MODE=false` in production.
Firebase credentials and payment secrets belong only on the backend.
Set the server-only `API_ORIGIN` environment variable on Vercel to your Render
backend origin, for example `https://your-backend.onrender.com` (no `/api` suffix).
Browser requests use the frontend's `/api` proxy so login cookies stay on the
frontend domain. On Render, set `APP_ORIGIN` to your exact Vercel frontend origin
without a trailing slash. Redeploy after changing these values.
Long-lived order update streams can reconnect when a hosting function times out;
order data also refreshes periodically.
