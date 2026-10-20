import { cleanBook, isBook, isVideoMedia, type Book, type Photo } from "./model"

const DB_NAME = "field-book"
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Storage is not available on this phone."))
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv")
      if (!db.objectStoreNames.contains("photos")) db.createObjectStore("photos")
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Could not open the book."))
  })
}

export async function loadBook(): Promise<Book | null> {
  const db = await openDb()
  const value = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction("kv", "readonly")
    const request = tx.objectStore("kv").get("book")
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error ?? new Error("Could not read the book."))
  })
  if (!isBook(value)) return null
  return cleanBook(value)
}

export async function saveBook(book: Book): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite")
    tx.objectStore("kv").put(book, "book")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("Could not save the book."))
    tx.onabort = () => reject(tx.error ?? new Error("Save was aborted."))
  })
}

export async function getPhotos(ids: string[]): Promise<Photo[]> {
  if (ids.length === 0) return []
  const db = await openDb()
  const found = await new Promise<Photo[]>((resolve, reject) => {
    const tx = db.transaction("photos", "readonly")
    const store = tx.objectStore("photos")
    const photos: Photo[] = []
    let pending = ids.length
    for (const id of ids) {
      const request = store.get(id)
      request.onsuccess = () => {
        const photo = request.result as Photo | undefined
        if (photo?.dataUrl) photos.push(photo)
        pending -= 1
        if (pending === 0) resolve(photos)
      }
      request.onerror = () => reject(request.error ?? new Error("Could not read a photo."))
    }
  })
  const byId = new Map(found.map((photo) => [photo.id, photo]))
  return ids
    .map((id) => byId.get(id))
    .filter((photo): photo is Photo => Boolean(photo))
    .filter((photo) => !isVideoMedia(photo))
}

export async function putPhotos(photos: Photo[]): Promise<void> {
  const kept = photos.filter((photo) => !isVideoMedia(photo))
  if (kept.length === 0) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite")
    const store = tx.objectStore("photos")
    for (const photo of kept) store.put(photo, photo.id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("Could not store photos."))
    tx.onabort = () => reject(tx.error ?? new Error("Photo save was aborted."))
  })
}

export async function deletePhotos(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite")
    const store = tx.objectStore("photos")
    for (const id of ids) store.delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("Could not remove photos."))
  })
}

export async function allPhotos(): Promise<Photo[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", "readonly")
    const request = tx.objectStore("photos").getAll()
    request.onsuccess = () =>
      resolve(((request.result as Photo[]) ?? []).filter((photo) => !isVideoMedia(photo)))
    request.onerror = () => reject(request.error ?? new Error("Could not read photos."))
  })
}

export async function replaceAllPhotos(photos: Photo[]): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite")
    const store = tx.objectStore("photos")
    store.clear()
    for (const photo of photos.filter((item) => !isVideoMedia(item))) store.put(photo, photo.id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("Could not replace photos."))
  })
}
