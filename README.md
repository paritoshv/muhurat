# Muhurat

**Play it: https://muhurat.paritosh.space**

A co-op chaos game for 1-6 players. Your crew runs a shaadi: keep the relatives fed, seated and calm until the muhurat. Prototype of the core run.

## Run it

```
npm install
npm start        # builds, then serves http://localhost:8787
npm test         # bot playthroughs: determinism + win rates per crew size
```

Open the page, create a room, and share the 5-character code (or the `#r-CODE` link). `dist/site/` is the solo build with the leaderboard, which Netlify deploys on every push to `main`.

## How it plays

- Walk into a stall to pick up, walk into a guest to serve. Space (or Drop) discards what you hold.
- Each run is 5 minutes. Izzat starts at 100; a guest who waits too long goes naraz and costs izzat. At 0 the run ends.
- The seed fixes who arrives when and which disasters hit. `#s-<seed>` links replay a specific shaadi; with no seed, everyone gets today's.

| Relative | Twist |
|---|---|
| Fufaji | Loses patience 1.7x faster; costs 30 izzat instead of 12 |
| Bua ji | When she goes naraz, nearby waiting guests lose patience too |
| Mamaji | Wants paneer constantly and wanders to a new spot after each serving |
| Dadi | Wants a chair first; slow to anger; her blessing gives +4 izzat |
| Pandit ji | If he goes naraz, the muhurat moves 20 seconds earlier |
| Chintu | Steals mithai out of your hands |

| Disaster | Effect | Fix |
|---|---|---|
| Bijli gayi | Lawn goes dark, patience drains 1.5x | Stand at the generator to crank it |
| Baarish | Crew moves at 62% speed, patience drains 1.25x | Wait it out (20s) |
| Ghodi bhaag gayi | Horse knocks items out of hands and rattles guests | Stay close to her to catch her |
| Paneer khatam | Halwai has no paneer for 18s | Wait it out |

The end screen writes the run's story from what actually happened ("Fufaji went naraz waiting for chai during the power cut").

## Daily leaderboard

Solo runs of today's shaadi post to a daily board (`/api/board`, `/api/score`), stored in Netlify Blobs. The client sends its seed and input log; the function replays the run with the same sim and scores it itself, so a score cannot be typed in. A scripted run that plays well is still a valid run. Room runs do not post yet.

## Layout

- `netlify/functions/board/` leaderboard function and name moderation
- `src/shared/replay.ts` input log format and the replay used by client and function

- `src/shared/sim.ts` the whole game, pure and seeded; runs on the server for rooms and in the browser for solo
- `src/server/server.ts` room codes over WebSocket, one sim per room (maps onto one Durable Object per room later)
- `src/client/` canvas renderer, input, menus
- `test/sim.test.ts` greedy bots; use the win rates to tune difficulty

## Not built yet

Leaderboard for room runs, voice, the clip recorder, the persistent crew layer, Discord Activity packaging, age gate. See `../research/REPORT.md`.
