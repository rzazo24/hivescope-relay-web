import { HIVE_API_NODE } from './config'
import { requestHiveBroadcast } from './hiveKeychain'

// @peak.snaps es la cuenta de PeakD que publica el contenedor diario de
// "snaps" (microblog corto en Hive): cada snap es un comentario colgado de
// ese post del día. Es una convención de la comunidad, no un protocolo
// formal -- si PeakD cambia de cuenta/formato, esto deja de encontrar
// contenedores nuevos (fallaría con "no se encontró..." al intentar
// publicar, sin romper nada más: ver publishRoomSnap).
const SNAP_CONTAINER_ACCOUNT = 'peak.snaps'

export interface SnapContainer {
  author: string
  permlink: string
}

/**
 * Busca el contenedor de snaps vigente: el post más reciente de
 * SNAP_CONTAINER_ACCOUNT. bridge.get_account_posts es la misma API pública
 * que usa cualquier frontend de Hive para leer el blog de una cuenta, no
 * hace falta autenticarse para leerla.
 */
export async function findLatestSnapContainer(): Promise<SnapContainer | null> {
  const res = await fetch(HIVE_API_NODE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'bridge.get_account_posts',
      params: { sort: 'posts', account: SNAP_CONTAINER_ACCOUNT, limit: 1 },
      id: 1,
    }),
  })

  if (!res.ok) {
    throw new Error(`hive node respondió ${res.status} al buscar el contenedor de snaps`)
  }

  const data = (await res.json()) as { result?: { author: string; permlink: string }[]; error?: { message: string } }
  if (data.error) {
    throw new Error(data.error.message)
  }

  const post = data.result?.[0]
  return post ? { author: post.author, permlink: post.permlink } : null
}

/**
 * Publica un snap en Hive (comentario colgado del contenedor diario de
 * @peak.snaps) anunciando una sala nueva de HiveScope Chat. Falla (rechaza
 * la promesa) si no hay contenedor disponible o si Keychain cancela/rechaza
 * la publicación -- quien llama decide si eso debe bloquear algo más o no
 * (en RoomList.tsx, no bloquea: la sala ya existe en Nostr igual).
 */
export async function publishRoomSnap(account: string, roomName: string, roomUrl: string): Promise<void> {
  const container = await findLatestSnapContainer()
  if (!container) {
    throw new Error('no se encontró el contenedor de snaps de hoy (@' + SNAP_CONTAINER_ACCOUNT + ')')
  }

  const permlink = `hivescope-room-${Date.now()}`
  const body = `New room "${roomName}" just opened on HiveScope Chat, a decentralized chat linked to Hive accounts.\n\n${roomUrl}\n\n#hivescope #nostr`

  await requestHiveBroadcast(account, [
    [
      'comment',
      {
        parent_author: container.author,
        parent_permlink: container.permlink,
        author: account,
        permlink,
        title: '',
        body,
        json_metadata: JSON.stringify({ app: 'hivescope-web', format: 'markdown', tags: ['hivescope', 'nostr'] }),
      },
    ],
  ])
}
