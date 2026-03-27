export const SECTIONS = [
  { id: 'inicio',    label: 'Inicio'     },
  { id: 'sistema',   label: 'El sistema' },
  { id: 'flujo',     label: 'Flujo'      },
  { id: 'panel',     label: 'Panel'      },
  { id: 'app',       label: 'App móvil'  },
  { id: 'precios',   label: 'Precios'    },
  { id: 'clientes',  label: 'Clientes'   },
]

export const FLOW_STEPS = [
  {
    title: 'Nosotros armamos la encuesta',
    detail: 'Nuestro equipo diseña la encuesta a medida: las preguntas correctas, en el orden correcto, pensadas para los objetivos de cada cliente.',
    chips: ['Preguntas validadas', 'Entrega en 48h', 'Revisiones incluidas', 'Lista para usar'],
  },
  {
    title: 'El cliente define zonas',
    detail: 'El admin asigna la encuesta a uno o varios equipos y puede definir un área geográfica para cada equipo. Si un encuestador sale de esa zona, la app se desactiva automáticamente.',
    chips: ['Geofencing opcional', 'Polígono personalizado', 'Activación automática', 'Control en tiempo real'],
  },
  {
    title: 'Coordinador distribuye',
    detail: 'El coordinador de cada equipo ve las encuestas disponibles y las asigna a los encuestadores según la zona o el perfil.',
    chips: ['Asignar encuestadores', 'Gestionar equipo', 'Ver disponibilidad'],
  },
  {
    title: 'Encuestadores en el campo',
    detail: 'Los encuestadores reciben la encuesta en su app móvil. Al completar cada entrevista, las respuestas se envían en tiempo real al panel central junto con la ubicación GPS.',
    chips: ['App móvil', 'GPS en tiempo real', 'Modo offline'],
  },
  {
    title: 'Resultados en tiempo real',
    detail: 'El admin y el coordinador ven los resultados a medida que llegan. Gráficos automáticos, mapa de ubicaciones, conteo de encuestas completadas por encuestador y control de actividad.',
    chips: ['Gráficos automáticos', 'Mapa en tiempo real', 'Exportar datos'],
  },
]

export const ROLES = [
  {
    key: 'admin',
    badge: 'admin',
    label: 'Admin / Gestor',
    title: 'El cliente',
    desc: 'Ve únicamente su organización. Gestiona equipos, monitorea resultados y opera desde su panel central. El Gestor tiene el mismo acceso sin la parte financiera.',
    perms: [
      'Accede a sus encuestas activas',
      'Crea equipos y define zonas geográficas',
      'Invita coordinadores y encuestadores',
      'Panel completo en tiempo real',
    ],
  },
  {
    key: 'coordinador',
    badge: 'coordinador',
    label: 'Coordinador',
    title: 'Jefe de campo',
    desc: 'Gestiona su equipo en el campo. Ve el mapa en tiempo real, asigna encuestas y controla el avance dentro de la zona asignada.',
    perms: [
      'Agrega/quita encuestadores de su equipo',
      'Asigna encuestas a encuestadores',
      'Ve ubicación en tiempo real de su equipo',
      'Panel web + app móvil',
    ],
  },
  {
    key: 'encuestador',
    badge: 'encuestador',
    label: 'Encuestador',
    title: 'Personal de campo',
    desc: 'Usa la app móvil para completar encuestas puerta a puerta. Si el equipo tiene zona asignada, la app verifica que esté dentro del área.',
    perms: [
      'Recibe encuestas asignadas en la app',
      'Completa entrevistas en campo',
      'Envía respuestas en tiempo real',
      'Ubicación GPS automática',
    ],
  },
]

export const PLANS = [
  {
    name: 'Arranque',
    desc: '3 encuestas incluidas. Encuestas adicionales con costo extra.',
    features: [
      'Acceso al panel mientras la suscripción esté activa',
      '3 encuestas incluidas y armadas por nosotros',
      '1 equipo de encuestadores',
      'Hasta 15 encuestadores',
      'Panel web en tiempo real',
      'App móvil incluida',
      'Gráficos básicos',
      { text: 'Exportación de datos', muted: true },
      { text: 'Soporte prioritario', muted: true },
    ],
  },
  {
    name: 'Estándar',
    desc: '10 encuestas incluidas. Encuestas adicionales con costo extra.',
    featured: true,
    features: [
      'Acceso al panel mientras la suscripción esté activa',
      '10 encuestas incluidas y armadas por nosotros',
      'Equipos ilimitados',
      'Hasta 60 encuestadores',
      'Panel web en tiempo real',
      'App móvil incluida',
      'Gráficos avanzados y mapas',
      'Exportación en Excel / PDF',
      'Soporte prioritario',
    ],
  },
  {
    name: 'Territorio',
    desc: 'Encuestas ilimitadas incluidas en el plan.',
    features: [
      'Acceso al panel mientras la suscripción esté activa',
      'Encuestas ilimitadas incluidas',
      'Equipos ilimitados',
      'Encuestadores ilimitados',
      'Panel web en tiempo real',
      'App móvil incluida',
      'Gráficos avanzados y mapas',
      'Exportación en Excel / PDF',
      'Soporte prioritario 24/7',
    ],
  },
]

export const TESTIMONIALS = [
  {
    quote: 'En menos de una semana teníamos el equipo de campo cargando encuestas en tiempo real. El mapa con la ubicación de cada encuestador nos cambió la forma de operar.',
    name: 'Roberto V.',
    role: 'Coordinador de campo',
    org: 'Municipio Posadas',
    initials: 'RV',
    bg: '#d8f3dc',
    tc: '#1a472a',
  },
  {
    quote: 'Podemos ver los resultados mientras están en la calle. Antes teníamos que esperar días para procesar todo. Ahora en la reunión de las 18hs ya tenemos los datos del día.',
    name: 'Sandra M.',
    role: 'Directora de gestión',
    org: 'Organización Misiones',
    initials: 'SM',
    bg: '#e0f2fe',
    tc: '#0369a1',
  },
  {
    quote: 'El geofencing nos resolvió un problema enorme. Sabemos que los encuestadores están trabajando en la zona asignada y no hay forma de cargar datos fuera del área.',
    name: 'Diego P.',
    role: 'Admin',
    org: 'Campaña Norte',
    initials: 'DP',
    bg: '#fef3c7',
    tc: '#b45309',
  },
]

export const SURVEY_QUESTIONS = [
  {
    type: 'multi',
    text: '¿Cómo calificarías la gestión en los últimos dos años?',
    opts: ['Muy buena', 'Buena', 'Regular', 'Mala', 'Muy mala'],
  },
  {
    type: 'sino',
    text: '¿Creés que la situación en tu comunidad mejoró en el último año?',
    opts: ['Sí', 'No'],
  },
  {
    type: 'escala',
    text: 'Del 1 al 10, ¿qué tan probable es que recomiendes esta organización?',
  },
  {
    type: 'multi',
    text: '¿Cuál es el tema que más te preocupa en tu comunidad?',
    opts: ['Seguridad', 'Salud', 'Educación', 'Empleo', 'Obras públicas'],
  },
  {
    type: 'texto',
    text: '¿Tenés algún comentario o sugerencia?',
  },
]

export const MOBILE_FEATURES = {
  encuestador: [
    { icon: '📋', title: 'Encuestas asignadas', desc: 'Ve solo las encuestas que el coordinador le asignó. Nada más, nada menos.' },
    { icon: '⚡', title: 'Envío en tiempo real', desc: 'Las respuestas llegan al panel central al instante, a medida que se completan.' },
    { icon: '📍', title: 'GPS automático', desc: 'Cada respuesta se envía con la ubicación exacta. Sin configuración manual.' },
    { icon: '🔒', title: 'Control de zona', desc: 'Si el equipo tiene geofencing activo, la app verifica que estés dentro del área asignada.' },
  ],
  coordinador: [
    { icon: '🗺️', title: 'Mapa en tiempo real', desc: 'Ve dónde está cada encuestador de su equipo en este momento.' },
    { icon: '👥', title: 'Control del equipo', desc: 'Cuántas encuestas completó cada uno, quién está activo y quién está pausado.' },
    { icon: '📋', title: 'Asignar encuestas', desc: 'Asigna o desasigna encuestas a sus encuestadores directamente desde la app.' },
    { icon: '⚡', title: 'Alertas instantáneas', desc: 'Notificación cuando un encuestador sale de la zona asignada o completa su meta.' },
  ],
  admin: [
    { icon: '📊', title: 'Resultados en vivo', desc: 'Ve cómo va cada encuesta en tiempo real, desde cualquier lugar.' },
    { icon: '📈', title: 'Gráficos instantáneos', desc: 'Resultados por pregunta actualizados al momento, sin computadora.' },
    { icon: '📋', title: 'Elegir la encuesta', desc: 'Cambia entre encuestas activas con un toque para monitorear cada una.' },
    { icon: '👥', title: 'Estado del campo', desc: 'Cuántos encuestadores están activos y cuántas respuestas van en total.' },
  ],
}

export const DASHBOARD_SIDEBAR = [
  {
    group: 'Principal',
    items: [
      { key: 'dashboard',   icon: '📊', label: 'Dashboard'    },
      { key: 'mapa',        icon: '🗺️', label: 'Mapa en vivo' },
    ],
  },
  {
    group: 'Gestión',
    items: [
      { key: 'encuestas',     icon: '📋', label: 'Encuestas'     },
      { key: 'equipos',       icon: '👥', label: 'Equipos'       },
      { key: 'coordinadores', icon: '👔', label: 'Coordinadores' },
      { key: 'encuestadores', icon: '👤', label: 'Encuestadores' },
    ],
  },
  {
    group: 'Herramientas',
    items: [
      { key: 'reportes',      icon: '📁', label: 'Reportes'      },
      { key: 'configuracion', icon: '⚙️', label: 'Configuración' },
    ],
  },
]

export const DASHBOARD_DATA = {
  kpis: [
    { l: 'Encuestas hoy',         v: '412', s: '+38 última hora'  },
    { l: 'Encuestadores activos', v: '23',  s: 'de 28 total'      },
    { l: 'Encuesta más usada',    v: 'Satisfacción', s: 'general' },
    { l: 'Zona líder',            v: 'Centro', s: '118 respuestas'},
  ],
  encuestadores: [
    { initials: 'MR', name: 'María R.',  status: 'active', zone: 'Norte',  count: 14, bg: '#d8f3dc', tc: '#1a472a' },
    { initials: 'JL', name: 'Juan L.',   status: 'active', zone: 'Centro', count: 9,  bg: '#e0f2fe', tc: '#0369a1' },
    { initials: 'AS', name: 'Ana S.',    status: 'idle',   zone: 'Sur',    count: 7,  bg: '#fef3c7', tc: '#b45309' },
    { initials: 'CP', name: 'Carlos P.', status: 'active', zone: 'Este',   count: 11, bg: '#f3e8ff', tc: '#7c3aed' },
  ],
  encuestasCards: [
    { name: 'Satisfacción general', p: 8,  r: 412, estado: 'activa',   eq: 3 },
    { name: 'Seguridad barrial',    p: 6,  r: 187, estado: 'activa',   eq: 2 },
    { name: 'Servicio al cliente',  p: 10, r: 0,   estado: 'borrador', eq: 0 },
    { name: 'Atención ciudadana',   p: 7,  r: 98,  estado: 'activa',   eq: 1 },
  ],
  equiposCards: [
    { name: 'Equipo Norte',  coord: 'Roberto V.', coordI: 'RV', coordBg: '#e0f2fe', coordTc: '#0369a1', enc: 8,  encuestas: 2 },
    { name: 'Equipo Centro', coord: 'Sandra M.',  coordI: 'SM', coordBg: '#d8f3dc', coordTc: '#1a472a', enc: 12, encuestas: 3 },
    { name: 'Equipo Sur',    coord: 'Diego P.',   coordI: 'DP', coordBg: '#fef3c7', coordTc: '#b45309', enc: 6,  encuestas: 1 },
    { name: 'Equipo Este',   coord: 'Claudia R.', coordI: 'CR', coordBg: '#f3e8ff', coordTc: '#7c3aed', enc: 7,  encuestas: 2 },
  ],
  encuestadoresCards: [
    { i: 'MR', name: 'María Rodríguez', eq: 'Norte',  estado: 'Activa',   enc: 14, bg: '#d8f3dc', tc: '#1a472a' },
    { i: 'JL', name: 'Juan López',      eq: 'Centro', estado: 'Activo',   enc: 9,  bg: '#e0f2fe', tc: '#0369a1' },
    { i: 'AS', name: 'Ana Suárez',      eq: 'Sur',    estado: 'Inactiva', enc: 7,  bg: '#fef3c7', tc: '#b45309' },
    { i: 'CP', name: 'Carlos Pérez',    eq: 'Este',   estado: 'Activo',   enc: 11, bg: '#f3e8ff', tc: '#7c3aed' },
    { i: 'LM', name: 'Laura Méndez',    eq: 'Centro', estado: 'Activa',   enc: 6,  bg: '#fce7f3', tc: '#be185d' },
    { i: 'RM', name: 'Roberto Medina',  eq: 'Norte',  estado: 'Activo',   enc: 13, bg: '#ecfdf5', tc: '#047857' },
  ],
  reportesCards: [
    { icon: '📊', title: 'Resumen ejecutivo',          meta: 'Satisfacción general · Hoy · 412 respuestas' },
    { icon: '📍', title: 'Mapa de calor por zona',     meta: 'Todas las encuestas · Esta semana'           },
    { icon: '👥', title: 'Desempeño de encuestadores', meta: 'Todos los equipos · Este mes'                },
    { icon: '📋', title: 'Respuestas completas',       meta: 'Seguridad barrial · 187 registros'           },
    { icon: '📈', title: 'Evolución temporal',         meta: 'Últimos 30 días'                             },
  ],
  configCards: [
    { l: 'Notificaciones por email',  s: 'Recibir alertas de actividad',          on: true  },
    { l: 'Alertas en tiempo real',    s: 'Aviso al completar cada entrevista',     on: true  },
    { l: 'Modo offline en app',       s: 'Permitir encuestas sin conexión',        on: false },
    { l: 'Geofencing por equipo',     s: 'Activar control de zona geográfica',     on: true  },
    { l: 'Reporte diario automático', s: 'Generar PDF cada mañana',               on: false },
  ],
  coordinadores: [
    { i: 'RV', name: 'Roberto V.',  email: 'roberto@ejemplo.com', equipos: ['Norte'],  estado: 'Activo',     bg: '#e0f2fe', tc: '#0369a1' },
    { i: 'SM', name: 'Sandra M.',  email: 'sandra@ejemplo.com',  equipos: ['Centro'], estado: 'Activo',     bg: '#d8f3dc', tc: '#1a472a' },
    { i: 'DP', name: 'Diego P.',   email: 'diego@ejemplo.com',   equipos: ['Sur'],    estado: 'Activo',     bg: '#fef3c7', tc: '#b45309' },
    { i: 'CR', name: 'Claudia R.', email: 'claudia@ejemplo.com', equipos: ['Este'],   estado: 'Activo',     bg: '#f3e8ff', tc: '#7c3aed' },
    { i: 'MF', name: 'María F.',   email: 'maria.f@ejemplo.com', equipos: [],         estado: 'Sin equipo', bg: '#fce7f3', tc: '#be185d' },
  ],
}