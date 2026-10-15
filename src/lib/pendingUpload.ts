import type { ColumnMapping } from '../types/lead';

const databaseName = 'figuredit-pending-upload';
export const pendingUploadKey = 'figuredit_pending_upload';

export interface PendingUpload {
  file: File;
  mapping: ColumnMapping;
  skipDuplicates: boolean;
}

function openPendingUpload(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('uploads');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function accessPendingUpload<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openPendingUpload();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction('uploads', mode);
      const request = action(transaction.objectStore('uploads'));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export const savePendingUpload = (upload: PendingUpload) => accessPendingUpload('readwrite', store => store.put(upload, 'current'));
export const getPendingUpload = () => accessPendingUpload<PendingUpload | undefined>('readonly', store => store.get('current'));
export const clearPendingUpload = () => accessPendingUpload('readwrite', store => store.delete('current'));
