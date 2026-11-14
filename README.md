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

Open `http://localhost:5173/`. Use the profile menu to switch roles in demo mode. A local web server is required for JavaScript modules; opening the HTML file directly may not work. No build step or package installation is required.

## Connect Supabase

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor on a new database. It creates the tables, row-level policies, secure checkout function, sample products, and profile trigger.
2. Open `config.js` and set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the project URL and publishable/anon key. Never put a service-role key in browser code. Reload the page. The Supabase JavaScript client is loaded from jsDelivr only when both settings are present.
3. Register an account in the app and confirm its email if required by your Supabase authentication settings. New accounts start as customers. In the Supabase SQL editor, promote the first administrator using their account UUID:

```sql
update public.profiles set role = 'admin' where id = 'YOUR-USER-UUID';
```

The administrator can then assign staff and admin roles in Team & accounts. Staff see assigned orders and can update their status or stock; customers see their own orders. Checkout locks product rows, validates stock, and calculates prices on the server before recording an order. Payment verification is manual; no payment gateway is connected.

Product photos, fonts, and the Supabase client use remote URLs and need an internet connection. The SQL file is intended for a fresh project, not an existing schema migration.

<!-- /coderabbit-ai-generated:v1 -->
