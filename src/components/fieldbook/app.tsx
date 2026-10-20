import { useEffect, useState } from "react"
import { LocateFixed, Plus } from "lucide-react"
import { clearSamples, exportBook, importBookFile } from "@/lib/fieldbook/actions"
import { requestLocation, reverseGeocode } from "@/lib/fieldbook/device"
import {
  blankDraft,
  formatDistance,
  nearbyProperties,
  uid,
  type Draft,
} from "@/lib/fieldbook/model"
import { useBook } from "@/lib/fieldbook/store"
import { HomeScreen } from "./home-screen"
import { NavProvider, type NavApi } from "./nav"
import { NearbyScreen, PropertyScreen } from "./property-screen"
import { VisitScreen } from "./visit-screen"

type Screen =
  | { kind: "home" }
  | { kind: "property"; propertyId: string }
  | { kind: "editor"; token: string; draft: Draft }
  | { kind: "nearby"; hits: { propertyId: string; meters: number }[] }

type Menu = "closed" | "root" | "clear" | "import"

export function FieldBook() {
  const boot = useBook((state) => state.boot)
  const status = useBook((state) => state.status)
  const properties = useBook((state) => state.properties)
  const visits = useBook((state) => state.visits)
  const [stack, setStack] = useState<Screen[]>([{ kind: "home" }])
  const [notice, setNotice] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [menu, setMenu] = useState<Menu>("closed")
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [menuMessage, setMenuMessage] = useState("")
  const screen = stack[stack.length - 1] ?? { kind: "home" as const }
  const hasExamples = properties.some((property) => property.sample)

  useEffect(() => {
    void boot()
  }, [boot])

  function push(next: Screen) {
    setStack((current) => [...current, next])
  }

  function back() {
    setStack((current) => (current.length > 1 ? current.slice(0, -1) : current))
  }

  function openProperty(propertyId: string) {
    push({ kind: "property", propertyId })
  }

  function finishEdit(propertyId: string) {
    setStack((current) => {
      const under = current.slice(0, -1)
      const previous = under[under.length - 1]
      if (previous?.kind === "property" && previous.propertyId === propertyId) return under
      return [...under, { kind: "property", propertyId }]
    })
  }

  async function locateHere() {
    if (locating) return
    setLocating(true)
    setNotice(null)
    const result = await requestLocation()
    setLocating(false)
    if ("error" in result) {
      setNotice(result.error)
      return
    }
    const hits = nearbyProperties(useBook.getState().properties, result.lat, result.lng)
    if (hits.length === 1) {
      push({ kind: "property", propertyId: hits[0].property.id })
      setNotice(`${hits[0].property.address} · ${formatDistance(hits[0].meters)} away.`)
      return
    }
    if (hits.length > 1) {
      push({
        kind: "nearby",
        hits: hits.map((hit) => ({ propertyId: hit.property.id, meters: hit.meters })),
      })
      return
    }
    push({ kind: "editor", token: uid(), draft: blankDraft({ lat: result.lat, lng: result.lng }) })
    setNotice("No saved address within about 650 feet. Check the street before you save.")
    const geo = await reverseGeocode(result.lat, result.lng)
    if (geo) useBook.getState().setGeoHint({ address: geo.address, city: geo.city, nonce: Date.now() })
  }

  const nav: NavApi = {
    back,
    openProperty,
    openEditor: (draft) => push({ kind: "editor", token: uid(), draft }),
    notify: (message) => setNotice(message),
    locateHere: () => void locateHere(),
    locating,
    openMenu: () => {
      setMenuMessage("")
      setMenu("root")
    },
  }

  async function onExport() {
    setMenuMessage("Preparing backup…")
    let message = "Couldn't build the backup. No file was saved."
    try {
      const result = await exportBook()
      if ("error" in result) message = result.error
      else message = result.via === "share" ? "Backup shared." : "Backup downloaded."
    } catch {
      message = "Couldn't build the backup. No file was saved."
    } finally {
      setMenuMessage(message)
    }
  }

  async function onImport() {
    if (!pendingFile) return
    const result = await importBookFile(pendingFile)
    if ("error" in result) {
      setMenuMessage(result.error)
      return
    }
    setPendingFile(null)
    setMenu("closed")
    setStack([{ kind: "home" }])
    setNotice(`Backup imported. ${result.count} call${result.count === 1 ? "" : "s"}.`)
  }

  async function onClear() {
    const ok = await clearSamples()
    setMenu("closed")
    setNotice(ok ? "Example addresses removed." : "Examples hidden on this screen. Storage is blocked.")
  }

  return (
    <NavProvider value={nav}>
      <div className="mx-auto flex min-h-screen w-full max-w-5xl">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-line bg-card px-5 py-8 md:flex">
          <p className="text-sm font-semibold tracking-wide text-pine">Field Book</p>
          <p className="mt-2 text-2xl font-semibold leading-tight">The van file for every stop.</p>
          <p className="mt-3 text-sm text-muted">
            Address, owner, realty company, appliance, parts, photos, and the note you wish you had last time.
          </p>
          <p className="mt-4 font-mono text-sm text-muted tabular-nums">
            {properties.length} addresses · {visits.length} calls
          </p>
          <button type="button" className="btn btn-primary mt-6 w-full" onClick={() => nav.openEditor(blankDraft())}>
            <Plus className="size-5" aria-hidden="true" />
            Log a call
          </button>
          <button type="button" className="btn btn-sand mt-2 w-full" disabled={locating} onClick={() => void locateHere()}>
            <LocateFixed className="size-5" aria-hidden="true" />
            {locating ? "Finding you…" : "I'm here"}
          </button>
          <button
            type="button"
            className="btn btn-sand mt-2 w-full"
            onClick={() => {
              setMenuMessage("")
              setMenu("root")
            }}
          >
            Backup
          </button>
          <p className="mt-6 text-sm text-muted">
            Stamp a location on the address. Next time you're within about 650 feet, I'm here opens that file.
          </p>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-xl px-4 pt-4 pb-16 md:px-8 md:pt-8">
            {status === "memory" ? (
              <p className="mb-4 rounded-xl bg-sand px-3 py-3 text-sm">
                This browser blocked saved storage. Export a backup before you close the page.
              </p>
            ) : null}
            {notice ? (
              <div className="mb-4 flex items-start justify-between gap-3 rounded-xl bg-sand px-3 py-3 text-sm" role="status">
                <p>{notice}</p>
                <button type="button" className="font-semibold" onClick={() => setNotice(null)}>
                  Dismiss
                </button>
              </div>
            ) : null}
            {screen.kind === "home" ? <HomeScreen /> : null}
            {screen.kind === "property" ? <PropertyScreen propertyId={screen.propertyId} /> : null}
            {screen.kind === "editor" ? (
              <VisitScreen key={screen.token} draft={screen.draft} onSaved={finishEdit} />
            ) : null}
            {screen.kind === "nearby" ? <NearbyScreen hits={screen.hits} /> : null}
          </div>
        </main>
      </div>

      {menu !== "closed" ? (
        <div className="fixed inset-0 z-40">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close menu" onClick={() => setMenu("closed")} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-card px-4 pt-3 pb-6">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
            {menu === "root" ? (
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Book</h2>
                <button type="button" className="btn btn-sand w-full" onClick={() => void onExport()}>
                  Export backup
                </button>
                <label className="btn btn-sand w-full">
                  Import backup
                  <input
                    className="sr-only"
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ""
                      if (!file) return
                      setPendingFile(file)
                      setMenu("import")
                      setMenuMessage("")
                    }}
                  />
                </label>
                {hasExamples ? (
                  <button type="button" className="btn btn-sand w-full" onClick={() => setMenu("clear")}>
                    Remove example addresses
                  </button>
                ) : null}
                <button type="button" className="btn btn-primary w-full" onClick={() => setMenu("closed")}>
                  Close
                </button>
              </div>
            ) : null}
            {menu === "import" ? (
              <div>
                <h2 className="text-lg font-semibold">Replace this book?</h2>
                <p className="mt-2 text-sm text-muted">
                  {pendingFile ? pendingFile.name : "That file"} will replace every address and call on this phone.
                </p>
                <div className="mt-4 flex gap-2">
                  <button type="button" className="btn btn-primary flex-1" onClick={() => void onImport()}>
                    Import
                  </button>
                  <button type="button" className="btn btn-sand flex-1" onClick={() => setMenu("root")}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
            {menu === "clear" ? (
              <div>
                <h2 className="text-lg font-semibold">Remove the examples?</h2>
                <p className="mt-2 text-sm text-muted">
                  This deletes the sample addresses and every call saved on them. Your other stops stay.
                </p>
                <div className="mt-4 flex gap-2">
                  <button type="button" className="btn btn-primary flex-1" onClick={() => void onClear()}>
                    Remove examples
                  </button>
                  <button type="button" className="btn btn-sand flex-1" onClick={() => setMenu("root")}>
                    Keep them
                  </button>
                </div>
              </div>
            ) : null}
            {menuMessage ? <p className="mt-3 text-sm">{menuMessage}</p> : null}
          </div>
        </div>
      ) : null}
    </NavProvider>
  )
}
