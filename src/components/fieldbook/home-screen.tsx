import { useMemo, useState } from "react"
import { Ellipsis, LocateFixed, Plus } from "lucide-react"
import {
  applianceTitle,
  blankDraft,
  filterProperties,
  filterVisitRows,
  formatDate,
  lastVisitDate,
  appliancesAt,
  realtyGroups,
  recentRows,
  SEARCH_MODES,
  type Book,
  type SearchMode,
} from "@/lib/fieldbook/model"
import { useBook } from "@/lib/fieldbook/store"
import { useNav } from "./nav"
import { EmptyNote, PropertyButton, SectionTitle, VisitRowButton } from "./ui"

export function HomeScreen() {
  const nav = useNav()
  const properties = useBook((state) => state.properties)
  const appliances = useBook((state) => state.appliances)
  const visits = useBook((state) => state.visits)
  const status = useBook((state) => state.status)
  const [mode, setMode] = useState<SearchMode>("all")
  const [query, setQuery] = useState("")
  const book: Book = { properties, appliances, visits }
  const hasExamples = properties.some((property) => property.sample)

  const results = useMemo(() => {
    if (mode === "address" || mode === "owner") {
      return { kind: "properties" as const, properties: filterProperties(book, mode, query) }
    }
    if (mode === "realty") {
      return { kind: "realty" as const, groups: realtyGroups(filterVisitRows(book, "realty", query)) }
    }
    if (mode === "date") {
      return { kind: "visits" as const, rows: filterVisitRows(book, "date", query), order: "newest" as const }
    }
    if (query.trim()) {
      return { kind: "visits" as const, rows: filterVisitRows(book, "all", query), order: "newest" as const }
    }
    return { kind: "visits" as const, rows: recentRows(book), order: "newest" as const }
  }, [appliances, mode, properties, query, visits])

  function chooseMode(next: SearchMode) {
    setMode(next)
    if (next === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(query)) setQuery("")
  }

  const placeholder =
    mode === "address"
      ? "Street address"
      : mode === "realty"
        ? "Realty company"
        : mode === "owner"
          ? "Owner name"
          : "Address, name, model, part number…"

  return (
    <div>
      <header className="flex items-start justify-between gap-3 md:hidden">
        <div>
          <p className="text-sm font-semibold text-pine">Field Book</p>
          <h1 className="text-2xl font-semibold leading-tight">Service calls</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="icon-btn"
            aria-label="I'm here"
            disabled={nav.locating}
            onClick={nav.locateHere}
          >
            <LocateFixed className="size-5" aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" aria-label="Menu" onClick={nav.openMenu}>
            <Ellipsis className="size-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold">Service calls</h1>
        <p className="mt-1 text-sm text-muted">Search by address, realty company, owner, or the day you were there.</p>
      </div>

      <button type="button" className="btn btn-primary mt-4 w-full md:hidden" onClick={() => nav.openEditor(blankDraft())}>
        <Plus className="size-5" aria-hidden="true" />
        Log a call
      </button>

      <div className="mt-4">
        <label className="label" htmlFor="book-search">
          {mode === "date" ? "Day you were there" : "Find"}
        </label>
        {mode === "date" ? (
          <input
            id="book-search"
            className="field"
            type="date"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        ) : (
          <input
            id="book-search"
            className="field"
            value={query}
            placeholder={placeholder}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Search by">
        {SEARCH_MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            className="chip"
            aria-pressed={mode === item.id}
            onClick={() => chooseMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {hasExamples ? (
        <p className="mt-4 rounded-xl bg-sand px-3 py-3 text-sm">
          Four example calls are loaded so you can try a search. Remove them from the menu when you start your own
          book.
        </p>
      ) : null}

      <div className="mt-5" aria-live="polite">
        {status === "loading" ? (
          <div className="space-y-3">
            <div className="h-24 rounded-2xl bg-sand" />
            <div className="h-24 rounded-2xl bg-sand" />
            <div className="h-24 rounded-2xl bg-sand" />
          </div>
        ) : results.kind === "properties" ? (
          <PropertyResults properties={results.properties} book={book} mode={mode} query={query} />
        ) : results.kind === "realty" ? (
          <RealtyResults groups={results.groups} query={query} />
        ) : (
          <VisitResults rows={results.rows} order={results.order} mode={mode} query={query} />
        )}
      </div>
    </div>
  )
}

function PropertyResults({
  properties,
  book,
  mode,
  query,
}: {
  properties: Book["properties"]
  book: Book
  mode: SearchMode
  query: string
}) {
  const nav = useNav()
  if (properties.length === 0) {
    return (
      <EmptyNote
        title="No address matches"
        body={
          query.trim()
            ? `Nothing in the book for “${query.trim()}”. Log the call and it will be here next time.`
            : "No addresses yet."
        }
      />
    )
  }
  return (
    <div>
      <SectionTitle
        title={mode === "owner" ? "Owners" : "Addresses"}
        aside={`${properties.length} file${properties.length === 1 ? "" : "s"}`}
      />
      <ul className="space-y-3">
        {properties.map((property) => {
          const units = appliancesAt(book, property.id)
          const last = lastVisitDate(book, property.id)
          const detail = [
            units.length > 0 ? units.map((unit) => applianceTitle(unit)).join(", ") : "No appliance yet",
            last ? `last ${formatDate(last)}` : "no calls yet",
          ].join(" · ")
          return (
            <li key={property.id}>
              <PropertyButton property={property} detail={detail} onOpen={() => nav.openProperty(property.id)} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function VisitResults({
  rows,
  order,
  mode,
  query,
}: {
  rows: ReturnType<typeof recentRows>
  order: "oldest" | "newest"
  mode: SearchMode
  query: string
}) {
  const nav = useNav()
  const title =
    mode === "date" && query
      ? `Calls on ${formatDate(query)}`
      : mode === "date"
        ? "Every call"
        : query.trim()
          ? "Matches"
          : "Latest calls"
  if (rows.length === 0) {
    return (
      <EmptyNote
        title="No calls match"
        body={
          query.trim()
            ? `Nothing for “${query.trim()}”. Try the realty company, the owner, or the street.`
            : "Log a call and it will show up here."
        }
      />
    )
  }
  return (
    <div>
      <SectionTitle
        title={title}
        aside={order === "newest" ? "Newest first" : `${rows.length} recent`}
      />
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.visit.id}>
            <VisitRowButton
              row={row}
              showRealty={mode === "all" || mode === "date"}
              onOpen={() => nav.openProperty(row.property.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function RealtyResults({
  groups,
  query,
}: {
  groups: ReturnType<typeof realtyGroups>
  query: string
}) {
  const nav = useNav()
  if (groups.length === 0) {
    return (
      <EmptyNote
        title="No realty company matches"
        body={
          query.trim()
            ? `No calls for a company named “${query.trim()}”.`
            : "Add a realty company when you log a call."
        }
      />
    )
  }
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.name}>
          <SectionTitle
            title={group.name}
            aside={`${group.rows.length} call${group.rows.length === 1 ? "" : "s"} · newest first`}
          />
          <ul className="space-y-3">
            {group.rows.map((row) => (
              <li key={row.visit.id}>
                <VisitRowButton row={row} showRealty={false} onOpen={() => nav.openProperty(row.property.id)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
