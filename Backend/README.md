# NaijaFresh Backend

## Local Tab Testing

For side-by-side account testing, set Backend `TAB_SESSION_TEST_MODE=true` and Frontend `VITE_TAB_SESSION_TEST_MODE=true`, then restart both servers. This is enabled locally now. Open separate fresh tabs and sign in through the same login page with separate admin/customer accounts. Each tab has a sessionStorage namespace selecting its own HttpOnly cookie; credentials are never stored in browser storage. Cart/wishlist persistence and authenticated event streams follow the same tab. Refresh keeps that tab signed in; logging out affects only that tab. Previously shared logins are not reused: sign in again in each tab.

Use fresh tabs, not Duplicate Tab, which browsers may initialize with a copy of sessionStorage. Tab identifiers are cookie selectors, not credentials, and do not grant roles. Backend role and ownership checks remain active. This feature is localhost-only and defaults off in the example configurations. Set both flags to false and restart to return to normal shared sessions before deployment. Ordinary shared-session cookies are preserved, not deleted by tab testing. Test session cookies expire after seven days; log out before closing test tabs.

The default `npm run dev` and `npm start` run the Firebase marketplace API on port 3003. The frontend forwards `/api` requests to this API. See [Firestore migration and cutover](FIRESTORE_MARKETPLACE.md). `npm run legacy:start` runs the preserved SQLite API only for rollback.

Firebase Authentication handles identities and Cloud Firestore stores application data. See [Firebase connection setup](FIREBASE_CONNECTION.md) and `npm run db:test`. Administrator and product setup are separate steps.

Standalone Node.js 24+ API, Firebase authentication, Firestore data, local image storage, and integration tests. The customer/admin/rider screens remain in `../Frontend`.

In Command Prompt:

```cmd
cd /d "C:\Users\USER\Desktop\Naija Fresh\Backend"
npm install
rem Only on first setup: copy .env.example .env and configure credentials.
npm run dev
```

The API runs at `http://127.0.0.1:3003`. Keep this terminal open, and start the frontend in another terminal with `npm run dev` from the Frontend folder. Open `http://localhost:8080`. Browser requests are forwarded by the frontend to this API. Customers must sign in again after switching from SQLite; imported customer passwords are preserved.

Set your own `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters) in this folder's `.env`, then run `npm run admin:create` once. Remove `ADMIN_PASSWORD` afterwards. Sign in through `http://localhost:8080/login`.

Run `npm test` for backend integration tests. Use `npm start` to run without the development watcher.

## Checkout And Perishables

Cart is basket review only; `/checkout` requires a customer session and collects delivery details before opening secure provider payment. Payments remain unavailable without a configured real provider. Failed payment initialization leaves a link to the pending order for retry.

Product fields `perishable`, `orderStart`, and `orderCutoff` are editable in Admin > Products. Windows repeat daily in Africa/Lagos, opening inclusive and cutoff exclusive; overnight windows are rejected. Existing starter meat, seafood, vegetables, fruit and frozen chicken use 08:00–14:00. Outside the window the shop disables adding these products and checkout enforces the rule transactionally, including items already in carts. Nonperishable products remain unaffected. Customers request delivery within one or two hours; this is saved with the order, not a dispatch guarantee or automated logistics service.

At the owner's request, `scripts/add-starter-products.mjs` added 12 visible food listings with existing saved images, temporary prices and 20 units per variation. Eight carry the `popular` tag and four carry `deal`, matching the homepage filters. These are not verified market prices, actual pack contents, or physical stock. Review them under Admin > Products before accepting orders. Normal admin edits persist in Firestore and are reflected in Shop and homepage queries. The importer skips existing product slugs and never resets later admin edits; it is not run automatically on startup.

The old SQLite database and uploaded image bytes are preserved under `data/`. Current application records are in Firestore. Never put service-account credentials or the Paystack secret in the frontend. See [the marketplace setup guide](../MARKETPLACE_SETUP.md) for provider configuration, workflows, and production limitations.
