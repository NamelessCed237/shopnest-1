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
