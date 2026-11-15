// main.ts — the entrypoint: hands LANTERNWARD in.
//
// Copies game/ and screenshots/ from this repository into the output
// directory and writes dossier.json with the kit's buildDossier, exactly
// as the scorer will recompute it. Runs twice in the grader; both runs
// write the same bytes. Standard library only, no network, no install.
//
// The output directory is never removed itself (the grader mounts it):
// only its previous contents are cleared, one entry at a time.

import { buildDossier } from './vendor/makefun-game.ts';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function clearContents(dir: string): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

function main(): void {
  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  mkdirSync(outDir, { recursive: true });
  clearContents(outDir);
  cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`LANTERNWARD handed in: ${outDir} (dossier ${dossier.length} bytes)`);
}

main();
