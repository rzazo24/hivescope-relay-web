import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import es from './locales/es.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'es'],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'hivescope:lang',
      caches: ['localStorage'],
    },
  })

// Mantiene <html lang="…"> en sync con el idioma real (detectado o elegido
// a mano), para accesibilidad/SEO -- el atributo del HTML es estático, pero
// el idioma efectivo puede cambiar en cualquier momento con el selector.
const syncHtmlLang = () => {
  document.documentElement.lang = i18n.resolvedLanguage ?? i18n.language
}
i18n.on('languageChanged', syncHtmlLang)
syncHtmlLang()

export default i18n
