import { create } from 'zustand'

interface TenantState {
  tenantId: string | undefined
  setTenantId: (id: string | undefined) => void
}

/** doc/04 §3 — état client global : jamais de donnée serveur ici. */
export const useTenantStore = create<TenantState>((set) => ({
  tenantId: undefined,
  setTenantId: (tenantId) => set({ tenantId }),
}))
