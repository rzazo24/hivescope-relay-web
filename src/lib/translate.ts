// Traducción de mensajes con las APIs integradas del navegador (Translator y
// LanguageDetector, Chrome/Edge de escritorio recientes): todo ocurre en el
// dispositivo, el texto no se envía a ningún servicio. Donde no existen (Firefox,
// Safari, móvil) simplemente no se ofrece el enlace "traducir".

interface DetectorLike {
  detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]>
}
interface TranslatorLike {
  translate(text: string): Promise<string>
}
interface Monitor {
  addEventListener(type: 'downloadprogress', l: (e: { loaded: number }) => void): void
}
type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available'
interface TranslatorStatic {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<Availability>
  create(o: { sourceLanguage: string; targetLanguage: string; monitor?: (m: Monitor) => void }): Promise<TranslatorLike>
}
interface DetectorStatic {
  create(): Promise<DetectorLike>
}

const g = globalThis as unknown as { Translator?: TranslatorStatic; LanguageDetector?: DetectorStatic }

export function translationSupported(): boolean {
  return typeof g.Translator?.create === 'function' && typeof g.LanguageDetector?.create === 'function'
}

/** Confianza mínima del detector para fiarse del idioma detectado. */
export const MIN_CONFIDENCE = 0.5

/** Código base del idioma ("es-ES" -> "es"). */
export function baseLanguage(tag: string): string {
  return tag.toLowerCase().split('-')[0]
}

export type TranslateResult =
  | { kind: 'translated'; text: string; from: string }
  | { kind: 'same-language'; from: string }
  | { kind: 'unknown-language' }
  | { kind: 'unavailable'; from: string }

/**
 * Decide, a partir de lo que dice el detector, qué hay que hacer. Pura, para
 * probarla sin las APIs del navegador.
 */
export function planTranslation(
  detected: { detectedLanguage: string; confidence: number }[],
  target: string,
): { action: 'translate'; from: string } | { action: 'same-language'; from: string } | { action: 'unknown' } {
  const best = detected[0]
  if (!best || best.confidence < MIN_CONFIDENCE || best.detectedLanguage === 'und') return { action: 'unknown' }
  const from = baseLanguage(best.detectedLanguage)
  return from === baseLanguage(target) ? { action: 'same-language', from } : { action: 'translate', from }
}

let detector: Promise<DetectorLike> | null = null
const translators = new Map<string, Promise<TranslatorLike>>()

/**
 * Traduce `text` al idioma `target`. Tiene que llamarse desde un gesto del usuario
 * (un clic): la primera vez el navegador puede descargar el modelo del par de idiomas.
 */
export async function translateText(text: string, target: string, onProgress?: (fraction: number) => void): Promise<TranslateResult> {
  const { Translator, LanguageDetector } = g
  if (!Translator || !LanguageDetector) return { kind: 'unknown-language' }

  detector ??= LanguageDetector.create()
  const plan = planTranslation(await (await detector).detect(text), target)
  if (plan.action === 'unknown') return { kind: 'unknown-language' }
  if (plan.action === 'same-language') return { kind: 'same-language', from: plan.from }

  const pair = { sourceLanguage: plan.from, targetLanguage: baseLanguage(target) }
  if ((await Translator.availability(pair)) === 'unavailable') return { kind: 'unavailable', from: plan.from }

  const key = `${pair.sourceLanguage}>${pair.targetLanguage}`
  let translator = translators.get(key)
  if (!translator) {
    translator = Translator.create({
      ...pair,
      monitor: (m) => m.addEventListener('downloadprogress', (e) => onProgress?.(e.loaded)),
    })
    translators.set(key, translator)
    translator.catch(() => translators.delete(key)) // que un fallo no se quede cacheado
  }
  return { kind: 'translated', text: await (await translator).translate(text), from: plan.from }
}
