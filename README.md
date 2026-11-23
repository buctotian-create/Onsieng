<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:aaf1123ee380e4b586a0ff4c36b2de869b6ff990a00d21a20848b42d5bbcbeec -->

# Onsieng Warehouse & Commerce

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:856fc46c48f4bf3fc071bfa06465680108ba810a424dae31a5ec1ed264c776c3 -->

A responsive storefront and warehouse application built with HTML, CSS, and browser-native JavaScript. It includes customer, staff, admin, and delivery driver views. Without configuration it runs as a browser-local demo; demo changes are stored in localStorage and are not shared between browsers.

<!-- /coderabbit-ai-generated:v1 -->

## Run locally

From the project folder, run:

```sh
python3 -m http.server 5173
```

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:7a44b359ca2e622d94bc37a63c85aea202787b867b1876300e33649e5a88e7d5 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:105416e24766bdbe98ed0604f82408d6c634cbcd4ad95dffef7c302962cae92d -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:be044c4bac6891fede9d14b3cdd4ea1616803eeb90239b70ae4ab1a1a8857adb -->

Open `http://localhost:5173/`. Visitors can browse and add items to a cart; checkout requires signing in. Without Supabase, use the demo customer sign-in to try checkout and the Explore team demo link to try the warehouse views. Demo access is for testing only. In a fresh demo, My orders includes an example tracking receipt and the driver workspace includes an assigned delivery. If updating an older copy, replace all files and hard refresh the browser. A local web server is required for JavaScript modules; opening the HTML file directly may not work. No build step or package installation is required.

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->

## Contact details

Set `CONTACT_FACEBOOK_URL`, `CONTACT_INSTAGRAM_URL`, and `CONTACT_PHONE` in `config.js` to show your real contact details. Leave a value blank until it is available; blank entries are shown as not added yet.

<!-- /coderabbit-ai-generated:v1 -->

## Connect Supabase

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:cd5dcfa2f85daf58174737fe6e22c355b19234b9831a86a06ee51ab140c98710 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:aaafa768cf276a39122c26a58b480504f2ab35e2da6577796677bd1e51cd3549 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:d2d6e68b23fe129017de02ec7658b102754e29c92066421a5e3cd673a2469c27 -->

1. On a new Supabase project, run `supabase/schema.sql`, `supabase/delivery-migration.sql`, `supabase/bugfix-migration.sql`, and `supabase/public-catalog-migration.sql` in that order in the SQL editor. Existing Onsieng projects should apply `public-catalog-migration.sql` after the earlier migrations. The public catalog and bugfix migrations are safe to rerun; do not rerun the base schema or delivery migration on an already configured project. The catalog function exposes product information and available stock to visitors, without exposing warehouse locations, accounts or orders.

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->
2. Open `config.js` and set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the project URL and publishable/anon key. Never put a service-role key in browser code. Reload the page. The Supabase JavaScript client is loaded from jsDelivr only when both settings are present.
<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:45996d2cc39c788db9e7d4ccd5d96886d339aa23d075840aeceff65ab9ba7fe5 -->

3. In your Supabase dashboard, open **Authentication → Sign In / Providers → Email** and turn off **Confirm email**. New accounts can then sign in without proving ownership of their email addresses. This setting is controlled by Supabase and cannot be changed by frontend code.
4. Register an account in the app. New accounts start as customers. In the Supabase SQL editor, promote the first administrator using their account UUID:

<!-- /coderabbit-ai-generated:v1 -->

```sql
update public.profiles set role = 'admin' where id = 'YOUR-USER-UUID';
```

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:1185da07fb65d6534054aea0f5ab81436e9558d92f8427a6e91091aa9e41260f -->

The administrator can assign staff, driver, and admin roles in Team & accounts, then assign a driver from an order. Staff see assigned orders and can update their status or stock; drivers see only their assigned deliveries; customers see their own orders and delivery progress. Drivers accept an assignment, pick up a packed order, record arrival, and confirm delivery with a recipient name. If the customer is unavailable, the driver can notify the admin and wait for instructions. Receipt numbers are derived from the unique order ID. Checkout locks product rows, validates stock, and calculates prices on the server before recording an order. Payment verification is manual; no payment gateway or live GPS tracking is connected.

<!-- /coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:ad3ed05244507e7c10e6a9f77912931701b2f5ddbcd5806e4d624d8962040678 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:78f8ceb4e05f74392aefd957cab8b07f911a0e152911192f357789ffacca0eed -->

## Signup and rate limits

Disabling Confirm email prevents signup from sending confirmation emails. Each account still needs a distinct email address. Supabase enforces project-side limits on signup requests; you can adjust configurable limits under **Authentication → Rate Limits**, but the app cannot remove provider-enforced limits. See [Supabase authentication settings](https://supabase.com/docs/guides/auth/general-configuration) and [rate limits](https://supabase.com/docs/guides/auth/rate-limits).

If other authentication emails are needed, configure a custom provider under **Authentication → SMTP Settings**. The built-in email provider is intended for testing, is limited to project team addresses, and has a low sending quota. See [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

<!-- /coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:acf3f277b3366e5f9e6061bfd835d6d79d5cd598ae2d1da142005806562b523c -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:921aef80c4f5e059d682b960bf889dcd16a5312f69e4ec9bc76b98669cff360f -->

Product photos, fonts, and the Supabase client use remote URLs and need an internet connection. The base SQL schema is intended for a fresh project, not an existing schema migration.

The demo includes six additional sample products. For a connected Supabase store, review `supabase/sample-products.sql` and optionally run it in the SQL editor to add those sample products. Check the names, prices, stock, photos, and locations first; existing IDs and product codes are left unchanged. Real inventory can also be managed from the admin workspace.

<!-- /coderabbit-ai-generated:v1 -->

## Regression checks

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:fffd93aab16aa72a3c09d69f889cd1fc959ab601702b82f9feeb7c7254af21d5 -->

Run `node tests/frontend-regressions.mjs` with Node 24 or newer. No packages are required. SQL tests in `tests/` are for disposable PostgreSQL databases only. Apply `tests/schema-setup.sql`, the base schema, and all three migrations, then run each smoke test on a separate fresh database. The setup file supplies synthetic Auth helpers; never apply it to your real Supabase project.

<!-- /coderabbit-ai-generated:v1 -->

Demo storage now saves changes as one browser-local snapshot. Successful checkout remains confirmed if the next refresh fails. Role changes clear cached account data, and carts are checked against current prices and availability before checkout.

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->
