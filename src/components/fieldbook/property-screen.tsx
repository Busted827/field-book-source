import { useEffect, useRef, useState } from "react"
import { MapPin, Plus, Star } from "lucide-react"
import { deleteAppliance, deleteProperty, updateProperty, upsertAppliance } from "@/lib/fieldbook/actions"
import { requestLocation } from "@/lib/fieldbook/device"
import { OUT_OF_DATE, SUPPORTED_BRANDS, decodeApplianceYear, yearToField } from "@/lib/fieldbook/year-decode"
import {
  APPLIANCE_TYPES,
  appliancesAt,
  draftForProperty,
  draftFromVisit,
  formatDistance,
  placeLabel,
  rememberedValues,
  uid,
  visitsAt,
  mirrorPartsOnOrderLegacy,
  normalizePartsOnOrderItems,
  shapePartsOnOrderItems,
  type Appliance,
  type PartsOnOrderItem,
  type Property,
} from "@/lib/fieldbook/model"
import { useBook } from "@/lib/fieldbook/store"
import { useNav } from "./nav"
import { AutofillField, BackHeader, EmptyNote, PartsOnOrderToggle, PropertyAlertBanner, PropertyButton, RememberedField, SectionTitle, VisitRowButton, YearSelect } from "./ui"

export function PropertyScreen({ propertyId }: { propertyId: string }) {
  const nav = useNav()
  const properties = useBook((state) => state.properties)
  const appliances = useBook((state) => state.appliances)
  const visits = useBook((state) => state.visits)
  const property = properties.find((item) => item.id === propertyId)
  const book = { properties, appliances, visits }

  if (!property) {
    return (
      <div>
        <BackHeader title="Address missing" />
        <EmptyNote title="That file isn't in the book" body="It may have been removed." />
      </div>
    )
  }

  const units = appliancesAt(book, property.id)
  const history = visitsAt(book, property.id)

  return (
    <div>
      <BackHeader title={property.address} subtitle={property.city || "Address file"} />
      <PropertyAlertBanner alert={property.alert} />
      {property.sample ? (
        <p className="mb-4 text-sm font-semibold text-copper">Example address</p>
      ) : null}
      <FileDetails property={property} />
      <div className="mt-6">
        <SectionTitle title="Appliances" aside={units.length ? String(units.length) : "None yet"} />
        <div className="space-y-3">
          {units.map((unit) => (
            <ApplianceCard key={unit.id} unit={unit} />
          ))}
          <AddAppliance propertyId={property.id} />
        </div>
      </div>
      <div className="mt-6">
        <SectionTitle title="Calls" aside={history.length ? "Newest first" : undefined} />
        {history.length === 0 ? (
          <EmptyNote title="No calls on this address yet" body="Log what you did and it stays with this file." />
        ) : (
          <ul className="space-y-3">
            {history.map((row) => (
              <li key={row.visit.id} data-show-wrench="false">
                <VisitRowButton
                  row={row}
                  showAddress={false}
                  showPartsOnOrder={false}
                  onOpen={() => nav.openEditor(draftFromVisit(book, row.visit))}
                />
                {/* Address Calls hide the wrench; Latest calls and search keep it. */}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        className="btn btn-primary mt-5 w-full"
        onClick={() => nav.openEditor(draftForProperty(book, property.id))}
      >
        <Plus className="size-5" aria-hidden="true" />
        Log a call here
      </button>
    </div>
  )
}

function FileDetails({ property }: { property: Property }) {
  const nav = useNav()
  const properties = useBook((state) => state.properties)
  const cities = rememberedValues(properties.map((item) => item.city))
  const companies = rememberedValues(properties.map((item) => item.realtyCompany))
  const [editing, setEditing] = useState(false)
  const [address, setAddress] = useState(property.address)
  const [city, setCity] = useState(property.city)
  const [ownerName, setOwnerName] = useState(property.ownerName)
  const [realtyCompany, setRealtyCompany] = useState(property.realtyCompany)
  const [unitNumber, setUnitNumber] = useState(property.unitNumber ?? "")
  const [alert, setAlert] = useState(property.alert ?? "")
  const [lat, setLat] = useState(property.lat)
  const [lng, setLng] = useState(property.lng)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [message, setMessage] = useState("")

  async function stamp() {
    const result = await requestLocation()
    if ("error" in result) {
      setMessage(result.error)
      return
    }
    setLat(result.lat)
    setLng(result.lng)
    setEditing(true)
    setMessage("Location stamped. Save the file so I'm here can open it next time.")
  }

  async function save() {
    if (!address.trim()) {
      setMessage("The street address can't be empty.")
      return
    }
    const ok = await updateProperty({
      ...property,
      address: address.trim(),
      city: city.trim(),
      ownerName: ownerName.trim(),
      realtyCompany: realtyCompany.trim(),
      unitNumber: realtyCompany.trim() ? unitNumber.trim() : "",
      alert: alert.trim(),
      lat,
      lng,
    })
    setMessage(ok ? "File saved." : "Saved on this screen, but this browser blocked permanent storage.")
    setEditing(false)
  }

  async function remove() {
    const ok = await deleteProperty(property.id)
    if (!ok) {
      setMessage("Couldn't remove that address.")
      return
    }
    nav.back()
  }

  if (!editing) {
    return (
      <section className="rounded-2xl border border-line bg-card px-4 py-4">
        <p className="text-sm text-muted">Owner</p>
        <p className="font-semibold">{property.ownerName || "Not listed"}</p>
        <p className="mt-3 text-sm text-muted">Realty company</p>
        <p className="font-semibold">{property.realtyCompany || "Not listed"}</p>
        {property.realtyCompany ? (
          <>
            <p className="mt-3 text-sm text-muted">Unit number</p>
            <p className="font-semibold">{property.unitNumber || "Not listed"}</p>
          </>
        ) : null}
        <p className="mt-3 text-sm text-muted">Location</p>
        <p className="font-semibold">{property.lat != null && property.lng != null ? "Stamped for I'm here" : "Not stamped"}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-sand" onClick={() => setEditing(true)}>
            Edit file
          </button>
          <button type="button" className="btn btn-sand" onClick={() => void stamp()}>
            <MapPin className="size-5" aria-hidden="true" />
            Stamp location
          </button>
        </div>
        {message ? <p className="mt-3 text-sm">{message}</p> : null}
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-line bg-card px-4 py-4">
      <label className="label" htmlFor="file-address">
        Street address
      </label>
      <input id="file-address" className="field" value={address} onChange={(event) => setAddress(event.target.value)} />
      <RememberedField
        id="file-city"
        className="mt-3"
        label="City"
        value={city}
        options={cities}
        newPlaceholder="New city, like Corolla"
        onChange={setCity}
      />
      <label className="label mt-3" htmlFor="file-owner">
        Owner
      </label>
      <input
        id="file-owner"
        className="field"
        value={ownerName}
        autoComplete="name"
        onChange={(event) => setOwnerName(event.target.value)}
      />
      <RememberedField
        id="file-realty"
        className="mt-3"
        label="Realty company"
        value={realtyCompany}
        options={companies}
        newPlaceholder="New company, like Twiddy"
        onChange={setRealtyCompany}
      />
      {realtyCompany.trim() ? (
        <>
          <label className="label mt-3" htmlFor="file-unit">
            Unit number
          </label>
          <input
            id="file-unit"
            className="field"
            value={unitNumber}
            placeholder="Apt, suite, or unit"
            autoComplete="off"
            onChange={(event) => setUnitNumber(event.target.value)}
          />
        </>
      ) : null}
      <label className="label mt-3" htmlFor="file-alert">
        Property alert
      </label>
      <input
        id="file-alert"
        className="field"
        value={alert}
        placeholder="Owner hard of hearing — KNOCK LOUD, gate code…"
        onChange={(event) => setAlert(event.target.value)}
      />
      <p className="mt-3 text-sm text-muted">
        {lat != null && lng != null ? "A location is stamped on this file." : "No location stamped yet."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => void save()}>
          Save file
        </button>
        <button type="button" className="btn btn-sand" onClick={() => void stamp()}>
          Stamp location
        </button>
        <button
          type="button"
          className="btn btn-sand"
          onClick={() => {
            setEditing(false)
            setAddress(property.address)
            setCity(property.city)
            setOwnerName(property.ownerName)
            setRealtyCompany(property.realtyCompany)
            setUnitNumber(property.unitNumber ?? "")
            setAlert(property.alert ?? "")
            setLat(property.lat)
            setLng(property.lng)
          }}
        >
          Cancel
        </button>
      </div>
      {confirmRemove ? (
        <div className="mt-4 rounded-xl bg-sand px-3 py-3">
          <p className="text-sm">Remove {placeLabel(property)} and every call on it?</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn btn-primary" onClick={() => void remove()}>
              Remove
            </button>
            <button type="button" className="btn btn-sand" onClick={() => setConfirmRemove(false)}>
              Keep
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="mt-4 text-sm font-semibold" onClick={() => setConfirmRemove(true)}>
          Remove this address
        </button>
      )}
      {message ? <p className="mt-3 text-sm">{message}</p> : null}
    </section>
  )
}

function orderSummary(items: PartsOnOrderItem[]): string {
  return items
    .map((item) => [item.note.trim(), item.number.trim()].filter(Boolean).join(" · "))
    .filter(Boolean)
    .join("; ")
}

function ApplianceCard({ unit }: { unit: Appliance }) {
  const nav = useNav()
  const properties = useBook((state) => state.properties)
  const appliances = useBook((state) => state.appliances)
  const visits = useBook((state) => state.visits)
  const models = rememberedValues(appliances.map((item) => item.model))
  const [editing, setEditing] = useState(false)
  const [type, setType] = useState(unit.type)
  const [brand, setBrand] = useState(unit.brand)
  const [model, setModel] = useState(unit.model)
  const [serial, setSerial] = useState(unit.serial)
  const [year, setYear] = useState(unit.year ?? "")
  const [partsOnOrder, setPartsOnOrder] = useState(Boolean(unit.partsOnOrder))
  const [partsOnOrderItems, setPartsOnOrderItems] = useState<PartsOnOrderItem[]>(() => shapePartsOnOrderItems(unit))
  const [message, setMessage] = useState("")
  const partsSync = useRef("")

  useEffect(() => {
    const nextOn = Boolean(unit.partsOnOrder)
    const nextItems = shapePartsOnOrderItems(unit)
    const key = `${nextOn}|${JSON.stringify(nextItems)}`
    if (partsSync.current && partsSync.current !== key) return
    partsSync.current = ""
    setPartsOnOrder(nextOn)
    setPartsOnOrderItems(nextItems)
  }, [unit])

  useEffect(() => {
    setYear(unit.year ?? "")
  }, [unit.id, unit.year])

  async function persistParts(on: boolean, items: PartsOnOrderItem[]) {
    setPartsOnOrder(on)
    setPartsOnOrderItems(items)
    const cleaned = normalizePartsOnOrderItems({ partsOnOrder: on, partsOnOrderItems: items })
    const legacy = mirrorPartsOnOrderLegacy(cleaned)
    partsSync.current = `${on}|${JSON.stringify(items)}`
    const ok = await upsertAppliance({
      ...unit,
      year: (unit.year ?? "").trim(),
      partsOnOrder: on,
      partsOnOrderNote: legacy.partsOnOrderNote,
      partsOnOrderNumber: legacy.partsOnOrderNumber,
      partsOnOrderItems: cleaned,
    })
    if (!ok) {
      partsSync.current = ""
      setMessage("Couldn't save parts on order.")
    }
  }

  async function save() {
    if (!type.trim()) {
      setMessage("Choose the appliance.")
      return
    }
    const cleaned = normalizePartsOnOrderItems({ partsOnOrder, partsOnOrderItems })
    const legacy = mirrorPartsOnOrderLegacy(cleaned)
    const ok = await upsertAppliance({
      ...unit,
      type: type.trim(),
      brand: brand.trim(),
      model: model.trim(),
      serial: serial.trim(),
      year: year.trim(),
      partsOnOrder,
      partsOnOrderNote: legacy.partsOnOrderNote,
      partsOnOrderNumber: legacy.partsOnOrderNumber,
      partsOnOrderItems: cleaned,
    })
    setMessage(ok ? "" : "Couldn't save that unit.")
    if (ok) setEditing(false)
  }

  async function remove() {
    const result = await deleteAppliance(unit.id)
    if ("error" in result) setMessage(result.error)
  }

  if (!editing) {
    const storedYear = (unit.year ?? "").trim()
    const overviewYear =
      storedYear === OUT_OF_DATE
        ? ""
        : storedYear || yearToField(decodeApplianceYear(unit.brand, unit.serial, unit.model))
    return (
      <article className="rounded-2xl border border-line bg-card px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 font-semibold">{[unit.brand, unit.type].filter(Boolean).join(" ") || "Appliance"}</p>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {overviewYear ? <span className="text-right text-sm text-muted tabular-nums">{overviewYear}</span> : null}
            {partsOnOrder ? (
              <Star className="size-5 shrink-0 fill-amber-500 text-amber-500" aria-label="Parts on order" />
            ) : null}
          </div>
        </div>
        <p className="mt-1 font-mono text-sm break-all text-muted">
          {unit.model || "No model"}
          {unit.serial ? ` · SN ${unit.serial}` : ""}
        </p>
        {partsOnOrder && orderSummary(partsOnOrderItems) ? (
          <p className="mt-1 text-sm font-semibold">On order: {orderSummary(partsOnOrderItems)}</p>
        ) : null}
        <PartsOnOrderToggle
          id={`${unit.id}-parts`}
          on={partsOnOrder}
          items={partsOnOrderItems}
          applianceType={unit.type}
          onChange={(next) => void persistParts(next.partsOnOrder, next.partsOnOrderItems)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-sand"
            onClick={() => nav.openEditor(draftForProperty({ properties, appliances, visits }, unit.propertyId, unit.id))}
          >
            Log this unit
          </button>
          <button type="button" className="btn btn-sand" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
        {message ? <p className="mt-3 text-sm">{message}</p> : null}
      </article>
    )
  }

  return (
    <article className="rounded-2xl border border-line bg-card px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{[brand, type].filter(Boolean).join(" ") || "Appliance"}</h2>
        <YearSelect brand={brand} serial={serial} model={model} year={year} onYear={setYear} />
      </div>
      <ApplianceFields type={type} brand={brand} model={model} serial={serial} models={models} idPrefix={unit.id} onType={setType} onBrand={setBrand} onModel={setModel} onSerial={setSerial} />
      <PartsOnOrderToggle
        id={`${unit.id}-parts-edit`}
        on={partsOnOrder}
        items={partsOnOrderItems}
        applianceType={type}
        onChange={(next) => {
          setPartsOnOrder(next.partsOnOrder)
          setPartsOnOrderItems(next.partsOnOrderItems)
        }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => void save()}>
          Save unit
        </button>
        <button type="button" className="btn btn-sand" onClick={() => setEditing(false)}>
          Cancel
        </button>
        <button type="button" className="btn btn-sand" onClick={() => void remove()}>
          Remove
        </button>
      </div>
      {message ? <p className="mt-3 text-sm">{message}</p> : null}
    </article>
  )
}

function AddAppliance({ propertyId }: { propertyId: string }) {
  const models = rememberedValues(useBook((state) => state.appliances).map((item) => item.model))
  const [open, setOpen] = useState(false)
  const [type, setType] = useState("")
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [serial, setSerial] = useState("")
  const [year, setYear] = useState("")
  const [partsOnOrder, setPartsOnOrder] = useState(false)
  const [partsOnOrderItems, setPartsOnOrderItems] = useState<PartsOnOrderItem[]>([])
  const [message, setMessage] = useState("")

  async function save() {
    if (!type.trim()) {
      setMessage("Choose the appliance.")
      return
    }
    const cleaned = normalizePartsOnOrderItems({ partsOnOrder, partsOnOrderItems })
    const legacy = mirrorPartsOnOrderLegacy(cleaned)
    const ok = await upsertAppliance({
      id: uid(),
      propertyId,
      type: type.trim(),
      brand: brand.trim(),
      model: model.trim(),
      serial: serial.trim(),
      year: year.trim(),
      partsOnOrder,
      partsOnOrderNote: legacy.partsOnOrderNote,
      partsOnOrderNumber: legacy.partsOnOrderNumber,
      partsOnOrderItems: cleaned,
    })
    if (!ok) {
      setMessage("Couldn't save that unit.")
      return
    }
    setOpen(false)
    setType("")
    setBrand("")
    setModel("")
    setSerial("")
    setYear("")
    setPartsOnOrder(false)
    setPartsOnOrderItems([])
    setMessage("")
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-sand w-full" onClick={() => setOpen(true)}>
        <Plus className="size-5" aria-hidden="true" />
        Add appliance
      </button>
    )
  }

  return (
    <article className="rounded-2xl border border-line bg-card px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{[brand, type].filter(Boolean).join(" ") || "New appliance"}</h2>
        <YearSelect brand={brand} serial={serial} model={model} year={year} onYear={setYear} />
      </div>
      <ApplianceFields
        type={type}
        brand={brand}
        model={model}
        serial={serial}
        models={models}
        idPrefix="new-unit"
        onType={setType}
        onBrand={setBrand}
        onModel={setModel}
        onSerial={setSerial}
      />
      <PartsOnOrderToggle
        id="new-unit-parts"
        on={partsOnOrder}
        items={partsOnOrderItems}
        applianceType={type}
        onChange={(next) => {
          setPartsOnOrder(next.partsOnOrder)
          setPartsOnOrderItems(next.partsOnOrderItems)
        }}
      />
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-primary" onClick={() => void save()}>
          Save unit
        </button>
        <button type="button" className="btn btn-sand" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {message ? <p className="mt-3 text-sm">{message}</p> : null}
    </article>
  )
}

export function ApplianceFields({
  type,
  brand,
  model,
  serial,
  models,
  idPrefix,
  onType,
  onBrand,
  onModel,
  onSerial,
}: {
  type: string
  brand: string
  model: string
  serial: string
  models: string[]
  idPrefix: string
  onType: (value: string) => void
  onBrand: (value: string) => void
  onModel: (value: string) => void
  onSerial: (value: string) => void
}) {
  const known = (SUPPORTED_BRANDS as readonly string[]).includes(brand)
  const [customBrand, setCustomBrand] = useState(!known && brand.trim() !== "")
  const brandChoice = known ? brand : customBrand || brand.trim() ? "__other" : ""

  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor={`${idPrefix}-type`}>
          Appliance
        </label>
        <ApplianceTypeSelect id={`${idPrefix}-type`} value={type} onChange={onType} />
      </div>
      <div>
        <label className="label" htmlFor={`${idPrefix}-brand`}>
          Brand
        </label>
        <select
          id={`${idPrefix}-brand`}
          className="field select"
          value={brandChoice}
          onChange={(event) => {
            const value = event.target.value
            if (value === "__other") {
              setCustomBrand(true)
              if (known) onBrand("")
              return
            }
            setCustomBrand(false)
            onBrand(value)
          }}
        >
          <option value="">Brand</option>
          {SUPPORTED_BRANDS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          <option value="__other">Other…</option>
        </select>
        {brandChoice === "__other" ? (
          <input
            className="field mt-2"
            value={known ? "" : brand}
            placeholder="Brand name"
            aria-label="Other brand"
            onChange={(event) => onBrand(event.target.value)}
          />
        ) : null}
      </div>
      <AutofillField
        id={`${idPrefix}-model`}
        label="Model"
        value={model}
        options={models}
        mono
        placeholder="Model number"
        onChange={onModel}
      />
      <div>
        <label className="label" htmlFor={`${idPrefix}-serial`}>
          Serial number
        </label>
        <input
          id={`${idPrefix}-serial`}
          className="field font-mono"
          value={serial}
          onChange={(event) => onSerial(event.target.value)}
        />
      </div>
    </div>
  )
}

export function ApplianceTypeSelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const known = APPLIANCE_TYPES
  return (
    <select id={id} className="field select" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Choose appliance</option>
      {known.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  )
}

export function NearbyScreen({ hits }: { hits: { propertyId: string; meters: number }[] }) {
  const properties = useBook((state) => state.properties)
  const nav = useNav()
  return (
    <div>
      <BackHeader title="Nearby stops" subtitle="Within about 650 feet" />
      <ul className="space-y-3">
        {hits.map((hit) => {
          const property = properties.find((item) => item.id === hit.propertyId)
          if (!property) return null
          return (
            <li key={hit.propertyId}>
              <PropertyButton
                property={property}
                detail={`${formatDistance(hit.meters)} away`}
                onOpen={() => nav.openProperty(property.id)}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
