# Firestore Marketplace Migration

The Firebase-backed marketplace is implemented in `firebase-marketplace-server.mjs` and `firestore-marketplace.mjs`. It does not use SQLite for business data. The frontend development proxy and server-rendered public requests now target this API on port 3003.

## Run Separately

```cmd
cd /d "C:\Users\USER\Desktop\Naija Fresh\Backend"
npm run firebase:start
```

The new API defaults to `http://127.0.0.1:3003`. `FIREBASE_MARKETPLACE_PORT` can override it, but changing it also requires updating the frontend proxy and server-rendered request target. `npm start` and `npm run dev` also start this Firebase API. The preserved old API is available with `npm run legacy:start`. Health through `http://localhost:8080/api/health` reports `database: firestore` and `authentication: firebase`.

The same `/api` paths and response formats are retained for products, categories, recipes, carts, orders, payments, inventory, delivery actions, tracking, notifications, image metadata, settings, and admin analytics. Authentication uses the verified Firebase service and Firestore customer profiles/sessions. A separate Firebase session cookie avoids reusing legacy SQLite sessions.

No store administrator or rider has been created during migration. `npm run admin:create` is prepared for a later, explicitly requested Firebase administrator setup; it refuses to overwrite/promote existing accounts. `npm run legacy:admin:create` is rollback-only and creates a SQLite administrator. Rider creation remains protected by the admin API. Public registration is always CUSTOMER.

## Food Images And Recipes

`node --env-file-if-exists=.env scripts/restore-food-content.mjs` restores the existing project artwork into the admin saved-image picker, creates missing food categories, and publishes two rice recipes. It is scoped to this project's existing administrator, skips existing category/recipe slugs, and never creates saleable products or invented inventory/prices. Image metadata and recipe records are in Firestore; image bytes remain in `data/uploads`. These are reused project assets, not newly licensed stock photos or copied TikTok images.

Recipes can contain measured `ingredientNotes` independently of optional purchasable `ingredients` variation links. At least one kind of ingredient is required. Cooking references and HTTPS video links are shown on recipe detail pages. The two starter recipes use concise independently worded methods with Chef Lola's Kitchen references; the TikTok jollof feature is a related reference, not a verified step-by-step video. Admins can edit measured ingredients and link real product variations later.

Firestore collections include `users`, `backend_sessions`, `products`, `variants`, `product_slugs`, `categories`, `recipes`, `carts`, `orders`, `payments`, `payment_provider_ids`, `checkout_keys`, `notifications`, `inventory_transactions`, `delivery_locations`, `reviews`, `settings`, `uploads`, and `audit_log`.

An order embeds its item snapshots, status history, rider assignment, delivery confirmation records, evidence metadata, dispute, review, and latest active location. Historical location records are stored separately. Each event has an actor and timestamp. Customer responses omit protected delivery evidence and hide live location outside active delivery. Phone sharing requires rider consent.

Money is stored in integer kobo. Frontend prices remain in naira. Each variation has independent stock. Checkout reads prices and availability from Firestore and reserves stock in a transaction; retries and concurrent requests cannot oversell. Idempotency keys deduplicate checkout. Failed payments, cancellation, and expired reservations restore stock once. A successful payment after released stock is marked for a manual refund rather than fulfilled. Signed Paystack webhooks also verify payments through the provider API.

Rider delivery does not finalize customer receipt. Only a separate customer confirmation or an audited dispute resolution completes the order. Rider assignment and state changes are checked against the current transaction state.

Realtime event streams use Firestore snapshot listeners with role/ownership filters. Streams send invalidation events, not customer records. Session/role validity is rechecked periodically. Completed/cancelled/returned location history older than seven days is removed by housekeeping while the API is running.

Uploaded image bytes still live in the backend's private `data/uploads` directory; their metadata and access control now use Firestore. This migration does not claim to have moved images to Firebase Storage. A persistent volume or a later cloud-storage adapter is needed for deployment.

## Existing Customer Migration

The local preflight found one customer and no business catalogue/orders/payments to copy. The source SQLite file is retained. A read-only preview checks cloud UID/email conflicts before applying:

```cmd
npm run firebase:customers:preview
npm run firebase:customers:test
npm run firebase:customers:migrate
```

The compatibility test uses a temporary Firebase identity with a known test password, imports the same standard-scrypt format used by Node, verifies sign-in, then deletes the identity. The migration preserves customer UIDs and original password hashes through Firebase's supported STANDARD_SCRYPT import (N=16384, r=8, p=1, 64-byte derived key; legacy salt bytes are UTF-8 hex strings). Password hashes are not copied to Firestore profiles. Existing Firebase accounts are not overwritten. Non-customer legacy roles are rejected rather than promoted. SQLite sessions are not migrated; customers sign in again after the frontend switches.

This script is intended for the inspected customer-only source. It stops on conflicts and does not import arbitrary existing product/order records. If business records are added to SQLite before cutover, repeat the preflight and implement that data transfer before switching. Do not run customer import while accepting new sign-ups on both backends.

## Verification

`npm test` runs isolated automated tests. Live verification runs against real Firestore under one `_backend_validation/marketplace-<random>` document and its subcollections:

```cmd
npm run firebase:test:live -- --allow-isolated-test-data
```

Live tests validate catalogue references, money/variant identity, recipe links, carts, concurrent stock reservations, idempotency, ownership, order workflow, private tracking/evidence, consent, notifications, event-stream setup, disputes, reviews, analytics, and cleanup. Synthetic role fixtures are confined to the test namespace; no real Firebase administrator/customer/rider is created by that test. Its injected payment provider exists only inside the test script and takes no money. Production uses the real provider or disables checkout when the secret is absent.

The test deletes only its isolated namespace and temporary image files. It never populates the real store catalogue. If interrupted, the command identifies the test path for cleanup.

## Security And Cutover

The supplied `firestore.rules` denies direct browser reads/writes; backend Admin SDK access uses IAM. The rules/index files are supplied for review and are not automatically deployed. `firestore.indexes.json` excludes large embedded item/history arrays from indexes; normal single-field ownership/status queries do not require composite indexes. Verify your project's existing production rules before allowing client SDK access.

The frontend targets port 3003 after backend validation and customer import. Keep the legacy API stopped during normal use so new sign-ups do not diverge. Production hosting must also forward `/api` to the Firebase backend; Vite's development proxy does not configure a production reverse proxy. SQLite remains available for rollback; new Firebase orders will not be replicated back to SQLite. Mock payments are not enabled.

Remaining production work from the original setup guide still applies: real payment-provider sandbox/live onboarding, refunds, email/push queues, durable image storage, logistics/background GPS, account recovery/MFA, pagination/load tests, backup/monitoring, and retention policies for evidence/customer data. This is a database/backend migration, not a claim that every external service is deployed.

Reference: [Firebase password import](https://firebase.google.com/docs/auth/admin/import-users).
