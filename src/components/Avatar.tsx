import { useState } from 'react'
import { hiveAvatarUrl } from '../lib/hiveAvatar'

/**
 * Imagen de perfil de una cuenta Hive, con una inicial de reserva si no carga
 * (sin red, cuenta inexistente...). Decorativa: el nombre ya va al lado.
 */
export function Avatar({ account, size = 16 }: { account: string; size?: number }) {
  const url = hiveAvatarUrl(account)
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size }
  if (!url || failed) {
    return (
      <span
        aria-hidden="true"
        style={style}
        className="inline-flex shrink-0 items-center justify-center self-center rounded-full bg-surface-2 text-[9px] font-bold uppercase text-muted"
      >
        {account.charAt(0)}
      </span>
    )
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      style={style}
      onError={() => setFailed(true)}
      className="shrink-0 self-center rounded-full bg-surface-2 object-cover"
    />
  )
}
