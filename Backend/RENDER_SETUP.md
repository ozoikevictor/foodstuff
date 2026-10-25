# Render backend setup

Use the latest commit from `main`, not the initial `0265993` commit.

Service settings:

- Root Directory: `Backend`
- Runtime: Node.js 24
- Build Command: `npm ci`
- Start Command: `npm start`
- Health Check Path: `/api/health`

## Firebase credentials

Alternatively, set `FIREBASE_SERVICE_ACCOUNT_JSON` to the complete service-account
JSON as one environment variable. With this method, remove
`GOOGLE_APPLICATION_CREDENTIALS`; no Secret File is needed. Keep this variable
private and only on the backend. A generated local `.env.render` file is ignored
by Git and can be copied into Render's Add from .env option.

In Render's service dashboard, open Environment > Secret Files. Add a file named
`firebase-service-account.json` containing the service-account JSON for your Firebase
project. You can use your existing local private JSON file. Do not commit this file
to GitHub or send its contents in chat.

Set these environment variables in Render:

```dotenv
NODE_ENV=production
APP_ORIGIN=https://your-frontend.vercel.app
TAB_SESSION_TEST_MODE=false
FIREBASE_PROJECT_ID=your-project-id
FIRESTORE_DATABASE_ID=(default)
FIREBASE_WEB_API_KEY=your-firebase-web-api-key
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/firebase-service-account.json
```

Use the exact frontend origin without a trailing slash for `APP_ORIGIN`.
The JSON key must belong to the configured Firebase project and its service account
must be allowed to access Firestore and read Firebase Authentication configuration.
Enable Email/Password sign-in in Firebase Authentication. Render supplies `PORT`;
the server uses it and binds to `0.0.0.0`.

The `.env not found. Continuing without it.` message is normal on Render: its
Environment settings supply the values instead of a local file.

For payments, configure `PAYSTACK_SECRET_KEY` on the backend only.

## Uploaded images

The existing public catalogue artwork is bundled under `public/catalogue` and
serves as a fallback for its original image IDs. It does not require migrating
local upload files and does not include private customer photos.

Image bytes require persistent storage. Attach a persistent disk and set
`UPLOADS_PATH` to a directory on that disk. Migrate existing `Backend/data/uploads`
files to it separately; Git does not include those files. A free service's ephemeral
filesystem cannot preserve these uploads across deployments.

After saving the settings, deploy the latest commit. Check `/api/health` on your
backend URL. Configure the frontend API connection separately; a successful backend
startup does not replace the frontend's local API URL automatically.

References: [Render environment and secret files](https://render.com/docs/configure-environment-variables),
[Render port binding](https://render.com/docs/web-services),
[Firebase Admin setup](https://firebase.google.com/docs/admin/setup).

## Fixing "Request origin not allowed"

For the current production frontend, set this in the Render backend Environment:

```dotenv
APP_ORIGIN=https://foodstuff-zeta.vercel.app
```

Save and redeploy the backend. APP_ORIGIN is the frontend address, not the Render
backend address. For another custom domain or preview deployment, explicitly add
its exact origin to the comma-separated APP_ORIGINS setting. Only add sites you
control; do not use a wildcard. Local development keeps APP_ORIGIN=http://localhost:8080.
The frontend proxy preserves the browser Origin header so untrusted sites remain blocked.
