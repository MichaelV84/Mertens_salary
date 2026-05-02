# Mertens Salary

Web app for tracking work shifts, calculating monthly salary, and exporting reports.

Built with:
- React
- TypeScript
- Vite
- Supabase

## Features

- Email/password auth via Supabase
- Monthly dashboard with per-day shift editing
- Salary calculation with:
  - regular hours
  - evening/night rates
  - overtime
  - weekends
  - manual holiday overrides
  - sick day / day off handling
- User settings for base rate and default hours
- Excel export
- PDF export
- Minimal admin page for blocking/unblocking users

## Environment

Create a local `.env` file from `.env.example`.

Required variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Local Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Start dev server:

```bash
npm run dev
```

Build production bundle:

```bash
npm run build
```

## Project Notes

- The app uses Supabase Auth session restore on page refresh.
- Account profile loading is treated as a background enhancement and should not block the dashboard.
- Selected month is stored in `localStorage`.
- App profile cache is stored in `localStorage` to keep refresh and tab restore fast.

## Deploy to GitHub Pages

Deployment is handled by GitHub Actions from `.github/workflows/deploy.yml`.

Requirements:

1. In GitHub repository settings, set `Pages -> Source` to `GitHub Actions`
2. Add these repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Push to `main`

What the workflow does:

- installs dependencies with `npm ci`
- runs tests
- builds the app
- publishes `dist`
- creates `dist/404.html` for SPA route fallback on GitHub Pages

## Useful Scripts

```bash
npm run dev
npm test
npm run build
```

## Current Structure

```text
src/
  components/
  pages/
  services/
  types/
  utils/
```

Main areas:

- `src/services/` — Supabase, auth, API, export helpers
- `src/pages/` — login, dashboard, settings, admin
- `src/utils/` — salary calculation and date/holiday helpers

## Maintenance Notes

- If GitHub Pages shows an old build, check the latest workflow run in `Actions`.
- If the IDE highlights `tsconfig.app.json` in red but build passes, restart the TypeScript server before changing config.
