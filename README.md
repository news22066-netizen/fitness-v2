# Setup (website version)
1. Supabase -> Authentication -> Providers: Email is ON. For easy testing, turn OFF "Confirm email".
2. Supabase -> SQL Editor: run supabase/schema.sql (it deletes the old Telegram tables first).
3. Supabase -> Project Settings -> API: copy URL, anon key, and service_role key into .env.local (see .env.example).
4. Replace your old project files with these, keep your .env.local, add the 2 new NEXT_PUBLIC_ variables. Then: npm install, npm run dev, open http://localhost:3000
5. Sign up on the site with your email. Then run the creator insert at the bottom of schema.sql (put your email in it).
6. Vercel: add the same variables, redeploy.
7. Telegram bot stays only for admin alerts. Webhook (same as before):
   https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<YOUR_VERCEL_URL>/api/bot&secret_token=<WEBHOOK_SECRET>
