import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { usePerfil } from '../../hooks/usePerfil'
import { Button, Input } from '../../components/ui'
import styles from './CompletarPerfil.module.css'

export default function CompletarPerfil() {
  const { refreshPerfil } = useAuth()
  const { updatePerfil, saving, error } = usePerfil()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    nombre_completo: '',
    telefono: '',
    fecha_nacimiento: '',
    genero: '',
    dni: '',
    telefono_alternativo: '',
    calle: '', numero: '', piso: '', departamento: '',
    barrio: '', localidad: '', provincia: '', codigo_postal: '',
    pais: 'Argentina',
  })

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const ok = await updatePerfil({ ...form, perfil_completo: true })
    if (ok) {
      await refreshPerfil()
      navigate('/dashboard', { replace: true })
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2>Completá tu perfil</h2>
          <p>Necesitamos algunos datos antes de que puedas usar el sistema.</p>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Tu cuenta</div>
            <div className={styles.grid2}>
              <Input
                label="Nombre completo"
                name="nombre_completo"
                value={form.nombre_completo}
                onChange={handleChange}
                required
                placeholder="Juan Pérez"
              />
              <Input
                label="Teléfono"
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                required
                placeholder="+54 9 376 ..."
              />
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Datos personales</div>
            <div className={styles.grid2}>
              <Input
                label="DNI"
                name="dni"
                value={form.dni}
                onChange={handleChange}
                required
                placeholder="12.345.678"
              />
              <Input
                label="Fecha de nacimiento"
                name="fecha_nacimiento"
                type="date"
                value={form.fecha_nacimiento}
                onChange={handleChange}
                required
              />
            </div>
            <div className={styles.grid2}>
              <div>
                <label className={styles.label}>Género</label>
                <select name="genero" value={form.genero} onChange={handleChange} className={styles.select} required>
                  <option value="">Seleccionar</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <Input
                label="Teléfono alternativo"
                name="telefono_alternativo"
                value={form.telefono_alternativo}
                onChange={handleChange}
                placeholder="+54 9 11 ..."
              />
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Dirección</div>
            <div className={styles.grid3}>
              <Input label="Calle"   name="calle"  value={form.calle}  onChange={handleChange} required />
              <Input label="Número"  name="numero" value={form.numero} onChange={handleChange} required />
              <Input label="Piso / Depto" name="piso" value={form.piso} onChange={handleChange} />
            </div>
            <div className={styles.grid2}>
              <Input label="Barrio"    name="barrio"    value={form.barrio}    onChange={handleChange} />
              <Input label="Localidad" name="localidad" value={form.localidad} onChange={handleChange} required />
            </div>
            <div className={styles.grid3}>
              <Input label="Provincia"     name="provincia"     value={form.provincia}     onChange={handleChange} required />
              <Input label="Código postal" name="codigo_postal" value={form.codigo_postal} onChange={handleChange} />
              <Input label="País"          name="pais"          value={form.pais}          onChange={handleChange} required />
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}
          <Button type="submit" loading={saving} fullWidth size="lg">
            Guardar y continuar
          </Button>
        </form>
      </div>
    </div>
  )
}