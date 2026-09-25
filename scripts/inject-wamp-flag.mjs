/**
 * Construit le bundle WAMP (wamp_deploy/index.html) :
 * 1. copie dist/index.html (produit par `vite build`) vers wamp_deploy/index.html ;
 * 2. y injecte window.__BARPOS_USE_API__ = true AVANT le code de l'application :
 *    la version WAMP fonctionne UNIQUEMENT avec MySQL (API PHP), JAMAIS en
 *    mode local navigateur (aucun repli, aucune écriture localStorage métier).
 *
 * Usage : npm run build:wamp   (après npm run build, ou directement : il lance vite build)
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const DIST = 'dist/index.html';
const WAMP = 'wamp_deploy/index.html';

copyFileSync(DIST, WAMP);

let html = readFileSync(WAMP, 'utf-8');

const marker = '<script type="module" crossorigin>';
const flagScript = '<script>window.__BARPOS_USE_API__ = true;</script>';
// NB : le nom du drapeau figure aussi dans le code de l'app (lecture du
// drapeau) : on teste l'injection exacte, pas la simple présence du nom.
const injected = 'window.__BARPOS_USE_API__ = true;</script>';

if (!html.includes(injected)) {
  if (!html.includes(marker)) {
    console.error('Script applicatif introuvable dans dist/index.html');
    process.exit(1);
  }
  html = html.replace(marker, `${flagScript}\n    ${marker}`);
  writeFileSync(WAMP, html);
  console.log('wamp_deploy/index.html : MySQL FORCÉ (__BARPOS_USE_API__ = true) injecté.');
} else {
  console.log('wamp_deploy/index.html : drapeau MySQL forcé déjà présent.');
}
