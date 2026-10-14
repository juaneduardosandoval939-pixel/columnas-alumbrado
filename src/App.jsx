import { useEffect, useState } from 'react'
import { leer, guardar, hashClave, asegurarHashes, registrarAcceso, sync, useEstadoSync, useColeccion, ROLES } from './datos'
import { subirPendientes, cantidadPendientes } from './fotos'
import { Campo } from './ui'
import Panel from './pages/Panel'
import Turno from './pages/Turno'
import FormRegistro from './pages/FormRegistro'
import Lista from './pages/Lista'
import Mapa from './pages/Mapa'
import Certificaciones from './pages/Certificaciones'
import Materiales from './pages/Materiales'
import Turnos from './pages/Turnos'
import Clientes from './pages/Clientes'
import Usuarios from './pages/Usuarios'
import Accesos from './pages/Accesos'

// Pantallas del menú y qué roles las ven
const MENU = [
  { id: 'panel',           icono: '📊', label: 'Panel',            roles: ['admin'] },
  { id: 'turno',           icono: '⏱️', label: 'Mi turno',         roles: ['supervisor'] },
  { id: 'nuevo',           icono: '➕', label: 'Nueva cuadra',     roles: ['admin', 'supervisor'] },
  { id: 'lista',           icono: '📋', label: 'Lista',            roles: ['admin', 'supervisor', 'cliente'] },
  { id: 'mapa',            icono: '🗺️', label: 'Mapa',             roles: ['admin', 'supervisor', 'cliente'] },
  { id: 'certificaciones', icono: '✅', label: 'Certificaciones',  roles: ['admin'] },
  { id: 'turnos',          icono: '📈', label: 'Turnos y productividad', roles: ['admin'] },
  { id: 'materiales',      icono: '🎨', label: 'Pinturas y stock', roles: ['admin'] },
  { id: 'clientes',        icono: '🏛️', label: 'Clientes',         roles: ['admin'] },
  { id: 'usuarios',        icono: '👥', label: 'Usuarios',         roles: ['admin'] },
  { id: 'accesos',         icono: '🛡️', label: 'Accesos',          roles: ['admin'] },
]
const INICIO = { admin: 'panel', supervisor: 'turno', cliente: 'lista' }
const CLAVE_SESION = 'col_sesion'

function Login({ onEntrar }) {
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setError(''); setCargando(true)
    try {
      if (navigator.onLine) await sync.sincronizar()   // trae usuarios nuevos o contraseñas cambiadas
      const hash = await hashClave(email, clave)
      const u = leer('usuarios').find(x => x.email.trim().toLowerCase() === email.trim().toLowerCase())
      if (!u || u.passHash !== hash) return setError('Usuario o contraseña incorrectos')
      if (u.activo === false) return setError('Usuario desactivado. Consultá con el administrador.')
      onEntrar(u)
    } finally { setCargando(false) }
  }

  return (
    <div className="login">
      <form className="caja" onSubmit={entrar}>
        <h1>Columnas de Alumbrado</h1>
        <div className="tenue" style={{ marginBottom: 18 }}>Crear Construcciones y Mantenimiento S.A.</div>
        {error && <div className="error">{error}</div>}
        <Campo label="Email"><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required /></Campo>
        <Campo label="Contraseña"><input type="password" value={clave} onChange={e => setClave(e.target.value)} autoComplete="current-password" required /></Campo>
        <button className="btn grande" disabled={cargando}>{cargando ? 'Ingresando…' : 'Ingresar'}</button>
        <div className="tenue" style={{ marginTop: 14, textAlign: 'center' }}>¿No tenés cuenta? Pedila al administrador.</div>
      </form>
    </div>
  )
}

function CambiarClave({ usuario, onListo }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [error, setError] = useState('')
  async function guardarClave(e) {
    e.preventDefault()
    if (a.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')
    if (a !== b) return setError('Las contraseñas no coinciden')
    const passHash = await hashClave(usuario.email, a)
    const u = { ...leer('usuarios').find(x => x.id === usuario.id), passHash, debeCambiar: false }
    guardar('usuarios', u)
    onListo(u)
  }
  return (
    <div className="login">
      <form className="caja" onSubmit={guardarClave}>
        <h1>Elegí tu contraseña</h1>
        <div className="tenue" style={{ marginBottom: 18 }}>Es tu primer ingreso: reemplazá la contraseña inicial.</div>
        {error && <div className="error">{error}</div>}
        <Campo label="Nueva contraseña"><input type="password" value={a} onChange={e => setA(e.target.value)} autoComplete="new-password" /></Campo>
        <Campo label="Repetir contraseña"><input type="password" value={b} onChange={e => setB(e.target.value)} autoComplete="new-password" /></Campo>
        <button className="btn grande">Guardar</button>
      </form>
    </div>
  )
}

function EstadoSync() {
  const e = useEstadoSync()
  const [online, setOnline] = useState(navigator.onLine)
  const [fotos, setFotos] = useState(0)
  useEffect(() => {
    const on = () => setOnline(navigator.onLine)
    window.addEventListener('online', on); window.addEventListener('offline', on)
    const t = setInterval(() => cantidadPendientes().then(setFotos), 5000)
    cantidadPendientes().then(setFotos)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on); clearInterval(t) }
  }, [])
  let texto, estilo
  if (!e.configurado) { texto = 'Sin servidor configurado'; estilo = { background: '#fde2e0', color: '#a12b1f' } }
  else if (!online) { texto = 'Sin señal — se guarda en el celular'; estilo = { background: '#fff3cd', color: '#6b4e00' } }
  else if (e.ok === false) { texto = 'Error al sincronizar — reintentar'; estilo = { background: '#fde2e0', color: '#a12b1f' } }
  else if (e.ultima) { texto = '☁ Sincronizado ' + e.ultima.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); estilo = { background: '#dcf3e3', color: '#17663a' } }
  else { texto = 'Sincronizando…'; estilo = { background: '#eceff1', color: '#546e7a' } }
  if (fotos > 0) texto += ` · ${fotos} foto${fotos > 1 ? 's' : ''} por subir`
  return <button className="estado-sync" style={estilo} title={e.error || ''} onClick={() => { sync.sincronizar(); subirPendientes() }}>{texto}</button>
}

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [listo, setListo] = useState(false)
  const [vista, setVista] = useState({ id: '', params: {} })
  const [menuAbierto, setMenuAbierto] = useState(false)
  const usuarios = useColeccion('usuarios')

  // Arranque: hashes iniciales, sesión guardada y sincronización periódica
  useEffect(() => {
    asegurarHashes().then(() => {
      const id = localStorage.getItem(CLAVE_SESION)
      const u = id && leer('usuarios').find(x => x.id === id && x.activo !== false)
      if (u) { setUsuario(u); setVista({ id: INICIO[u.rol], params: {} }) }
      setListo(true)
      sync.sincronizar().then(subirPendientes)
    })
    const alVolver = () => { sync.sincronizar().then(subirPendientes) }
    window.addEventListener('online', alVolver)
    const t = setInterval(alVolver, 60000)
    return () => { window.removeEventListener('online', alVolver); clearInterval(t) }
  }, [])

  // Si el admin desactiva al usuario o le cambia el rol, se refleja al sincronizar
  useEffect(() => {
    if (!usuario) return
    const u = usuarios.find(x => x.id === usuario.id)
    if (!u || u.activo === false) salir()
    else if (u.rol !== usuario.rol || u.nombre !== usuario.nombre) setUsuario(u)
  }, [usuarios])

  function entrar(u) {
    localStorage.setItem(CLAVE_SESION, u.id)
    registrarAcceso(u)
    setUsuario(u)
    setVista({ id: INICIO[u.rol], params: {} })
  }
  function salir() {
    localStorage.removeItem(CLAVE_SESION)
    setUsuario(null)
  }
  function ir(id, params = {}) {
    setVista({ id, params })
    setMenuAbierto(false)
    window.scrollTo(0, 0)
  }

  if (!listo) return null
  if (!usuario) return <Login onEntrar={entrar} />
  if (usuario.debeCambiar) return <CambiarClave usuario={usuario} onListo={setUsuario} />

  const menu = MENU.filter(m => m.roles.includes(usuario.rol))
  const actual = menu.find(m => m.id === vista.id) || menu[0]
  const p = { usuario, ir, params: vista.params }
  const titulo = actual.id === 'nuevo' && vista.params.id ? 'Editar cuadra' : actual.label

  return (
    <div className="app">
      <div className={'velo' + (menuAbierto ? ' abierto' : '')} onClick={() => setMenuAbierto(false)} />
      <aside className={'lateral' + (menuAbierto ? ' abierto' : '')}>
        <div className="marca">CREAR · Columnas<small>Pintura de alumbrado público</small></div>
        <nav className="menu">
          {menu.map(m => (
            <button key={m.id} className={m.id === actual.id ? 'activo' : ''} onClick={() => ir(m.id)}>
              <span>{m.icono}</span>{m.label}
            </button>
          ))}
        </nav>
        <div className="pie-lateral">
          <div><b>{usuario.nombre}</b></div>
          <div>{ROLES[usuario.rol]}</div>
          <button className="btn sec chico" style={{ marginTop: 8 }} onClick={salir}>Cerrar sesión</button>
        </div>
      </aside>
      <div className="principal">
        <header className="barra">
          <button className="hamburguesa" onClick={() => setMenuAbierto(true)}>☰</button>
          <h1>{titulo}</h1>
          <EstadoSync />
        </header>
        <main className="contenido">
          {actual.id === 'panel' && <Panel {...p} />}
          {actual.id === 'turno' && <Turno {...p} />}
          {actual.id === 'nuevo' && <FormRegistro key={vista.params.id || vista.params.otra || 'nuevo'} {...p} />}
          {actual.id === 'lista' && <Lista {...p} />}
          {actual.id === 'mapa' && <Mapa {...p} />}
          {actual.id === 'certificaciones' && <Certificaciones {...p} />}
          {actual.id === 'turnos' && <Turnos {...p} />}
          {actual.id === 'materiales' && <Materiales {...p} />}
          {actual.id === 'clientes' && <Clientes {...p} />}
          {actual.id === 'usuarios' && <Usuarios {...p} />}
          {actual.id === 'accesos' && <Accesos {...p} />}
        </main>
      </div>
    </div>
  )
}
