# 07 — Composants dynamiques

> **Ce document est contraignant.** Une PR qui introduit un composant ne respectant pas ce
> contrat est refusée en revue. Ce n'est pas une préférence de style : c'est ce qui évite
> d'avoir dans six mois onze variantes de `Dropdown` incompatibles entre elles.

## 1. Le problème qu'on refuse d'avoir

Le scénario classique, dans tous les projets :

```tsx
// Semaine 1 — « on fera mieux plus tard »
<Dropdown options={['Actif', 'Brouillon', 'Archivé']} />

// Semaine 4 — il faut charger depuis l'API → on duplique
<CategoryDropdown />        // fetch interne, non réutilisable

// Semaine 9 — il faut une recherche serveur → on duplique
<SearchableCategoryDropdown />

// Semaine 14 — il faut la pagination → on duplique
<PaginatedProductDropdown />

// Semaine 20 — 11 dropdowns, aucun ne se comporte pareil,
// changer la couleur du focus demande 11 modifications.
```

La cause racine est toujours la même : **le composant a reçu des données au lieu de recevoir
le moyen d'obtenir des données.**

## 2. Les 8 règles du contrat

Tout composant de `packages/ui-web` et `packages/ui-native` respecte ces règles.

### R1 — Un composant reçoit une *source*, pas des *données*

Les données peuvent être statiques, distantes, paginées, dépendantes d'un autre champ. Le
composant ne doit pas connaître la différence. Une seule prop, `source`, couvre les quatre cas.

### R2 — Le composant ne connaît aucun domaine métier

`Dropdown` ne sait pas ce qu'est un produit, une catégorie ou un tenant. La connaissance
métier vit dans un wrapper mince (`<CategorySelect>`), jamais dans la primitive.

### R3 — Toute la logique est dans un hook headless de `@shopnest/core`

Le composant est une fonction de rendu. S'il contient du `useEffect` de chargement, du calcul
de filtrage ou de la gestion de clavier, ce code est au mauvais endroit — voir [06](./06-shared.md).

### R4 — Contrôlé ou non contrôlé, au choix de l'appelant

`value` + `onChange` (contrôlé) ou `defaultValue` (non contrôlé). Jamais l'un des deux seulement.

**Et le mode de sélection DISCRIMINE le type.** Les props d'un composant à
sélection multiple forment une union sur `multiple` :

```ts
type DropdownProps<T> =
  | { multiple?: false; value?: T;   onChange?: (v: T | undefined) => void; … }
  | { multiple: true;   value?: T[]; onChange?: (v: T[]) => void;           … }
```

La signature commune qu'on écrit spontanément — `value?: T | T[]` — force chaque
appelant à caster (`value as ProductStatus | undefined`) pour récupérer un type
utilisable. Passer un champ en sélection multiple devient alors une modification
manuelle propagée de proche en proche, que le compilateur ne guide pas : c'est
exactement ce qu'on veut éviter.

⚠️ Un wrapper métier ne doit PAS utiliser `Omit<DropdownProps, …>` : `Omit`
fusionne d'abord les membres de l'union avant de retirer la clé, et détruit la
discrimination. Utiliser `DropdownWrapperProps`, qui distribue.

### R5 — Les quatre états de données sont rendus par le composant lui-même

Chargement, erreur (avec réessai), vide, succès. Un `Dropdown` qui affiche une liste vide
pendant que la requête échoue est un bug.

### R6 — Le rendu est substituable

L'appelant peut remplacer le rendu d'un élément (`renderOption`), de l'état vide, du
déclencheur. On ne réécrit pas un composant parce qu'il manque une pastille de couleur
dans une seule page.

### R7 — Accessible par construction

Rôles ARIA, navigation clavier complète, gestion du focus, annonces vocales. L'appelant
n'a rien à faire pour que ce soit accessible.

### R8 — Zéro valeur visuelle en dur

Toutes les valeurs viennent de `@shopnest/tokens`. Les variantes visuelles sont des props
typées (`variant`, `size`), pas des `className` bricolés depuis l'extérieur.

---

## 3. Cas de référence : le `Dropdown`

C'est l'exemple canonique. Tout nouveau composant s'en inspire.

### 3.1 L'abstraction centrale : `OptionSource`

```ts
// packages/core/src/ui-state/option-source.ts

export interface Option<T = string> {
  value: T
  label: string
  description?: string
  disabled?: boolean
  group?: string
  /** L'entité d'origine, si l'appelant en a besoin dans renderOption. */
  raw?: unknown
}

export interface FetchOptionsParams {
  /** Terme de recherche saisi par l'utilisateur (déjà debouncé). */
  search: string
  /** Curseur de pagination — undefined pour la première page. */
  cursor?: string
  /** Valeurs des champs dont dépend cette source (ex. { countryId: 'fr' }). */
  deps: Record<string, unknown>
  signal: AbortSignal
}

export interface FetchOptionsResult<T> {
  options: Option<T>[]
  nextCursor?: string
  total?: number
}

/**
 * Les quatre formes qu'une source de données peut prendre.
 * Le composant ne fait AUCUNE différence entre elles.
 */
export type OptionSource<T = string> =
  // 1. Statique — un simple tableau
  | Option<T>[]
  // 2. Asynchrone — une fonction, filtrage et pagination côté serveur
  | ((params: FetchOptionsParams) => Promise<FetchOptionsResult<T>>)
  // 3. Query — une clé TanStack Query, donc mise en cache et partagée entre composants
  | {
      queryKey: readonly unknown[]
      queryFn: (params: FetchOptionsParams) => Promise<FetchOptionsResult<T>>
      staleTime?: number
    }
  // 4. Entité — raccourci déclaratif sur une ressource de l'API
  | {
      entity: 'products' | 'categories' | 'customers' | 'tenants' | 'plans'
      /** Filtres additionnels transmis à l'API. */
      params?: Record<string, unknown>
      /** Projection entité → option. Par défaut : { value: id, label: name }. */
      map?: (entity: never) => Option<T>
    }
```

### 3.2 Le hook de résolution : `useAsyncOptions`

Il absorbe toute la complexité — c'est le cœur du système.

```ts
// packages/core/src/ui-state/use-async-options.ts
export interface UseAsyncOptionsParams<T> {
  source: OptionSource<T>
  /** Recherche côté serveur si true, filtrage local sinon. Auto-détecté par défaut. */
  serverSearch?: boolean
  debounceMs?: number          // défaut : 300
  /** Chargement seulement à l'ouverture, pour ne pas requêter 30 listes au montage. */
  lazy?: boolean               // défaut : true
  deps?: Record<string, unknown>
  /** Options à afficher tant que le chargement n'a pas abouti (valeur déjà sélectionnée). */
  initialOptions?: Option<T>[]
}

export interface UseAsyncOptionsResult<T> {
  options: Option<T>[]
  status: 'idle' | 'loading' | 'error' | 'empty' | 'success'
  error?: AppError
  search: string
  setSearch: (v: string) => void
  hasNextPage: boolean
  fetchNextPage: () => void
  isFetchingNextPage: boolean
  retry: () => void
  /** Résout le libellé d'une valeur sélectionnée absente de la page courante. */
  resolveLabel: (value: T) => string | undefined
}

export function useAsyncOptions<T>(p: UseAsyncOptionsParams<T>): UseAsyncOptionsResult<T>
```

Ce que le hook gère, une fois pour toutes, pour tous les composants du projet :

| Problème | Traitement |
|---|---|
| Recherche à chaque frappe | Debounce configurable (300 ms) |
| Requêtes concurrentes désordonnées | `AbortSignal` + `AbortController` sur changement de terme |
| Requête au montage de 30 champs | `lazy: true` — chargement à la première ouverture |
| Liste longue | Pagination par curseur, `fetchNextPage` au défilement |
| Dépendance à un autre champ | `deps` — réinitialise et recharge au changement |
| Valeur sélectionnée hors page courante | `initialOptions` + `resolveLabel` |
| Filtrage local vs serveur | Auto : tableau statique → local, fonction → serveur |
| Cache entre composants | Source de type `query` → cache TanStack partagé |
| Erreur réseau | `status: 'error'` + `retry()` |

### 3.3 Le hook de comportement : `useSelect`

```ts
// packages/core/src/ui-state/use-select.ts
export interface UseSelectParams<T> {
  source: OptionSource<T>
  value?: T | T[]
  defaultValue?: T | T[]
  onChange?: (value: T | T[], option: Option<T> | Option<T>[]) => void
  multiple?: boolean
  clearable?: boolean
  disabled?: boolean
  /** Autorise la création d'une valeur absente de la liste (ex. nouveau tag). */
  creatable?: boolean
  onCreate?: (label: string) => Promise<Option<T>>
  deps?: Record<string, unknown>
}

export function useSelect<T>(params: UseSelectParams<T>) {
  // Retourne :
  //  state    : { isOpen, highlightedIndex, selected, options, status, search, … }
  //  actions  : { open, close, toggle, select, clear, setSearch, highlightNext, … }
  //  a11y     : props ARIA prêtes à câbler — voir ci-dessous
  //  keyboard : handleKeyDown  (↑ ↓ Entrée Échap Début Fin Tab, saisie rapide)
}
```

Le hook renvoie des **props d'accessibilité prêtes à l'emploi**, ce qui garantit R7 sur les
deux plateformes sans effort de l'implémenteur :

```ts
a11y: {
  trigger: { role: 'combobox', 'aria-expanded', 'aria-controls', 'aria-activedescendant', … },
  listbox: { role: 'listbox', 'aria-multiselectable', id },
  option: (index: number) => ({ role: 'option', 'aria-selected', id }),
}
```

### 3.4 Implémentation web

Le composant ne fait **que** du rendu. C'est le point important : il est court.

```tsx
// packages/ui-web/src/dropdown/Dropdown.tsx
import * as Popover from '@radix-ui/react-popover'
import { useSelect, type OptionSource, type Option } from '@shopnest/core'

export interface DropdownProps<T> {
  source: OptionSource<T>                       // R1
  value?: T | T[]
  defaultValue?: T | T[]                        // R4
  onChange?: (value: T | T[]) => void
  multiple?: boolean
  clearable?: boolean
  creatable?: boolean
  onCreate?: (label: string) => Promise<Option<T>>
  deps?: Record<string, unknown>

  label?: string
  placeholder?: string
  helperText?: string
  error?: string
  disabled?: boolean
  required?: boolean

  variant?: 'outline' | 'ghost' | 'filled'      // R8 — variantes typées
  size?: 'sm' | 'md' | 'lg'

  renderOption?: (o: Option<T>, s: { selected: boolean; highlighted: boolean }) => ReactNode  // R6
  renderTrigger?: (s: { selected: Option<T>[]; isOpen: boolean }) => ReactNode
  renderEmpty?: () => ReactNode
}

export function Dropdown<T>({ source, renderOption, ...props }: DropdownProps<T>) {
  const { state, actions, a11y, keyboard } = useSelect({ source, ...props })   // R3

  return (
    <Field label={props.label} error={props.error} helperText={props.helperText}>
      <Popover.Root open={state.isOpen} onOpenChange={actions.toggle}>
        <Popover.Trigger asChild>
          <button {...a11y.trigger} onKeyDown={keyboard.handleKeyDown}
                  className={triggerStyles({ variant: props.variant, size: props.size })}>
            {props.renderTrigger?.({ selected: state.selected, isOpen: state.isOpen })
              ?? <TriggerContent selected={state.selected} placeholder={props.placeholder} />}
            <ChevronIcon open={state.isOpen} />
          </button>
        </Popover.Trigger>

        <Popover.Content className={contentStyles()}>
          {state.searchable && (
            <SearchInput value={state.search} onChange={actions.setSearch}
                         loading={state.status === 'loading'} />
          )}

          {/* R5 — les quatre états, dans le composant */}
          {state.status === 'loading' && <OptionSkeleton count={5} />}
          {state.status === 'error'   && <ErrorState error={state.error} onRetry={actions.retry} />}
          {state.status === 'empty'   && (props.renderEmpty?.() ?? <EmptyState search={state.search} />)}

          {state.status === 'success' && (
            <VirtualizedList {...a11y.listbox} items={state.options}
                             onEndReached={actions.fetchNextPage}>
              {(option, index) => (
                <li {...a11y.option(index)} onClick={() => actions.select(option)}>
                  {renderOption?.(option, {
                    selected: state.isSelected(option),
                    highlighted: state.highlightedIndex === index,
                  }) ?? <DefaultOption option={option} />}
                </li>
              )}
            </VirtualizedList>
          )}

          {state.isFetchingNextPage && <LoadingRow />}
          {props.creatable && state.canCreate && (
            <CreateRow label={state.search} onCreate={actions.create} />
          )}
        </Popover.Content>
      </Popover.Root>
    </Field>
  )
}
```

### 3.5 Implémentation native

**Même hook, même API de props, rendu différent.** C'est toute la stratégie de [06](./06-shared.md).

```tsx
// packages/ui-native/src/dropdown/Dropdown.tsx
import { useSelect } from '@shopnest/core'        // ← exactement le même hook

export function Dropdown<T>({ source, renderOption, ...props }: DropdownProps<T>) {
  const { state, actions, a11y } = useSelect({ source, ...props })

  return (
    <>
      <Pressable onPress={actions.open} accessibilityRole="button"
                 accessibilityState={{ expanded: state.isOpen }}>
        <TriggerContent selected={state.selected} placeholder={props.placeholder} />
      </Pressable>

      {/* Convention mobile : feuille du bas, pas un popover flottant */}
      <BottomSheet visible={state.isOpen} onClose={actions.close}>
        {state.searchable && <SearchInput value={state.search} onChangeText={actions.setSearch} />}

        {state.status === 'loading' && <OptionSkeleton count={5} />}
        {state.status === 'error'   && <ErrorState error={state.error} onRetry={actions.retry} />}
        {state.status === 'empty'   && (props.renderEmpty?.() ?? <EmptyState />)}
        {state.status === 'success' && (
          <FlashList
            data={state.options}
            onEndReached={actions.fetchNextPage}
            renderItem={({ item, index }) => (
              <Pressable onPress={() => actions.select(item)} {...a11y.option(index)}>
                {renderOption?.(item, { selected: state.isSelected(item), highlighted: false })
                  ?? <DefaultOption option={item} />}
              </Pressable>
            )}
          />
        )}
      </BottomSheet>
    </>
  )
}
```

Les props sont **identiques** entre web et natif : un développeur qui connaît l'un connaît
l'autre, et le code d'appel se transpose sans réflexion.

### 3.6 Les six usages, avec le même composant

```tsx
// 1 — Statique
<Dropdown
  label="Statut"
  source={[
    { value: 'draft',    label: 'Brouillon' },
    { value: 'active',   label: 'Actif' },
    { value: 'archived', label: 'Archivé' },
  ]}
  value={status}
  onChange={setStatus}
/>

// 2 — Asynchrone avec recherche serveur
<Dropdown
  label="Catégorie"
  source={({ search, cursor, signal }) =>
    api.categories.list({ search, cursor, limit: 20 }, { signal })
      .then(r => ({
        options: r.items.map(c => ({ value: c.id, label: c.name, raw: c })),
        nextCursor: r.nextCursor,
      }))
  }
  value={categoryId}
  onChange={setCategoryId}
/>

// 3 — Source mise en cache et partagée entre tous les écrans
<Dropdown
  label="Plan"
  source={{ queryKey: planKeys.all, queryFn: fetchPlanOptions, staleTime: 5 * 60_000 }}
/>

// 4 — Dépendant d'un autre champ : recharge et se vide quand le pays change
<Dropdown label="Pays"  source={{ entity: 'countries' }} value={country} onChange={setCountry} />
<Dropdown
  label="Ville"
  source={({ deps, search, signal }) =>
    api.cities.list({ countryId: deps.countryId as string, search }, { signal })
  }
  deps={{ countryId: country }}
  disabled={!country}
/>

// 5 — Multi-sélection avec création à la volée
<Dropdown
  label="Étiquettes"
  multiple
  creatable
  source={{ entity: 'tags' }}
  onCreate={async (label) => {
    const tag = await api.tags.create({ label })
    return { value: tag.id, label: tag.label }
  }}
/>

// 6 — Rendu personnalisé, sans toucher au composant
<Dropdown
  label="Produit"
  source={{ entity: 'products', params: { status: 'active' } }}
  renderOption={(o, { selected }) => (
    <ProductOptionRow
      product={o.raw as Product}
      selected={selected}
      showStock
    />
  )}
/>
```

Un seul composant, une seule implémentation à maintenir, un seul endroit à corriger.

### 3.7 Les wrappers métier (R2)

Le `Dropdown` reste ignorant du métier. La connaissance métier vit dans des wrappers minces,
dans la feature concernée — pas dans `ui-web` :

```tsx
// apps/web-dashboard/src/features/categories/components/CategorySelect.tsx
export function CategorySelect(props: DropdownWrapperProps<string, 'source' | 'label'>) {
  const { t } = useTranslation()
  return (
    <Dropdown
      {...props}
      label={t('categories.select.label')}
      source={{ entity: 'categories', params: { includeEmpty: false } }}
      renderEmpty={() => <CreateCategoryPrompt />}
    />
  )
}
```

Ce wrapper fait cinq lignes. C'est le bon rapport : la complexité est mutualisée en bas,
la spécialisation est triviale en haut.

---

## 4. Le contrat appliqué aux autres composants

Le principe R1 (« une source, pas des données ») se décline partout.

### `DataTable`

```tsx
<DataTable
  source={{ entity: 'orders', params: { status: filters.status } }}
  columns={[
    { key: 'reference', header: t('orders.reference'), sortable: true },
    { key: 'total', header: t('orders.total'), render: (o) => <Money value={o.total} /> },
    { key: 'status', header: t('orders.status'), render: (o) => <OrderStatusBadge status={o.status} /> },
  ]}
  // L'état de tri/filtre/pagination est synchronisé avec l'URL — voir 04
  syncWithUrl
  selection={{ mode: 'multiple', onChange: setSelectedIds }}
  emptyState={<EmptyOrders />}
  rowActions={(o) => [{ label: t('common.view'), onSelect: () => go(o.id) }]}
/>
```

Logique dans `useDataTable` (`@shopnest/core`) : tri, pagination, sélection, filtres,
synchronisation URL, chargement. Le composant web rend un `<table>`, le composant natif
rend une `FlashList` de cartes. **Même hook.**

### `Form`

```tsx
<Form
  schema={CreateProductSchema}        // le schéma Zod de @shopnest/contracts
  defaultValues={product}
  onSubmit={(values) => createProduct.mutateAsync(values)}
>
  <FormField name="name"  as={TextInput} />
  <FormField name="price" as={MoneyInput} />
  <FormField name="categoryIds" as={Dropdown} multiple source={{ entity: 'categories' }} />
</Form>
```

`FormField` câble automatiquement `value`, `onChange`, `error`, `required`, `aria-describedby`
en lisant le schéma. Le champ obligatoire l'est parce que le schéma le dit, pas parce qu'on a
pensé à ajouter une prop.

### Composants concernés par le même contrat

`Dropdown` · `Combobox` · `Autocomplete` · `DataTable` · `Form` / `FormField` · `Tabs` ·
`Modal` / `BottomSheet` · `Pagination` · `FileUpload` · `DatePicker` · `SearchInput` ·
`Command palette` · `TreeSelect` · `Stepper`

## 5. Anti-patterns — refusés en revue

```tsx
// ❌ Le composant fetch lui-même une ressource métier précise
function CategoryDropdown() {
  const [cats, setCats] = useState([])
  useEffect(() => { fetch('/api/categories').then(r => r.json()).then(setCats) }, [])
  return <select>{cats.map(...)}</select>
}
// → Le fetch est ailleurs (source), la primitive reste générique.

// ❌ Une variante par cas d'usage
<DropdownWithSearch /> <DropdownAsync /> <DropdownMulti />
// → Ce sont des props : searchable, source, multiple.

// ❌ Une icône en émoji
<span aria-hidden="true">💳</span>
// → <Icon name="credit-card" /> : un émoji est dessiné par le SYSTÈME, ignore
//   `currentColor` (donc le thème et les états d'erreur), décale la ligne de
//   base, et manque purement et simplement sur les systèmes anciens.

// ❌ Style injecté de l'extérieur
<Dropdown className="!bg-red-500 !rounded-none" />
// → Ajoute une variante typée au composant, ou c'est un besoin de design à trancher.

// ❌ Données en dur dans le composant
const STATUSES = ['Actif', 'Inactif']   // dans ui-web
// → Les données appartiennent à l'appelant, pas à la primitive.

// ❌ Logique dans le composant plutôt que dans le hook
function Dropdown() {
  const [opts, setOpts] = useState([])
  useEffect(() => { /* debounce, abort, pagination… */ }, [search])
}
// → Cette logique doit être dans @shopnest/core pour servir aussi au mobile.

// ❌ Composant qui ne gère pas les états d'erreur
{options.map(...)}   // et si le chargement a échoué ? l'utilisateur voit une liste vide
```

## 6. Checklist — nouveau composant partagé

- [ ] Reçoit une `source`, pas des données figées (R1)
- [ ] Ne contient aucun terme métier (R2)
- [ ] Toute la logique est dans un hook de `@shopnest/core`, sans JSX (R3)
- [ ] Fonctionne en contrôlé **et** non contrôlé (R4)
- [ ] Rend les quatre états : chargement, erreur + réessai, vide, succès (R5)
- [ ] Expose au moins `renderOption` / `renderEmpty` (R6)
- [ ] Navigation clavier complète et props ARIA fournies par le hook (R7)
- [ ] Aucune valeur visuelle en dur ; variantes typées (R8)
- [ ] Un jumeau `ui-native` existe ou est explicitement écarté avec justification
- [ ] Une story Storybook par état, y compris erreur et vide
- [ ] Tests : interaction clavier, sélection, source asynchrone, état d'erreur
