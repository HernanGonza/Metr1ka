<div align="center">

<a href="https://www.metr1ka.com">
  <img src="https://zjphrjcpkzlmdpqhjypq.supabase.co/storage/v1/object/public/assets/LogoMetr1ka_white.svg" alt="METR1KA" width="300" />
</a>

<br/><br/>

**Sistema profesional de encuestas de campo**  
Datos reales, en tiempo real.

[![Deploy](https://img.shields.io/badge/deploy-metr1ka.com-52B788?style=flat-square&logo=vercel&logoColor=white)](https://www.metr1ka.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-backend-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Expo](https://img.shields.io/badge/Expo-app%20móvil-000020?style=flat-square&logo=expo&logoColor=white)](https://expo.dev)

</div>

---

## ¿Qué es Metr1ka?

Metr1ka es una plataforma para gestionar y ejecutar encuestas de campo en tiempo real. Permite a organizaciones coordinar equipos de encuestadores, asignar zonas geográficas, monitorear el trabajo desde un panel web y recolectar respuestas desde una app móvil — todo sincronizado en tiempo real.

Nace como un proyecto conjunto entre **[Enfoque Misiones](https://www.enfoquemisiones.com)** y **[Paralelo Software Studio](https://paralelo-studio.vercel.app)**, desarrollado en Misiones, Argentina 🇦🇷

---

## Arquitectura

```
metr1ka/                    ← Panel web (este repo)
metr1ka-app/                ← App móvil (Expo / React Native)
Supabase                    ← Backend, auth, base de datos, realtime
```

El sistema tiene **tres capas de usuario**:

| Rol | Acceso | Descripción |
|-----|--------|-------------|
| `superadmin` / `editor` | Panel web `/superadmin` | Gestión global del sistema, organizaciones, encuestas |
| `admin` / `gestor` / `coordinador` | Panel web `/dashboard` | Gestión de equipos, encuestas, reportes y mapa en vivo |
| `encuestador` | App móvil | Ejecución de encuestas en campo con GPS y geofencing |

---

## Stack técnico

### Panel web

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| React | 19 | Framework UI |
| React Router | 7 | Ruteo |
| Supabase JS | 2 | Auth, DB, Realtime |
| Leaflet | 1.9 | Mapas interactivos |
| Lucide React | latest | Iconografía |
| Vite | 8 | Build tool |

### App móvil

| Tecnología | Uso |
|-----------|-----|
| Expo / React Native | Framework |
| Expo Router | Navegación |
| Expo Location | GPS y permisos |
| Supabase JS | Auth, DB, Realtime |
| React Native Maps | Mapas en campo |

### Backend (Supabase)

- **PostgreSQL** con RLS en todas las tablas
- **Auth** con email/password, magic link y Google OAuth
- **Realtime** en ubicaciones, encuestas, sesiones y respuestas
- **Edge Functions** para invitación de usuarios y procesamiento de datos
- **Storage** para assets y logos

---

## Funcionalidades principales

### Panel web

- 🗺 **Mapa en tiempo real** — ubicación de encuestadores en campo, actualización cada 15 segundos
- 📋 **Gestor de encuestas** — constructor de formularios con lógica condicional, múltiples tipos de pregunta
- 👥 **Gestión de equipos** — coordinadores, encuestadores, asignación de zonas geográficas
- 📊 **Reportes** — visualización y exportación de respuestas
- 🔐 **Auth completa** — Google OAuth, magic link, recuperación de contraseña
- 🌙 **Dark mode** completo

### App móvil

- 📍 **Geofencing** — el encuestador solo puede operar dentro de la zona asignada
- 🗺 **Navegación por parcelas** — mapa con dirección a la siguiente vivienda
- 📝 **Formularios dinámicos** — lógica condicional, validaciones, múltiples tipos de pregunta
- 📡 **Tracking singleton** — un único intervalo de GPS sin importar cuántas pantallas estén abiertas
- 🔄 **Sincronización realtime** — respuestas y ubicación sincronizadas al instante

---

## Estructura del proyecto

```
src/
├── components/
│   ├── layout/          # Topbar, Sidebar, ProtectedRoute, DashboardLayout
│   ├── superadmin/      # Layout superadmin
│   └── ui/              # Button, Input, Spinner, etc.
├── context/
│   └── AuthContext.jsx  # Sesión global, perfil, rol
├── hooks/
│   └── useTheme.js      # Sincronización dark/light mode
├── pages/
│   ├── admin/           # Dashboard, Encuestas, Equipos, Mapa, Reportes, etc.
│   ├── auth/            # Login, CompletarPerfil, RecuperarPassword
│   ├── coordinador/     # Dashboard, Equipo, Encuestas del coordinador
│   ├── landing/         # Landing pública
│   ├── legal/           # Privacidad, Términos, Cookies
│   └── superadmin/      # Panel global
└── styles/
    └── global.css       # Variables CSS, dark mode, tipografía
```

---

## Variables de entorno

Crear un archivo `.env` en la raíz:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxx
```

---

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Correr en desarrollo
npm run dev

# Build de producción
npm run build
```

---

## Deploy

El panel web está deployado en **[www.metr1ka.com](https://www.metr1ka.com)** con deploy continuo desde la rama `develop`.

---

## Seguridad

- RLS (Row Level Security) activo en todas las tablas
- Los registros son **solo por invitación** — no hay registro público
- Google OAuth bloqueado para usuarios no invitados via hook `before_user_created`
- Roles granulares: cada rol accede únicamente a los datos que le corresponden
- La service role key de Supabase nunca está expuesta en el cliente

---

## Repositorios relacionados

| Repo | Descripción |
|------|-------------|
| [metr1ka](https://github.com/HernanGonza/Metr1ka) | Panel web (este repo) |
| [metr1ka-app](https://github.com/HernanGonza/metr1ka-app) | App móvil Expo |

---

<div align="center">

Desarrollado con ♥ en Misiones, Argentina  
por **[Paralelo Software Studio](https://paralelo-studio.vercel.app)**  
en colaboración con **[Enfoque Misiones](https://www.enfoquemisiones.com)**

</div>
