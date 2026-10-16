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
The production backend URL and API proxy must be configured separately before
shopping, login, or server-rendered product pages can work online; the current
local API connection is for development.
