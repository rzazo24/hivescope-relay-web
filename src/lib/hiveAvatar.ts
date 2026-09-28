// Avatar de una cuenta Hive: el servicio público de imágenes de Hive sirve la
// imagen de perfil (o una por defecto) a partir del nombre de cuenta, sin API.
const ACCOUNT = /^[a-z][a-z0-9-]{1,15}(\.[a-z][a-z0-9-]{1,15})*$/

/** URL del avatar pequeño de `account`, o null si no es un nombre de cuenta Hive válido. */
export function hiveAvatarUrl(account: string): string | null {
  const a = account.trim().toLowerCase()
  return ACCOUNT.test(a) ? `https://images.hive.blog/u/${a}/avatar/small` : null
}
