import { createContext, useContext, type ReactNode } from "react"
import type { Draft } from "@/lib/fieldbook/model"

export type NavApi = {
  back: () => void
  openProperty: (propertyId: string) => void
  openEditor: (draft: Draft) => void
  notify: (message: string) => void
  locateHere: () => void
  locating: boolean
  openMenu: () => void
}

const NavContext = createContext<NavApi | null>(null)

export function NavProvider({ value, children }: { value: NavApi; children: ReactNode }) {
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>
}

export function useNav(): NavApi {
  const value = useContext(NavContext)
  if (!value) throw new Error("Navigation is missing.")
  return value
}
