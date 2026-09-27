"use client";

/**
 * Fotos offline (Fase 19): blobs em IndexedDB (localStorage não cabe binary).
 * A op `file.upload` na outbox referencia o blob pela chave; o sync lê,
 * envia e apaga. Sem IDB (SSR/privado): lança, e o chamador segue sem fila.
 */

const DB = "corpservices.photos.v1";
const STORE = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("no-idb"));
      return;
    }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb-open"));
  });
}

export async function savePhotoBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("idb-put"));
    });
  } finally {
    db.close();
  }
}

export async function getPhotoBlob(key: string): Promise<Blob | null> {
  const db = await openDb();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("idb-get"));
    });
  } finally {
    db.close();
  }
}

export async function deletePhotoBlob(key: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("idb-del"));
    });
  } finally {
    db.close();
  }
}
