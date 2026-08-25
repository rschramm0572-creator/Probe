/**
 * Lokale Persistenz auf Basis von IndexedDB.
 *
 * Die Erfassung passiert im Markt, oft ohne stabile Verbindung. Alles wird
 * deshalb zuerst lokal gespeichert; die Analyse wird nachgeholt, sobald wieder
 * eine Verbindung besteht. Eine Cloud-Synchronisation ist optional und in
 * Version 1 nicht angebunden.
 */

const DB_NAME = 'kalkulens';
const DB_VERSION = 1;
const STORE_PRODUKTE = 'produkte';
const STORE_KV = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

function oeffne(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB steht in dieser Umgebung nicht zur Verfügung.'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((erfuellen, ablehnen) => {
    const anfrage = indexedDB.open(DB_NAME, DB_VERSION);
    anfrage.onupgradeneeded = () => {
      const db = anfrage.result;
      if (!db.objectStoreNames.contains(STORE_PRODUKTE)) {
        db.createObjectStore(STORE_PRODUKTE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
    };
    anfrage.onsuccess = () => erfuellen(anfrage.result);
    anfrage.onerror = () => ablehnen(anfrage.error ?? new Error('IndexedDB konnte nicht geöffnet werden.'));
  });
  return dbPromise;
}

function alsPromise<T>(anfrage: IDBRequest<T>): Promise<T> {
  return new Promise((erfuellen, ablehnen) => {
    anfrage.onsuccess = () => erfuellen(anfrage.result);
    anfrage.onerror = () => ablehnen(anfrage.error ?? new Error('Datenbankfehler'));
  });
}

export async function speichereProdukt<T extends { id: string }>(produkt: T): Promise<void> {
  const db = await oeffne();
  const tx = db.transaction(STORE_PRODUKTE, 'readwrite');
  tx.objectStore(STORE_PRODUKTE).put(produkt);
  await new Promise<void>((erfuellen, ablehnen) => {
    tx.oncomplete = () => erfuellen();
    tx.onerror = () => ablehnen(tx.error ?? new Error('Speichern fehlgeschlagen'));
  });
}

export async function ladeProdukte<T>(): Promise<T[]> {
  const db = await oeffne();
  const tx = db.transaction(STORE_PRODUKTE, 'readonly');
  return alsPromise(tx.objectStore(STORE_PRODUKTE).getAll() as IDBRequest<T[]>);
}

export async function loescheProdukt(id: string): Promise<void> {
  const db = await oeffne();
  const tx = db.transaction(STORE_PRODUKTE, 'readwrite');
  tx.objectStore(STORE_PRODUKTE).delete(id);
  await new Promise<void>((erfuellen) => {
    tx.oncomplete = () => erfuellen();
  });
}

export async function setzeWert(schluessel: string, wert: unknown): Promise<void> {
  const db = await oeffne();
  const tx = db.transaction(STORE_KV, 'readwrite');
  tx.objectStore(STORE_KV).put(wert, schluessel);
  await new Promise<void>((erfuellen, ablehnen) => {
    tx.oncomplete = () => erfuellen();
    tx.onerror = () => ablehnen(tx.error ?? new Error('Speichern fehlgeschlagen'));
  });
}

export async function holeWert<T>(schluessel: string): Promise<T | undefined> {
  const db = await oeffne();
  const tx = db.transaction(STORE_KV, 'readonly');
  return alsPromise(tx.objectStore(STORE_KV).get(schluessel) as IDBRequest<T | undefined>);
}

/** Loescht alle lokal gespeicherten Daten. */
export async function leereDatenbank(): Promise<void> {
  const db = await oeffne();
  const tx = db.transaction([STORE_PRODUKTE, STORE_KV], 'readwrite');
  tx.objectStore(STORE_PRODUKTE).clear();
  tx.objectStore(STORE_KV).clear();
  await new Promise<void>((erfuellen) => {
    tx.oncomplete = () => erfuellen();
  });
}
