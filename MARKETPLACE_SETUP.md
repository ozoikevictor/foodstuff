# NaijaFresh Marketplace Setup

The backend and frontend now use Firebase Authentication and Cloud Firestore through the Node.js API on port 3003. Start the backend with `npm run dev` in Backend, then start the frontend with `npm run dev` in Frontend and open `http://localhost:8080`. Keep the existing configured Backend/.env; do not overwrite it. See [the current backend guide](Backend/README.md). Administrator and product setup remain separate next steps.

The instructions below are the original local setup reference. For database configuration, migration, and current limitations, use [the Firestore guide](Backend/FIRESTORE_MARKETPLACE.md). SQLite is retained only for rollback; it is no longer the website's active database.

The React 19 / TanStack Start application connects to the Node.js Firebase API. Branding and customer navigation are retained. Node.js 24 or later is required. No sample store catalogue is inserted.

## Start Locally

Start the backend first in Command Prompt:

```cmd
cd /d "C:\Users\USER\Desktop\Naija Fresh\Backend"
npm install
copy .env.example .env
```

Edit `Backend/.env` and fill in `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 12 characters. These are your own administrator credentials; no default password is provided.

```cmd
npm run admin:create
```

Remove `ADMIN_PASSWORD` from `.env` after creating the administrator. Then run:

```cmd
npm run dev
```

In a second Command Prompt window, start the frontend:

```cmd
cd /d "C:\Users\USER\Desktop\Naija Fresh\Frontend"
npm install
npm run dev
```

Open `http://localhost:8080`. Use **localhost**, matching `APP_ORIGIN`, rather than `127.0.0.1`. If an old server is running, stop its terminal with Ctrl+C first. Backend runs the API on port 3001; Frontend runs the website on port 8080. Keep both terminals open. The folders have separate dependencies and configuration.

Visit `/login` and sign in. Administrators are directed to `/admin`; riders to `/rider`; customers to `/account`. The admin API enforces permissions independently of the page.

## Populate Your Store

1. In Website Settings, configure your actual pickup address/coordinates, support phone, and delivery zones with fees in naira.
2. Add categories and upload images. A category can have a parent category.
3. Add products, descriptions, images, and variations. Each variation has its own measurement label, selling price, optional original price, available pack count, and low-stock threshold.
4. Use the featured toggle and collections to control product placement. Archive products to remove them from sale without losing order history. Disable a variation to withdraw only that quantity.
5. Publish recipes with uploaded images, times, servings, method, and links to exact product variations. Ingredient quantities are counts of the selected pack (for example, two packs of 500 g), not arbitrary unit conversions.
6. Create rider accounts through Customers & Riders. Share initial credentials securely and have riders sign in. Rider phone sharing is off until the rider opts in in their profile.

Product quantities represent sellable packs: stock 5 for a `1 kg` variation means five 1 kg packs. Stock for different variations is independent; it does not automatically convert a shared physical sack into smaller packs. Manage those counts consistently when restocking.

The old `src/data/mock.ts` remains a legacy reference, not the production catalogue. The database starts empty. Enter verified business information; do not assume the old sample prices are current.

## Configuration

| Variable | Purpose |
| --- | --- |
| `APP_ORIGIN` | Exact browser origin; used for mutation origin checks and payment callback URLs. Use HTTPS in production. |
| `API_PORT` | API listening port, default 3001. Development proxy and SSR currently expect 3001. |
| `DATABASE_PATH` | Persistent SQLite database path. Default `Backend/data/marketplace.sqlite`; `.env` paths are relative to the Backend working directory. |
| `UPLOADS_PATH` | Persistent image storage directory. Default `Backend/data/uploads`. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | One-time administrator bootstrap inputs. Existing accounts are not overwritten. |
| `PAYSTACK_SECRET_KEY` | Backend-only Paystack secret. Leave blank to disable checkout; baskets remain intact. |
| `VITE_MAPBOX_TOKEN` | Optional public, domain-restricted Mapbox token. Rebuild after changing it in production. |

Backend variables belong in `Backend/.env`; only `VITE_MAPBOX_TOKEN` belongs in `Frontend/.env`. Never put a secret in a variable starting with `VITE_`. `.env` and database/upload directories are ignored by Git.

## Payments And Inventory

Use Paystack test credentials first. The backend initializes a hosted checkout, calculates totals from database prices, and verifies reference, NGN currency, and amount. The browser callback is not proof of payment.

Configure your Paystack webhook to `https://YOUR_DOMAIN/api/payments/webhook`. HMAC-SHA512 signatures are checked against the exact request bytes, and successful notifications are verified with Paystack before changing an order. A public HTTPS deployment is required for provider webhooks; localhost is not reachable by Paystack.

Inventory is reserved atomically at checkout for 30 minutes. A unique customer/idempotency key prevents duplicate orders. Cancellation, verified payment failure, and reservation expiry restore stock once. Provider retries cannot confirm payment twice. A success received after reserved stock was released is marked `refund_required`, not sent for fulfilment. Refunds must currently be processed manually in Paystack; the dashboard flags these cases but does not issue a refund.

Reference: [Paystack webhook validation](https://paystack.com/docs/payments/webhooks/).

## Delivery And Location

Admins advance paid orders through confirmation, preparation, and dispatch, then assign a rider. Riders accept or reject assignments, confirm pickup, start delivery, submit location updates, and mark delivery with notes or an optional image. Customers separately confirm receipt or open a dispute. Only customer confirmation or an audited admin dispute resolution completes delivery.

Location sharing uses the rider browser's actual geolocation while the delivery screen remains open. It requires location permission and HTTPS outside localhost. This is foreground tracking only: it is **not reliable background tracking**. A production mobile rider app or an authorized logistics API must be integrated for that requirement. No GPS movement is fabricated. The map shows last received coordinates and Mapbox driving estimates, not a guaranteed arrival time.

Location is exposed only for active assigned deliveries, and customer access stops after rider delivery or cancellation. Customers cannot read another customer's order or tracking data. Rider phone numbers are returned only after rider consent and during relevant deliveries. Delivery evidence images are restricted to the uploader and administrators. Completed/cancelled/returned GPS records are deleted after seven days by the API housekeeping task.

Map reference: [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/).

## Backend Endpoints

All routes are under `/api`. Mutating browser requests require the configured Origin. Auth uses HttpOnly SameSite cookies (Secure under HTTPS); passwords use salted scrypt and sessions are stored as token hashes. Login/register requests are rate-limited in the single API process.

| Routes | Access |
| --- | --- |
| `GET /categories`, `/products`, `/products/:id`, `/recipes`, `/recipes/:slug`, `/config` | Public catalogue/configuration |
| `POST /auth/register`, `/auth/login`, `/auth/logout`; `GET /auth/me` | Customer registration and sessions |
| `PATCH /profile` | Signed-in profile and rider contact consent |
| `GET/PUT /cart` | Customer's saved basket |
| `GET /notifications`, `PATCH /notifications/:id`, `DELETE /notifications` | Own notification records |
| `GET /events` | Authenticated server-sent invalidation events; data still fetched through authorized endpoints |
| `GET/POST /orders`, `GET /orders/:id` | Own orders; admins see all, riders see assigned orders |
| `POST /orders/:id/cancel`, `/confirm`, `/dispute`, `/review` | Role and lifecycle checks enforced |
| `POST /orders/:id/status`, `/assign`, `/resolve` | Admin only |
| `POST /orders/:id/rider`, `/location` | Assigned rider only |
| `POST /payments/:reference/initialize`, `/verify` | Owner or administrator |
| `POST /payments/webhook` | Signed Paystack webhook |
| `GET /admin/overview`, `/customers`, `/payments`, `/inventory`, `/reviews` | Admin only |
| `GET/POST/PUT/DELETE /admin/products`, `/admin/recipes`; `POST/PUT/DELETE /admin/categories` | Admin catalogue management |
| `POST /admin/riders`; `GET/PUT /admin/settings` | Admin only |
| `POST /images`, `GET /images/:id` | Authorized upload; public catalogue or protected evidence retrieval |

Images are restricted to JPEG, PNG, or WebP signatures and a 5 MB limit, with generated file IDs and no caller-controlled paths. SVG and executable uploads are rejected.

Database migrations run automatically, once per migration file. The schema includes foreign keys, indexes, status history, inventory transactions, delivery evidence/confirmations, disputes, ratings, sessions, notifications, and audit records.

## Verification

```cmd
cd /d "C:\Users\USER\Desktop\Naija Fresh\Backend"
npm test
cd /d "C:\Users\USER\Desktop\Naija Fresh\Frontend"
npx tsc --noEmit
npm test
npm run build
```

Backend integration tests use an isolated in-memory database and a test-only provider stub. Production never uses the stub. Tests cover authentication/role checks, origin checks, private order access, variant/recipe linking, inventory reservation/idempotency/restoration, amount verification, signed webhook retries, late payments, assigned rider location privacy, and separate customer delivery confirmation.

## Deployment And Remaining Production Work

The build targets a Node server. Run the API and `.output/server/index.mjs` as separate supervised processes on the same host; terminate HTTPS at a reverse proxy. Route `/api/*` to `127.0.0.1:3001` without buffering SSE, and other requests to the frontend Node port. Public browser requests and payment callbacks must use one `APP_ORIGIN`. The storefront SSR public-data client currently calls `127.0.0.1:3001`, so hosting the API on another machine requires changing that configuration.

Use one API instance with a persistent local SQLite volume. Back up SQLite consistently (including live WAL state using SQLite backup tooling) and back up uploaded images. Ephemeral/serverless storage and multiple API replicas are not supported by this implementation. Horizontal deployment needs a shared database, event bus, session rate-limit store, and object storage adapter.

Before calling this production-ready, complete:

- Real Paystack sandbox callback/webhook tests, live-key onboarding, refund procedures, and payment reconciliation.
- Actual Mapbox-token/map/route tests and real-device location tests; a mobile/background tracking integration if required.
- A selected third-party logistics adapter. The internal assignment workflow exists; no external courier API is connected.
- Email/push providers and delivery/retry queues. Current notifications are persisted and live in-app only.
- Account recovery, email verification, stronger administrator account controls, and a rider credential-change flow.
- Geographic delivery-boundary validation and map/address selection; checkout currently accepts coordinates and configured zone names.
- Image decoding/re-encoding and metadata removal, malware scanning where appropriate, object storage, upload quotas, and consent/retention policies for delivery evidence.
- Evidence/notification/customer-data retention and deletion policies beyond the seven-day GPS cleanup.
- Independent security/load tests, pagination, monitoring, operational backups, and accessibility checks for every dashboard form.

This is a connected local implementation with verified backend workflows, not a claim that all seven production phases or provider integrations are complete. No deployment or live payment was performed.
