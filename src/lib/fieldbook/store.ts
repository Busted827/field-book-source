import { create } from "zustand"
import { deletePhotos, loadBook, putPhotos, replaceAllPhotos, saveBook as persistBook } from "./db"
import { SAMPLE_BOOK } from "./sample"
import type { Book, Photo } from "./model"

export type BookStatus = "loading" | "ready" | "memory"

type GeoHint = { address: string; city: string; nonce: number } | null

type FieldState = Book & {
  status: BookStatus
  geoHint: GeoHint
  boot: () => Promise<void>
  saveBook: (book: Book) => Promise<boolean>
  replaceAll: (book: Book, photos: Photo[]) => Promise<boolean>
  setGeoHint: (hint: GeoHint) => void
}

let bootStarted = false
let dirty = false

function pick(state: FieldState): Book {
  return {
    properties: state.properties,
    appliances: state.appliances,
    visits: state.visits,
  }
}

export const useBook = create<FieldState>((set, get) => ({
  properties: [],
  appliances: [],
  visits: [],
  status: "loading",
  geoHint: null,
  setGeoHint: (hint) => set({ geoHint: hint }),
  boot: async () => {
    if (bootStarted) return
    bootStarted = true
    try {
      const saved = await loadBook()
      if (dirty) {
        await persistBook(pick(get()))
        set({ status: "ready" })
        return
      }
      if (saved) set({ ...saved, status: "ready" })
      else {
        set({ ...SAMPLE_BOOK, status: "ready" })
        await persistBook(SAMPLE_BOOK)
      }
    } catch {
      if (!dirty && get().properties.length === 0) set({ ...SAMPLE_BOOK, status: "memory" })
      else set({ status: get().properties.length === 0 ? "memory" : "ready" })
    }
  },
  saveBook: async (book) => {
    dirty = true
    set({ ...book })
    try {
      await persistBook(book)
      set({ status: "ready" })
      return true
    } catch {
      set({ status: "memory" })
      return false
    }
  },
  replaceAll: async (book, photos) => {
    dirty = true
    set({ ...book, status: "ready" })
    try {
      await persistBook(book)
      await replaceAllPhotos(photos)
      return true
    } catch {
      set({ status: "memory" })
      return false
    }
  },
}))

export async function rememberPhotos(photos: Photo[]) {
  await putPhotos(photos)
}

export async function forgetPhotos(ids: string[]) {
  await deletePhotos(ids)
}
