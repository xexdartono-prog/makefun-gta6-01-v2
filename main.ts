// CORAL BAY — the gta6-01 hand-in program (Node 22, standard library only).
// Entry: "Coral Bay", an open-world getaway game — a sun-soaked coastal city to
// explore on foot and by car, with traffic, pedestrians, car theft, a wanted
// level with police, three story missions, combat, a HUD with a minimap, a start
// screen and a save.
// The game itself is plain static files under game/ (game/index.html plus its ES
// modules, three.js vendored under game/vendor, no network request at run time).
// This program copies game/ and screenshots/ from beside this file into the
// output directory and writes dossier.json there with the vendored make.fun
// library, so the judge can read the game from the dossier alone.
//
// Play it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's caps (reference/gate.json): text_max_bytes shapes the dossier's
// text; the rest refuse an entry the scorer would refuse — more than 4 screenshots
// or one over 256 KiB, more than 993 files or 48 MiB under game/, or a game/ path
// over 1000 bytes. game/ counts beside /output's own 1000-entry cap, together
// with screenshots/ and dossier.json.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
