# Tut Lab

React + Express tutoring marketplace backed by Supabase PostgreSQL, Auth, and Storage.

## Connect Supabase

1. Create a project at `https://supabase.com/dashboard`.
2. Open **SQL Editor**, paste [supabase/schema.sql](supabase/schema.sql), and run it once.
3. In **Project Settings → API**, copy the project URL, publishable/anon key, and service-role key.
4. Copy `.env.example` to `.env` and replace the placeholder values. Never expose or commit the service-role key.
5. In **Authentication → URL Configuration**, set:
   - Site URL: `http://localhost:5173`
   - Redirect URL: `http://localhost:5173/`
6. In **Authentication → Providers**, enable Email, Google, and LinkedIn (OIDC). Add each provider's client ID and secret.
7. Run the API and frontend in separate terminals:

```powershell
npm run server
npm run dev
```

Open `http://localhost:5173`. Test the connection at `http://localhost:8787/api/health`.

## Google OAuth

Create a Web OAuth client in Google Cloud. Use the callback URL displayed on the Google provider page in Supabase as Google's authorized redirect URI. Add `http://localhost:5173` as an authorized JavaScript origin, then paste the client ID and secret into Supabase.

## LinkedIn OAuth

Create a LinkedIn app, enable **Sign In with LinkedIn using OpenID Connect**, and add the callback URL displayed on the LinkedIn provider page in Supabase. Paste the LinkedIn client ID and secret into Supabase.

## Authentication emails

- In **Authentication → Email Templates → Confirm signup**, paste `supabase/email-templates/confirm-signup.html` and save it.
- For production delivery, configure **Authentication → SMTP Settings** with a transactional email provider. Supabase's default SMTP is only suitable for limited testing.
- Sign-in security alerts use Resend. Create a Resend API key, verify your sending domain, then set `RESEND_API_KEY` and `EMAIL_FROM` in `.env`.
- Run `supabase/schema.sql` again after updates when needed. The schema is rerunnable: tables and seed records are preserved, while security policies are safely refreshed.

## Security model

- The browser receives only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Express alone receives `SUPABASE_SERVICE_ROLE_KEY`.
- Express verifies Supabase access tokens before protected operations.
- Admin-only resource approval and payment confirmation verify the profile role server-side.
- PostgreSQL Row Level Security is enabled as defense in depth.
- Uploaded learning resources are stored in Supabase Storage with a 10 MB server limit.

To make an account an administrator after signing up, run this in the SQL Editor with the correct email:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## Useful commands

```powershell
npm run dev       # Vite frontend
npm run server    # Express + Supabase API
npm run build     # production build
npm start         # serve the production build and API
```

The existing `data/*.json` files are no longer used by the runtime. Keep them only as migration/reference data until you confirm the Supabase records.
