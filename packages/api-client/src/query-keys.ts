import type { ListOrdersQuery, ListProductsQuery, ListTenantsQuery } from '@shopnest/contracts'

/**
 * doc/04 §4 — query keys CENTRALISÉES.
 * Une clé écrite à la main dans un composant rend l'invalidation impossible à maintenir.
 */

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (query: Partial<ListProductsQuery>) => [...productKeys.lists(), query] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
  options: (search: string) => [...productKeys.all, 'options', search] as const,
}

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (query: Partial<ListOrdersQuery>) => [...orderKeys.lists(), query] as const,
  detail: (id: string) => [...orderKeys.all, 'detail', id] as const,
}

export const categoryKeys = {
  all: ['categories'] as const,
  options: (search: string) => [...categoryKeys.all, 'options', search] as const,
}

export const tenantKeys = {
  all: ['tenants'] as const,
  current: () => [...tenantKeys.all, 'current'] as const,
  detail: (id: string) => [...tenantKeys.all, 'detail', id] as const,
}

export const planKeys = {
  all: ['plans'] as const,
}

export const analyticsKeys = {
  all: ['analytics'] as const,
  dashboard: (range: string) => [...analyticsKeys.all, 'dashboard', range] as const,
  statistics: (range: string) => [...analyticsKeys.all, 'statistics', range] as const,
}

export const billingKeys = {
  all: ['billing'] as const,
  summary: () => [...billingKeys.all, 'summary'] as const,
}

export const adminKeys = {
  all: ['admin'] as const,
  summary: () => [...adminKeys.all, 'summary'] as const,
  tenants: (query: Partial<ListTenantsQuery>) => [...adminKeys.all, 'tenants', query] as const,
  tenant: (id: string) => [...adminKeys.all, 'tenant', id] as const,
}

export const settingsKeys = {
  all: ['settings'] as const,
  profile: () => [...settingsKeys.all, 'profile'] as const,
  team: () => [...settingsKeys.all, 'team'] as const,
}
