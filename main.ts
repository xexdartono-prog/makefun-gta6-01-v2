// CORAL BAY — the entry program for make.fun gta6-01 (Node 22, standard library only).
//
// What it does: it takes the game in game/ (plain static files: the page, its
// modules, the vendored three.js build) and the screenshots in screenshots/,
// copies both into the grader's output directory, and writes the dossier the
// judge reads there with the vendored make.fun library. Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output, so a local check looks like:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The program must write exactly the same bytes on both of the grader's runs,
// so it does nothing time- or environment-dependent: no timestamps, no random
// file order (the copy and the dossier library both walk in path order).

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The game itself: every static file the browser loads, nothing else.
const gameSrc = join(repoRoot, 'game');
const gameDst = join(outDir, 'game');
mkdirSync(outDir, { recursive: true });
cpSync(gameSrc, gameDst, { recursive: true });

// The screenshots: three or four renders of the game, the first by name the
// cover. Copy them only when the folder is there, so a missing folder is a
// dossier error rather than a crash here.
const shotsSrc = join(repoRoot, 'screenshots');
const shotsDst = join(outDir, 'screenshots');
mkdirSync(shotsDst, { recursive: true });
if (existsSync(shotsSrc)) {
  cpSync(shotsSrc, shotsDst, { recursive: true });
}

// Refuse loudly when a run would hand in an empty or unreadable game folder,
// instead of writing a dossier that names no game at all.
if (!existsSync(join(gameDst, 'index.html'))) {
  throw new Error('CORAL BAY: game/index.html is missing, refusing to write a dossier');
}
const shotFiles = readdirSync(shotsDst).filter((n) => !n.startsWith('.'));
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`CORAL BAY: expected 3 or 4 screenshots, found ${shotFiles.length}`);
}

// The dossier, with the bounty gate's caps: text capped at 160 KiB, at most
// four screenshots of 256 KiB each, game/ at most 993 entries and 48 MiB.
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
