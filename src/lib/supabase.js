import { createClient } from '@supabase/supabase-js'

const supabaseUrl    = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars not set. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persistir sesión en localStorage (default)
    persistSession: true,
    // Detectar automáticamente el callback de OAuth en la URL
    detectSessionInUrl: true,
    // Refresh token automático antes de que expire
    autoRefreshToken: true,
    // Storage key consistente
    storageKey: 'metr1ka-auth',
  },
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
  global: {
    fetch: (url, options) => {
      return fetch(url, { ...options, signal: AbortSignal.timeout(15000) })
    },
  },
  db: {
    schema: 'public',
  },
})

/*
  TOKENS — Configuración recomendada (hacer en Supabase Dashboard > Auth > Settings):
  - JWT expiry: 3600s (1 hora) — valor por defecto, está bien
  - Refresh token reuse interval: 10s — cambiar a 0s para evitar "Refresh Token Not Found"
    cuando se usan múltiples pestañas al mismo tiempo.
    
  El error "Invalid Refresh Token: Refresh Token Not Found" que aparece en los logs
  es causado por el reuse interval. Supabase revoca el token viejo cuando se usa un
  refresh token, y si hay múltiples tabs intentando refrescar al mismo tiempo, una
  de ellas falla. Solucion: ir a Dashboard > Authentication > Settings > 
  "JWT expiry limit" y "Refresh token reuse interval" y poner en 0.
  
  GOOGLE OAuth — Para activar el login con Google:
  1. Ir a https://console.cloud.google.com y crear un proyecto OAuth
  2. Copiar Client ID y Client Secret
  3. En Supabase Dashboard > Authentication > Providers > Google: activar y pegar las keys
  4. Agregar redirect URL: https://[proyecto].supabase.co/auth/v1/callback
  5. El botón de Google en Login.jsx ya está listo, solo falta activar el proveedor.
*/