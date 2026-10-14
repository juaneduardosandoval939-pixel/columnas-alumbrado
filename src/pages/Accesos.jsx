// Registro de ingresos al sistema
import { useMemo, useState } from 'react'
import { useColeccion, fechaCorta, ROLES, diaLocal } from '../datos'
import { Campo } from '../ui'

export default function Accesos() {
  const accesos = useColeccion('accesos')
  const usuarios = useColeccion('usuarios')
  const [fil, setFil] = useState({ usuarioId: '', desde: '', hasta: '' })
  const lista = useMemo(() => accesos.filter(a => {
    const d = diaLocal(a.fecha)
    if (fil.usuarioId && a.usuarioId !== fil.usuarioId) return false
    if (fil.desde && d < fil.desde) return false
    if (fil.hasta && d > fil.hasta) return false
    return true
  }), [accesos, fil])

  return (
    <>
      <div className="tarjeta">
        <div className="tenue" style={{ marginBottom: 10 }}>{accesos.length} accesos registrados</div>
        <div className="fila">
          <Campo label="Usuario">
            <select value={fil.usuarioId} onChange={e => setFil(p => ({ ...p, usuarioId: e.target.value }))}>
              <option value="">Todos</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Desde"><input type="date" value={fil.desde} onChange={e => setFil(p => ({ ...p, desde: e.target.value }))} /></Campo>
          <Campo label="Hasta"><input type="date" value={fil.hasta} onChange={e => setFil(p => ({ ...p, hasta: e.target.value }))} /></Campo>
        </div>
      </div>
      <div className="envoltura-tabla">
        <table className="tabla">
          <thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Día</th><th>Hora</th><th>Dispositivo</th></tr></thead>
          <tbody>
            {lista.slice(0, 500).map(a => (
              <tr key={a.id}>
                <td><b>{a.nombre}</b></td><td>{a.email}</td><td><span className={'etq ' + (a.rol === 'admin' ? 'verde' : 'gris')}>{ROLES[a.rol] || a.rol}</span></td>
                <td>{fechaCorta(a.fecha)}</td><td>{new Date(a.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
                <td className="tenue">{/Android|iPhone|iPad/i.test(a.dispositivo || '') ? '📱 Celular' : '💻 Computadora'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
