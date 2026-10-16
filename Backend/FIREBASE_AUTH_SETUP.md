# Stage 2: Firebase Authentication Backend

This stage adds a separate Node.js authentication test API using real Firebase Authentication and Firestore. The customer website and existing SQLite API are unchanged. No administrator, rider, or product is created.

## Enable Email And Password

In Firebase Console for `naijafresh-4cd5a`, open Security > Authentication > Get started > Sign-in method > Email/Password. Enable password sign-in and save. Passwordless email-link sign-in is not needed for this stage.

Run `npm run auth:check` from `Backend`. This reads configuration only; it does not change Firebase settings or create accounts. It reports whether Email/Password is enabled and whether an API key is available, without printing credentials. The service account must be allowed to read Firebase Authentication configuration. If automatic API-key discovery is unavailable, set `FIREBASE_WEB_API_KEY` in `Backend/.env` using the Web API key in Firebase Project Settings > General.

## Start The Separate Backend Test API

```cmd
cd /d "C:\Users\USER\Desktop\Naija Fresh\Backend"
npm run auth:start
```

The authentication API listens on loopback port 3002, independently of the current app API on port 3001. Do not change the frontend proxy until the backend live tests pass. Keep `APP_ORIGIN` configured for the intended frontend, currently `http://localhost:8080`.

| Route | Behavior |
| --- | --- |
| `POST /api/auth/register` | Creates a Firebase email/password customer, Firestore profile, and backend session. |
| `POST /api/auth/login` | Verifies credentials with Firebase and creates a backend session. |
| `GET /api/auth/me` | Returns the current customer profile or null. |
| `POST /api/auth/logout` | Deletes the current Firestore session and clears its cookie. |
| `PATCH /api/profile` | Updates the authenticated user's name and phone only. |

Registration accepts `name`, `email`, `phone`, and `password` (12+ characters). A caller-supplied role is ignored; every registration creates a CUSTOMER. Roles are stored in server-owned Firestore profiles and cannot be changed through profile updates. Phone numbers in profiles are user-provided, not verified phone-auth identities.

Firebase manages passwords. The Node backend does not store them in Firestore. Verified Firebase ID tokens are exchanged for random backend session tokens; only token hashes are persisted under `backend_sessions`. Cookies are HttpOnly, SameSite=Lax, and Secure for HTTPS origins. Session records expire after seven days; configure a Firestore TTL policy on `backend_sessions.expiresAt` for storage cleanup. Expired sessions are rejected even if TTL cleanup has not run. Disabled/deleted accounts and Firebase global token revocations invalidate backend access. Logout revokes the current device session only.

Live tests should use a specifically approved temporary Firebase customer and remove its Firebase identity, Firestore profile, and sessions afterwards. Automated tests use isolated test doubles; production has no fake-provider fallback. Existing SQLite accounts are not copied or removed in this stage.

## Current Limits

This authentication API is a staging step, not the completed marketplace migration. Product/order/inventory/delivery queries still need migration before switching the full website. Notifications, email verification/recovery, MFA, distributed rate limits, and profile/account migration require later work. Firestore profile/session collections must not be publicly writable. Firebase Admin uses server IAM permissions and does not rely on browser security rules for authorization.

References: [Firebase Auth REST API](https://firebase.google.com/docs/reference/rest/auth/), [Firebase ID-token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens).
