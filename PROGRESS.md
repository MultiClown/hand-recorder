# Build Progress

Web app (PWA later) for recording live poker hands. Prototype on desktop first, then phone.

## Phase 1: working prototype
- [x] `js/engine.js`: hand logic (positions, blinds, BB ante, actions, all-ins, pot, plain-text export). Tested with a sample hand.
- [x] `index.html` + `styles.css` + `js/app.js`: home screen, table, card grid, action panel, raise panel, showdown, review/copy
- [x] Local preview (`.claude/launch.json`, python http.server on port 5173). Full test hand clicked through: preflop raise, fold-around, flop bet, fold, save, text export all correct.
- [x] Redesign v2 (2026-10-23): Setup (blinds, table size, hero position picker, tap seat: not in hand → in → away, stacks/names for involved) → Cards (board first, then hero + opponents, one shared grid) → Actions (uninvolved auto-fold, streets advance from entered board, auto winner at showdown). Tested a full 3-way hand to showdown.
- [x] Swipe-to-delete, stack units (1K/10K/100K), tournament-only with BB ante, one-screen compact layout, notes + commentary at end of Actions.
- [x] Home: live tournament card (name, buy-in, GTD, bullets, entries, players left, blinds, my stack). New hands auto-fill blinds + hero stack; hero stack updates after each saved hand; hand text includes tournament snapshot.
- [x] dev-server.py: no-cache local server (launch.json uses it).
- [x] Hand sheet (review): one hand per screen, real-card colours, actions by street, result, TO SAY + notes; swipe or arrow keys between hands.
- [x] "Export for vlog editor": downloads hands_<tournament>_<date>.json in the vlog-editor work/hands.json shape (level, hero, villains, say, streets, result, event) plus notes, field, played_at.
- [ ] Vlog-editor side: ingest the app export instead of parsing notes; timing marks via chat Q&A; retire the timing worksheet (separate repo)
- [x] Phone testing over Wi-Fi (http://<PC-IP>:5173). Stacks moved to end of Actions + Stacks button mid-hand; unknown opponent stacks play as hero's stack; seats toggle in/out on Cards page; no opponent stack carry-over.
- [x] Brand theme: purple #B15BF1 → cyan #54E2EF (from vlog-editor config/brand).
- [x] Offline install: manifest.webmanifest, sw.js (network-first cache), brand icons in icons/, iOS meta + safe-area padding.
- [x] Backup / Restore on home page (merge by session id, never deletes).
- [x] Hosting: GitHub Pages from public repo MultiClown/hand-recorder (main, root) → https://multiclown.github.io/hand-recorder/ . Push to main = live in ~1 min. Move to Cloudflare Pages later if sync/sharing is needed.

## Phase 2 (after feedback)
- Iterate on the flow based on desktop testing
- Drag an action onto a different seat
- Offline install on iPhone (manifest + service worker), free hosting
- Backup / restore
