// Usuarios y roles
import { useState } from 'react'
import { useColeccion, guardar, nuevoId, hashClave, ROLES } from '../datos'
import { Campo, Modal } from '../ui'

export default function Usuarios({ usuario }) {
  const usuarios = useColeccion('usuarios')
  const clientes = useColeccion('clientes')
  const [editar, setEditar] = useState(undefined)
  const [f, setF] = useState({})
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')

  function abrir(u) {
    setF(u || { id: nuevoId(), nombre: '', email: '', rol: 'supervisor', clienteId: '', activo: true })
    setClave(''); setError('')
    setEditar(u || null)
  }

  async function guardarUsuario() {
    const email = (f.email || '').trim().toLowerCase()
    if (!f.nombre?.trim() || !email) return setError('Completá nombre y email')
    if (usuarios.some(u => u.id !== f.id && u.email.toLowerCase() === email)) return setError('Ya existe un usuario con ese email')
    if (!editar && clave.length < 6) return setError('La contraseña inicial debe tener al menos 6 caracteres')
    if (f.rol === 'cliente' && !f.clienteId) return setError('Elegí el cliente que va a ver este usuario')
    if (editar?.id === usuario.id && f.rol !== 'admin') return setError('No podés quitarte el rol de administrador')
    const datos = { ...f, nombre: f.nombre.trim(), email }
    // Si cambia la contraseña o el email, se recalcula el hash (la sal es el email)
    if (clave) { datos.passHash = await hashClave(email, clave); datos.debeCambiar = true }
    else if (editar && email !== editar.email.toLowerCase()) return setError('Si cambiás el email, cargá también una contraseña nueva')
    guardar('usuarios', datos)
    setEditar(undefined)
  }

  return (
    <>
      <div className="acciones" style={{ marginBottom: 14 }}><button className="btn" onClick={() => abrir(null)}>➕ Nuevo usuario</button></div>
      <div className="envoltura-tabla">
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id}>
                <td><b>{u.nombre}</b>{u.rol === 'cliente' && <div className="tenue">{clientes.find(c => c.id === u.clienteId)?.nombre}</div>}</td>
                <td>{u.email}</td>
                <td><span className={'etq ' + (u.rol === 'admin' ? 'verde' : u.rol === 'supervisor' ? 'gris' : 'azul')}>{ROLES[u.rol]}</span></td>
                <td>{u.activo !== false ? <span className="etq verde">Activo</span> : <span className="etq gris">Desactivado</span>}{u.debeCambiar ? <div className="tenue">Debe cambiar la contraseña</div> : null}</td>
                <td><button className="btn sec chico" onClick={() => abrir(u)}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editar !== undefined && (
        <Modal titulo={editar ? 'Editar usuario' : 'Nuevo usuario'} onCerrar={() => setEditar(undefined)}>
          {error && <div className="error">{error}</div>}
          <Campo label="Nombre *"><input value={f.nombre} onChange={e => setF(p => ({ ...p, nombre: e.target.value }))} /></Campo>
          <Campo label="Email *"><input type="email" value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))} /></Campo>
          <Campo label={editar ? 'Nueva contraseña (dejar vacío para no cambiarla)' : 'Contraseña inicial *'}>
            <input value={clave} onChange={e => setClave(e.target.value)} placeholder="La persona la cambia al entrar" />
          </Campo>
          <div className="fila">
            <Campo label="Rol">
              <select value={f.rol} onChange={e => setF(p => ({ ...p, rol: e.target.value }))}>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            {f.rol === 'cliente' && (
              <Campo label="Cliente que ve">
                <select value={f.clienteId} onChange={e => setF(p => ({ ...p, clienteId: e.target.value }))}>
                  <option value="">Seleccioná…</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </Campo>
            )}
          </div>
          <div className="tenue" style={{ marginBottom: 10 }}>
            Administrador: todo · Supervisor: abre turnos, carga cuadras y ve las suyas · Cliente: ve la lista y el mapa de sus cuadras.
          </div>
          {editar?.id !== usuario.id && (
            <label style={{ display: 'block', marginBottom: 12 }}><input type="checkbox" checked={f.activo !== false} onChange={e => setF(p => ({ ...p, activo: e.target.checked }))} /> Activo (si lo desactivás no puede entrar)</label>
          )}
          <div className="acciones">
            <button className="btn" onClick={guardarUsuario}>Guardar</button>
            <button className="btn sec" onClick={() => setEditar(undefined)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </>
  )
}
