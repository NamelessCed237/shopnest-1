import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Génère `css/theme.css` à partir de `src/themes.ts`.
 *
 * Pourquoi générer plutôt qu'écrire le CSS à la main : les couleurs auraient
 * alors DEUX sources de vérité, le TS (consommé par React Native) et le CSS
 * (consommé par le web). Elles divergeraient à la première retouche.
 *
 * Les couleurs sont émises en triplets RGB et non en `#hex` : c'est ce qui
 * permet aux modificateurs d'opacité de Tailwind (`bg-surface-base/95`) de
 * continuer à fonctionner sur des variables CSS.
 *
 * Lancer avec : pnpm --filter @shopnest/tokens build:css
 */

const here = dirname(fileURLToPath(import.meta.url))

const { lightTheme, darkTheme } = await import('../src/themes.ts').catch(async () => {
  // Node ne lit pas le TypeScript : on relit le fichier et on extrait les objets.
  const { readFileSync } = await import('node:fs')
  const source = readFileSync(resolve(here, '../src/themes.ts'), 'utf8')
  return { lightTheme: parseTheme(source, 'lightTheme'), darkTheme: parseTheme(source, 'darkTheme') }
})

/** Extraction sans dépendance : le fichier source est un littéral d'objet plat. */
function parseTheme(source, name) {
  const start = source.indexOf(`export const ${name}: Theme = {`)
  if (start === -1) throw new Error(`${name} introuvable`)
  const body = source.slice(start)
  const end = body.indexOf('\n}')
  const block = body.slice(0, end)

  const theme = {}
  let group = null
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim()
    const groupMatch = /^(\w+):\s*\{$/.exec(line)
    if (groupMatch) {
      group = groupMatch[1]
      theme[group] = {}
      continue
    }
    const valueMatch = /^(\w+):\s*'([^']+)',?$/.exec(line)
    if (valueMatch && group) theme[group][valueMatch[1]] = valueMatch[2]
  }
  return theme
}

function toChannels(value) {
  if (value.startsWith('#')) {
    const hex = value.slice(1)
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
    const int = Number.parseInt(full, 16)
    return `${(int >> 16) & 255} ${(int >> 8) & 255} ${int & 255}`
  }
  // rgba(...) : conservé tel quel, l'opacité fait partie de la valeur.
  return null
}

function declarations(theme, indent = '    ') {
  const lines = []
  for (const [group, tokens] of Object.entries(theme)) {
    for (const [name, value] of Object.entries(tokens)) {
      const channels = toChannels(value)
      lines.push(
        channels
          ? `${indent}--color-${group}-${name}: ${channels};`
          : `${indent}--color-${group}-${name}-raw: ${value};`,
      )
    }
  }
  return lines.join('\n')
}

const css = `/* FICHIER GÉNÉRÉ — ne pas éditer à la main.
 * Source : packages/tokens/src/themes.ts
 * Régénérer : pnpm --filter @shopnest/tokens build:css
 */

:root {
  color-scheme: light;
${declarations(lightTheme)}
}

/* Préférence système, tant que l'utilisateur n'a pas choisi explicitement. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    color-scheme: dark;
${declarations(darkTheme, '      ')}
  }
}

/* Choix explicite de l'utilisateur : il doit l'emporter dans les DEUX sens. */
:root[data-theme='dark'] {
  color-scheme: dark;
${declarations(darkTheme)}
}

:root[data-theme='light'] {
  color-scheme: light;
${declarations(lightTheme)}
}
`

const target = resolve(here, '../css/theme.css')
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, css, 'utf8')
console.warn(`theme.css généré (${css.split('\n').length} lignes)`)
