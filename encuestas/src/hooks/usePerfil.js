import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function usePerfil() {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  async function updatePerfil(data) {
    if (!user) return
    setSaving(true)
    setError(null)

    const { error: err } = await supabase
      .from('perfiles')
      .update(data)
      .eq('id', user.id)

    if (err) setError(err.message)
    setSaving(false)
    return !err
  }

  return { updatePerfil, saving, error }
}
