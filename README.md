# Metr1ka

Sistema de encuestas en tiempo real para campañas electorales.

## Stack
- React 18 + Vite
- React Router DOM
- Supabase (auth + base de datos)

## Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase

# 3. Correr en desarrollo
npm run dev

# 4. Build de producción
npm run build
```

## Variables de entorno

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

## Estructura

```
src/
├── components/
│   ├── ui/              # Componentes base: Button, Badge, Card, Avatar, Input, Spinner
│   └── layout/          # Sidebar, Topbar, DashboardLayout, ProtectedRoute
├── context/
│   └── AuthContext.jsx  # Auth + perfil del usuario logueado
├── hooks/
│   ├── useAuth.js       # Re-export de AuthContext
│   └── usePerfil.js     # Update de perfil en Supabase
├── lib/
│   └── supabase.js      # Cliente de Supabase
├── pages/
│   ├── auth/            # Login, CompletarPerfil
│   ├── admin/           # Dashboard, Mapa, Encuestas, Equipos, Coordinadores, Encuestadores, Reportes, Configuracion
│   └── coordinador/     # Dashboard, Equipo, Encuestas
├── styles/
│   ├── global.css       # Reset, tipografía, animaciones
│   └── variables.css    # Tokens de diseño (colores, radios, sombras)
└── App.jsx              # Router principal con rutas protegidas por rol
```

## Roles y rutas

| Rol         | Rutas disponibles |
|-------------|-------------------|
| admin       | /dashboard, /mapa, /encuestas, /equipos, /coordinadores, /encuestadores, /reportes, /configuracion |
| coordinador | /dashboard, /equipo, /encuestas |
| encuestador | App móvil (React Native / Expo) |

## Flujo de autenticación

1. Usuario recibe invitación por email (con `organizacion_id` y `rol` en los metadatos)
2. Acepta el link → Supabase crea el usuario y el trigger crea su fila en `perfiles`
3. Al ingresar, si `perfil_completo = false` → redirige a `/completar-perfil`
4. Una vez completado → accede al panel según su rol
