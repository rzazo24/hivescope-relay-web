import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TerminalWindow } from './TerminalWindow'

interface HelpSection {
  heading: string
  body: string
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const sections = t('help.sections', { returnObjects: true }) as HelpSection[]

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    // Siempre alineado arriba (nunca items-center): un modal centrado cuyo
    // contenido supera el alto de la pantalla deja la parte de arriba
    // (fuera de los límites del contenedor) inalcanzable con scroll, no
    // solo requiere desplazarse -- es una trampa real de flexbox+overflow,
    // no solo un detalle estético.
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm"
    >
      <div role="dialog" aria-modal="true" aria-label={t('help.title')} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
        <TerminalWindow title={`$ ${t('help.title')}`}>
          <div className="flex flex-col gap-4 text-sm">
            {sections.map((section) => (
              <div key={section.heading}>
                <p className="text-ink">{section.heading}</p>
                <p className="mt-1 text-muted">{section.body}</p>
              </div>
            ))}

            <button
              type="button"
              onClick={onClose}
              className="mt-2 self-start rounded-md border border-border px-3 py-1.5 text-xs text-muted transition hover:border-accent hover:text-ink"
            >
              [x] {t('help.close')}
            </button>
          </div>
        </TerminalWindow>
      </div>
    </div>
  )
}
