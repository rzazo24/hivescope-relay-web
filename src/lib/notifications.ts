// Avisos del navegador (Notification API) para menciones y respuestas cuando la
// pestaña está en segundo plano. Solo funcionan mientras la app está abierta:
// no hay push (haría falta un servidor y esto es una SPA sin backend).

const STORAGE_KEY = 'hivescope:notify'
const listeners = new Set<() => void>()

export function notificationsSupported(): boolean {
  return typeof Notification !== 'undefined'
}

function readPref(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Pura, para probarla: ¿hay que mostrar un aviso ahora? */
export function shouldNotify(pref: boolean, permission: string, appInBackground: boolean): boolean {
  return pref && permission === 'granted' && appInBackground
}

export type NotifyState = 'unsupported' | 'blocked' | 'off' | 'on'

export function notifyState(): NotifyState {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  return readPref() && Notification.permission === 'granted' ? 'on' : 'off'
}

function emit() {
  listeners.forEach((l) => l())
}

export function subscribeNotify(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** Activa (pidiendo permiso, que exige un gesto del usuario) o desactiva los avisos. */
export async function setNotifyEnabled(on: boolean): Promise<void> {
  try {
    if (on && notificationsSupported()) {
      const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
      localStorage.setItem(STORAGE_KEY, permission === 'granted' ? '1' : '0')
    } else {
      localStorage.setItem(STORAGE_KEY, '0')
    }
  } catch {
    // sin almacenamiento: el cambio no se recuerda
  }
  emit()
}

/** Muestra un aviso si el usuario los tiene activados y la app no está a la vista. */
export function showNotification(opts: { title: string; body: string; tag: string; onClick: () => void }): void {
  if (!notificationsSupported()) return
  const background = document.visibilityState !== 'visible' || !document.hasFocus()
  if (!shouldNotify(readPref(), Notification.permission, background)) return
  try {
    const n = new Notification(opts.title, { body: opts.body, tag: opts.tag, icon: '/favicon.svg' })
    n.onclick = () => {
      window.focus()
      opts.onClick()
      n.close()
    }
  } catch {
    // algunos navegadores móviles no permiten construir Notification directamente
  }
}
