# NaijaFresh

Nigerian foodstuff marketplace with a customer storefront, recipes, saved items,
shopping basket, account profiles, and admin and rider dashboards.

## Project structure

- `Frontend/`: React and TanStack Start application.
- `Backend/`: Node.js API using Firebase Authentication and Cloud Firestore.

Requires Node.js 24 or newer. Install dependencies with `npm ci` in each folder.
Copy each folder's `.env.example` to `.env` and fill in your own settings.
Never commit credentials or service-account files.

## Local development

Run `npm run dev` in `Backend/`, then run `npm run dev` in `Frontend/`
in a separate terminal. Open http://localhost:8080.

## Verification

- Frontend: `npx tsc --noEmit` and `npm test`.
- Backend: `npm test`.

## Hosting

The frontend and backend are separate applications. Use their respective folders
as the project roots on your hosting services. The frontend builds for Vercel;
see [frontend hosting settings](Frontend/README.md). API hosting is still a
separate step: the frontend currently forwards API requests to the local backend
on port 3003, and the backend currently listens on localhost. Update the API
connection and backend network settings before deployment.

Firebase records are stored remotely. Uploaded image files live under
`Backend/data/uploads/` and are intentionally excluded from Git. Move these files
to persistent hosting storage separately when deploying; pushing this repository
does not migrate them.

See [backend setup](Backend/README.md),
[Firebase connection](Backend/FIREBASE_CONNECTION.md), and
[marketplace setup](MARKETPLACE_SETUP.md) for configuration details.
