# The KaXro deployment guide

## 1. Replace the project files

Replace the GitHub project with the files from the supplied ZIP. Keep your existing Cloudflare Worker and D1 database; do not create a new database.

## 2. Restore the existing D1 ID

The supplied ZIP did not contain the D1 UUID, so `wrangler.jsonc` contains:

`8a251e00-a961-4883-9432-427b73544aa2`

Run:

```bash
npx wrangler d1 list
```

Find the database named `thekaxro-db` and put its existing UUID into `wrangler.jsonc` as `database_id`.

## 3. Check migration state before applying anything

```bash
npx wrangler d1 migrations list thekaxro-db --remote
```

The original `0001_initial.sql` must remain unchanged. The project adds only `0002_order_coupon_code.sql`.

If `0002` is listed as unapplied, run:

```bash
npx wrangler d1 migrations apply thekaxro-db --remote
```

Do not reset, drop, or recreate the production database.

## 4. Set the owner setup secret

In Cloudflare Worker Settings, add a secret named `ADMIN_SETUP_KEY`.

Use a strong random value and keep it out of GitHub and frontend files.

## 5. Deploy

```bash
npm install
npx wrangler deploy
```

## 6. Create the owner account once

After deployment, send a POST request to `/api/admin/setup` with:

- Header: `X-Admin-Setup-Key: <your secret>`
- JSON body containing `name`, `email`, and a password of at least 10 characters.

The endpoint refuses to create another owner after the first owner exists.

## 7. Verify the deployment

Check:

```text
/api/health
/api/products
/admin
```

Then test signup, duplicate signup, login, logout, profile saving, cart checkout, UTR submission, manual payment verification, stock changes, discount codes, order notes and CSV export.

## Values intentionally preserved

- Worker: `thekaxro`
- Entry point: `src/index.js`
- D1 name: `thekaxro-db`
- D1 binding: `DB`
- Assets binding: `ASSETS`
- Assets directory: `.`
- Support email: `thekaxro@gmail.com`
- UPI ID: `9719747071@fam`
- Payment image: exact supplied `payment-qr.jpg`


### Password hashing compatibility
The Worker uses PBKDF2-HMAC-SHA-256 with 100,000 iterations because Cloudflare Workers Web Crypto rejects PBKDF2 iteration counts above 100,000 in this runtime. New passwords are stored with the iteration count in the hash format.

## 8. Frame categories, sizes and personalization

This version adds the `Personalize` product category, checkout frame sizes (A4/A3/A2/A1), and Pinterest-link or image-upload personalization for products whose category is `Personalize`.

After deployment, apply the new migration:

```bash
npx wrangler d1 migrations apply thekaxro-db --remote
```

In the owner Admin Panel → Products, create/add products with categories such as `Anime`, `Cars`, `Games`, `Minimal`, or `Personalize`.

For a `Personalize` product, checkout requires either a Pinterest/pin.it image link or a PNG/JPG/WebP upload up to 1.5 MB. The selected frame size is stored with the order.


## 9. Forgot Password + Reset Password

This version includes a complete email-based password reset flow:

- **Forgot password?** appears on the customer sign-in form.
- A cryptographically random, one-time reset token is stored only as a SHA-256 hash in D1.
- Reset links expire after 30 minutes.
- Resetting the password invalidates all existing sessions for that account.
- The API intentionally uses a generic success message so it does not disclose whether an email is registered.
- Reset emails are sent through Resend.

### Configure Resend

Create a Resend account, verify the sender/domain you want to use, then add these Cloudflare Worker secrets: 

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESET_FROM_EMAIL
```

For `RESET_FROM_EMAIL`, use a sender that Resend has authorized, for example:

```text
The KaXro <no-reply@your-verified-domain.com>
```

Do **not** put the Resend API key in GitHub, `script.js`, `index.html`, or `wrangler.jsonc`.

### Apply the new D1 migration

After uploading this ZIP, run:

```bash
npx wrangler d1 migrations apply thekaxro-db --remote
```

This applies `migrations/0007_password_reset.sql` and creates the `password_reset_tokens` table. Do not drop or recreate the existing database.

### Test

1. Open the website and choose **Sign In**.
2. Select **Forgot password?**.
3. Enter a registered email.
4. Open the reset email and select **Reset password**.
5. Enter and confirm a new password.
6. Sign in with the new password.
7. Reuse the same reset link; it must fail.
8. Request another reset and verify the previous token is invalidated.

## 10. Personalize frame update

This release adds a ready-to-use `Custom Frame` listing in the `Personalize` category. Customers can choose the listing, upload a photo, or paste a Pinterest/pin.it link before adding it to the cart. Uploaded images are resized/compressed in the browser before being stored with the order, reducing payload size.

Apply the migration after deploying the files:

```bash
npx wrangler d1 migrations apply thekaxro-db --remote
```

No new secret is required for this feature.
