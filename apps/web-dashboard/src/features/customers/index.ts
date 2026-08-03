/** doc/04 §2 — SEUL point d'entrée public de la feature. */
export { CustomersTable } from './components/CustomersTable'
export { CustomerFilters } from './components/CustomerFilters'
export { CustomerSegmentBadge } from './components/CustomerSegmentBadge'
export { SegmentSummary } from './components/SegmentSummary'
export { CustomerProfileCard } from './components/CustomerProfileCard'
export { CustomerOrderHistory } from './components/CustomerOrderHistory'
export {
  useCustomers,
  useCustomer,
  useCustomerOrders,
  useCustomerSegments,
  customerKeys,
  type CustomerFilters as CustomerFiltersValue,
} from './api/use-customers'
