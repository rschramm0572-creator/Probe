/**
 * Fotoerfassung: Bilder werden vor dem Speichern verkleinert.
 *
 * Ein Regalfoto vom Handy hat schnell 4 MB. Fuer das Ablesen eines Etiketts
 * genuegen 1600 px Kantenlaenge – das haelt die lokale Datenbank klein und die
 * Analyse schnell.
 */

const MAX_KANTE = 1600;
const QUALITAET = 0.82;

export async function verkleinereBild(datei: File | Blob): Promise<string> {
  const bild = await ladeBild(datei);
  const faktor = Math.min(1, MAX_KANTE / Math.max(bild.width, bild.height));
  const breite = Math.round(bild.width * faktor);
  const hoehe = Math.round(bild.height * faktor);

  const canvas = document.createElement('canvas');
  canvas.width = breite;
  canvas.height = hoehe;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Das Bild konnte nicht verarbeitet werden.');
  ctx.drawImage(bild, 0, 0, breite, hoehe);
  if ('close' in bild && typeof bild.close === 'function') bild.close();
  return canvas.toDataURL('image/jpeg', QUALITAET);
}

async function ladeBild(datei: File | Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(datei);
    } catch {
      // Fallback unten
    }
  }
  const url = URL.createObjectURL(datei);
  try {
    return await new Promise<HTMLImageElement>((erfuellen, ablehnen) => {
      const img = new Image();
      img.onload = () => erfuellen(img);
      img.onerror = () => ablehnen(new Error('Das Bild konnte nicht geladen werden.'));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

/** Ungefaehre Groesse einer Data-URL in Byte. */
export function dataUrlGroesse(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.round((base64.length * 3) / 4);
}
