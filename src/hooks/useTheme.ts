import { useEffect, useState } from 'react'
import { getTheme, setTheme, subscribeTheme, type Theme } from '../lib/theme'

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(getTheme)

  useEffect(() => subscribeTheme(setThemeState), [])

  return [theme, setTheme]
}
