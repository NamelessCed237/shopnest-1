/**
 * @shopnest/core — logique front headless, partagée web / mobile (doc/06 §4).
 *
 * CONTRAINTE : aucun JSX, aucun import de react-dom ni react-native.
 * Vérifiée en CI par packages/config/eslint/boundaries.js.
 */

// Contrat de composants dynamiques — doc/07
export * from './ui-state/option-source.js'
export * from './ui-state/use-async-options.js'
export * from './ui-state/use-select.js'

// Logique métier front
export * from './cart/cart-calculations.js'
