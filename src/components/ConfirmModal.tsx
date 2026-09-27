import { useEffect } from 'react'
import { TerminalWindow } from './TerminalWindow'

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    // Mismo patrón que HelpModal: alineado arriba, no centrado, para no
    // dejar la barra de título inalcanzable con scroll en pantallas cortas.
    <div
      role="presentation"
      onClick={onCancel}
      className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm"
    >
      <div role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
        <TerminalWindow title={title}>
          <div className="flex flex-col gap-4 text-sm">
            <p className="text-ink">{message}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-md border border-error px-3 py-1.5 text-xs font-bold text-error transition hover:bg-error hover:text-base"
              >
                {confirmLabel}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted transition hover:border-accent hover:text-ink"
              >
                {cancelLabel}
              </button>
            </div>
          </div>
        </TerminalWindow>
      </div>
    </div>
  )
}
