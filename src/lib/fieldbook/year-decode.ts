/**
 * Brand-aware manufacture year from serial (and model when needed).
 * Rules from /workspace/appliance-year-refs/*-serial-decode.md
 */

export type YearDecode = {
  /** Best-guess calendar year, or null if unknown. */
  year: number | null
  month?: number | null
  /** True when more than one decade/cycle fits. */
  ambiguous: boolean
  /** All plausible years (newest-first preference order). */
  candidates: number[]
  /** Short hint for the edit UI. */
  hint: string
}

const CURRENT_YEAR = new Date().getFullYear()

function cleanSerial(serial: string): string {
  return serial.trim().toUpperCase().replace(/[\s\-_/]/g, "")
}

function cleanBrand(brand: string): string {
  return brand.trim().toLowerCase().replace(/\s+/g, " ")
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

/** Prefer most recent year that is not after next calendar year. */
function pickYear(candidates: number[]): number | null {
  const usable = [...new Set(candidates)]
    .filter((y) => y >= 1975 && y <= CURRENT_YEAR + 1)
    .sort((a, b) => b - a)
  return usable[0] ?? null
}

function result(
  candidates: number[],
  opts?: { month?: number | null; hint?: string; forceAmbiguous?: boolean },
): YearDecode {
  const uniq = [...new Set(candidates.filter((y) => y >= 1975 && y <= CURRENT_YEAR + 1))].sort(
    (a, b) => b - a,
  )
  const year = pickYear(uniq)
  const ambiguous = opts?.forceAmbiguous || uniq.length > 1
  const hint = opts?.hint ?? ""
  return {
    year,
    month: opts?.month ?? null,
    ambiguous,
    candidates: uniq,
    hint,
  }
}

function empty(hint = ""): YearDecode {
  return { year: null, month: null, ambiguous: false, candidates: [], hint }
}

// --- GE (USA): 1st alpha = month, 2nd alpha = year (12-year cycle) ---
const GE_MONTH: Record<string, number> = {
  A: 1,
  D: 2,
  F: 3,
  G: 4,
  H: 5,
  L: 6,
  M: 7,
  R: 8,
  S: 9,
  T: 10,
  V: 11,
  Z: 12,
}

const GE_YEAR: Record<string, number[]> = {
  F: [1991, 2003, 2015],
  G: [1980, 1992, 2004, 2016],
  H: [1981, 1993, 2005, 2017],
  L: [1982, 1994, 2006, 2018],
  M: [1983, 1995, 2007, 2019],
  R: [1984, 1996, 2008, 2020],
  S: [1985, 1997, 2009, 2021],
  T: [1986, 1998, 2010, 2022],
  V: [1987, 1999, 2011, 2023],
  Z: [1988, 2000, 2012, 2024],
  A: [1989, 2001, 2013, 2025],
  D: [1990, 2002, 2014, 2026],
}

function decodeGE(serial: string): YearDecode {
  const s = cleanSerial(serial)
  const m = /^([A-Z])([A-Z])/.exec(s)
  if (!m) return empty("GE serial needs two letters at the start")
  const month = GE_MONTH[m[1]]
  const years = GE_YEAR[m[2]]
  if (!years) return empty("GE year letter not recognized")
  return result(years, {
    month: month ?? null,
    forceAmbiguous: years.filter((y) => y <= CURRENT_YEAR + 1).length > 1,
  })
}

// --- U-Line: YY####-MM-#### ---
function decodeULine(serial: string): YearDecode {
  const raw = serial.trim().toUpperCase()
  const m = /^(\d{2})\d{0,4}\D+(\d{2})/.exec(raw.replace(/\s+/g, ""))
  const compact = cleanSerial(serial)
  let yy: number | null = null
  let month: number | null = null
  if (m) {
    yy = Number(m[1])
    month = Number(m[2])
  } else if (/^\d{6}/.test(compact)) {
    yy = Number(compact.slice(0, 2))
  }
  if (yy == null || Number.isNaN(yy)) return empty("U-Line serial needs year digits first")
  // Prefer 20xx; if that is far future, try 19xx
  const cands = [2000 + yy, 1900 + yy]
  return result(cands, {
    month: month && month >= 1 && month <= 12 ? month : null,
  })
}

// --- Whirlpool family (Whirlpool / KitchenAid / Maytag / Amana): 2nd letter = year (30-year cycle), digits 3–4 = week ---
// Chart covers ~2001–2054; letter repeats every ~30 years within chart (K, L, M appear twice).
const WHIRLPOOL_YEAR: Record<string, number[]> = {
  A: [2013, 2043],
  B: [2014, 2044],
  C: [2015, 2045],
  D: [2016, 2046],
  E: [2017, 2047],
  F: [2018, 2048],
  G: [2019, 2049],
  H: [2020, 2050],
  J: [2021, 2051],
  K: [2001, 2022, 2031, 2052],
  L: [2002, 2023, 2032, 2053],
  M: [2003, 2024, 2033, 2054],
  P: [2004, 2034],
  R: [2005, 2035],
  S: [2006, 2036],
  T: [2007, 2037],
  U: [2009, 2039],
  V: [2008, 2038],
  W: [2010, 2040],
  X: [2011, 2041],
  Y: [2012, 2042],
}

function decodeWhirlpool(serial: string): YearDecode {
  const s = cleanSerial(serial)
  const m = /^[A-Z]([A-Z])(\d{2})/.exec(s)
  if (!m) return empty("Whirlpool serial needs letter + year letter + week")
  const years = WHIRLPOOL_YEAR[m[1]]
  if (!years) return empty("Whirlpool year letter not recognized")
  return result(years, {
    forceAmbiguous: years.filter((y) => y <= CURRENT_YEAR + 1).length > 1,
  })
}

// --- Frigidaire: plant letters + 1-digit year + 2-digit week ---
function decodeFrigidaire(serial: string): YearDecode {
  const s = cleanSerial(serial)
  const m = /^[A-Z]{1,3}(\d)(\d{2})/.exec(s)
  if (!m) return empty("Frigidaire serial needs plant letters then year digit")
  const digit = Number(m[1])
  const cands: number[] = []
  for (let decade = 2020; decade >= 1980; decade -= 10) {
    cands.push(decade + digit)
  }
  return result(cands, { forceAmbiguous: true })
}

// --- Hoshizaki: first letter = year (I skipped), last letter = month (I skipped); ~2010+ ---
const HOSHIZAKI_YEAR: Record<string, number> = (() => {
  const map: Record<string, number> = {}
  // A=2011 … H=2018, skip I, J=2019 …
  const letters = "ABCDEFGHJKLMNOPQRSTUVWXYZ"
  let year = 2011
  for (const ch of letters) {
    map[ch] = year
    year += 1
  }
  return map
})()

const HOSHIZAKI_MONTH: Record<string, number> = (() => {
  const map: Record<string, number> = {}
  const letters = "ABCDEFGHJKLM" // A=Jan … H=Aug, J=Sep … M=Dec (I skipped)
  letters.split("").forEach((ch, i) => {
    map[ch] = i + 1
  })
  return map
})()

function decodeHoshizaki(serial: string): YearDecode {
  const s = cleanSerial(serial)
  if (s.length < 2) return empty()
  const y = HOSHIZAKI_YEAR[s[0]]
  const month = HOSHIZAKI_MONTH[s[s.length - 1]]
  if (y == null) return empty("Hoshizaki year letter not recognized")
  return result([y], { month: month ?? null })
}

// --- Bosch FD: first two + 20 → year via (yy+20)%100 into 2000s; last two = month ---
function extractBoschFd(serial: string, model: string): string | null {
  const blob = `${serial} ${model}`.toUpperCase()
  const labeled = /\bFD\s*[#:]?\s*(\d{4})\b/.exec(blob)
  if (labeled) return labeled[1]
  const s = cleanSerial(serial)
  if (/^\d{4}/.test(s)) {
    const fd = s.slice(0, 4)
    const month = Number(fd.slice(2, 4))
    if (month >= 1 && month <= 12) return fd
  }
  // Sometimes FD is embedded
  const embed = /(?:^|[^0-9])(\d{2}(?:0[1-9]|1[0-2]))(?:[^0-9]|$)/.exec(s)
  return embed ? embed[1] : null
}

function decodeBosch(serial: string, model: string): YearDecode {
  const fd = extractBoschFd(serial, model)
  if (!fd) return empty("Bosch needs 4-digit FD (e.g. FD 9612)")
  const yy = Number(fd.slice(0, 2))
  const month = Number(fd.slice(2, 4))
  // Chart: 96+20=2016, 01+20=2021 → year = 2000 + ((yy + 20) % 100)
  let year = 2000 + ((yy + 20) % 100)
  if (year > CURRENT_YEAR + 1) year -= 100
  return result([year, year - 100], {
    month: month >= 1 && month <= 12 ? month : null,
  })
}

// --- Samsung: chars 8–9 = year letter + month ---
const SAMSUNG_YEAR: Record<string, number> = {
  J: 2015,
  K: 2016,
  M: 2017,
  N: 2018,
  R: 2019,
  T: 2020,
  W: 2021,
  X: 2022,
  Y: 2023,
  A: 2024,
  B: 2025,
  C: 2026,
}

function decodeSamsung(serial: string): YearDecode {
  const s = cleanSerial(serial)
  if (s.length < 9) return empty("Samsung serial needs at least 9 characters")
  const yLetter = s[7]
  const mChar = s[8]
  const year = SAMSUNG_YEAR[yLetter]
  if (year == null) return empty("Samsung year letter not recognized")
  let month: number | null = null
  if (/[1-9]/.test(mChar)) month = Number(mChar)
  else if (mChar === "A") month = 10
  else if (mChar === "B") month = 11
  else if (mChar === "C") month = 12
  return result([year], { month })
}

// --- LG: 1st digit = year digit, 2nd–3rd = month ---
function decodeLG(serial: string): YearDecode {
  const s = cleanSerial(serial)
  const m = /^(\d)(\d{2})/.exec(s)
  if (!m) return empty("LG serial needs year digit + month at start")
  const digit = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) return empty("LG month looks invalid")
  const cands: number[] = []
  for (let decade = 2020; decade >= 1990; decade -= 10) {
    cands.push(decade + digit)
  }
  return result(cands, { month, forceAmbiguous: true })
}

// --- Sharp: first 3 digits = year digit + month ---
function decodeSharp(serial: string): YearDecode {
  const s = cleanSerial(serial)
  const m = /^(\d)(\d{2})/.exec(s)
  if (!m) return empty("Sharp serial needs year digit + month at start")
  const digit = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) return empty("Sharp month looks invalid")
  const cands: number[] = []
  for (let decade = 2020; decade >= 1990; decade -= 10) {
    cands.push(decade + digit)
  }
  // ≤2014 style: 3 nums + 4 letters + 5 nums → prefer ≤2014
  // ≥2015 style: 3 nums + 9 mixed → prefer ≥2015
  const legacyStyle = /^\d{3}[A-Z]{4}\d{5}/.test(s)
  const modernStyle = /^\d{3}[A-Z0-9]{9}$/.test(s) && !legacyStyle
  if (legacyStyle) {
    const legacy = cands.filter((y) => y <= 2014)
    if (legacy.length > 0) return result(legacy, { month, forceAmbiguous: legacy.length > 1 })
  }
  if (modernStyle) {
    const modern = cands.filter((y) => y >= 2015)
    if (modern.length > 0) return result(modern, { month, forceAmbiguous: modern.length > 1 })
  }
  return result(cands, { month, forceAmbiguous: true })
}

// --- Kenmore: model prefix → maker, then that maker’s serial rules ---
const KENMORE_PREFIX: Record<string, "whirlpool" | "frigidaire" | "lg" | "ge"> = {
  "110": "whirlpool",
  "106": "whirlpool",
  "562": "whirlpool",
  "665": "whirlpool",
  "253": "frigidaire",
  "790": "frigidaire",
  "795": "lg",
  "796": "lg",
  "362": "ge",
  "363": "ge",
  "417": "ge",
}

function kenmorePrefix(model: string): string | null {
  const m = model.trim()
  const hit = /^(\d{3})\b/.exec(m) || /^(\d{3})/.exec(digitsOnly(m).slice(0, 3) ? digitsOnly(m) : "")
  if (hit) return hit[1]
  const d = digitsOnly(m)
  return d.length >= 3 ? d.slice(0, 3) : null
}

function decodeKenmore(serial: string, model: string): YearDecode {
  const prefix = kenmorePrefix(model)
  if (!prefix || !KENMORE_PREFIX[prefix]) {
    return empty("Kenmore needs model prefix (e.g. 110) to pick maker rules")
  }
  const maker = KENMORE_PREFIX[prefix]
  if (maker === "whirlpool") return decodeWhirlpool(serial)
  if (maker === "frigidaire") return decodeFrigidaire(serial)
  if (maker === "lg") return decodeLG(serial)
  return decodeGE(serial)
}

// --- Sub-Zero: serial has no public year; parse printed Date Code / MFG date ---
// Official: manufacture date is on the rating tag under "Date Code" (not encoded in serial).
// Tech may enter the Date Code / printed date in the serial field (alone or after the serial).
const SUBZERO_MONTH: Record<string, number> = {
  JAN: 1,
  JANUARY: 1,
  FEB: 2,
  FEBRUARY: 2,
  MAR: 3,
  MARCH: 3,
  APR: 4,
  APRIL: 4,
  MAY: 5,
  JUN: 6,
  JUNE: 6,
  JUL: 7,
  JULY: 7,
  AUG: 8,
  AUGUST: 8,
  SEP: 9,
  SEPT: 9,
  SEPTEMBER: 9,
  OCT: 10,
  OCTOBER: 10,
  NOV: 11,
  NOVEMBER: 11,
  DEC: 12,
  DECEMBER: 12,
}

function decodeSubZero(serial: string, model = ""): YearDecode {
  const blob = `${serial} ${model}`.trim().toUpperCase()
  if (!blob) return empty()

  // Mon YYYY / Month YYYY (e.g. Jul 2003, APRIL 2020)
  const monYear = /\b([A-Z]{3,9})\s*[\/\-\s,]?\s*((?:19|20)\d{2})\b/.exec(blob)
  if (monYear) {
    const month = SUBZERO_MONTH[monYear[1]]
    const year = Number(monYear[2])
    if (month && year) {
      return result([year], {
        month,
        hint: "From Date Code / manufacture date on tag",
      })
    }
  }

  // MM/YYYY or M/YYYY or MM-YYYY
  const mY = /\b(0?[1-9]|1[0-2])[\/\-]((?:19|20)\d{2})\b/.exec(blob)
  if (mY) {
    return result([Number(mY[2])], {
      month: Number(mY[1]),
      hint: "From Date Code / manufacture date on tag",
    })
  }

  // YYYY-MM or YYYY/MM
  const yM = /\b((?:19|20)\d{2})[\/\-](0?[1-9]|1[0-2])\b/.exec(blob)
  if (yM) {
    return result([Number(yM[1])], {
      month: Number(yM[2]),
      hint: "From Date Code / manufacture date on tag",
    })
  }

  // YYYYMM (e.g. 200307)
  const yyyymm = /\b((?:19|20)\d{2})(0[1-9]|1[0-2])\b/.exec(blob.replace(/[\s\-_]/g, ""))
  if (yyyymm) {
    return result([Number(yyyymm[1])], {
      month: Number(yyyymm[2]),
      hint: "From Date Code / manufacture date on tag",
    })
  }

  // Bare 4-digit year when clearly labeled
  const labeledYear = /\b(?:DATE\s*CODE|MFG|MANUFACTURE(?:D)?(?:\s*DATE)?|YEAR)[:\s#]*((?:19|20)\d{2})\b/.exec(
    blob,
  )
  if (labeledYear) {
    return result([Number(labeledYear[1])], {
      hint: "From Date Code / manufacture date on tag",
    })
  }

  // Cryptic Date Code alone (e.g. 776N) — no public decode table
  const compact = cleanSerial(serial)
  if (/^[A-Z]?\d{6,8}$/.test(compact) || /^\d{3,4}[A-Z]$/.test(compact)) {
    return empty("Sub-Zero: enter Date Code from tag (e.g. Jul 2003) — serial alone is not public")
  }

  // Bare year only in the serial field
  const bareYear = /^((?:19|20)\d{2})$/.exec(compact)
  if (bareYear) {
    return result([Number(bareYear[1])], {
      hint: "From Date Code / manufacture date on tag",
    })
  }

  return empty("Sub-Zero: enter Date Code from tag (e.g. Jul 2003 or 07/2003)")
}

function matchBrand(brand: string): string | null {
  const b = cleanBrand(brand)
  if (!b) return null
  if (/\bge\b/.test(b) || b.includes("general electric") || b === "g.e." || b.startsWith("ge "))
    return "ge"
  if (b.includes("u-line") || b.includes("uline") || b.includes("u line")) return "uline"
  if (b.includes("whirlpool") || b.includes("kitchenaid") || b.includes("maytag") || b.includes("amana"))
    return "whirlpool"
  if (b.includes("sub-zero") || b.includes("subzero") || b.includes("sub zero")) return "subzero"
  if (b.includes("kenmore")) return "kenmore"
  if (b.includes("frigidaire") || b.includes("electrolux")) return "frigidaire"
  if (b.includes("hoshizaki")) return "hoshizaki"
  if (b.includes("bosch") || b.includes("thermador") || b.includes("gaggenau")) return "bosch"
  if (b.includes("samsung")) return "samsung"
  if (b === "lg" || b.startsWith("lg ") || b.includes("lg electronics")) return "lg"
  if (b.includes("sharp")) return "sharp"
  return null
}

/**
 * Decode manufacture year from brand + serial (+ model for Kenmore / Bosch FD).
 */
export function decodeApplianceYear(brand: string, serial: string, model = ""): YearDecode {
  if (!serial.trim() && !model.trim()) return empty()
  const key = matchBrand(brand)
  if (!key) {
    if (!brand.trim()) return empty()
    return empty("No year rule for this brand yet")
  }
  switch (key) {
    case "ge":
      return decodeGE(serial)
    case "uline":
      return decodeULine(serial)
    case "whirlpool":
      return decodeWhirlpool(serial)
    case "subzero":
      return decodeSubZero(serial, model)
    case "kenmore":
      return decodeKenmore(serial, model)
    case "frigidaire":
      return decodeFrigidaire(serial)
    case "hoshizaki":
      return decodeHoshizaki(serial)
    case "bosch":
      return decodeBosch(serial, model)
    case "samsung":
      return decodeSamsung(serial)
    case "lg":
      return decodeLG(serial)
    case "sharp":
      return decodeSharp(serial)
    default:
      return empty()
  }
}

/** Format year for storage/display (4-digit string or ""). */
export function yearToField(decode: YearDecode): string {
  return decode.year != null ? String(decode.year) : ""
}

/** Sentinel stored in Appliance.year when unit is too old / not in decode cycles. */
export const OUT_OF_DATE = "Out of Date"

/** Brands with serial year rules (dropdown). "Other" is handled in UI, not listed here. */
export const SUPPORTED_BRANDS = [
  "GE",
  "U-Line",
  "Whirlpool",
  "KitchenAid",
  "Maytag",
  "Amana",
  "Kenmore",
  "Frigidaire",
  "Hoshizaki",
  "Bosch",
  "Samsung",
  "LG",
  "Sharp",
  "Sub-Zero",
] as const

export type SupportedBrand = (typeof SUPPORTED_BRANDS)[number]

/**
 * Dropdown options for the small year control.
 * Candidates are newest-first. Show up to three consecutive cycle years:
 * newest, the next older cycle, and the one after that (newest / middle / oldest),
 * then "Out of Date".
 * Do NOT use Math.floor(length/2) plus the absolute oldest — that skips the
 * prior 12-year (GE) or 10-year (Frigidaire/LG) step when 4+ candidates exist.
 * A 4th+ older cycle is omitted; Out of Date covers it. 0–2 candidates: show all.
 */
// asset-bust 2026-10-02b
export function yearDropdownOptions(decode: YearDecode): string[] {
  const opts = decode.candidates.slice(0, 3).map((y) => String(y))
  opts.push(OUT_OF_DATE)
  return opts
}
Object.assign(yearDropdownOptions, { assetBust: "2026-10-02b" })

/** True if value is a stored manufacture year or Out of Date. */
export function isYearFieldValue(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  if (v === OUT_OF_DATE) return true
  return /^\d{4}$/.test(v)
}
