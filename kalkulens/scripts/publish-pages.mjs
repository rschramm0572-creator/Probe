/**
 * Kopiert den Produktionsbuild in den Ordner `app/` im Repository-Wurzelverzeichnis.
 *
 * GitHub Pages veroeffentlicht dieses Repository direkt aus dem Branch `main`
 * ("Deploy from a branch"). Damit KalkuLens ohne Actions-Workflow und ohne
 * Aenderung an den Repository-Einstellungen erreichbar ist, wandert der fertige
 * Build als statischer Ordner mit ins Repository.
 *
 *   npm run build:pages
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = path.dirname(fileURLToPath(import.meta.url));
const quelle = path.resolve(hier, '..', 'dist');
const ziel = path.resolve(hier, '..', '..', 'app');

if (!fs.existsSync(quelle)) {
  console.error('Kein Build gefunden. Bitte zuerst "npm run build" ausführen.');
  process.exit(1);
}

fs.rmSync(ziel, { recursive: true, force: true });
fs.cpSync(quelle, ziel, { recursive: true });

// Jekyll wuerde Ordner mit fuehrendem Unterstrich verschlucken – der Schalter
// kostet nichts und schliesst die Fehlerquelle aus.
fs.writeFileSync(path.join(ziel, '.nojekyll'), '');

fs.writeFileSync(
  path.join(ziel, 'HINWEIS.txt'),
  [
    'Dieser Ordner ist erzeugt, nicht von Hand geschrieben.',
    '',
    'Er enthält den Produktionsbuild von KalkuLens und wird von GitHub Pages',
    'unter /app/ ausgeliefert. Änderungen gehören in kalkulens/src/ und werden',
    'mit "npm run build:pages" hierher übertragen.',
    '',
  ].join('\n'),
);

const dateien = fs.readdirSync(ziel, { recursive: true }).length;
console.log(`KalkuLens nach ${path.relative(process.cwd(), ziel)} veröffentlicht (${dateien} Dateien).`);
