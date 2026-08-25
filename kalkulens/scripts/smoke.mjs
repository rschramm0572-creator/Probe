/**
 * Rauchtest im echten Browser.
 *
 * Prüft in einem Durchlauf, was die Unit-Tests nicht abdecken: dass die
 * Oberfläche rendert, der Erfassungsablauf durchläuft und beide Exporte
 * eine gültige Datei erzeugen.
 *
 *   npm run build && npm run preview   (in einem zweiten Terminal)
 *   node scripts/smoke.mjs
 *
 * Voraussetzung: `npm i -D playwright` und ein Chromium. Ist eines
 * vorinstalliert, kann der Pfad über CHROMIUM_PATH gesetzt werden.
 */
import { chromium } from 'playwright';
import * as XLSX from 'xlsx';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const URL = process.env.KALKULENS_URL ?? 'http://localhost:4173/';
const ausgabe = fs.mkdtempSync(path.join(os.tmpdir(), 'kalkulens-'));
const start = { executablePath: process.env.CHROMIUM_PATH || undefined };

let fehlgeschlagen = 0;
function pruefe(name, bedingung, zusatz = '') {
  const zeichen = bedingung ? '✓' : '✗';
  if (!bedingung) fehlgeschlagen++;
  console.log(`${zeichen} ${name}${zusatz ? ` – ${zusatz}` : ''}`);
}

const browser = await chromium.launch(start);
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const konsolenfehler = [];
page.on('console', (m) => m.type() === 'error' && konsolenfehler.push(m.text()));
page.on('pageerror', (e) => konsolenfehler.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
pruefe('App startet', (await page.locator('text=KalkuLens').count()) > 0);

await page.getByRole('button', { name: 'Demodaten laden' }).click();
await page.waitForTimeout(600);
await page.locator('button:has-text("Markenartikel")').first().click();
await page.waitForTimeout(900);
pruefe('Ergebnis wird berechnet', (await page.locator('text=Vollkosten je VE').count()) > 0);

await page.getByRole('button', { name: 'aufklappen' }).first().click();
await page.waitForTimeout(300);
await page.locator('td:has-text("Verwaltungsgemeinkosten")').first().click();
await page.waitForTimeout(300);
pruefe('Jede Zahl ist bis zur Annahme rückverfolgbar', (await page.getByRole('dialog').count()) > 0);
await page.locator('div[role=dialog] button[aria-label="Schließen"]').click();

await page.getByRole('button', { name: /Annahmen simulieren/ }).click();
await page.waitForTimeout(900);
pruefe('Simulation und Tornado rendern', (await page.locator('text=Hebelwirkung').count()) > 0);

await page.locator('button:has-text("Ergebnis")').first().click();
await page.waitForTimeout(600);

const [xlsxDl] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.getByRole('button', { name: /Excel-Kalkulationsblatt/ }).click(),
]);
const xlsxPfad = path.join(ausgabe, xlsxDl.suggestedFilename());
await xlsxDl.saveAs(xlsxPfad);
pruefe('Excel-Export mit sprechendem Dateinamen', /^KalkuLens_.*\.xlsx$/.test(xlsxDl.suggestedFilename()), xlsxDl.suggestedFilename());

const [pdfDl] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.getByRole('button', { name: /PDF-Summary/ }).click(),
]);
const pdfPfad = path.join(ausgabe, pdfDl.suggestedFilename());
await pdfDl.saveAs(pdfPfad);
pruefe('PDF-Export ist eine gültige PDF-Datei', fs.readFileSync(pdfPfad).subarray(0, 5).toString('latin1') === '%PDF-');

await page.locator('nav button:has-text("Bibliothek")').click();
await page.waitForTimeout(500);
await page.locator('button:has-text("zum Vergleich")').first().click();
await page.waitForTimeout(200);
await page.locator('button:has-text("zum Vergleich")').first().click();
await page.locator('nav button:has-text("Vergleich")').click();
await page.waitForTimeout(800);
pruefe('Vergleich stellt zwei Produkte gegenüber', (await page.locator('text=Kostenstruktur je Verkaufseinheit').count()) > 0);

await page.locator('nav button:has-text("Stammdaten")').click();
await page.waitForTimeout(500);
pruefe('Stammdaten sind erreichbar', (await page.locator('text=Rohstoffpreisdatenbank').count()) > 0);

await browser.close();

const wb = XLSX.read(fs.readFileSync(xlsxPfad), { type: 'buffer', cellFormula: true });
const formeln = Object.entries(wb.Sheets['Kalkulation']).filter(([k, v]) => !k.startsWith('!') && v?.f);
pruefe('Excel enthält lebende Formeln', formeln.length > 20, `${formeln.length} Formelzellen`);
pruefe(
  'Formeln verweisen auf das Annahmenblatt',
  formeln.filter(([, z]) => String(z.f).includes('Annahmen!')).length > 5,
);
pruefe('Keine Konsolenfehler', konsolenfehler.length === 0, konsolenfehler.slice(0, 3).join(' | '));

console.log(`\nDateien unter ${ausgabe}`);
process.exit(fehlgeschlagen === 0 ? 0 : 1);
