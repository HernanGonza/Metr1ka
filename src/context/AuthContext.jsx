import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [perfil, setPerfil]   = useState(null)
  const [loading, setLoading] = useState(true)
  const fetchingRef = useRef(false)

  const fetchPerfil = useCallback(async (userId) => {
    // Evitar llamadas simultáneas
    if (fetchingRef.current) return
    fetchingRef.current = true

    const { data, error } = await supabase
      .from('perfiles')
      .select('*, organizaciones(nombre, logo_url, color_primario)')
      .eq('id', userId)
      .single()

    if (!error && data) {
      setPerfil(data)
    }
    setLoading(false)
    fetchingRef.current = false
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        fetchPerfil(currentUser.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const currentUser = session?.user ?? null
        setUser(currentUser)
        if (currentUser) {
          fetchPerfil(currentUser.id)
        } else {
          setPerfil(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchPerfil])

  async function signOut() {
    await supabase.auth.signOut()
    setPerfil(null)
    setUser(null)
  }

  const value = {
    user,
    perfil,
    loading,
    rol: perfil?.rol ?? null,
    organizacion: perfil?.organizaciones ?? null,
    perfilCompleto: perfil?.perfil_completo ?? false,
    signOut,
    refreshPerfil: () => user && fetchPerfil(user.id),
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}