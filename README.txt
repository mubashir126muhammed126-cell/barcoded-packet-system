BARCODED PACKET SYSTEM - UPDATED DEPLOYMENT

Files:
- index.html
- app.js
- style.css
- track.html
- supabase_final_update.sql

DEPLOYMENT:
1. Run supabase_final_update.sql in Supabase SQL Editor if not already run.
2. Upload/replace ALL website files in the GitHub repository.
3. Commit changes.
4. Wait 2-3 minutes for GitHub Pages.
5. Open the site in a private/incognito tab.
6. Login with the existing Admin account.
7. Admin -> Create Shipment -> enter customer name -> Generate Shipment.
8. Print the generated label.
9. Customer can scan the tracking QR or open the tracking URL.

IMPORTANT:
- app.js and track.html are already configured with the current Supabase URL and Publishable key.
- Never put a Supabase secret/service-role key in these files.
- SITE_URL in app.js is configured for:
  https://ir126muhammed126-cell.github.io/barcoded-packet-system/

If the website still shows an old error after deployment, clear browser cache or use a private/incognito tab.
