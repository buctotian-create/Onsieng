<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:aaf1123ee380e4b586a0ff4c36b2de869b6ff990a00d21a20848b42d5bbcbeec -->

# Onsieng Warehouse & Commerce

A responsive storefront and warehouse application built with HTML, CSS, and browser-native JavaScript. It includes customer, staff, and admin views. Without configuration it runs as a browser-local demo; demo changes are stored in localStorage and are not shared between browsers.

## Run locally

From the project folder, run:

```sh
python3 -m http.server 5173
```

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:7a44b359ca2e622d94bc37a63c85aea202787b867b1876300e33649e5a88e7d5 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:105416e24766bdbe98ed0604f82408d6c634cbcd4ad95dffef7c302962cae92d -->

Open `http://localhost:5173/`. Use the demo views or profile menu to switch roles. In a fresh demo, the customer’s My orders page includes an example tracking receipt and the driver workspace includes an assigned delivery. If updating an older copy, replace all files and hard refresh the browser. A local web server is required for JavaScript modules; opening the HTML file directly may not work. No build step or package installation is required.

<!-- /coderabbit-ai-generated:v1 -->

## Contact details

Set `CONTACT_FACEBOOK_URL`, `CONTACT_INSTAGRAM_URL`, and `CONTACT_PHONE` in `config.js` to show your real contact details. Leave a value blank until it is available; blank entries are shown as not added yet.

<!-- /coderabbit-ai-generated:v1 -->

## Connect Supabase

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:cd5dcfa2f85daf58174737fe6e22c355b19234b9831a86a06ee51ab140c98710 -->

1. On a new Supabase project, run `supabase/schema.sql` and then `supabase/delivery-migration.sql` once in the SQL editor. On an existing Onsieng project that already has `schema.sql`, run only `supabase/delivery-migration.sql` once. The migration adds driver roles, delivery tracking, and an optional customer phone number while retaining the original order function.

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

Product photos, fonts, and the Supabase client use remote URLs and need an internet connection. The SQL file is intended for a fresh project, not an existing schema migration.

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->
