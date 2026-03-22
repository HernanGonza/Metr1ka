// Datos de contenido de la landing page
// Separados del componente para facilitar edición

export const SECTIONS = [
  { id: 'inicio',     label: 'Inicio' },
  { id: 'sistema',    label: 'El sistema' },
  { id: 'flujo',      label: 'Flujo' },
  { id: 'panel',      label: 'Panel central' },
  { id: 'app',        label: 'App móvil' },
  { id: 'precios',    label: 'Precios' },
  { id: 'tecnologia', label: 'Tecnología' },
]

export const FLOW_STEPS = [
  {
    title: 'Nosotros armamos la encuesta',
    detail: 'Nuestro equipo diseña la encuesta a medida: las preguntas correctas, en el orden correcto, pensadas para los objetivos de cada cliente.',
    chips: ['Preguntas validadas', 'Entrega en 48h', 'Revisiones incluidas', 'Lista para usar'],
  },
  {
    title: 'Asigna al equipo',
    detail: 'El admin asigna la encuesta a uno o varios equipos. Una misma encuesta puede correr en múltiples equipos simultáneamente, sin necesidad de crearla de nuevo.',
    chips: ['Equipo Norte', 'Equipo Centro', 'Equipo Sur'],
  },
  {
    title: 'Coordinador distribuye',
    detail: 'El coordinador de cada equipo ve las encuestas disponibles y las asigna a los encuestadores de su equipo según la zona o el perfil.',
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
    label: 'Admin',
    title: 'El cliente',
    desc: 'Ve únicamente su organización. Gestiona equipos, monitorea resultados y opera desde su panel central.',
    perms: [
      'Accede a sus encuestas activas',
      'Crea equipos y asigna coordinadores',
      'Invita coordinadores y encuestadores',
      'Panel completo en tiempo real',
    ],
  },
  {
    key: 'coordinador',
    badge: 'coordinador',
    label: 'Coordinador',
    title: 'Jefe de campo',
    desc: 'Gestiona su equipo en el campo. Ve el mapa en tiempo real, asigna encuestas y controla el avance.',
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
    desc: 'Usa la app móvil para completar encuestas puerta a puerta. No accede al panel web.',
    perms: [
      'Recibe encuestas asignadas en la app',
      'Completa entrevistas',
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

export const TECH_CARDS = [
  {
    title: 'Datos aislados por cliente',
    text: 'Cada organización ve únicamente sus propios datos. La separación está garantizada a nivel de base de datos, no solo a nivel de aplicación.',
    tag: 'Seguridad',
  },
  {
    title: 'Sin servidor que mantener',
    text: 'La infraestructura corre sobre servicios administrados en la nube. No hay servidor propio que configurar ni actualizar.',
    tag: 'Infraestructura',
  },
  {
    title: 'Tiempo real nativo',
    text: 'Las respuestas llegan al panel en tiempo real gracias a suscripciones de base de datos en vivo. Sin polling, sin recargar.',
    tag: 'Tecnología',
  },
  {
    title: 'App en Android e iOS',
    text: 'La app funciona en ambas plataformas. Un solo código base, sin desarrollo doble.',
    tag: 'Mobile',
  },
  {
    title: 'Personalizable por cliente',
    text: 'Logo, colores y nombre pueden adaptarse para cada cliente sin cambiar el sistema. El core es siempre el mismo.',
    tag: 'Whitelabel',
  },
  {
    title: 'Funciona offline',
    text: 'Los encuestadores pueden trabajar sin conexión. Las respuestas se sincronizan automáticamente cuando vuelve el internet.',
    tag: 'Resiliencia',
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
    { icon: '📵', title: 'Funciona sin internet', desc: 'Guarda respuestas offline y las sube automáticamente cuando vuelve la conexión.' },
  ],
  coordinador: [
    { icon: '🗺️', title: 'Mapa en tiempo real', desc: 'Ve dónde está cada encuestador de su equipo en este momento.' },
    { icon: '👥', title: 'Control del equipo', desc: 'Cuántas encuestas completó cada uno, quién está activo y quién está pausado.' },
    { icon: '📋', title: 'Asignar encuestas', desc: 'Asigna o desasigna encuestas a sus encuestadores directamente desde la app.' },
    { icon: '⚡', title: 'Alertas instantáneas', desc: 'Notificación cuando un encuestador completa su meta o se queda sin conexión.' },
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
      { key: 'dashboard',    icon: '📊', label: 'Dashboard' },
      { key: 'mapa',         icon: '🗺️', label: 'Mapa en vivo' },
    ],
  },
  {
    group: 'Gestión',
    items: [
      { key: 'encuestas',      icon: '📋', label: 'Encuestas' },
      { key: 'equipos',        icon: '👥', label: 'Equipos' },
      { key: 'coordinadores',  icon: '👔', label: 'Coordinadores' },
      { key: 'encuestadores',  icon: '👤', label: 'Encuestadores' },
    ],
  },
  {
    group: 'Herramientas',
    items: [
      { key: 'reportes',      icon: '📁', label: 'Reportes' },
      { key: 'configuracion', icon: '⚙️', label: 'Configuración' },
    ],
  },
]

export const DASHBOARD_DATA = {
  kpis: [
    { l: 'Encuestas hoy',          v: '412', s: '+38 última hora' },
    { l: 'Encuestadores activos',  v: '23',  s: 'de 28 total' },
    { l: 'Encuesta más usada',     v: 'Satisfacción', s: 'general' },
    { l: 'Zona líder',             v: 'Centro', s: '118 respuestas' },
  ],
  encuestadores: [
    { initials: 'MR', name: 'María R.',  status: 'active', zone: 'Norte', count: 14, bg: '#d8f3dc', tc: '#1a472a' },
    { initials: 'JL', name: 'Juan L.',   status: 'active', zone: 'Centro', count: 9,  bg: '#e0f2fe', tc: '#0369a1' },
    { initials: 'AS', name: 'Ana S.',    status: 'idle',   zone: 'Sur',   count: 7,  bg: '#fef3c7', tc: '#b45309' },
    { initials: 'CP', name: 'Carlos P.', status: 'active', zone: 'Este',  count: 11, bg: '#f3e8ff', tc: '#7c3aed' },
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
    { icon: '📍', title: 'Mapa de calor por zona',     meta: 'Todas las encuestas · Esta semana' },
    { icon: '👥', title: 'Desempeño de encuestadores', meta: 'Todos los equipos · Este mes' },
    { icon: '📋', title: 'Respuestas completas',       meta: 'Seguridad barrial · 187 registros' },
    { icon: '📈', title: 'Evolución temporal',         meta: 'Últimos 30 días' },
  ],
  configCards: [
    { l: 'Notificaciones por email',  s: 'Recibir alertas de actividad',           on: true  },
    { l: 'Alertas en tiempo real',    s: 'Aviso al completar cada entrevista',      on: true  },
    { l: 'Modo offline en app',       s: 'Permitir encuestas sin conexión',         on: false },
    { l: 'Perfil obligatorio',        s: 'Bloquear acceso hasta completar perfil',  on: true  },
    { l: 'Reporte diario automático', s: 'Generar PDF cada mañana',                on: false },
  ],
  coordinadores: [
    { i: 'RV', name: 'Roberto V.',  email: 'roberto@ejemplo.com', equipos: ['Norte'],   estado: 'Activo',     bg: '#e0f2fe', tc: '#0369a1' },
    { i: 'SM', name: 'Sandra M.',  email: 'sandra@ejemplo.com',  equipos: ['Centro'],  estado: 'Activo',     bg: '#d8f3dc', tc: '#1a472a' },
    { i: 'DP', name: 'Diego P.',   email: 'diego@ejemplo.com',   equipos: ['Sur'],     estado: 'Activo',     bg: '#fef3c7', tc: '#b45309' },
    { i: 'CR', name: 'Claudia R.', email: 'claudia@ejemplo.com', equipos: ['Este'],    estado: 'Activo',     bg: '#f3e8ff', tc: '#7c3aed' },
    { i: 'MF', name: 'María F.',   email: 'maria.f@ejemplo.com', equipos: [],          estado: 'Sin equipo', bg: '#fce7f3', tc: '#be185d' },
  ],
}