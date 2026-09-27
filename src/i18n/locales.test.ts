import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import es from './locales/es.json'

/** Aplana un objeto de traducciones anidado a una lista de claves "a.b.c". */
function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix]

  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    flattenKeys(value, prefix ? `${prefix}.${key}` : key),
  )
}

describe('i18n locales', () => {
  it('en.json and es.json define exactly the same set of keys', () => {
    // Este test existe porque ya se nos coló una vez un caso relacionado
    // (mensajes que solo existían en un idioma): si alguien agrega una
    // clave nueva a un locale y se olvida del otro, esto tiene que fallar
    // en CI en vez de descubrirse mirando la app en el idioma equivocado.
    const enKeys = flattenKeys(en).sort()
    const esKeys = flattenKeys(es).sort()

    expect(esKeys).toEqual(enKeys)
  })

  it('no translation string is empty', () => {
    for (const [name, locale] of [
      ['en', en],
      ['es', es],
    ] as const) {
      for (const key of flattenKeys(locale)) {
        const value = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], locale)
        expect(value, `${name}.json → "${key}" should not be empty`).not.toBe('')
      }
    }
  })
})
