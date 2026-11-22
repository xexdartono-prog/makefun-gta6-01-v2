# CORAL BAY — a getaway in the sun

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/xexdartono-prog/makefun-gta6-01-v2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/xexdartono-prog/makefun-gta6-01-v2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world getaway game in the spirit of GTA 6, built from static files with three.js. Play it at https://make.fun/bounty/gta6-01 — ref `6k6wxasr`.

## The story

Dana Cruz drives for a living, and Coral Bay owes her one last payout. Three jobs stand between her and the last boat out of town: a fare across the city, a timed run through the harbor, and a heist that ends with every cop in the bay on her tail. Steal the car you need, lose the heat, and get out clean.

## What is in the game

- **A city to explore** — an 8-by-8 road grid with procedural towers, palm-lined blocks, parks, a sandy beach on the south edge and a container harbor on the east, all built in code at load time.
- **On foot and by car** — walk, run and punch as Dana, or steal any parked car (the coral mission car is yours from the start) and drive with arcade handling.
- **Living streets** — traffic cruises the grid and turns at intersections, pedestrians stroll the sidewalks and scatter when a car bears down on them.
- **Wanted level** — steal a car, hit a pedestrian or ram a cop and the stars climb; police cars spawn, chase and ram back, and the heat only cools when you stay out of sight.
- **Three missions** — First Fare, Harbor Run and Bay Heist, each with a beacon marker, a HUD objective and a payout, ending in a completion screen.
- **A full HUD** — wanted stars, money, speed, objective line, toasts, and a live top-down minimap showing roads, cars, police and the mission marker.
- **Menus and saving** — start screen with the story and controls, pause, and progress (money and jobs done) kept in localStorage.
- **Procedural sound** — an engine hum that follows speed, a two-tone siren while wanted, and blips and thuds, all synthesized with WebAudio. No audio files.

## How to play

Open `game/index.html` from any static file server (or run `node serve.ts` and visit http://localhost:8080). Keyboard and mouse:

| Key | Action |
| --- | --- |
| W A S D | Walk / drive |
| Shift | Run |
| E | Get in / out of a car |
| F or click | Punch |
| P or Esc | Pause |
| Mouse drag | Look around |

## How it is built

`game/` holds the whole game: `index.html` plus one module per system under `game/src/` (city, cars, player, pedestrians, police, missions, HUD, audio, shots, save). three.js is vendored as `game/vendor/three.module.min.js`. `main.ts` at the repository root copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.
