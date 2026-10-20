import { isVideoMedia } from "./model"

export function requestLocation(): Promise<{ lat: number; lng: number } | { error: string }> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ error: "This phone doesn't share location. Search by the address instead." })
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (failure) => {
        if (failure.code === failure.PERMISSION_DENIED) {
          resolve({ error: "Location is off. Allow it for this site, or search by the address." })
          return
        }
        resolve({ error: "Couldn't read your location. Search by the address instead." })
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    )
  })
}

export async function reverseGeocode(lat: number, lng: number): Promise<{ address: string; city: string } | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } })
    if (!response.ok) return null
    const data = (await response.json()) as {
      display_name?: string
      address?: Record<string, string>
    }
    const parts = data.address ?? {}
    const street = [parts.house_number, parts.road].filter(Boolean).join(" ")
    const city = parts.city || parts.town || parts.village || parts.hamlet || parts.suburb || ""
    const address = street || data.display_name?.split(",")[0] || ""
    if (!address) return null
    return { address, city }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const max = 1280
      const scale = Math.min(1, max / Math.max(image.width, image.height))
      const width = Math.max(1, Math.round(image.width * scale))
      const height = Math.max(1, Math.round(image.height * scale))
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext("2d")
      if (!context) {
        URL.revokeObjectURL(url)
        reject(new Error("Could not read that photo."))
        return
      }
      context.drawImage(image, 0, 0, width, height)
      const dataUrl = canvas.toDataURL("image/jpeg", 0.72)
      URL.revokeObjectURL(url)
      resolve(dataUrl)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Could not read that photo."))
    }
    image.src = url
  })
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

type CapFilesystem = {
  writeFile: (opts: {
    path: string
    data: string
    directory: string
    encoding: string
  }) => Promise<{ uri?: string } | undefined>
}

type CapShare = {
  share: (opts: {
    title?: string
    text?: string
    url?: string
    files?: string[]
    dialogTitle?: string
  }) => Promise<unknown>
}

type CapBridge = {
  Plugins?: { Filesystem?: CapFilesystem; Share?: CapShare }
  isNativePlatform?: () => boolean
}

function capacitor(): CapBridge | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { Capacitor?: CapBridge }).Capacitor
}

function isAndroidWebView(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  if (!/Android/i.test(ua)) return false
  return /;\s*wv\)/i.test(ua) || /\bwv\b/i.test(ua) || /Version\/\d/i.test(ua)
}

function errorBits(err: unknown): { name: string; message: string } {
  if (err instanceof Error) return { name: err.name, message: err.message }
  if (err && typeof err === "object") {
    const o = err as { name?: unknown; message?: unknown }
    return {
      name: typeof o.name === "string" ? o.name : "",
      message: typeof o.message === "string" ? o.message : "",
    }
  }
  return { name: "", message: typeof err === "string" ? err : "" }
}

function shareFail(err: unknown): { error: string } {
  const { name, message } = errorBits(err)
  if (name === "AbortError" || /cancel/i.test(message)) {
    return { error: "Share cancelled. No file was saved." }
  }
  if (/timed? ?out/i.test(message)) {
    return {
      error:
        "Share sheet didn't open. Force-close the app and try Export again, or open appliancetracker.grok.me in Chrome.",
    }
  }
  return { error: "Couldn't share the backup. No file was saved." }
}

function asFile(filename: string, json: string): File | null {
  if (typeof File !== "function") return null
  return new File([json], filename, { type: "application/json" })
}

function canShareFile(file: File): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false
  if (typeof navigator.canShare !== "function") return false
  try {
    return navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    promise.then(
      (v) => {
        window.clearTimeout(t)
        resolve(v)
      },
      (e) => {
        window.clearTimeout(t)
        reject(e)
      },
    )
  })
}

const APK_HINT = "This phone app build can't save backups yet. Install the latest APK."

/** Strip video media from a backup payload (keeps photos). */
export function backupWithoutVideos<T extends { photos?: Array<{ dataUrl?: string; mediaType?: string }> }>(
  payload: T,
): T {
  const photos = (payload.photos ?? []).filter(
    (photo) => !isVideoMedia({ dataUrl: photo.dataUrl ?? "", mediaType: photo.mediaType }),
  )
  return { ...payload, photos }
}

export async function shareOrDownloadJson(
  filename: string,
  data: unknown,
): Promise<{ ok: true; via: "share" | "download" } | { error: string }> {
  let json: string
  try {
    json = JSON.stringify(data)
  } catch {
    return { error: "Couldn't build the backup — it may be too large. Remove some photos and try again." }
  }

  const sizeMb = json.length / (1024 * 1024)

  const cap = capacitor()
  const fs = cap?.Plugins?.Filesystem
  const share = cap?.Plugins?.Share
  let native = false
  try {
    native = !!cap?.isNativePlatform?.()
  } catch {
    native = false
  }

  const onPhoneShell = Boolean(native || cap || isAndroidWebView())

  if (fs?.writeFile && share?.share && onPhoneShell) {
    try {
      const written = await withTimeout(
        fs.writeFile({
          path: filename,
          data: json,
          directory: "CACHE",
          encoding: "utf8",
        }),
        45_000,
        "Write",
      )
      const uri = written?.uri
      if (!uri) return { error: "Couldn't share the backup. No file was saved." }

      await withTimeout(
        share.share({
          title: "Field Book backup",
          url: uri,
          files: [uri],
          dialogTitle: "Save or email Field Book backup",
        }),
        90_000,
        "Share",
      )
      return { ok: true, via: "share" }
    } catch (err) {
      const fail = shareFail(err)
      if (/cancel/i.test(fail.error)) return fail
    }
  }

  const file = asFile(filename, json)
  if (file && canShareFile(file)) {
    try {
      await withTimeout(navigator.share({ files: [file], title: "Field Book backup" }), 90_000, "Share")
      return { ok: true, via: "share" }
    } catch (err) {
      return shareFail(err)
    }
  }

  if (onPhoneShell) {
    if (sizeMb > 20) {
      return {
        error:
          "Backup is too large to share from the app. Remove some photos and try again, or open the site in Chrome.",
      }
    }
    return { error: APK_HINT }
  }

  downloadJson(filename, data)
  return { ok: true, via: "download" }
}

export async function readJsonFile(file: File): Promise<unknown> {
  return JSON.parse(await file.text())
}
