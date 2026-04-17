import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname } = useLocation()
  // useLayoutEffect corre ANTES del paint — no hay movimiento visible
  useLayoutEffect(() => {
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0  // Safari
  }, [pathname])
  return null
}