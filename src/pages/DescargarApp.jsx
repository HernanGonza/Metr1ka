import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/ui'
import { Download, Smartphone, Info } from 'lucide-react'
import styles from './admin/Page.module.css'
import { Topbar } from '../components/layout'

export default function DescargarApp() {
  const [apks, setApks]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    cargarApks()
  }, [])

  async function cargarApks() {
    setLoading(true)
    const { data, error: err } = await supabase.storage.from('apks').list('', {
      limit: 20, sortBy: { column: 'created_at', order: 'desc' }
    })
    if (err) { setError(err.message); setLoading(false); return }
    setApks((data || []).filter(f => f.name.endsWith('.apk')))
    setLoading(false)
  }

  async function descargar(nombre) {
    const { data } = supabase.storage.from('apks').getPublicUrl(nombre)
    const a = document.createElement('a')
    a.href = data.publicUrl
    a.download = nombre
    a.click()
  }

  function formatSize(bytes) {
    if (!bytes) return '—'
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  function formatFecha(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('es-AR', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
  }

  return (
    <div className={styles.page}>
      <Topbar title="Descargar App" />
      <div className={styles.content}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Info */}
          <div style={{ background: 'var(--accent-light)', border: '1px solid #b7e4c7', borderRadius: 'var(--r2)', padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Info size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent2)', marginBottom: 4 }}>
                Instalación de la app Metr1ka
              </div>
              <div style={{ fontSize: 13, color: 'var(--accent2)', lineHeight: 1.6 }}>
                La app todavía no está en Google Play. Para instalarla en Android, descargá el APK y habilitá
                la instalación desde fuentes desconocidas en <strong>Ajustes → Seguridad → Fuentes desconocidas</strong>.
              </div>
            </div>
          </div>

          {/* Lista de APKs */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Smartphone size={16} color="var(--ink3)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Versiones disponibles
              </span>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center' }}><Spinner size="md" /></div>
            ) : error ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>
                {error}
              </div>
            ) : apks.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink2)', marginBottom: 6 }}>
                  Todavía no hay versiones disponibles
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink3)' }}>
                  El administrador subirá el APK cuando esté listo.
                </div>
              </div>
            ) : (
              apks.map((apk, i) => (
                <div key={apk.name} style={{
                  padding: '14px 20px',
                  borderBottom: i < apks.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>
                      {apk.name.replace('.apk', '')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)' }}>
                      {formatSize(apk.metadata?.size)} · {formatFecha(apk.created_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => descargar(apk.name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', background: 'var(--accent)', color: '#fff',
                      border: 'none', borderRadius: 'var(--r)', fontSize: 13,
                      fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans',
                      flexShrink: 0,
                    }}
                  >
                    <Download size={14} /> Descargar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}