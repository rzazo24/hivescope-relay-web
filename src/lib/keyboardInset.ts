/**
 * Cuánto tapa el teclado en pantalla, en px: la diferencia entre el viewport
 * de layout (que en iOS NO se encoge al salir el teclado) y el viewport
 * visual (que sí). 0 si no hay teclado.
 */
export function keyboardInset(layoutHeight: number, visualHeight: number, visualOffsetTop: number): number {
  return Math.max(0, Math.round(layoutHeight - visualHeight - visualOffsetTop))
}

/**
 * Publica el alto del teclado en la variable CSS --keyboard-inset para que la
 * página se alargue esa cantidad (ver index.css). Sin esto, en iOS -- sobre
 * todo en navegadores integrados como el de Hive Keychain -- el documento es
 * más corto que el área visible al salir el teclado y por debajo asoma el
 * fondo blanco del navegador. Se ejecuta al importar, como theme.ts.
 */
function init() {
  const vv = window.visualViewport
  if (!vv) return
  const update = () => {
    document.documentElement.style.setProperty(
      '--keyboard-inset',
      `${keyboardInset(window.innerHeight, vv.height, vv.offsetTop)}px`,
    )
  }
  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
  update()
}

init()
