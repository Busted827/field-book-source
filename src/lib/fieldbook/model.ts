export type Property = {
  id: string
  address: string
  city: string
  ownerName: string
  realtyCompany: string
  /** Apartment / unit at a realty multi-unit address. */
  unitNumber: string
  /** Always-true note for this address. Empty means no alert. */
  alert: string
  lat: number | null
  lng: number | null
  sample: boolean
}

export type PartsOnOrderItem = { note: string; number: string }

export type Appliance = {
  id: string
  propertyId: string
  type: string
  brand: string
  model: string
  serial: string
  /** Manufacture year (YYYY string). Empty if unknown. */
  year: string
  partsOnOrder: boolean
  partsOnOrderNote?: string
  /** Optional part number for parts on order. */
  partsOnOrderNumber: string
  /** Multiple parts on order for this appliance. */
  partsOnOrderItems: PartsOnOrderItem[]
}

export type WorkLine = {
  id: string
  action: string
  partName: string
  partNumber: string
  note: string
  partCustom: boolean
}

/** One appliance serviced on a call, with its own work lines. */
export type VisitUnit = {
  applianceId: string
  work: WorkLine[]
}

export type Visit = {
  id: string
  propertyId: string
  /** Nested appliances + work for this call. Canonical shape. */
  units: VisitUnit[]
  /** Dual-write of units[0] for one release (legacy readers). */
  applianceId: string
  /** Dual-write of units[0].work for one release. */
  work: WorkLine[]
  date: string
  comments: string
  photoIds: string[]
  sample: boolean
}

export type Photo = {
  id: string
  visitId: string
  dataUrl: string
  mediaType?: "image" | "video"
}

export type Book = {
  properties: Property[]
  appliances: Appliance[]
  visits: Visit[]
}

export type DraftPhoto = {
  id: string
  dataUrl: string
  mediaType?: "image" | "video"
}

export function isVideoMedia(item: { dataUrl: string; mediaType?: string }): boolean {
  return item.mediaType === "video" || item.dataUrl.startsWith("data:video/")
}

/** Draft card for one appliance on a multi-unit call. */
export type DraftUnit = {
  key: string
  applianceId: string | null
  applianceType: string
  brand: string
  model: string
  serial: string
  year: string
  partsOnOrder?: boolean
  partsOnOrderNote?: string
  partsOnOrderNumber: string
  partsOnOrderItems: PartsOnOrderItem[]
  work: WorkLine[]
}

export type Draft = {
  visitId: string | null
  propertyId: string | null
  date: string
  address: string
  city: string
  ownerName: string
  realtyCompany: string
  unitNumber: string
  alert: string
  lat: number | null
  lng: number | null
  units: DraftUnit[]
  comments: string
  photos: DraftPhoto[]
  existingPhotoIds: string[]
  sampleProperty: boolean
  sampleVisit: boolean
}

export type VisitRow = {
  visit: Visit
  property: Property
  appliance: Appliance | null
  /** All appliances for this property with up-to-date partsOnOrder status. */
  appliances: Appliance[]
  /** Appliances serviced on this call. */
  visitAppliances?: Appliance[]
}

export type Backup = {
  version: 1 | 2
  exportedAt: string
  properties: Property[]
  appliances: Appliance[]
  visits: Visit[]
  photos: Photo[]
}

export const SEARCH_MODES = [
  { id: "all", label: "All" },
  { id: "address", label: "Address" },
  { id: "realty", label: "Realty" },
  { id: "owner", label: "Owner" },
  { id: "date", label: "Date" },
] as const

export type SearchMode = (typeof SEARCH_MODES)[number]["id"]

export const APPLIANCE_TYPES = [
  "Refrigerator",
  "Wine Fridge",
  "Freezer",
  "Washer",
  "Dryer",
  "Stack Unit",
  "Dishwasher",
  "Oven / Range",
  "Wall Oven",
  "Cooktop",
  "Microwave",
  "Disposal",
  "Water heater",
  "Ice maker",
  "HVAC",
  "Other",
] as const

export const WORK_ACTIONS = [
  "Cleaned",
  "Replaced",
  "Reset",
  "Diagnosed",
  "Assess",
  "Adjusted",
  "Installed",
  "Tested",
  "Sealed",
  "Lubricated",
  "Cleared",
  "Reconnected",
  "Other",
] as const

export const PART_WORK_ACTIONS = ["Replaced", "Installed", "Reconnected"] as const
export type PartWorkAction = (typeof PART_WORK_ACTIONS)[number]
export function workActionUsesPart(action: string): boolean {
  return (PART_WORK_ACTIONS as readonly string[]).includes(action)
}

export const PARTS_BY_TYPE: Record<string, string[]> = {
  Refrigerator: [
    "Compressor",
    "Start relay",
    "Overload",
    "Condenser fan motor",
    "Evaporator fan motor",
    "Defrost heater",
    "Defrost thermostat",
    "Defrost timer",
    "Control board",
    "Thermistor",
    "Damper control",
    "Door gasket",
    "Water inlet valve",
    "Ice maker",
    "Ice maker valve",
    "Drain pan",
    "Door switch",
    "Light socket",
  ],
  Freezer: [
    "Compressor",
    "Start relay",
    "Overload",
    "Condenser fan motor",
    "Evaporator fan motor",
    "Defrost heater",
    "Defrost thermostat",
    "Control board",
    "Door gasket",
    "Thermistor",
  ],
  Washer: [
    "Lid switch",
    "Door lock",
    "Drain pump",
    "Drive belt",
    "Agitator dogs",
    "Motor coupling",
    "Transmission",
    "Shift actuator",
    "Water inlet valve",
    "Pressure switch",
    "Control board",
    "Shock absorber",
    "Suspension rod",
    "Door boot",
    "Heating element",
    "Drive motor",
    "Tub bearing",
  ],
  Dryer: [
    "Heating element",
    "Thermal fuse",
    "High-limit thermostat",
    "Cycling thermostat",
    "Thermistor",
    "Belt",
    "Idler pulley",
    "Drum roller",
    "Drum glide",
    "Blower wheel",
    "Door switch",
    "Igniter",
    "Flame sensor",
    "Gas valve coil",
    "Control board",
    "Drive motor",
  ],
  Dishwasher: [
    "Circulation pump",
    "Drain pump",
    "Inlet valve",
    "Door latch",
    "Spray arm",
    "Heating element",
    "Control board",
    "Float switch",
    "Door gasket",
    "Detergent dispenser",
    "Diverter motor",
  ],
  "Oven / Range": [
    "Bake element",
    "Broil element",
    "Igniter",
    "Spark module",
    "Spark electrode",
    "Infinite switch",
    "Oven sensor",
    "Control board",
    "Door gasket",
    "Convection fan motor",
    "Safety valve",
  ],
  Cooktop: [
    "Infinite switch",
    "Surface element",
    "Spark module",
    "Spark electrode",
    "Control board",
  ],
  Microwave: [
    "Magnetron",
    "High-voltage diode",
    "High-voltage capacitor",
    "Door switch",
    "Turntable motor",
    "Control board",
    "Line fuse",
    "Thermoprotector",
  ],
  Disposal: ["Splash guard", "Stopper", "Mounting assembly", "Overload protector"],
  "Water heater": [
    "Thermocouple",
    "Gas control valve",
    "Heating element",
    "Thermostat",
    "Anode rod",
    "T&P valve",
    "Dip tube",
    "Drain valve",
  ],
  "Ice maker": [
    "Water inlet valve",
    "Harvest motor",
    "Thermostat",
    "Bin sensor",
    "Mold heater",
    "Control board",
  ],
  HVAC: [
    "Run capacitor",
    "Contactor",
    "Blower motor",
    "Condenser fan motor",
    "Compressor",
    "Filter",
    "Thermostat",
    "Reversing valve",
    "Transformer",
    "Control board",
    "Flame sensor",
    "Igniter",
  ],
  Other: [],
}

PARTS_BY_TYPE["Stack Unit"] = [...new Set([...PARTS_BY_TYPE.Washer, ...PARTS_BY_TYPE.Dryer])]
PARTS_BY_TYPE["Wine Fridge"] = PARTS_BY_TYPE.Refrigerator.filter(
  (part) => !["Ice maker", "Ice maker valve", "Water inlet valve", "Damper control", "Drain pan"].includes(part),
)
PARTS_BY_TYPE["Wall Oven"] = PARTS_BY_TYPE["Oven / Range"].filter((part) => part !== "Infinite switch")

export const MAX_PHOTOS = 8
export const NEARBY_METERS = 200

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function uid(): string {
  return crypto.randomUUID()
}

export function todayISO(): string {
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${month}-${day}`
}

export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return iso
  const month = MONTHS[Number(match[2]) - 1]
  if (!month) return iso
  return `${month} ${Number(match[3])}, ${match[1]}`
}

export function formatDistance(meters: number): string {
  const feet = meters * 3.28084
  if (feet < 900) return `${Math.max(1, Math.round(feet))} ft`
  const miles = feet / 5280
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`
}

export function placeLabel(property: Property): string {
  return property.city ? `${property.address}, ${property.city}` : property.address
}

export function applianceTitle(appliance: Appliance | null | undefined): string {
  if (!appliance) return "Appliance"
  const name = [appliance.brand, appliance.type].filter(Boolean).join(" ")
  return name || "Appliance"
}

export function summarizeWork(work: WorkLine[]): string {
  if (work.length === 0) return "No work logged"
  return work
    .map((line) => {
      if (workActionUsesPart(line.action) && line.partName) {
        const number = line.partNumber ? ` ${line.partNumber}` : ""
        return `${line.action} ${line.partName}${number}`
      }
      if (line.note) return `${line.action} — ${line.note}`
      return line.action || "Work"
    })
    .join(" · ")
}

/** Summarize work across all units on a visit (for list rows). */
export function summarizeVisitWork(visit: Visit, appliances: Appliance[] = []): string {
  const units = visitUnits(visit)
  if (units.length === 0) return "No work logged"
  if (units.length === 1) return summarizeWork(units[0].work)
  return units
    .map((unit) => {
      const appliance = appliances.find((item) => item.id === unit.applianceId)
      const label = applianceTitle(appliance) 
      return `${label}: ${summarizeWork(unit.work)}`
    })
    .join(" · ")
}

export function partsFor(type: string): string[] {
  return PARTS_BY_TYPE[type] ?? []
}

export function blankWork(): WorkLine {
  return { id: uid(), action: "", partName: "", partNumber: "", note: "", partCustom: false }
}

/** Prefer visit.units; migrate flat applianceId+work for legacy rows. */
export function visitUnits(visit: Visit | { applianceId?: string; work?: WorkLine[]; units?: VisitUnit[] }): VisitUnit[] {
  if (Array.isArray(visit.units) && visit.units.length > 0) {
    return visit.units.map((unit) => ({
      applianceId: typeof unit.applianceId === "string" ? unit.applianceId : "",
      work: Array.isArray(unit.work) ? unit.work : [],
    }))
  }
  const applianceId = typeof visit.applianceId === "string" ? visit.applianceId : ""
  const work = Array.isArray(visit.work) ? visit.work : []
  if (applianceId || work.length > 0) return [{ applianceId, work }]
  return []
}

function readPartsOnOrderItems(
  record: {
    partsOnOrder?: boolean
    partsOnOrderNote?: string
    partsOnOrderNumber?: string
    partsOnOrderItems?: unknown
  },
  trim: boolean,
): PartsOnOrderItem[] {
  const text = (value: unknown) => {
    const raw = typeof value === "string" ? value : ""
    return trim ? raw.trim() : raw
  }
  const raw = record.partsOnOrderItems
  if (Array.isArray(raw) && raw.length > 0) {
    const cleaned = raw
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        note: text(item.note),
        number: text(item.number),
      }))
    if (cleaned.length > 0) return cleaned
  }
  const note = text(record.partsOnOrderNote)
  const number = text(record.partsOnOrderNumber)
  if (note || number) return [{ note, number }]
  if (record.partsOnOrder) return [{ note: "", number: "" }]
  return []
}

/** Copy parts into `{ note, number }` rows without trimming. For editors only. */
export function shapePartsOnOrderItems(record: {
  partsOnOrder?: boolean
  partsOnOrderNote?: string
  partsOnOrderNumber?: string
  partsOnOrderItems?: unknown
}): PartsOnOrderItem[] {
  return readPartsOnOrderItems(record, false)
}

/** Migrate legacy note/number / boolean into partsOnOrderItems; trim strings. */
export function normalizePartsOnOrderItems(record: {
  partsOnOrder?: boolean
  partsOnOrderNote?: string
  partsOnOrderNumber?: string
  partsOnOrderItems?: unknown
}): PartsOnOrderItem[] {
  return readPartsOnOrderItems(record, true)
}

export function mirrorPartsOnOrderLegacy(items: PartsOnOrderItem[]): {
  partsOnOrderNote: string
  partsOnOrderNumber: string
} {
  return {
    partsOnOrderNote: items[0]?.note ?? "",
    partsOnOrderNumber: items[0]?.number ?? "",
  }
}

export function blankDraftUnit(partial?: Partial<DraftUnit>): DraftUnit {
  const partsOnOrderItems = shapePartsOnOrderItems({
    partsOnOrder: partial?.partsOnOrder,
    partsOnOrderNote: partial?.partsOnOrderNote,
    partsOnOrderNumber: partial?.partsOnOrderNumber,
    partsOnOrderItems: partial?.partsOnOrderItems,
  })
  const legacy = mirrorPartsOnOrderLegacy(partsOnOrderItems)
  return {
    key: partial?.key ?? uid(),
    applianceId: partial?.applianceId ?? null,
    applianceType: partial?.applianceType ?? "",
    brand: partial?.brand ?? "",
    model: partial?.model ?? "",
    serial: partial?.serial ?? "",
    year: partial?.year ?? "",
    partsOnOrder: partial?.partsOnOrder ?? false,
    partsOnOrderNote: legacy.partsOnOrderNote,
    partsOnOrderNumber: legacy.partsOnOrderNumber,
    partsOnOrderItems,
    work: partial?.work && partial.work.length > 0 ? partial.work : [blankWork()],
  }
}

export function blankDraft(partial?: Partial<Draft>): Draft {
  const base: Draft = {
    visitId: null,
    propertyId: null,
    date: todayISO(),
    address: "",
    city: "",
    ownerName: "",
    realtyCompany: "",
    unitNumber: "",
    alert: "",
    lat: null,
    lng: null,
    units: [blankDraftUnit()],
    comments: "",
    photos: [],
    existingPhotoIds: [],
    sampleProperty: false,
    sampleVisit: false,
  }
  return {
    ...base,
    ...partial,
    units: partial?.units && partial.units.length > 0 ? partial.units : base.units,
    photos: partial?.photos ?? base.photos,
    existingPhotoIds: partial?.existingPhotoIds ?? base.existingPhotoIds,
    alert: partial?.alert ?? "",
  }
}

export function draftFromVisit(book: Book, visit: Visit): Draft {
  const property = book.properties.find((item) => item.id === visit.propertyId)
  const units = visitUnits(visit).map((unit) => {
    const appliance = book.appliances.find((item) => item.id === unit.applianceId)
    return blankDraftUnit({
      applianceId: appliance?.id ?? null,
      applianceType: appliance?.type ?? "",
      brand: appliance?.brand ?? "",
      model: appliance?.model ?? "",
      serial: appliance?.serial ?? "",
      year: appliance?.year ?? "",
      partsOnOrder: appliance?.partsOnOrder ?? false,
      partsOnOrderNote: appliance?.partsOnOrderNote ?? "",
      partsOnOrderNumber: appliance?.partsOnOrderNumber ?? "",
      partsOnOrderItems: appliance?.partsOnOrderItems,
      work: unit.work.map((line) => ({ ...line, partCustom: line.partCustom ?? false })),
    })
  })
  return blankDraft({
    visitId: visit.id,
    propertyId: visit.propertyId,
    date: visit.date,
    address: property?.address ?? "",
    city: property?.city ?? "",
    ownerName: property?.ownerName ?? "",
    realtyCompany: property?.realtyCompany ?? "",
    unitNumber: property?.unitNumber ?? "",
    alert: property?.alert ?? "",
    lat: property?.lat ?? null,
    lng: property?.lng ?? null,
    units: units.length > 0 ? units : [blankDraftUnit()],
    comments: visit.comments,
    existingPhotoIds: [...visit.photoIds],
    sampleProperty: property?.sample ?? false,
    sampleVisit: visit.sample,
  })
}

export function draftForProperty(book: Book, propertyId: string, applianceId?: string): Draft {
  const property = book.properties.find((item) => item.id === propertyId)
  const appliance = applianceId ? book.appliances.find((item) => item.id === applianceId) : undefined
  return blankDraft({
    propertyId,
    address: property?.address ?? "",
    city: property?.city ?? "",
    ownerName: property?.ownerName ?? "",
    realtyCompany: property?.realtyCompany ?? "",
    unitNumber: property?.unitNumber ?? "",
    alert: property?.alert ?? "",
    lat: property?.lat ?? null,
    lng: property?.lng ?? null,
    sampleProperty: property?.sample ?? false,
    units: [
      blankDraftUnit({
        applianceId: appliance?.id ?? null,
        applianceType: appliance?.type ?? "",
        brand: appliance?.brand ?? "",
        model: appliance?.model ?? "",
        serial: appliance?.serial ?? "",
        year: appliance?.year ?? "",
        partsOnOrder: appliance?.partsOnOrder ?? false,
        partsOnOrderNote: appliance?.partsOnOrderNote ?? "",
        partsOnOrderNumber: appliance?.partsOnOrderNumber ?? "",
      partsOnOrderItems: appliance?.partsOnOrderItems,
      }),
    ],
  })
}

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

export function visitRows(book: Book): VisitRow[] {
  const rows: VisitRow[] = []
  for (const visit of book.visits) {
    const property = book.properties.find((item) => item.id === visit.propertyId)
    if (!property) continue
    const units = visitUnits(visit)
    const visitAppliances = units
      .map((unit) => book.appliances.find((item) => item.id === unit.applianceId) ?? null)
      .filter((item): item is Appliance => item !== null)
    const propertyAppliances = book.appliances.filter((item) => item.propertyId === property.id)
    const appliances = propertyAppliances.length > 0 ? propertyAppliances : visitAppliances
    rows.push({
      visit,
      property,
      appliance: visitAppliances[0] ?? propertyAppliances[0] ?? null,
      appliances,
      visitAppliances,
    })
  }
  rows.sort((a, b) => {
    if (a.visit.date !== b.visit.date) return a.visit.date < b.visit.date ? -1 : 1
    return a.property.address.localeCompare(b.property.address)
  })
  return rows
}

function rowBlob(row: VisitRow): string {
  const units = visitUnits(row.visit)
  const work = units
    .flatMap((unit) => unit.work)
    .map((line) => `${line.action} ${line.partName} ${line.partNumber} ${line.note}`)
    .join(" ")
  const applianceBits = row.appliances.flatMap((appliance) => [
    appliance.type,
    appliance.brand,
    appliance.model,
    appliance.serial,
  ])
  return [
    row.property.address,
    row.property.city,
    row.property.ownerName,
    row.property.realtyCompany,
    row.property.unitNumber,
    ...applianceBits,
    work,
    row.visit.comments,
    row.visit.date,
    formatDate(row.visit.date),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function newestFirst(rows: VisitRow[]): VisitRow[] {
  return [...rows].reverse()
}

export function filterVisitRows(book: Book, mode: SearchMode, query: string): VisitRow[] {
  const q = query.trim().toLowerCase()
  const rows = visitRows(book)
  let matched: VisitRow[]
  if (mode === "date") {
    matched = !q
      ? rows
      : rows.filter(
          (row) =>
            row.visit.date === q ||
            row.visit.date.startsWith(q) ||
            formatDate(row.visit.date).toLowerCase().includes(q),
        )
  } else {
    matched = rows.filter((row) => {
      const blob =
        mode === "realty"
          ? row.property.realtyCompany
          : mode === "address"
            ? `${row.property.address} ${row.property.city}`
            : mode === "owner"
              ? row.property.ownerName
              : rowBlob(row)
      if (!q) return mode === "realty"
      return blob.toLowerCase().includes(q)
    })
  }
  return newestFirst(matched)
}

export function rememberedValues(values: string[]): string[] {
  const seen = new Map<string, string>()
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (!seen.has(key)) seen.set(key, trimmed)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
}

export function filterProperties(book: Book, mode: "address" | "owner", query: string): Property[] {
  const q = query.trim().toLowerCase()
  const list = book.properties.filter((property) => {
    if (!q) return true
    const blob = mode === "owner" ? property.ownerName : `${property.address} ${property.city}`
    return blob.toLowerCase().includes(q)
  })
  list.sort((a, b) => {
    if (mode === "owner") {
      const byOwner = a.ownerName.localeCompare(b.ownerName)
      if (byOwner !== 0) return byOwner
    }
    return a.address.localeCompare(b.address)
  })
  return list
}

export type RealtyGroup = { name: string; rows: VisitRow[] }

export function realtyGroups(rows: VisitRow[]): RealtyGroup[] {
  const map = new Map<string, VisitRow[]>()
  for (const row of rows) {
    const name = row.property.realtyCompany.trim() || "No realty company"
    const bucket = map.get(name)
    if (bucket) bucket.push(row)
    else map.set(name, [row])
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, grouped]) => ({ name, rows: grouped }))
}

export function recentRows(book: Book, limit = 20): VisitRow[] {
  return [...visitRows(book)].reverse().slice(0, limit)
}

export function appliancesAt(book: Book, propertyId: string): Appliance[] {
  return book.appliances
    .filter((item) => item.propertyId === propertyId)
    .sort((a, b) => a.type.localeCompare(b.type) || a.brand.localeCompare(b.brand))
}

export function visitsAt(book: Book, propertyId: string): VisitRow[] {
  return visitRows(book)
    .filter((row) => row.property.id === propertyId)
    .reverse()
}

export function lastVisitDate(book: Book, propertyId: string): string | null {
  const dates = book.visits.filter((visit) => visit.propertyId === propertyId).map((visit) => visit.date)
  if (dates.length === 0) return null
  return dates.sort().at(-1) ?? null
}

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radius = 6371000
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function nearbyProperties(properties: Property[], lat: number, lng: number, radius = NEARBY_METERS) {
  return properties
    .filter((property) => property.lat != null && property.lng != null)
    .map((property) => ({
      property,
      meters: distanceMeters(lat, lng, property.lat as number, property.lng as number),
    }))
    .filter((hit) => hit.meters <= radius)
    .sort((a, b) => a.meters - b.meters)
}

export function commitDraft(
  book: Book,
  draft: Draft,
): { book: Book; visit: Visit; removedPhotoIds: string[] } | { error: string } {
  const address = draft.address.trim()
  if (!address) return { error: "Add the street address." }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return { error: "Add the date you were there." }

  const draftUnits = draft.units.length > 0 ? draft.units : [blankDraftUnit()]
  for (let i = 0; i < draftUnits.length; i++) {
    if (!draftUnits[i].applianceType.trim()) {
      return { error: draftUnits.length > 1 ? `Choose appliance ${i + 1}.` : "Choose the appliance." }
    }
  }

  type CleanedUnit = {
    draft: DraftUnit
    work: WorkLine[]
  }
  const cleanedUnits: CleanedUnit[] = []
  for (const unit of draftUnits) {
    const work = unit.work
      .filter((line) => line.action || line.partName || line.partNumber || line.note)
      .map((line) =>
        workActionUsesPart(line.action)
          ? { ...line, partName: line.partName.trim(), partNumber: line.partNumber.trim() }
          : { ...line, partName: "", partNumber: "", partCustom: false },
      )
    for (const line of work) {
      if (!line.action) return { error: "Choose the work on each line, or remove the blank one." }
      if (workActionUsesPart(line.action) && !line.partName) {
        return { error: `Pick the part you ${line.action.toLowerCase()}, or choose a different action.` }
      }
    }
    cleanedUnits.push({ draft: unit, work })
  }

  const anyWork = cleanedUnits.some((unit) => unit.work.length > 0)
  if (!anyWork && !draft.comments.trim() && draft.photos.length === 0) {
    return { error: "Add the work you did, a comment, or a photo." }
  }

  let propertyId = draft.propertyId
  let properties = book.properties.slice()
  const realtyCompany = draft.realtyCompany.trim()
  const unitNumber = realtyCompany ? draft.unitNumber.trim() : ""
  const alert = draft.alert !== undefined ? draft.alert.trim() : ""

  if (propertyId && !properties.some((property) => property.id === propertyId)) propertyId = null

  if (propertyId) {
    properties = properties.map((property) =>
      property.id === propertyId
        ? {
            ...property,
            address,
            city: draft.city.trim(),
            ownerName: draft.ownerName.trim(),
            realtyCompany,
            unitNumber,
            alert,
            lat: draft.lat,
            lng: draft.lng,
          }
        : property,
    )
  } else {
    const existing = properties.find(
      (property) =>
        norm(property.address) === norm(address) &&
        norm(property.city) === norm(draft.city) &&
        norm(property.unitNumber) === norm(unitNumber),
    )
    if (existing) {
      propertyId = existing.id
      properties = properties.map((property) =>
        property.id === existing.id
          ? {
              ...property,
              address,
              city: draft.city.trim(),
              ownerName: draft.ownerName.trim() || property.ownerName,
              realtyCompany: realtyCompany || property.realtyCompany,
              unitNumber: realtyCompany
                ? unitNumber || property.unitNumber
                : property.unitNumber,
              alert: draft.alert !== undefined ? draft.alert.trim() : property.alert,
              lat: draft.lat ?? property.lat,
              lng: draft.lng ?? property.lng,
            }
          : property,
      )
    } else {
      propertyId = uid()
      properties.push({
        id: propertyId,
        address,
        city: draft.city.trim(),
        ownerName: draft.ownerName.trim(),
        realtyCompany,
        unitNumber,
        alert: draft.alert?.trim() ?? "",
        lat: draft.lat,
        lng: draft.lng,
        sample: false,
      })
    }
  }

  let appliances = book.appliances.slice()
  const resolvedUnits: VisitUnit[] = []

  for (const cleaned of cleanedUnits) {
    let applianceId = cleaned.draft.applianceId
    const applianceFields = (() => {
      const items = normalizePartsOnOrderItems(cleaned.draft)
      const legacy = mirrorPartsOnOrderLegacy(items)
      return {
        type: cleaned.draft.applianceType.trim(),
        brand: cleaned.draft.brand.trim(),
        model: cleaned.draft.model.trim(),
        serial: cleaned.draft.serial.trim(),
        year: cleaned.draft.year.trim(),
        partsOnOrder: Boolean(cleaned.draft.partsOnOrder),
        partsOnOrderNote: legacy.partsOnOrderNote,
        partsOnOrderNumber: legacy.partsOnOrderNumber,
        partsOnOrderItems: items,
      }
    })()

    if (applianceId && !appliances.some((item) => item.id === applianceId && item.propertyId === propertyId)) {
      applianceId = null
    }

    if (applianceId) {
      appliances = appliances.map((item) => (item.id === applianceId ? { ...item, ...applianceFields } : item))
    } else {
      applianceId = uid()
      appliances.push({ id: applianceId, propertyId, ...applianceFields })
    }

    resolvedUnits.push({ applianceId, work: cleaned.work })
  }

  const primary = resolvedUnits[0] ?? { applianceId: "", work: [] as WorkLine[] }
  const visitId = draft.visitId ?? uid()
  const photoIds = draft.photos.map((photo) => photo.id)
  const visit: Visit = {
    id: visitId,
    propertyId,
    units: resolvedUnits,
    applianceId: primary.applianceId,
    work: primary.work,
    date: draft.date,
    comments: draft.comments.trim(),
    photoIds,
    sample: Boolean(draft.sampleVisit && draft.visitId),
  }

  const visits = book.visits.some((item) => item.id === visitId)
    ? book.visits.map((item) => (item.id === visitId ? visit : item))
    : [...book.visits, visit]

  const kept = new Set(photoIds)
  const removedPhotoIds = draft.existingPhotoIds.filter((id) => !kept.has(id))

  return { book: { properties, appliances, visits }, visit, removedPhotoIds }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function isProperty(value: unknown): value is Property {
  if (!isRecord(value) || !str(value.id) || !str(value.address)) return false
  return true
}

function isAppliance(value: unknown): value is Appliance {
  return isRecord(value) && Boolean(str(value.id) && str(value.propertyId))
}

function isWorkLine(value: unknown): value is WorkLine {
  return isRecord(value) && Boolean(str(value.id))
}

function isVisit(value: unknown): value is Visit {
  return isRecord(value) && Boolean(str(value.id) && str(value.propertyId) && str(value.date))
}

function isPhoto(value: unknown): value is Photo {
  return isRecord(value) && Boolean(str(value.id) && str(value.dataUrl))
}

function cleanProperty(value: Property): Property {
  const record = value as Property & Record<string, unknown>
  const realtyCompany = typeof record.realtyCompany === "string" ? record.realtyCompany.trim() : ""
  const unitNumber =
    typeof record.unitNumber === "string" ? record.unitNumber.trim() : ""
  const alert =
    typeof record.alert === "string" ? record.alert.trim() : typeof record.alerts === "string" ? record.alerts.trim() : ""
  return {
    id: record.id,
    address: record.address.trim(),
    city: typeof record.city === "string" ? record.city.trim() : "",
    ownerName: typeof record.ownerName === "string" ? record.ownerName.trim() : "",
    realtyCompany,
    unitNumber: realtyCompany ? unitNumber : "",
    alert,
    lat: typeof record.lat === "number" ? record.lat : null,
    lng: typeof record.lng === "number" ? record.lng : null,
    sample: Boolean(record.sample),
  }
}

function cleanAppliance(value: Appliance): Appliance {
  const record = value as Appliance & Record<string, unknown>
  const items = normalizePartsOnOrderItems(record)
  const legacy = mirrorPartsOnOrderLegacy(items)
  return {
    id: record.id,
    propertyId: record.propertyId,
    type: typeof record.type === "string" ? record.type : "",
    brand: typeof record.brand === "string" ? record.brand : "",
    model: typeof record.model === "string" ? record.model : "",
    serial: typeof record.serial === "string" ? record.serial : "",
    year: typeof record.year === "string" ? record.year.trim() : "",
    partsOnOrder: Boolean(record.partsOnOrder),
    partsOnOrderNote: legacy.partsOnOrderNote,
    partsOnOrderNumber: legacy.partsOnOrderNumber,
    partsOnOrderItems: items,
  }
}

function cleanWorkLines(work: unknown): WorkLine[] {
  if (!Array.isArray(work)) return []
  return work.filter(isWorkLine).map((line) => ({
    id: line.id,
    action: typeof line.action === "string" ? line.action : "",
    partName: typeof line.partName === "string" ? line.partName : "",
    partNumber: typeof line.partNumber === "string" ? line.partNumber : "",
    note: typeof line.note === "string" ? line.note : "",
    partCustom: Boolean(line.partCustom),
  }))
}

function isVisitUnit(value: unknown): value is VisitUnit {
  return isRecord(value) && typeof value.applianceId === "string"
}

function cleanVisit(value: Visit): Visit {
  const record = value as Visit & Record<string, unknown>
  const legacyWork = cleanWorkLines(record.work)
  const legacyApplianceId = typeof record.applianceId === "string" ? record.applianceId : ""

  let units: VisitUnit[] = []
  if (Array.isArray(record.units) && record.units.length > 0) {
    units = record.units.filter(isVisitUnit).map((unit) => ({
      applianceId: unit.applianceId,
      work: cleanWorkLines(unit.work),
    }))
  }
  // Legacy migrate: flat applianceId+work → units: [{applianceId, work}]
  if (units.length === 0 && (legacyApplianceId || legacyWork.length > 0)) {
    units = [{ applianceId: legacyApplianceId, work: legacyWork }]
  }

  const primary = units[0] ?? { applianceId: "", work: [] as WorkLine[] }
  return {
    id: record.id,
    propertyId: record.propertyId,
    units,
    applianceId: primary.applianceId,
    work: primary.work,
    date: typeof record.date === "string" ? record.date : "",
    comments: typeof record.comments === "string" ? record.comments : "",
    photoIds: Array.isArray(record.photoIds) ? record.photoIds.filter((id) => typeof id === "string") : [],
    sample: Boolean(record.sample),
  }
}

export function parseBackup(raw: unknown): { backup: Backup } | { error: string } {
  if (!isRecord(raw)) return { error: "That file isn't a Field Book backup." }
  if (!Array.isArray(raw.properties) || !Array.isArray(raw.appliances) || !Array.isArray(raw.visits)) {
    return { error: "That file is missing addresses or calls." }
  }
  const properties = raw.properties.filter(isProperty).map(cleanProperty).filter((item) => item.address)
  const appliances = raw.appliances.filter(isAppliance).map(cleanAppliance)
  const visits = raw.visits.filter(isVisit).map(cleanVisit)
  const photos = (
    Array.isArray(raw.photos)
      ? raw.photos.filter(isPhoto).map((photo) => {
          const dataUrl = photo.dataUrl
          const mediaType: Photo["mediaType"] = photo.mediaType === "image" ? "image" : undefined
          return {
            id: photo.id,
            visitId: typeof photo.visitId === "string" ? photo.visitId : "",
            dataUrl,
            ...(mediaType ? { mediaType } : {}),
          }
        })
      : []
  ).filter((photo) => !isVideoMedia(photo))
  const keptPhotoIds = new Set(photos.map((photo) => photo.id))
  const visitsWithoutVideos = visits.map((visit) => ({
    ...visit,
    photoIds: visit.photoIds.filter((id) => keptPhotoIds.has(id)),
  }))
  if (properties.length === 0 && visits.length === 0) return { error: "Nothing to import in that file." }
  const version = raw.version === 2 ? 2 : 1
  return {
    backup: {
      version,
      exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "",
      properties,
      appliances,
      visits: visitsWithoutVideos,
      photos,
    },
  }
}

export function isBook(value: unknown): value is Book {
  if (!isRecord(value)) return false
  return Array.isArray(value.properties) && Array.isArray(value.appliances) && Array.isArray(value.visits)
}

export function cleanBook(value: Book): Book {
  return {
    properties: value.properties.filter(isProperty).map(cleanProperty).filter((item) => item.address),
    appliances: value.appliances.filter(isAppliance).map(cleanAppliance),
    visits: value.visits.filter(isVisit).map(cleanVisit),
  }
}
