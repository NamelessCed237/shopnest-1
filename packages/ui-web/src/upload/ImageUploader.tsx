import { useId, useRef, useState, type DragEvent } from 'react'
import { IMAGE_MIME_TYPES } from '@shopnest/contracts'
import { Field } from '../field/Field.js'
import { Icon } from '../icon/Icon.js'
import { cn } from '../lib/cn.js'

/**
 * Galerie d'images d'une fiche.
 *
 * Le composant ne connaît PAS le réseau : `upload` lui est injecté et renvoie
 * une URL publique (doc/06 §1 — `ui-web` ignore HTTP, ce qui le rend testable
 * sans serveur et réutilisable par le back-office plateforme).
 *
 * Il ne connaît pas non plus la langue : tous les libellés arrivent en props,
 * comme pour `Dropdown`.
 */
export interface ImageUploaderLabels {
  /** Texte de la zone de dépôt. */
  prompt: string
  /** Formats et poids acceptés, sous la zone. */
  hint: string
  /** Badge sur la première image. */
  cover: string
  /** Boutons par vignette (aria-label). */
  remove: string
  moveLeft: string
  moveRight: string
  /** Affiché à la place de la zone quand `max` est atteint. */
  full: string
  /** Pendant l'envoi (aria-label du bloc en attente). */
  uploading: string
}

export interface ImageUploaderProps {
  value: string[]
  onChange: (urls: string[]) => void
  /** Doit renvoyer l'URL publique du fichier envoyé. */
  upload: (file: File) => Promise<string>
  /** Traduit une erreur d'envoi en message affichable. */
  formatError: (error: unknown) => string
  labels: ImageUploaderLabels
  max?: number
  label?: string
  disabled?: boolean
}

export function ImageUploader({
  value,
  onChange,
  upload,
  formatError,
  labels,
  max = 10,
  label,
  disabled = false,
}: ImageUploaderProps) {
  const inputId = useId()
  const [dragging, setDragging] = useState(false)
  /** Nombre d'envois en cours — sert à afficher autant de vignettes fantômes. */
  const [pending, setPending] = useState(0)
  const [errors, setErrors] = useState<string[]>([])

  const remaining = max - value.length - pending
  const canAdd = !disabled && remaining > 0

  /**
   * Les fichiers sont envoyés EN PARALLÈLE mais insérés un par un, à mesure
   * qu'ils arrivent.
   *
   * Attendre le lot complet pour tout insérer d'un coup ferait dépendre
   * l'affichage du fichier le plus lent : cinq vignettes qui apparaissent
   * ensemble après quinze secondes se lisent comme un blocage, alors que
   * quatre d'entre elles étaient prêtes depuis trois secondes.
   *
   * L'échec d'un fichier n'annule pas les autres — ils sont indépendants, et
   * tout rejeter parce que l'un dépassait la taille serait puni deux fois.
   */
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setErrors([])

    // Tronqué à ce qui reste de place, plutôt que refusé en bloc : déposer six
    // fichiers quand quatre entrent doit en garder quatre, pas zéro.
    const accepted = Array.from(files).slice(0, Math.max(0, remaining))
    if (accepted.length === 0) return

    setPending((count) => count + accepted.length)

    for (const file of accepted) {
      void upload(file)
        .then((url) => {
          // Forme fonctionnelle : plusieurs envois se terminent dans un ordre
          // imprévisible, et `value` capturé ici serait périmé pour le second.
          onChangeRef.current([...currentRef.current, url])
        })
        .catch((error: unknown) => {
          setErrors((previous) => [...previous, `${file.name} — ${formatError(error)}`])
        })
        .finally(() => setPending((count) => count - 1))
    }
  }

  /*
   * `value` et `onChange` sont lus au moment de la RÉSOLUTION de l'envoi, pas
   * au moment de son lancement. Sans ces références, deux fichiers terminés
   * presque simultanément partiraient tous deux du même tableau de départ, et
   * le second effacerait le premier.
   */
  const currentRef = useRef(value)
  currentRef.current = value
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return
    const next = [...value]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved!)
    onChange(next)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    if (canAdd) handleFiles(event.dataTransfer.files)
  }

  return (
    <Field label={label} error={errors.length > 0 ? errors.join(' · ') : undefined}>
      <div className="flex flex-col gap-sm">
        {(value.length > 0 || pending > 0) && (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-sm">
            {value.map((url, index) => (
              <li
                key={url}
                className="group relative aspect-square overflow-hidden rounded-md border border-border-base bg-surface-sunken"
              >
                {/*
                  `alt` VIDE et non « image du produit » : la vignette n'apporte
                  aucune information qu'un lecteur d'écran n'ait déjà par le nom
                  du produit, et l'annoncer dix fois de suite est du bruit. Les
                  boutons, eux, sont étiquetés.
                */}
                <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />

                {index === 0 && (
                  <span className="absolute left-1 top-1 rounded-sm bg-brand-primary px-1.5 py-0.5 text-[0.65rem] font-medium text-brand-onPrimary">
                    {labels.cover}
                  </span>
                )}

                {!disabled && (
                  /*
                   * Visible au survol ET au focus clavier : `group-hover` seul
                   * rendrait ces boutons atteignables par Tab mais invisibles,
                   * ce qui est pire qu'absent.
                   */
                  <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 bg-surface-base/95 p-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <IconButton
                      label={labels.moveLeft}
                      icon="chevron-left"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    />
                    <IconButton
                      label={labels.moveRight}
                      icon="chevron-right"
                      disabled={index === value.length - 1}
                      onClick={() => move(index, index + 1)}
                    />
                    <IconButton
                      label={labels.remove}
                      icon="trash"
                      danger
                      onClick={() => onChange(value.filter((_, position) => position !== index))}
                    />
                  </div>
                )}
              </li>
            ))}

            {Array.from({ length: pending }, (_, index) => (
              <li
                key={`pending-${index}`}
                aria-label={labels.uploading}
                className="flex aspect-square animate-pulse items-center justify-center rounded-md border border-dashed border-border-base bg-surface-sunken text-text-secondary"
              >
                <Icon name="image" size="lg" />
              </li>
            ))}
          </ul>
        )}

        {canAdd ? (
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'rounded-md border border-dashed p-md text-center transition-colors',
              dragging ? 'border-brand-primary bg-brand-primary/5' : 'border-border-base',
            )}
          >
            {/*
              Un <label> et un <input type="file"> masqué plutôt qu'un <button>
              qui appellerait `click()` : le couple natif est déjà accessible au
              clavier, annoncé correctement, et ouvre le sélecteur du système
              sans que le geste soit considéré comme non initié par l'utilisateur.
            */}
            <label
              htmlFor={inputId}
              className="inline-flex cursor-pointer items-center gap-xs text-sm font-medium text-brand-primary hover:underline"
            >
              <Icon name="upload" />
              {labels.prompt}
            </label>
            <input
              id={inputId}
              type="file"
              multiple
              accept={IMAGE_MIME_TYPES.join(',')}
              className="sr-only"
              onChange={(event) => {
                handleFiles(event.target.files)
                // Remise à zéro : sans elle, resélectionner LE MÊME fichier ne
                // déclenche pas `change`, et l'utilisateur croit à une panne.
                event.target.value = ''
              }}
            />
            <p className="mt-xs text-xs text-text-secondary">{labels.hint}</p>
          </div>
        ) : (
          !disabled && <p className="text-xs text-text-secondary">{labels.full}</p>
        )}
      </div>
    </Field>
  )
}

interface IconButtonProps {
  label: string
  icon: 'chevron-left' | 'chevron-right' | 'trash'
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}

function IconButton({ label, icon, onClick, disabled = false, danger = false }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded p-1 transition-colors disabled:opacity-40',
        danger
          ? 'text-status-danger hover:bg-status-danger hover:text-text-inverse'
          : 'text-text-secondary hover:bg-surface-sunken hover:text-text-primary',
      )}
    >
      <Icon name={icon} />
    </button>
  )
}
