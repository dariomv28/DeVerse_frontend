# Devverse — Frontend

This is the frontend for Devverse built with Next.js (App Router) and React 19. It provides the feed UI, authentication pages, real-time updates via Socket.IO, and file uploads.

Key technologies
- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS
- Socket.IO client for real-time updates

Quick start

```bash
cd frontend
npm install
npm run dev
```

The dev server runs by default on port `3001` (script: `next dev -p 3001`). Open `http://localhost:3001`.

Available scripts

- `npm run dev` — start Next.js dev server
- `npm run build` — build for production
- `npm run start` — start production server after build
- `npm run lint` — run ESLint

Environment
- The frontend expects the backend API at `http://localhost:3000` by default (see `app/feed/page.tsx`). If your backend runs on a different host/port, update the `API_URL` in `app/feed/page.tsx` or provide a runtime configuration.

Project structure (important parts)
- `app/` — Next.js App Router pages and layouts
	- `app/feed/page.tsx` — Feed page (main social feed logic)
	- `app/auth/*` — authentication pages (login, signup, reset)
- `app/feed/components/` — extracted UI components (`CreatePostBox`, `PostList`, `PostItem`)
- `components/` — shared UI components (buttons, inputs, logo)
- `lib/socket.ts` — Socket.IO client initializer
- `public/` — static assets

Local caching and real-time behavior
- The feed page persists user-scoped local caches in `localStorage`:
	- `likes_<userId>` — per-user like states and counts
	- `comments_<userId>` — per-user comment cache (to survive reloads)
	- `post_last_likes` — last-seen like counts used to reconcile server values on reload
- The app listens to `post.updated` Socket.IO events and merges incoming updates with local caches to keep the UI responsive and consistent.

Testing the multi-account flow
1. Run backend (`http://localhost:3000`) and frontend (`http://localhost:3001`).
2. Open two browsers (or one normal + one incognito) and log in with two accounts.
3. Use the feed to create posts, like/unlike, comment, and verify changes are pushed in real-time across clients and survive reloads.

Notes & troubleshooting
- If likes or comments appear to revert after refresh, check `localStorage` keys listed above for each user and ensure the backend is emitting `post.updated` events. The frontend merges server results with local caches with heuristics involving timestamps.
- If socket connections don't work, ensure the backend Socket.IO server is reachable and CORS is configured properly.

Contributing
- Keep UI logic in `app/feed/page.tsx` and extract large JSX blocks into `app/feed/components/`. Follow existing patterns for local caching and socket handling.

Questions or next steps
- I can add an example `.env.local` or centralize the `API_URL` into a config file if you want. Would you like that?
