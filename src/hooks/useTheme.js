import { useState, useEffect } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    // Leer del atributo del DOM primero (fuente de verdad), luego localStorage
    const domTheme = document.documentElement.getAttribute('data-theme')
    if (domTheme) return domTheme
    const saved = localStorage.getItem('metr1ka-theme')
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    // Aplicar al DOM y guardar
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('metr1ka-theme', theme)
  }, [theme])

  // Escuchar cambios en el DOM (cuando otro componente cambia el tema)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const current = document.documentElement.getAttribute('data-theme')
      if (current && current !== theme) {
        setTheme(current)
      }
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [theme])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return { theme, toggle, isDark: theme === 'dark' }
}