import { allPhotos, getPhotos } from "./db"
import { backupWithoutVideos, readJsonFile, shareOrDownloadJson } from "./device"
import {
  commitDraft,
  isVideoMedia,
  parseBackup,
  todayISO,
  visitUnits,
  type Appliance,
  type Book,
  type Draft,
  type Photo,
  type Property,
} from "./model"
import { forgetPhotos, rememberPhotos, useBook } from "./store"

function currentBook(): Book {
  const state = useBook.getState()
  return {
    properties: state.properties,
    appliances: state.appliances,
    visits: state.visits,
  }
}

export async function saveVisit(draft: Draft): Promise<{ propertyId: string; memory: boolean } | { error: string }> {
  const photos = draft.photos.filter((photo) => !isVideoMedia(photo))
  const result = commitDraft(currentBook(), { ...draft, photos })
  if ("error" in result) return result
  try {
    await rememberPhotos(
      photos.map((photo) => ({
        id: photo.id,
        visitId: result.visit.id,
        dataUrl: photo.dataUrl,
        ...(photo.mediaType ? { mediaType: photo.mediaType } : {}),
      })),
    )
    await forgetPhotos(result.removedPhotoIds)
  } catch {
    return { error: "Couldn't store the photos. Remove one and try again." }
  }
  const memory = !(await useBook.getState().saveBook(result.book))
  return { propertyId: result.visit.propertyId, memory }
}

export async function updateProperty(property: Property): Promise<boolean> {
  const book = currentBook()
  return useBook.getState().saveBook({
    ...book,
    properties: book.properties.map((item) => (item.id === property.id ? property : item)),
  })
}

export async function upsertAppliance(appliance: Appliance): Promise<boolean> {
  const book = currentBook()
  const exists = book.appliances.some((item) => item.id === appliance.id)
  return useBook.getState().saveBook({
    ...book,
    appliances: exists
      ? book.appliances.map((item) => (item.id === appliance.id ? appliance : item))
      : [...book.appliances, appliance],
  })
}

export async function deleteAppliance(applianceId: string): Promise<{ error: string } | { ok: true }> {
  const book = currentBook()
  if (book.visits.some((visit) => visitUnits(visit).some((unit) => unit.applianceId === applianceId))) {
    return { error: "This unit has calls on it. Open those calls and remove them first." }
  }
  const ok = await useBook.getState().saveBook({
    ...book,
    appliances: book.appliances.filter((item) => item.id !== applianceId),
  })
  return ok ? { ok: true } : { error: "Couldn't save that change on this phone." }
}

export async function deleteVisit(visitId: string): Promise<boolean> {
  const book = currentBook()
  const visit = book.visits.find((item) => item.id === visitId)
  if (visit) await forgetPhotos(visit.photoIds).catch(() => undefined)
  return useBook.getState().saveBook({
    ...book,
    visits: book.visits.filter((item) => item.id !== visitId),
  })
}

export async function deleteProperty(propertyId: string): Promise<boolean> {
  const book = currentBook()
  const photoIds = book.visits.filter((visit) => visit.propertyId === propertyId).flatMap((visit) => visit.photoIds)
  await forgetPhotos(photoIds).catch(() => undefined)
  return useBook.getState().saveBook({
    properties: book.properties.filter((item) => item.id !== propertyId),
    appliances: book.appliances.filter((item) => item.propertyId !== propertyId),
    visits: book.visits.filter((visit) => visit.propertyId !== propertyId),
  })
}

export async function clearSamples(): Promise<boolean> {
  const book = currentBook()
  const sampleIds = new Set(book.properties.filter((item) => item.sample).map((item) => item.id))
  const photoIds = book.visits.filter((visit) => sampleIds.has(visit.propertyId)).flatMap((visit) => visit.photoIds)
  await forgetPhotos(photoIds).catch(() => undefined)
  return useBook.getState().saveBook({
    properties: book.properties.filter((item) => !sampleIds.has(item.id)),
    appliances: book.appliances.filter((item) => !sampleIds.has(item.propertyId)),
    visits: book.visits.filter((visit) => !sampleIds.has(visit.propertyId)),
  })
}

export async function exportBook(): Promise<{ error: string } | { ok: true; via: "share" | "download" }> {
  try {
    const book = currentBook()
    const known = new Set(book.visits.flatMap((visit) => visit.photoIds))
    const photos = (await allPhotos()).filter((photo) => known.has(photo.id))
    const payload = backupWithoutVideos({
      version: 2 as const,
      exportedAt: new Date().toISOString(),
      ...book,
      photos,
    })
    return await shareOrDownloadJson(`field-book-${todayISO()}.json`, payload)
  } catch {
    return { error: "Couldn't build the backup." }
  }
}

export async function importBookFile(file: File): Promise<{ error: string } | { count: number }> {
  let raw: unknown
  try {
    raw = await readJsonFile(file)
  } catch {
    return { error: "That file couldn't be read. Use a Field Book backup." }
  }
  const parsed = parseBackup(raw)
  if ("error" in parsed) return parsed
  const photos: Photo[] = parsed.backup.photos
  const ok = await useBook.getState().replaceAll(
    {
      properties: parsed.backup.properties,
      appliances: parsed.backup.appliances,
      visits: parsed.backup.visits,
    },
    photos,
  )
  if (!ok) return { error: "The backup is open on this screen, but this browser blocked saving it." }
  return { count: parsed.backup.visits.length }
}

export async function loadVisitPhotos(ids: string[]) {
  return getPhotos(ids)
}
