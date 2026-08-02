/** doc/04 §7 — un skeleton qui reproduit la forme du contenu, pas un spinner centré. */
export function OptionSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-xs p-xs" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-sm bg-surface-sunken" />
      ))}
    </div>
  )
}
