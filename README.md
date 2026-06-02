# CompTactic

Browser-based Squad tactical planner: draw on map layers, build line-ups, vehicle assignments, multi-slide briefings, and real-time collaboration.

**Live:** [comptactic.vercel.app](https://comptactic.vercel.app)

## Features

- Official AAS / Skirmish minimaps (SquadMaps CDN) with **capture point overlays** (Squad Wiki pipeline data)
- Custom PNG map import (scale in km for measure / range tools)
- Drawing tools, zones, assets, measure & **range rings** (mortar / FOB radius at map scale)
- Multi-slide tactics per layer, briefing mode, PDF/PNG export, **tactic sheet composite PNG**
- Real-time collab via `?room=` (BroadcastChannel + optional Supabase): server room policy, named rooms, editor count, offline-host editing for assigned editors, disconnect banner, and **History** (every Save is kept; restoring an older version does not delete newer saves)
- Cloud plans & share links when Supabase is configured

## Development

```bash
npm install
npm run dev
```

### Regenerate capture points

After updating `src/data/maps.ts` layer list:

```bash
npm run gen:cp
```

Source: [Squad Wiki map pipeline](https://github.com/Squad-Wiki/squad-wiki-pipeline-map-data) (CC BY-SA 4.0).

### Environment (optional cloud)

Copy `.env.example` to `.env.local`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Run `supabase/schema.sql` in the Supabase SQL editor. For existing projects, also apply:

- `supabase/migrations/002_shares_hardening.sql`
- `supabase/migrations/003_rooms_and_versions.sql` — server room title, member policy sync, and append-only save history per room
- `supabase/migrations/004_trim_room_versions.sql` — keeps only the latest 12 saves per room (recommended on **Free**)

Without `003`, collab still works via BroadcastChannel; room policy/history fall back to browser `localStorage` where implemented.

### Supabase Free (no Pro)

The app defaults to **Free-tier mode** (`VITE_SUPABASE_FREE_TIER=1` in `.env.example`):

- Slower collab debounce and less frequent full sync (saves Realtime messages)
- Room policy/title uses **polling** instead of `postgres_changes`
- Save history capped at **12** versions per room in the database (trigger in `004`)
- Inline custom map images are not stored inside cloud save rows (URLs only)

Copy `.env.example` → `.env.local`, add your project URL + anon key, and **do not** upgrade to Pro unless you hit limits. Set `VITE_SUPABASE_FREE_TIER=0` only after moving to Pro if you want faster sync.

**Vercel:** add the same `VITE_*` variables in Project → Settings → Environment Variables, then redeploy.

### Tests

```bash
npm run build
npm run test:e2e
```

## Deploy

- **Vercel (recommended):** connect the GitHub repo; build command `npm run build`, output `dist`.
- **GitHub Pages:** workflow in `.github/workflows/deploy.yml` uses `base: /comptactic/` on Actions; requires Pages enabled on the repo.

## Share links

- **Edit link:** `?room=` + optional `?s=` short id — live sync for editors.
- **View-only:** add `&view=1`.
- **Discord embed:** add `&embed=1` for a minimal map-only view (combine with `&view=1` for read-only).
- Short shares (`?s=`) require sign-in when Supabase RLS migration is applied (30-day expiry by default).

## License

App code: project license. Map imagery & game data belong to Offworld Industries / respective sources; capture point coordinates from Squad Wiki Editorial pipeline (CC BY-SA 4.0).
