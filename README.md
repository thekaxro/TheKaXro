# The KaXro

Cloudflare Workers + D1 storefront for The KaXro. The existing beige/gold storefront and responsive layout are retained.

## What was fixed

- Customer signup now uses the Worker/D1 binding correctly and returns the real backend error instead of masking it as a generic failure.
- Customer sign-in, logout, sessions, profile saving, duplicate-email protection and server-side authorization are wired end-to-end.
- Passwords are stored as salted PBKDF2 hashes; plaintext passwords are never stored.
- The account modal now says `Welcome` for account creation and `Welcome back` for sign-in.
- The owner-access sentence was removed from the customer account modal.
- The supplied `payment-qr.jpg` is used byte-for-byte as provided.
- Checkout stores orders in D1 and keeps payment status `submitted` until an owner manually verifies the UTR.
- `/admin` opens the owner admin interface; every admin API route checks the authenticated user's `owner` role on the server.
- Admin sections cover dashboard statistics, orders/payment verification, notes and CSV export, products/inventory, customers, discount codes and store settings.
- API inputs are validated and D1 queries are parameterized.
- Best-effort login/signup/order rate limiting was added at the Worker isolate level.
- Static asset exclusions keep Worker code, migrations and configuration out of public asset URLs.

## Important deployment detail

The uploaded project did **not** contain a Cloudflare D1 `database_id`. The Wrangler file therefore uses the explicit placeholder `8a251e00-a961-4883-9432-427b73544aa2` rather than inventing a database ID. This must be replaced with the ID of the **existing** `thekaxro-db`; do not create a replacement database.

Retrieve the existing ID with:

```bash
npx wrangler d1 list
```

Then replace only `8a251e00-a961-4883-9432-427b73544aa2` in `wrangler.jsonc`.

## D1 migrations

`migrations/0001_initial.sql` is the original non-destructive schema supplied with the project. Do not edit it for an already-initialized production database.

`migrations/0002_order_coupon_code.sql` is new. It:

1. Adds `orders.coupon_code`.
2. Prevents coupon `used_count` from exceeding `max_uses`.
3. Prevents product stock from becoming negative.

Check the remote migration state first:

```bash
npx wrangler d1 migrations list thekaxro-db --remote
```

Apply only unapplied migrations:

```bash
npx wrangler d1 migrations apply thekaxro-db --remote
```

Do not use a reset/drop command on the production database.

## Owner setup

1. In Cloudflare Worker Settings, create a secret named `ADMIN_SETUP_KEY`.
2. Deploy the Worker.
3. Send one authenticated setup request to `/api/admin/setup` with the `X-Admin-Setup-Key` header and JSON containing `name`, `email`, and a password of at least 10 characters.
4. The setup endpoint refuses to create another owner once an owner already exists.
5. Sign in at `/admin` using the owner credentials.

Never put `ADMIN_SETUP_KEY` or an admin password in `index.html`, `script.js`, GitHub, or the public assets.

## Deployment

```bash
npm install
npx wrangler d1 list
# put the existing database ID into wrangler.jsonc
npx wrangler d1 migrations list thekaxro-db --remote
npx wrangler d1 migrations apply thekaxro-db --remote
npx wrangler deploy
```

Keep these existing Cloudflare values:

- Worker name: `thekaxro`
- Worker entry point: `src/index.js`
- D1 database name: `thekaxro-db`
- D1 binding: `DB`
- Static assets binding: `ASSETS`
- Static asset directory: `.`

The only project value that could not be preserved automatically was the D1 UUID because it was absent from the supplied ZIP. The existing UUID from your Cloudflare account must be inserted in the one placeholder location above.
