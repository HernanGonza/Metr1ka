import styles from './Landing.module.css'

function LegalSection({ children }) {
  return <div className={styles.legalSection}>{children}</div>
}

export const PRIVACY_POLICY = (
  <div>
    <p className={styles.legalUpdated}>Última actualización: Abril 2026</p>
    <p>En METR1KA valoramos tu privacidad. Esta política describe cómo recopilamos, usamos y protegemos la información personal de nuestros usuarios.</p>

    <h2>1. Información que recopilamos</h2>
    <ul>
      <li><strong>Datos de cuenta:</strong> nombre, email y organización al registrarte.</li>
      <li><strong>Datos de uso:</strong> interacción con la plataforma (páginas visitadas, funciones utilizadas).</li>
      <li><strong>Datos de encuestas:</strong> respuestas recolectadas por los clientes a través del sistema.</li>
      <li><strong>Datos de ubicación:</strong> coordenadas GPS asociadas a respuestas de campo, si el geofencing está habilitado.</li>
      <li><strong>Datos técnicos:</strong> dirección IP, tipo de dispositivo, navegador.</li>
    </ul>

    <h2>2. Uso de la información</h2>
    <ul>
      <li>Proveer y operar el sistema de encuestas de campo.</li>
      <li>Permitir la gestión de equipos, coordinadores y encuestadores.</li>
      <li>Procesar y visualizar respuestas en tiempo real.</li>
      <li>Mejorar el servicio y la experiencia de usuario.</li>
    </ul>

    <h2>3. Arquitectura y almacenamiento</h2>
    <p>Utilizamos <strong>Supabase</strong> como proveedor de base de datos y autenticación. La infraestructura está desplegada en servidores con acceso segmentado por roles (admin, coordinador, encuestador).</p>

    <h2>4. Encuestas públicas y privadas</h2>
    <ul>
      <li><strong>Encuestas privadas:</strong> acceso restringido mediante autenticación.</li>
      <li><strong>Encuestas públicas:</strong> accesibles mediante enlace único.</li>
      <li>Los datos recolectados pertenecen al cliente que creó la encuesta.</li>
    </ul>

    <h2>5. Compartición de datos</h2>
    <p>No vendemos datos personales. Los datos solo se comparten con el cliente dueño de la encuesta o ante requerimiento legal expreso.</p>

    <h2>6. Seguridad</h2>
    <p>Aplicamos medidas técnicas y organizativas para proteger la información, incluyendo cifrado en tránsito y en reposo, y control de acceso por roles.</p>

    <h2>7. Tus derechos</h2>
    <p>Podés solicitar acceso, rectificación o eliminación de tus datos en cualquier momento.</p>

    <p className={styles.legalContact}>Contacto: <a href="mailto:privacidad@metr1ka.com">privacidad@metr1ka.com</a></p>
  </div>
)

export const TERMS = (
  <div>
    <p className={styles.legalUpdated}>Última actualización: Abril 2026</p>
    <p>METR1KA es una plataforma para gestión y ejecución de encuestas de campo en tiempo real.</p>

    <h2>1. Uso del servicio</h2>
    <p>Al usar METR1KA aceptás estos términos. El servicio está destinado a organizaciones que realizan trabajo de campo con equipos de encuestadores.</p>

    <h2>2. Cuenta y seguridad</h2>
    <p>El usuario es responsable de mantener la seguridad de sus credenciales. Cada cuenta está asociada a un rol con permisos específicos.</p>

    <h2>3. Roles del sistema</h2>
    <ul>
      <li><strong>Admin / Gestor:</strong> gestiona la organización, encuestas y equipos.</li>
      <li><strong>Coordinador:</strong> administra y supervisa equipos de campo.</li>
      <li><strong>Encuestador:</strong> ejecuta encuestas en terreno a través de la app móvil.</li>
    </ul>

    <h2>4. Responsabilidad del cliente</h2>
    <p>El cliente es responsable de:</p>
    <ul>
      <li>El contenido y diseño de las encuestas.</li>
      <li>El uso adecuado de los datos recolectados.</li>
      <li>El cumplimiento de la legislación aplicable en materia de datos personales.</li>
    </ul>

    <h2>5. Disponibilidad</h2>
    <p>Trabajamos para mantener el servicio operativo de forma continua, aunque no garantizamos disponibilidad ininterrumpida.</p>

    <h2>6. Uso prohibido</h2>
    <p>No se permite:</p>
    <ul>
      <li>Uso ilegal o fraudulento del sistema.</li>
      <li>Recolección de datos sin consentimiento de los encuestados.</li>
      <li>Manipulación o intento de acceso no autorizado al sistema.</li>
    </ul>

    <h2>7. Propiedad intelectual</h2>
    <p>La plataforma, su diseño y código son propiedad de METR1KA y Paralelo Software Studio. Queda prohibida su reproducción sin autorización.</p>

    <h2>8. Modificaciones</h2>
    <p>Podemos actualizar estos términos en cualquier momento. Te notificaremos por email ante cambios significativos.</p>

    <p className={styles.legalContact}>Contacto: <a href="mailto:privacidad@metr1ka.com">privacidad@metr1ka.com</a></p>
  </div>
)

export const COOKIES = (
  <div>
    <p className={styles.legalUpdated}>Última actualización: Abril 2026</p>
    <p>Esta política explica cómo METR1KA utiliza cookies y tecnologías similares.</p>

    <h2>1. ¿Qué son las cookies?</h2>
    <p>Las cookies son pequeños archivos que se almacenan en tu navegador cuando visitás un sitio web. Nos permiten recordar tus preferencias y mantener tu sesión activa.</p>

    <h2>2. Tipos de cookies que usamos</h2>
    <ul>
      <li><strong>Esenciales:</strong> necesarias para la autenticación y funcionamiento del sistema (Supabase auth tokens).</li>
      <li><strong>Funcionales:</strong> guardan tus preferencias, como el tema claro/oscuro.</li>
      <li><strong>Analíticas:</strong> nos ayudan a entender cómo se usa el sistema para mejorarlo.</li>
    </ul>

    <h2>3. Cookies de autenticación</h2>
    <p>Utilizamos tokens JWT y cookies de sesión para mantener tu acceso activo de forma segura. Estas cookies son estrictamente necesarias para el funcionamiento del sistema.</p>

    <h2>4. Control de cookies</h2>
    <p>Podés configurar tu navegador para bloquear o eliminar cookies. Ten en cuenta que deshabilitar las cookies esenciales puede impedir el uso del sistema.</p>

    <h2>5. Cambios en esta política</h2>
    <p>Podemos actualizar esta política en cualquier momento. La fecha de última actualización siempre estará visible al inicio del documento.</p>

    <p className={styles.legalContact}>Contacto: <a href="mailto:privacidad@metr1ka.com">privacidad@metr1ka.com</a></p>
  </div>
)