# Stage 1: Node.js Backend To Real Firebase

Firebase Cloud Firestore is the selected database. The existing backend is already Node.js. This stage verifies a real Firebase connection before replacing the existing SQLite queries or changing the frontend. No administrator or product is created.

## Local Configuration

1. Create or open your project in the Firebase console.
2. In Build > Firestore Database, create a Standard edition database in production mode. Note its database ID (usually `(default)`). Choose the region for your business before creating it.
3. Copy the Project ID from Project Settings into `FIREBASE_PROJECT_ID` in `Backend/.env`.
4. For this local server, use Project Settings > Service accounts > Firebase Admin SDK to obtain a private service-account JSON key. Keep it in `Backend/secrets/` (ignored by Git) or a private location outside the repository. Do not send it in chat.
5. Set `GOOGLE_APPLICATION_CREDENTIALS` in `Backend/.env` to its absolute file path, using forward slashes on Windows. Set `FIRESTORE_DATABASE_ID=(default)` unless you created a named database.

Example with placeholders:

```dotenv
FIREBASE_PROJECT_ID=your-project-id
FIRESTORE_DATABASE_ID=(default)
GOOGLE_APPLICATION_CREDENTIALS=C:/private/firebase-service-account.json
```

The service account needs permission to access Firestore in the selected project. On a managed Google hosting environment, use an assigned service identity/Application Default Credentials instead of distributing a JSON key. Never put service-account secrets into frontend configuration.

## Test Before Migration

```cmd
cd /d "C:\Users\USER\Desktop\Naija Fresh\Backend"
npm install
npm run db:test
```

`db:test` makes an authenticated read of a new, nonexistent test document in the real project. It does not read customer records or create documents. Emulator settings are rejected, and missing credentials cause failure instead of a mock success.

After that passes, `npm run db:test:write` creates one uniquely named document under `backend_connection_checks`, reads it back, deletes it, and verifies cleanup. If the process is interrupted or deletion fails, remove only the test document identified by the command. This is a real Firestore operation, not a simulated database test.

## Next Stages

After the live connection passes, migrate backend repositories and stock/order transactions from SQLite to Firestore, then test them. Decide the Firebase Authentication migration for customer/admin/rider identities at that backend stage. Only after backend tests pass should frontend authentication/API integration be changed, followed by administrator setup and products.

The existing SQLite database remains intact and is still used by current application routes until that migration is implemented. Installing Firebase Admin does not itself migrate the application.

Firestore Admin/server access is controlled by Google credentials/IAM, not browser security rules. Do not enable public read/write rules. No rules or cloud configuration are deployed by these scripts.

References: [Firebase Admin setup](https://firebase.google.com/docs/admin/setup), [Firestore server setup](https://firebase.google.com/docs/firestore/quickstart-server).
