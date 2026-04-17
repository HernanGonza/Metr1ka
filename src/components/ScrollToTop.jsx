import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    // Desactivar scroll-behavior: smooth temporalmente para que el reset sea instantáneo
    const html = document.documentElement
    html.style.scrollBehavior = 'auto'
    html.scrollTop = 0
    document.body.scrollTop = 0
    // Restaurar después del paint
    requestAnimationFrame(() => {
      html.style.scrollBehavior = ''
    })
  }, [pathname])
  return null
}