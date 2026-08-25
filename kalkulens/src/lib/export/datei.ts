/**
 * Datei-Download im Browser.
 *
 * Bewusst mit eigenem Anker statt der Bibliotheks-Helfer: nur so ist der
 * Dateiname verlaesslich derselbe, den der Nutzer in der App sieht.
 */
export function speichereDatei(daten: BlobPart, dateiname: string, mimeTyp: string): void {
  const blob = daten instanceof Blob ? daten : new Blob([daten], { type: mimeTyp });
  const url = URL.createObjectURL(blob);
  const anker = document.createElement('a');
  anker.href = url;
  anker.download = dateiname;
  anker.rel = 'noopener';
  document.body.appendChild(anker);
  anker.click();
  anker.remove();
  // Der Browser braucht den Blob noch einen Moment, bis der Download laeuft.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
