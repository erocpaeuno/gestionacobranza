<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f0b20370-bd02-4abb-9e5c-1987654d71b1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and set `SUPABASE_DATABASE_URL` to the PostgreSQL connection string from Supabase. Set `APP_SESSION_SECRET` to a long, random value shared by all API instances. Keep both values private and do not commit `.env`.
3. Set `GEMINI_API_KEY` if you use Gemini features.
4. Start the API server in one terminal:
   `npm run server`
5. Start the frontend in another terminal:
   `npm run dev`

To check the database connection and required Atlas ERP tables, run:
`npm run db:test`

## Deploy the API to Render

The `render.yaml` Blueprint deploys the existing Express API. Connect the
repository to Render and create a Blueprint from it. Add `SUPABASE_DATABASE_URL`
and `APP_SESSION_SECRET` as private environment variables in Render; never put
their values in `render.yaml` or source control. Use a random session secret of
at least 32 characters.

After deployment, set `VITE_API_URL` in the local `.env` to the Render service
URL followed by `/api` (for example, `https://your-service.onrender.com/api`),
then run `npm run build` and `npx cap sync android`.

## Android API URL

The Android app runs its web assets locally, so the default relative `/api` URL
does not reach the Express server. Before building for Android, set
`VITE_API_URL` in `.env` to the publicly reachable HTTPS base URL of the Express
API, including `/api` (for example, `https://api.example.com/api`). Then run:

1. `npm run build`
2. `npx cap sync android`

Do not use `localhost` for a server running on another computer; on Android,
`localhost` refers to the device itself.

## Multi-company access

The API does not use a fixed company ID. Login finds the active user in Atlas ERP and derives the company, role, and allowed modules from that user's database record. It issues a signed, 12-hour session token; protected requests re-check the user's and company's active status and permissions.

Every data query is constrained to the authenticated user's company. Company administrators with the relevant module permission can see the company's portfolio; other roles are additionally scoped to their assigned clients, credits, and payments. The frontend cache is separated by company and user. `APP_SESSION_SECRET` should be a strong, independently generated secret and must remain the same across server instances.
