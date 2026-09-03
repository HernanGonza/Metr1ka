import { useState, useEffect } from 'react'

// El tema ya viene aplicado en <html data-theme> por el script inline de index.html.
// Este hook solo lo lee y ofrece un toggle que persiste la elección explícita.
function leerTema() {
  return document.documentElement.getAttribute('data-theme')
    || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}

export function useTheme() {
  const [theme, setTheme] = useState(leerTema)

  // Sincronizar si otro componente cambia el tema
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const current = document.documentElement.getAttribute('data-theme')
      if (current && current !== theme) setTheme(current)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [theme])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('metr1ka-theme', next) } catch { /* modo privado */ }
    setTheme(next)
  }

  return { theme, toggle, isDark: theme === 'dark' }
}
