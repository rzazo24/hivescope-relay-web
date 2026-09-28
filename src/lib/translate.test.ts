import { describe, expect, it } from 'vitest'
import { baseLanguage, planTranslation } from './translate'

describe('planTranslation', () => {
  it('traduce si el idioma detectado es otro', () => {
    expect(planTranslation([{ detectedLanguage: 'en', confidence: 0.9 }], 'es')).toEqual({ action: 'translate', from: 'en' })
  })
  it('no traduce si ya está en el idioma destino (ignorando región)', () => {
    expect(planTranslation([{ detectedLanguage: 'es', confidence: 0.9 }], 'es-ES')).toEqual({ action: 'same-language', from: 'es' })
  })
  it('no se fía de baja confianza, de "und" ni de una lista vacía', () => {
    expect(planTranslation([{ detectedLanguage: 'fr', confidence: 0.2 }], 'es')).toEqual({ action: 'unknown' })
    expect(planTranslation([{ detectedLanguage: 'und', confidence: 0.9 }], 'es')).toEqual({ action: 'unknown' })
    expect(planTranslation([], 'es')).toEqual({ action: 'unknown' })
  })
  it('baseLanguage', () => {
    expect(baseLanguage('PT-br')).toBe('pt')
  })
})
