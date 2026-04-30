# Mertens Salary

Salary calculator web app built with React, TypeScript and Supabase.

## What is included

- Auth with Supabase email/password
- Salary engine with shift splitting and overtime rules
- Monthly dashboard with shift CRUD
- Settings page with rate and holidays
- Excel and PDF export
- Minimal admin page
- Supabase schema with RLS

## Local setup

1. Copy `.env.example` to `.env`
2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Run `npm install`
4. Run `npm test`
5. Run `npm run dev`

## GitHub Pages

This project can be deployed to GitHub Pages with GitHub Actions.

1. Push the repository to GitHub
2. In GitHub, go to `Settings -> Pages`
3. Set `Source` to `GitHub Actions`
4. In `Settings -> Secrets and variables -> Actions`, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Push to `main` to trigger deployment

The workflow will build the app, publish `dist`, and create a `404.html` fallback for SPA routes.
