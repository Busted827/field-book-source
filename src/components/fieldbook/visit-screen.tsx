import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Camera, MapPin, Plus, Trash2, X } from "lucide-react"
import { deleteVisit, loadVisitPhotos, saveVisit } from "@/lib/fieldbook/actions"
import { compressImage, requestLocation, reverseGeocode } from "@/lib/fieldbook/device"
import {
  MAX_PHOTOS,
  WORK_ACTIONS,
  appliancesAt,
  blankDraftUnit,
  blankWork,
  shapePartsOnOrderItems,
  partsFor,
  rememberedValues,
  uid,
  workActionUsesPart,
  type Draft,
  type DraftPhoto,
  type DraftUnit,
  type Property,
  type WorkLine,
} from "@/lib/fieldbook/model"
import { useBook } from "@/lib/fieldbook/store"
import { useNav } from "./nav"
import { ApplianceFields } from "./property-screen"
import { BackHeader, PartsOnOrderToggle, PropertyAlertBanner, RememberedField, YearSelect } from "./ui"

export function VisitScreen({ draft, onSaved }: { draft: Draft; onSaved: (propertyId: string) => void }) {
  const nav = useNav()
  const properties = useBook((state) => state.properties)
  const appliances = useBook((state) => state.appliances)
  const visits = useBook((state) => state.visits)
  const geoHint = useBook((state) => state.geoHint)
  const [form, setForm] = useState(draft)
  const [activeUnitKey, setActiveUnitKey] = useState(draft.units[0]?.key ?? "")
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [photosReady, setPhotosReady] = useState(draft.existingPhotoIds.length === 0)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [zoom, setZoom] = useState<DraftPhoto | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (draft.existingPhotoIds.length === 0) return
    let cancel = false
    loadVisitPhotos(draft.existingPhotoIds)
      .then((photos) => {
        if (cancel) return
        setForm((current) => ({
          ...current,
          photos: photos
            .filter((photo) => photo.mediaType !== "video" && !photo.dataUrl.startsWith("data:video/"))
            .map((photo) => ({
              id: photo.id,
              dataUrl: photo.dataUrl,
              mediaType: "image" as const,
            })),
        }))
        setPhotosReady(true)
      })
      .catch(() => {
        if (!cancel) {
          setPhotosReady(true)
          setError("Some photos couldn't be opened.")
        }
      })
    return () => {
      cancel = true
    }
  }, [draft.existingPhotoIds])

  useEffect(() => {
    if (!geoHint) return
    setForm((current) =>
      current.address.trim()
        ? current
        : { ...current, address: geoHint.address, city: geoHint.city || current.city },
    )
  }, [geoHint])

  const cities = useMemo(() => rememberedValues(properties.map((property) => property.city)), [properties])
  const companies = useMemo(() => rememberedValues(properties.map((property) => property.realtyCompany)), [properties])
  const models = useMemo(() => rememberedValues(appliances.map((unit) => unit.model)), [appliances])
  const book = { properties, appliances, visits }
  const onFileUnits = form.propertyId ? appliancesAt(book, form.propertyId) : []
  const query = form.address.trim().toLowerCase()
  const suggestions =
    query.length < 2
      ? []
      : properties
          .filter(
            (property) =>
              property.id !== form.propertyId && `${property.address} ${property.city}`.toLowerCase().includes(query),
          )
          .slice(0, 5)

  const twin =
    !form.propertyId &&
    properties.find(
      (property) =>
        property.address.trim().toLowerCase() === form.address.trim().toLowerCase() &&
        property.city.trim().toLowerCase() === form.city.trim().toLowerCase() &&
        property.unitNumber.trim().toLowerCase() === form.unitNumber.trim().toLowerCase() &&
        form.address.trim() !== "",
    )

  const showUnitNumber = form.realtyCompany.trim().length > 0
  const alertTwinId = useRef<string | null>(null)

  useEffect(() => {
    if (!twin || form.propertyId) return
    if (alertTwinId.current === twin.id) return
    alertTwinId.current = twin.id
    setForm((current) => (current.alert.trim() ? current : { ...current, alert: twin.alert ?? "" }))
  }, [twin, form.propertyId])

  const bannerAlert = form.alert.trim() || (twin ? twin.alert : "")

  function bindProperty(property: Property) {
    const onFile = appliances.filter((unit) => unit.propertyId === property.id)
    const only = onFile.length === 1 ? onFile[0] : undefined
    const first = blankDraftUnit({
      applianceId: only?.id ?? null,
      applianceType: only?.type ?? "",
      brand: only?.brand ?? "",
      model: only?.model ?? "",
      serial: only?.serial ?? "",
      year: only?.year ?? "",
      partsOnOrder: only?.partsOnOrder ?? false,
      partsOnOrderItems: only ? shapePartsOnOrderItems(only) : [],
    })
    setForm((current) => ({
      ...current,
      propertyId: property.id,
      address: property.address,
      city: property.city,
      ownerName: property.ownerName,
      realtyCompany: property.realtyCompany,
      unitNumber: property.unitNumber ?? "",
      alert: property.alert ?? "",
      lat: property.lat,
      lng: property.lng,
      sampleProperty: property.sample,
      units: [first],
    }))
    setActiveUnitKey(first.key)
    setSuggestOpen(false)
  }

  function updateUnit(key: string, patch: Partial<DraftUnit>) {
    setForm((current) => ({
      ...current,
      units: current.units.map((unit) => (unit.key === key ? { ...unit, ...patch } : unit)),
    }))
  }

  function updateUnitWork(unitKey: string, lineId: string, line: WorkLine) {
    setForm((current) => ({
      ...current,
      units: current.units.map((unit) =>
        unit.key === unitKey
          ? { ...unit, work: unit.work.map((item) => (item.id === lineId ? line : item)) }
          : unit,
      ),
    }))
  }

  function addApplianceCard() {
    const next = blankDraftUnit()
    setForm((current) => ({ ...current, units: [...current.units, next] }))
    setActiveUnitKey(next.key)
  }

  function removeApplianceCard(key: string) {
    setForm((current) => {
      const units = current.units.filter((unit) => unit.key !== key)
      const next = units.length > 0 ? units : [blankDraftUnit()]
      return { ...current, units: next }
    })
    setActiveUnitKey((active) => {
      if (active !== key) return active
      // next key resolved after form update; fall back to first remaining
      const remaining = form.units.filter((unit) => unit.key !== key)
      return remaining[0]?.key ?? ""
    })
  }

  async function stamp() {
    const result = await requestLocation()
    if ("error" in result) {
      setError(result.error)
      return
    }
    setForm((current) => ({ ...current, lat: result.lat, lng: result.lng }))
    setError("")
    if (!form.address.trim()) {
      const geo = await reverseGeocode(result.lat, result.lng)
      if (geo) {
        setForm((current) =>
          current.address.trim() ? current : { ...current, address: geo.address, city: geo.city || current.city },
        )
      }
    }
  }

  async function onFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    const room = MAX_PHOTOS - form.photos.length
    if (room <= 0) {
      setError(`This call already has ${MAX_PHOTOS} photos.`)
      return
    }
    const files = [...list].slice(0, room)
    try {
      const next: DraftPhoto[] = []
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue
        const dataUrl = await compressImage(file)
        next.push({ id: uid(), dataUrl, mediaType: "image" })
      }
      if (next.length === 0) {
        setError("Choose a photo from the camera or library.")
        return
      }
      setForm((current) => ({ ...current, photos: [...current.photos, ...next].slice(0, MAX_PHOTOS) }))
      setError("")
    } catch {
      setError("Couldn't read that file. Try another one.")
    } finally {
      if (cameraRef.current) cameraRef.current.value = ""
      if (libraryRef.current) libraryRef.current.value = ""
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!photosReady) {
      setError("Photos are still opening.")
      return
    }
    setSaving(true)
    const result = await saveVisit(form)
    setSaving(false)
    if ("error" in result) {
      setError(result.error)
      return
    }
    nav.notify(result.memory ? "Call saved on this screen. Export a backup — storage is blocked." : "Call saved.")
    onSaved(result.propertyId)
  }

  async function removeVisit() {
    if (!form.visitId) return
    const ok = await deleteVisit(form.visitId)
    if (!ok) {
      setError("Couldn't remove that call.")
      return
    }
    nav.notify("Call removed.")
    nav.back()
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      <BackHeader title={form.visitId ? "Edit call" : "Log a call"} subtitle={form.date || "Service record"} />
      <PropertyAlertBanner alert={bannerAlert} />

      <label className="label" htmlFor="call-date">
        Date you were there
      </label>
      <input
        id="call-date"
        className="field"
        type="date"
        required
        value={form.date}
        onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
      />

      <div className="mt-4">
        <label className="label" htmlFor="call-address">
          Street address
        </label>
        <input
          id="call-address"
          className="field"
          value={form.address}
          autoComplete="off"
          required
          onFocus={() => setSuggestOpen(true)}
          onChange={(event) => {
            const address = event.target.value
            setSuggestOpen(true)
            setForm((current) => {
              const bound = properties.find((property) => property.id === current.propertyId)
              const still = bound?.address === address
              if (!still) alertTwinId.current = null
              return {
                ...current,
                address,
                propertyId: still ? current.propertyId : null,
                sampleProperty: still ? current.sampleProperty : false,
                alert: still || !bound || current.alert !== (bound.alert ?? "") ? current.alert : "",
              }
            })
          }}
        />
        {suggestOpen && suggestions.length > 0 ? (
          <ul className="mt-2 overflow-hidden rounded-xl border border-line bg-card">
            {suggestions.map((property) => (
              <li key={property.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  className="min-h-12 w-full px-3 py-2 text-left"
                  onClick={() => bindProperty(property)}
                >
                  <span className="block font-semibold">{property.address}</span>
                  <span className="block text-sm text-muted">
                    {[property.city, property.ownerName, property.realtyCompany, property.unitNumber ? `Unit ${property.unitNumber}` : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {form.propertyId ? (
          <p className="mt-2 text-sm text-muted">
            This adds to the file already at this address.{" "}
            <button
              type="button"
              className="font-semibold text-ink"
              onClick={() => {
                const first = blankDraftUnit()
                alertTwinId.current = null
                setForm((current) => ({
                  ...current,
                  propertyId: null,
                  sampleProperty: false,
                  address: "",
                  city: "",
                  ownerName: "",
                  realtyCompany: "",
                  unitNumber: "",
                  alert: "",
                  lat: null,
                  lng: null,
                  units: [first],
                }))
                setActiveUnitKey(first.key)
              }}
            >
              Use a different address
            </button>
          </p>
        ) : twin ? (
          <p className="mt-2 text-sm text-muted">This address is already on file. Saving adds the call to that file.</p>
        ) : null}
      </div>

      <RememberedField
        id="call-city"
        className="mt-4"
        label="City"
        value={form.city}
        options={cities}
        newPlaceholder="New city, like Corolla"
        onChange={(city) => setForm((current) => ({ ...current, city }))}
      />

      <label className="label mt-4" htmlFor="call-owner">
        Owner
      </label>
      <input
        id="call-owner"
        className="field"
        autoComplete="name"
        value={form.ownerName}
        onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))}
      />

      <RememberedField
        id="call-realty"
        className="mt-4"
        label="Realty company"
        value={form.realtyCompany}
        options={companies}
        newPlaceholder="New company, like Twiddy"
        onChange={(realtyCompany) =>
          setForm((current) => ({
            ...current,
            realtyCompany,
            unitNumber: realtyCompany.trim() ? current.unitNumber : "",
          }))
        }
      />

      {showUnitNumber ? (
        <>
          <label className="label mt-4" htmlFor="call-unit">
            Unit number
          </label>
          <input
            id="call-unit"
            className="field"
            value={form.unitNumber}
            placeholder="Apt, suite, or unit"
            autoComplete="off"
            onChange={(event) => setForm((current) => ({ ...current, unitNumber: event.target.value }))}
          />
        </>
      ) : null}

      <label className="label mt-4" htmlFor="call-alert">
        Property alert
      </label>
      <input
        id="call-alert"
        className="field"
        value={form.alert}
        placeholder="Owner hard of hearing — KNOCK LOUD, gate code…"
        onChange={(event) => setForm((current) => ({ ...current, alert: event.target.value }))}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-sand" onClick={() => void stamp()}>
          <MapPin className="size-5" aria-hidden="true" />
          {form.lat != null ? "Update location" : "Stamp my location"}
        </button>
        {form.lat != null ? (
          <button
            type="button"
            className="text-sm font-semibold"
            onClick={() => setForm((current) => ({ ...current, lat: null, lng: null }))}
          >
            Clear location
          </button>
        ) : (
          <p className="text-sm text-muted">Optional. Next time you're here, I'm here can open this file.</p>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {form.units.map((unit, index) => (
          <ApplianceCardEditor
            key={unit.key}
            index={index}
            unit={unit}
            active={unit.key === activeUnitKey}
            canRemove={form.units.length > 1}
            models={models}
            onFileUnits={onFileUnits}
            onFocus={() => setActiveUnitKey(unit.key)}
            onChange={(patch) => updateUnit(unit.key, patch)}
            onWorkChange={(lineId, line) => updateUnitWork(unit.key, lineId, line)}
            onRemove={() => removeApplianceCard(unit.key)}
          />
        ))}
        <button type="button" className="btn btn-sand w-full" onClick={addApplianceCard}>
          <Plus className="size-5" aria-hidden="true" />
          Add another appliance
        </button>
      </div>

      <label className="label mt-6" htmlFor="call-comments">
        Notes for next time
      </label>
      <textarea
        id="call-comments"
        className="field"
        value={form.comments}
        placeholder="Gate code, dog in the yard, tenant wants a text first…"
        onChange={(event) => setForm((current) => ({ ...current, comments: event.target.value }))}
      />

      <div className="mt-6">
        <h2 className="text-base font-semibold">Photos</h2>
        <p className="mt-1 text-sm text-muted">Up to {MAX_PHOTOS} photos. Stored with this call.</p>
        {form.photos.length > 0 ? (
          <ul className="mt-3 flex gap-3 overflow-x-auto pt-2 pb-1">
            {form.photos.map((photo) => (
              <li key={photo.id} className="relative shrink-0">
                <button type="button" onClick={() => setZoom(photo)} aria-label="View photo">
                  <img src={photo.dataUrl} alt="" className="h-24 w-24 rounded-xl object-cover" />
                </button>
                <button
                  type="button"
                  className="icon-btn absolute -top-2 -right-2"
                  aria-label="Remove photo"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      photos: current.photos.filter((item) => item.id !== photo.id),
                    }))
                  }
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 flex gap-2">
          <button type="button" className="btn btn-sand flex-1" onClick={() => cameraRef.current?.click()}>
            <Camera className="size-5" aria-hidden="true" />
            Photo
          </button>
          <button type="button" className="btn btn-sand flex-1" onClick={() => libraryRef.current?.click()}>
            Library
          </button>
        </div>
        <input
          ref={cameraRef}
          className="sr-only"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => void onFiles(event.target.files)}
        />
        <input
          ref={libraryRef}
          className="sr-only"
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => void onFiles(event.target.files)}
        />
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-copper-soft px-3 py-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn btn-primary mt-5 w-full" disabled={saving || !photosReady}>
        {saving ? "Saving…" : "Save call"}
      </button>

      {form.visitId ? (
        confirmDelete ? (
          <div className="mt-4 rounded-xl bg-sand px-3 py-3">
            <p className="text-sm">Remove this call from the address file?</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn btn-primary" onClick={() => void removeVisit()}>
                Remove call
              </button>
              <button type="button" className="btn btn-sand" onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="mt-4 text-sm font-semibold" onClick={() => setConfirmDelete(true)}>
            Remove this call
          </button>
        )
      ) : null}

      {zoom ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4">
          <button type="button" className="icon-btn absolute top-4 right-4" aria-label="Close" onClick={() => setZoom(null)}>
            <X className="size-5" />
          </button>
          <img src={zoom.dataUrl} alt="Photo from this call" className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
      ) : null}
    </form>
  )
}

function ApplianceCardEditor({
  index,
  unit,
  active,
  canRemove,
  models,
  onFileUnits,
  onFocus,
  onChange,
  onWorkChange,
  onRemove,
}: {
  index: number
  unit: DraftUnit
  active: boolean
  canRemove: boolean
  models: string[]
  onFileUnits: ReturnType<typeof appliancesAt>
  onFocus: () => void
  onChange: (patch: Partial<DraftUnit>) => void
  onWorkChange: (lineId: string, line: WorkLine) => void
  onRemove: () => void
}) {
  return (
    <section
      className={`rounded-2xl border px-3 py-4 ${active ? "border-pine bg-card" : "border-line bg-card"}`}
      onFocusCapture={onFocus}
      onClick={onFocus}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Appliance {index + 1}</h2>
        <div className="flex items-center gap-2">
          <YearSelect
            brand={unit.brand}
            serial={unit.serial}
            model={unit.model}
            year={unit.year}
            onYear={(year) => onChange({ year })}
          />
          {canRemove ? (
            <button type="button" className="icon-btn" aria-label={`Remove appliance ${index + 1}`} onClick={onRemove}>
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {onFileUnits.length > 0 ? (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {onFileUnits.map((item) => (
            <button
              key={item.id}
              type="button"
              className="chip"
              aria-pressed={unit.applianceId === item.id}
              onClick={() =>
                onChange({
                  applianceId: item.id,
                  applianceType: item.type,
                  brand: item.brand,
                  model: item.model,
                  serial: item.serial,
                  year: item.year ?? "",
                  partsOnOrder: item.partsOnOrder,
                  partsOnOrderItems: shapePartsOnOrderItems(item),
                })
              }
            >
              {[item.brand, item.type].filter(Boolean).join(" ") || "Unit"}
            </button>
          ))}
          <button
            type="button"
            className="chip"
            aria-pressed={unit.applianceId == null}
            onClick={() =>
              onChange({
                applianceId: null,
                applianceType: "",
                brand: "",
                model: "",
                serial: "",
                year: "",
                partsOnOrder: false,
                partsOnOrderItems: [],
              })
            }
          >
            Different unit
          </button>
        </div>
      ) : null}

      <ApplianceFields
        idPrefix={`call-${unit.key}`}
        type={unit.applianceType}
        brand={unit.brand}
        model={unit.model}
        serial={unit.serial}
        models={models}
        onType={(applianceType) =>
          onChange({
            applianceType,
            work: unit.work.map((line) => {
              if (!workActionUsesPart(line.action) || !line.partName || line.partCustom) return line
              return partsFor(applianceType).includes(line.partName) ? line : { ...line, partCustom: true }
            }),
          })
        }
        onBrand={(brand) => onChange({ brand })}
        onModel={(model) => onChange({ model })}
        onSerial={(serial) => onChange({ serial })}
      />
      <PartsOnOrderToggle
        id={`call-${unit.key}-parts`}
        on={Boolean(unit.partsOnOrder)}
        items={unit.partsOnOrderItems ?? []}
        applianceType={unit.applianceType}
        onChange={(next) => onChange(next)}
        onInstall={(indexes) => onChange(installOrderedParts(unit, indexes))}
      />
      {unit.applianceId ? <p className="mt-2 text-sm text-muted">Saving updates this unit on the address.</p> : null}

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Work done</h3>
          <button
            type="button"
            className="btn btn-sand"
            onClick={() => onChange({ work: [...unit.work, blankWork()] })}
          >
            <Plus className="size-5" aria-hidden="true" />
            Add
          </button>
        </div>
        <div className="space-y-3">
          {unit.work.map((line, lineIndex) => (
            <WorkLineEditor
              key={line.id}
              line={line}
              index={lineIndex}
              applianceType={unit.applianceType}
              onChange={(next) => onWorkChange(line.id, next)}
              onRemove={() => {
                const work = unit.work.filter((item) => item.id !== line.id)
                onChange({ work: work.length > 0 ? work : [blankWork()] })
              }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function installOrderedParts(unit: DraftUnit, indexes: number[]): Partial<DraftUnit> {
  const items = unit.partsOnOrderItems ?? []
  const drop = new Set(indexes)
  const choices = partsFor(unit.applianceType)
  const lines: WorkLine[] = []
  indexes.forEach((index) => {
    const item = items[index]
    if (!item) return
    const note = item.note ?? ""
    const number = item.number ?? ""
    if (!note.trim() && !number.trim()) return
    const partName = note.trim() ? note : number
    lines.push({
      id: uid(),
      action: "Installed",
      partName,
      partNumber: note.trim() ? number : "",
      note: "",
      partCustom: !choices.includes(partName),
    })
  })
  const remaining = items.filter((_, index) => !drop.has(index))
  const stillOnOrder = remaining.some((item) => (item.note ?? "").trim() || (item.number ?? "").trim())
  const kept = stillOnOrder ? remaining : []
  const keptWork = unit.work.filter((line) => line.action || line.partName || line.partNumber || line.note)
  return {
    work: [...keptWork, ...lines],
    partsOnOrder: stillOnOrder,
    partsOnOrderItems: kept,
    partsOnOrderNote: kept[0]?.note ?? "",
    partsOnOrderNumber: kept[0]?.number ?? "",
  }
}

function WorkLineEditor({
  line,
  index,
  applianceType,
  onChange,
  onRemove,
}: {
  line: WorkLine
  index: number
  applianceType: string
  onChange: (line: WorkLine) => void
  onRemove: () => void
}) {
  const choices = partsFor(applianceType)
  const selectValue = line.partCustom ? "__custom" : choices.includes(line.partName) ? line.partName : ""

  return (
    <fieldset className="rounded-2xl bg-sand px-3 py-3">
      <legend className="sr-only">Work {index + 1}</legend>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor={`work-${line.id}`}>
            What you did
          </label>
          <select
            id={`work-${line.id}`}
            className="field select"
            value={line.action}
            onChange={(event) => onChange({ ...line, action: event.target.value })}
          >
            <option value="">Choose work</option>
            {WORK_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="icon-btn mt-7" aria-label="Remove work line" onClick={onRemove}>
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>

      <label className="label mt-3" htmlFor={`note-${line.id}`}>
        Detail
      </label>
      <input
        id={`note-${line.id}`}
        className="field"
        value={line.note}
        placeholder="Coils, error code, filter…"
        onChange={(event) => onChange({ ...line, note: event.target.value })}
      />

      {workActionUsesPart(line.action) ? (
        <div className="mt-3 rounded-xl bg-copper-soft px-3 py-3">
          <p className="text-sm font-semibold">
            {applianceType ? `Parts for this ${applianceType.toLowerCase()}` : `Part you ${line.action.toLowerCase()}`}
          </p>
          {choices.length > 0 ? (
            <>
              <label className="label mt-3" htmlFor={`part-${line.id}`}>
                Part
              </label>
              <select
                id={`part-${line.id}`}
                className="field select"
                value={selectValue}
                onChange={(event) => {
                  const value = event.target.value
                  if (value === "__custom") onChange({ ...line, partCustom: true, partName: "" })
                  else onChange({ ...line, partCustom: false, partName: value })
                }}
              >
                <option value="">Choose a part</option>
                {choices.map((part) => (
                  <option key={part} value={part}>
                    {part}
                  </option>
                ))}
                <option value="__custom">Other part…</option>
              </select>
            </>
          ) : (
            <p className="mt-2 text-sm">Choose the appliance above for a matching part list, or type the part.</p>
          )}
          {choices.length === 0 || line.partCustom || selectValue === "__custom" ? (
            <>
              <label className="label mt-3" htmlFor={`part-name-${line.id}`}>
                Part name
              </label>
              <input
                id={`part-name-${line.id}`}
                className="field"
                value={line.partName}
                onChange={(event) => onChange({ ...line, partCustom: true, partName: event.target.value })}
              />
            </>
          ) : null}
          <label className="label mt-3" htmlFor={`part-no-${line.id}`}>
            Part number
          </label>
          <input
            id={`part-no-${line.id}`}
            className="field font-mono"
            value={line.partNumber}
            placeholder="From the bag or invoice"
            onChange={(event) => onChange({ ...line, partNumber: event.target.value })}
          />
        </div>
      ) : null}
    </fieldset>
  )
}
