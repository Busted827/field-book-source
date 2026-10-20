import { useEffect, useRef, useState } from "react"
import { Camera, ChevronLeft, Plus, Star, Trash2, TriangleAlert, Wrench } from "lucide-react"
import {
  formatDate,
  partsFor,
  placeLabel,
  summarizeVisitWork,
  visitUnits,
  type PartsOnOrderItem,
  type Property,
  type VisitRow,
} from "@/lib/fieldbook/model"
import { OUT_OF_DATE, decodeApplianceYear, yearDropdownOptions, yearToField } from "@/lib/fieldbook/year-decode"
import { useNav } from "./nav"

export function ApplianceName({
  brand,
  type,
  year,
}: {
  brand?: string
  type?: string
  year?: string
}) {
  const name = [brand, type].filter(Boolean).join(" ") || "Appliance"
  const shown = year?.trim()
  return (
    <>
      <span className="font-semibold">{name}</span>
      {shown ? <span className="text-sm font-normal text-muted"> · {shown}</span> : null}
    </>
  )
}

export function YearSelect({
  brand,
  serial,
  model,
  year,
  onYear,
}: {
  brand: string
  serial: string
  model: string
  year: string
  onYear: (value: string) => void
}) {
  const CUSTOM_YEAR = "…"
  const prevFields = useRef<{ brand: string; serial: string; model: string } | null>(null)
  const yearNow = useRef(year)
  yearNow.current = year
  const customRef = useRef<HTMLInputElement>(null)
  const [typing, setTyping] = useState(false)
  const [draftYear, setDraftYear] = useState("")
  const decode = decodeApplianceYear(brand, serial, model)
  const options = yearDropdownOptions(decode)
  const current = year.trim()
  const choices = current && current !== CUSTOM_YEAR && !options.includes(current) ? [current, ...options] : options

  useEffect(() => {
    if (typing) customRef.current?.focus()
  }, [typing])

  useEffect(() => {
    const first = prevFields.current === null
    const prev = prevFields.current
    const changed = prev !== null && (prev.brand !== brand || prev.serial !== serial || prev.model !== model)
    prevFields.current = { brand, serial, model }
    const stored = yearNow.current.trim()
    if (stored === OUT_OF_DATE || stored === CUSTOM_YEAR) return
    if (changed && prev && /^\d{4}$/.test(stored)) {
      const previousOptions = yearDropdownOptions(decodeApplianceYear(prev.brand, prev.serial, prev.model))
      if (!previousOptions.includes(stored)) return
    }
    if (!(changed || (first && !stored))) return
    const newest = yearToField(decodeApplianceYear(brand, serial, model))
    if (newest !== stored) onYear(newest)
  }, [brand, model, serial])

  function commitCustom() {
    const next = draftYear.trim()
    if (/^\d{4}$/.test(next)) onYear(next)
    setTyping(false)
  }

  if (typing) {
    return (
      <input
        ref={customRef}
        aria-label="Manufacture year"
        inputMode="numeric"
        maxLength={4}
        placeholder="YYYY"
        className="w-20 shrink-0 rounded-lg border border-line bg-transparent px-2 py-0.5 text-sm text-muted tabular-nums"
        value={draftYear}
        onChange={(event) => setDraftYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commitCustom()
          }
          if (event.key === "Escape") {
            event.preventDefault()
            setTyping(false)
          }
        }}
        onBlur={commitCustom}
      />
    )
  }

  return (
    <select
      aria-label="Manufacture year"
      className="max-w-32 shrink-0 rounded-lg border border-line bg-transparent px-2 py-0.5 text-sm text-muted"
      value={current}
      onChange={(event) => {
        const value = event.target.value
        if (value === CUSTOM_YEAR) {
          setDraftYear("")
          setTyping(true)
          return
        }
        onYear(value)
      }}
    >
      {current === "" ? <option value=""> </option> : null}
      {choices.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
      <option value={CUSTOM_YEAR}>{CUSTOM_YEAR}</option>
    </select>
  )
}

export function BackHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const nav = useNav()
  return (
    <div className="mb-5 flex items-start gap-3">
      <button type="button" className="icon-btn" onClick={nav.back} aria-label="Back">
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <div className="min-w-0 pt-1">
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
        <h1 className="text-xl font-semibold leading-tight">{title}</h1>
      </div>
    </div>
  )
}

export function PropertyAlertBanner({ alert }: { alert: string }) {
  const text = alert.trim()
  if (!text) return null
  return (
    <div role="status" className="mb-4 rounded-2xl border border-copper bg-copper-soft px-4 py-3">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-copper uppercase">
        <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
        Property alert
      </p>
      <p className="mt-1 font-semibold leading-snug">{text}</p>
    </div>
  )
}

export type PartsOnOrderChange = {
  partsOnOrder: boolean
  partsOnOrderItems: PartsOnOrderItem[]
  partsOnOrderNote: string
  partsOnOrderNumber: string
}

function emitParts(on: boolean, items: PartsOnOrderItem[]): PartsOnOrderChange {
  return {
    partsOnOrder: on,
    partsOnOrderItems: items,
    partsOnOrderNote: items[0]?.note ?? "",
    partsOnOrderNumber: items[0]?.number ?? "",
  }
}

/** Star + switch + N part rows (+ Other…) + part number + Add another part. */
export function PartsOnOrderToggle({
  id,
  on,
  items,
  applianceType,
  onChange,
  onInstall,
}: {
  id: string
  on: boolean
  items: PartsOnOrderItem[]
  applianceType?: string
  onChange: (next: PartsOnOrderChange) => void
  /** Call screen only. Moves these rows into Work done as Installed. */
  onInstall?: (indexes: number[]) => void
}) {
  const [customRows, setCustomRows] = useState<Record<number, boolean>>({})
  const parts = partsFor(applianceType ?? "")

  function toggle() {
    const nextOn = !on
    setCustomRows({})
    if (nextOn && items.length === 0) {
      onChange(emitParts(true, [{ note: "", number: "" }]))
      return
    }
    onChange(emitParts(nextOn, items))
  }

  function updateItem(index: number, patch: Partial<PartsOnOrderItem>) {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    onChange(emitParts(true, next))
  }

  function removeItem(index: number) {
    const next = items.filter((_, i) => i !== index)
    setCustomRows({})
    onChange(emitParts(true, next.length > 0 ? next : [{ note: "", number: "" }]))
  }

  function addItem() {
    onChange(emitParts(true, [...items, { note: "", number: "" }]))
  }

  const readyIndexes = items.flatMap((item, index) =>
    (item.note ?? "").trim() || (item.number ?? "").trim() ? [index] : [],
  )

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-3">
        <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold" onClick={toggle}>
          <Star className={`size-3.5 ${on ? "fill-amber-500 text-amber-500" : "text-muted"}`} aria-hidden="true" />
          Parts on order
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Parts on order"
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-copper" : "bg-line"}`}
          onClick={toggle}
        >
          <span
            className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`}
          />
        </button>
      </div>
      {on ? (
        <div className="mt-2 space-y-2">
          {items.map((item, index) => {
            const note = item.note ?? ""
            const number = item.number ?? ""
            const inList = parts.includes(note)
            const custom = Boolean(customRows[index])
            const showName = parts.length === 0 || custom || (note.trim() !== "" && !inList)
            const selectValue = inList ? note : showName && parts.length > 0 ? "__custom" : ""
            const rowId = `${id}-${index}`
            return (
              <div key={rowId} className="rounded-xl bg-copper-soft/50 p-2.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-muted">{items.length > 1 ? `Part ${index + 1}` : "On order"}</p>
                  {items.length > 1 ? (
                    <button type="button" className="icon-btn" aria-label={`Remove part ${index + 1}`} onClick={() => removeItem(index)}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                {parts.length > 0 ? (
                  <>
                    <label className="label" htmlFor={rowId}>
                      What's on order
                    </label>
                    <select
                      id={rowId}
                      className="field select"
                      value={selectValue}
                      onChange={(event) => {
                        const value = event.target.value
                        if (value === "__custom") {
                          setCustomRows((prev) => ({ ...prev, [index]: true }))
                          updateItem(index, { note: inList ? "" : note })
                          return
                        }
                        setCustomRows((prev) => ({ ...prev, [index]: false }))
                        updateItem(index, { note: value })
                      }}
                    >
                      <option value="">Choose a part</option>
                      {parts.map((part) => (
                        <option key={part} value={part}>
                          {part}
                        </option>
                      ))}
                      <option value="__custom">Other part…</option>
                    </select>
                  </>
                ) : null}
                {showName ? (
                  <>
                    {parts.length === 0 ? (
                      <label className="label" htmlFor={`${rowId}-name`}>
                        What's on order
                      </label>
                    ) : null}
                    <input
                      id={`${rowId}-name`}
                      className={`field ${parts.length > 0 ? "mt-2" : ""}`}
                      value={inList ? "" : note}
                      placeholder="Part name or description"
                      onChange={(event) => updateItem(index, { note: event.target.value })}
                    />
                  </>
                ) : null}
                <label className="label mt-3" htmlFor={`${rowId}-part-no`}>
                  Part number
                </label>
                <input
                  id={`${rowId}-part-no`}
                  className="field font-mono"
                  value={number}
                  placeholder="From the bag or invoice"
                  onChange={(event) => updateItem(index, { number: event.target.value })}
                />
                {onInstall && ((note ?? "").trim() || (number ?? "").trim()) ? (
                  <button type="button" className="btn btn-sand mt-3 w-full" onClick={() => onInstall([index])}>
                    Move to installed
                  </button>
                ) : null}
              </div>
            )
          })}
          <button type="button" className="btn btn-sand w-full" onClick={addItem}>
            <Plus className="size-5" aria-hidden="true" />
            Add another part
          </button>
          {onInstall && readyIndexes.length > 1 ? (
            <button type="button" className="btn btn-primary w-full" onClick={() => onInstall(readyIndexes)}>
              Move all to installed
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function SectionTitle({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {aside ? <p className="text-sm text-muted">{aside}</p> : null}
    </div>
  )
}

export function VisitRowButton({
  row,
  onOpen,
  showAddress = true,
  showRealty = false,
  showPartsOnOrder = true,
}: {
  row: VisitRow
  onOpen: () => void
  showAddress?: boolean
  showRealty?: boolean
  showPartsOnOrder?: boolean
}) {
  const units = visitUnits(row.visit)
  const replaced = units.some((unit) => unit.work.some((line) => line.action === "Replaced"))
  const displayUnits = row.visitAppliances && row.visitAppliances.length > 0 ? row.visitAppliances : row.appliances
  const unitTag =
    row.property.realtyCompany && row.property.unitNumber
      ? `Unit ${row.property.unitNumber}`
      : null
  const partsOnOrder = (row.appliances && row.appliances.length > 0 ? row.appliances : (row.visitAppliances ?? [])).some(
    (unit) => Boolean(unit.partsOnOrder),
  )
  return (
    <button type="button" className="card" onClick={onOpen}>
      <span
        className={`absolute top-3 bottom-3 left-2 w-1 rounded-full ${replaced ? "bg-copper" : "bg-pine"}`}
        aria-hidden="true"
      />
      <span className="flex items-start gap-2 pl-3">
        <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-sm text-muted tabular-nums">{formatDate(row.visit.date)}</span>
          {row.visit.photoIds.length > 0 ? (
            <span className="inline-flex items-center gap-1 text-sm text-muted">
              <Camera className="size-4" aria-hidden="true" />
              {row.visit.photoIds.length}
            </span>
          ) : null}
        </span>
        {showAddress ? <span className="mt-1 block font-semibold">{placeLabel(row.property)}</span> : null}
        {showRealty && row.property.realtyCompany ? (
          <span className="mt-0.5 block text-sm text-muted">
            {[row.property.realtyCompany, unitTag].filter(Boolean).join(" · ")}
          </span>
        ) : unitTag ? (
          <span className="mt-0.5 block text-sm text-muted">{unitTag}</span>
        ) : null}
        <span className="mt-1 block text-sm">
          {displayUnits.length > 0 ? (
            displayUnits.map((unit, index) => (
              <span key={unit.id}>
                {index > 0 ? <span className="text-muted"> · </span> : null}
                <ApplianceName brand={unit.brand} type={unit.type} year={unit.year} />
              </span>
            ))
          ) : (
            <ApplianceName
              brand={row.appliance?.brand}
              type={row.appliance?.type}
              year={row.appliance?.year}
            />
          )}
        </span>
        <span className="mt-1 block text-sm text-muted">{summarizeVisitWork(row.visit, displayUnits)}</span>
        {row.visit.comments ? (
          <span className="mt-1 block text-sm text-ink/80 line-clamp-2">{row.visit.comments}</span>
        ) : null}
        </span>
        {showPartsOnOrder && partsOnOrder ? (
          <span
            className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-copper-soft text-copper"
            aria-label="Parts on order"
          >
            <Wrench className="size-4" aria-hidden="true" />
          </span>
        ) : null}
      </span>
    </button>
  )
}

export function PropertyButton({
  property,
  detail,
  onOpen,
}: {
  property: Property
  detail: string
  onOpen: () => void
}) {
  return (
    <button type="button" className="card" onClick={onOpen}>
      <span className="absolute top-3 bottom-3 left-2 w-1 rounded-full bg-pine" aria-hidden="true" />
      <span className="block pl-3">
        <span className="flex items-start justify-between gap-3">
          <span className="block font-semibold">{property.address}</span>
          {property.sample ? <span className="text-sm font-semibold text-copper">Example</span> : null}
        </span>
        {property.city ? <span className="mt-0.5 block text-sm text-muted">{property.city}</span> : null}
        <span className="mt-1 block text-sm">
          {[
            property.ownerName || "Owner not listed",
            property.realtyCompany,
            property.realtyCompany && property.unitNumber ? `Unit ${property.unitNumber}` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className="mt-1 block text-sm text-muted">{detail}</span>
      </span>
    </button>
  )
}

export function EmptyNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card px-4 py-6">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  )
}

function listed(options: string[], value: string): boolean {
  const key = value.trim().toLowerCase()
  if (!key) return false
  return options.some((item) => item.toLowerCase() === key)
}

export function RememberedField({
  id,
  label,
  value,
  options,
  onChange,
  className = "",
  mono = false,
  newPlaceholder,
}: {
  id: string
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  className?: string
  mono?: boolean
  newPlaceholder: string
}) {
  const [adding, setAdding] = useState(() => value.trim() !== "" && !listed(options, value))

  useEffect(() => {
    if (listed(options, value)) setAdding(false)
  }, [options, value])

  const selectValue = adding ? "__new" : value

  return (
    <div className={className}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={`field select ${mono ? "font-mono" : ""}`}
        value={selectValue}
        onChange={(event) => {
          const next = event.target.value
          if (next === "__new") {
            setAdding(true)
            onChange("")
            return
          }
          setAdding(false)
          onChange(next)
        }}
      >
        <option value="">Choose</option>
        {options.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
        <option value="__new">Add new…</option>
      </select>
      {adding ? (
        <input
          id={`${id}-new`}
          className={`field mt-2 ${mono ? "font-mono" : ""}`}
          value={value}
          placeholder={newPlaceholder}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
    </div>
  )
}

/** Type-ahead text field: suggestions filter as you type; new values join the pool after save. */
export function AutofillField({
  id,
  label,
  value,
  options,
  onChange,
  className = "",
  mono = false,
  placeholder,
}: {
  id: string
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  className?: string
  mono?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const q = value.trim().toLowerCase()
  const suggestions = options
    .filter((item) => {
      if (!q) return true
      return item.toLowerCase().includes(q) && item.toLowerCase() !== q
    })
    .slice(0, 8)

  return (
    <div className={`relative ${className}`}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={`field ${mono ? "font-mono" : ""}`}
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so a suggestion click registers
          window.setTimeout(() => setOpen(false), 120)
        }}
        onChange={(event) => {
          setOpen(true)
          onChange(event.target.value)
        }}
      />
      {open && suggestions.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-line bg-card shadow-sm">
          {suggestions.map((item) => (
            <li key={item} className="border-b border-line last:border-b-0">
              <button
                type="button"
                className={`min-h-11 w-full px-3 py-2 text-left ${mono ? "font-mono text-sm" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(item)
                  setOpen(false)
                }}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
