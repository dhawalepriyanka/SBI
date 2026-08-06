# Vercel deployment

The production deployment uses a Vercel Node.js Function and Neon Postgres. Local development continues to use SQLite when `DATABASE_URL` is not set.

## 1. Connect Neon

In the Vercel project, open **Storage** or **Marketplace**, add **Neon Postgres**, and connect it to this project. Confirm that Vercel created a `DATABASE_URL` environment variable for Production, Preview, and Development as needed.

The application creates the `applications` table and its indexes automatically on the first API request.

## 2. Add production environment variables

Open **Vercel project → Settings → Environment Variables** and add:

- `SESSION_SECRET`: a long random value (at least 32 random bytes)
- `MANAGER_ID`: `manager-001` or another internal identifier
- `MANAGER_USERNAME`: the manager login username
- `MANAGER_PASSWORD`: a strong, unique password
- `MANAGER_EDIT_ENABLED`: `true` or `false`

Do not add these values to GitHub. The `.env.example` file contains names only, not real secrets.

One way to generate a session secret locally is:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

## 3. Redeploy

Commit and push these files to the GitHub branch connected to Vercel. In Vercel, redeploy the latest commit after all environment variables are present.

Expected routes:

- `/` — employee application
- `/manager` — manager login
- `/api/auth/employee-session` — employee session API
- `/api/auth/login` — manager login API
- `/api/applications` — stored application data

## Production safety

Production startup does not fall back to the local `manager` / `manager123` credentials. Missing `SESSION_SECRET` or manager variables produces an explicit configuration error instead of using insecure defaults.
