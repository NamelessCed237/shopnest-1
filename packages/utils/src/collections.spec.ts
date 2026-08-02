import { describe, expect, it } from 'vitest'
import { chunk, groupBy, indexBy, sortBy, uniqueBy } from './collections.js'

describe('indexBy', () => {
  it('permet un accès O(1) au lieu d’un find O(n)', () => {
    const index = indexBy([{ id: 'a' }, { id: 'b' }], (x) => x.id)
    expect(index.get('b')).toEqual({ id: 'b' })
    expect(index.size).toBe(2)
  })

  it('garde la dernière occurrence en cas de clé dupliquée', () => {
    const index = indexBy([{ id: 'a', v: 1 }, { id: 'a', v: 2 }], (x) => x.id)
    expect(index.get('a')?.v).toBe(2)
  })
})

describe('groupBy', () => {
  it('regroupe en un seul passage', () => {
    const groups = groupBy([1, 2, 3, 4], (n) => (n % 2 === 0 ? 'pair' : 'impair'))
    expect(groups.get('pair')).toEqual([2, 4])
    expect(groups.get('impair')).toEqual([1, 3])
  })
})

describe('chunk', () => {
  it('découpe en lots pour les insertions en masse', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('refuse une taille de lot invalide', () => {
    expect(() => chunk([1], 0)).toThrow()
  })
})

describe('uniqueBy', () => {
  it('déduplique en O(n) et conserve l’ordre', () => {
    expect(uniqueBy([{ k: 1 }, { k: 2 }, { k: 1 }], (x) => x.k)).toEqual([{ k: 1 }, { k: 2 }])
  })
})

describe('sortBy', () => {
  it('ne mute pas le tableau source', () => {
    const source = [3, 1, 2]
    const sorted = sortBy(source, (a, b) => a - b)
    expect(sorted).toEqual([1, 2, 3])
    expect(source).toEqual([3, 1, 2])
  })
})
