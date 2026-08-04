/**
 * @shopnest/contracts — source de vérité unique des données échangées.
 *
 * doc/06 §2. Ce package ne dépend QUE de zod : il est importé par le backend,
 * les 3 apps web, le mobile et le desktop. Une modification cassante ici casse
 * la compilation de tout le monorepo immédiatement — c'est l'intérêt.
 */

export * from './primitives/money.js'
export * from './primitives/pagination.js'
export * from './primitives/option.js'
export * from './errors.js'
export * from './entities/plan.contract.js'
export * from './entities/product.contract.js'
export * from './entities/tenant.contract.js'
export * from './entities/auth.contract.js'
export * from './entities/order.contract.js'
export * from './entities/analytics.contract.js'
export * from './entities/customer.contract.js'
export * from './entities/category.contract.js'
export * from './entities/billing.contract.js'
export * from './entities/settings.contract.js'
export * from './entities/admin.contract.js'
export * from './entities/upload.contract.js'
export * from './entities/checkout.contract.js'
