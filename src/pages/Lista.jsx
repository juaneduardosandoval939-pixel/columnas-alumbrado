// Lista de cuadras pintadas con filtros, detalle y exportación a Excel
import { useMemo, useState } from 'react'
import { useColeccion, eliminar, num, fmt, fechaCorta, fechaHora, ESTADOS_CERT, diaLocal } from '../datos'
import { descartarPendiente } from '../fotos'
import { Campo, Modal, EtqCert, EtqOper, Fotos, exportarExcel } from '../ui'

// Qué cuadras puede ver cada rol
export function visibles(registros, usuario) {
  if (usuario.rol === 'cliente') return registros.filter(r => r.clienteId && r.clienteId === usuario.clienteId)
  if (usuario.rol === 'supervisor') return registros.filter(r => r.usuarioId === usuario.id)
  return registros
}

export function DetalleRegistro({ r, usuario, ir, onCerrar }) {
  const [confirmar, setConfirmar] = useState(false)
  const colores = useColeccion('colores')
  const conLitros = colores.filter(c => num(r.litros?.[c.id]) > 0)
  const puedeEditar = usuario.rol === 'admin' || (usuario.rol === 'supervisor' && !['Certificado', 'Facturado'].includes(r.estadoCert))
  function borrar() {
    (r.fotos || []).filter(f => f.pendiente).forEach(f => descartarPendiente(f.id))
    eliminar('registros', r.id)
    onCerrar()
  }
  return (
    <Modal titulo={`${r.calle} entre ${r.entre1}${r.entre2 ? ' y ' + r.entre2 : ''}`} onCerrar={onCerrar}>
      <div className="grilla" style={{ marginBottom: 12 }}>
        <div className="dato"><div className="etiqueta">Columnas</div><div className="valor">{fmt(r.columnas)}</div></div>
        <div className="dato"><div className="etiqueta">Estado</div><EtqOper v={r.estadoOperativo} /> <EtqCert v={r.estadoCert} /></div>
      </div>
      <p className="tenue">
        {fechaHora(r.fecha)} · {r.usuarioNombre}{r.clienteNombre ? ' · ' + r.clienteNombre : ''}
        {r.editado ? <><br />Editado {fechaHora(r.editado)} por {r.editadoPor}</> : null}
        {r.certificadoNumero ? <><br />Certificado N° {r.certificadoNumero}</> : null}
      </p>
      {r.lat && <p><a href={r.lat2 ? `https://www.google.com/maps/dir/${r.lat},${r.lng}/${r.lat2},${r.lng2}/data=!4m2!4m1!3e2` : `https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer">📍 Ver la cuadra en Google Maps</a></p>}
      {conLitros.length > 0 && <p><b>Pintura usada:</b> {conLitros.map(c => `${c.nombre} ${fmt(r.litros[c.id], 2)} L`).join(' · ')}</p>}
      {r.observaciones && <p><b>Observaciones:</b> {r.observaciones}</p>}
      <Fotos fotos={r.fotos} />
      {confirmar ? (
        <div className="error" style={{ marginTop: 12 }}>
          ¿Eliminar esta cuadra? No se puede deshacer.
          <div className="acciones" style={{ marginTop: 8 }}>
            <button className="btn peligro" onClick={borrar}>Sí, eliminar</button>
            <button className="btn sec" onClick={() => setConfirmar(false)}>No</button>
          </div>
        </div>
      ) : (
        <div className="acciones" style={{ marginTop: 14 }}>
          {puedeEditar && <button className="btn" onClick={() => { onCerrar(); ir('nuevo', { id: r.id }) }}>Editar</button>}
          {usuario.rol === 'admin' && <button className="btn peligro" onClick={() => setConfirmar(true)}>Eliminar</button>}
          <button className="btn sec" onClick={onCerrar}>Cerrar</button>
        </div>
      )}
    </Modal>
  )
}

export default function Lista({ usuario, ir }) {
  const registros = visibles(useColeccion('registros'), usuario)
  const clientes = useColeccion('clientes')
  const usuarios = useColeccion('usuarios')
  const colores = useColeccion('colores')
  const [fil, setFil] = useState({ desde: '', hasta: '', clienteId: '', usuarioId: '', cert: '', texto: '' })
  const [detalle, setDetalle] = useState(null)
  const cambiar = (k, v) => setFil(p => ({ ...p, [k]: v }))

  const lista = useMemo(() => {
    const t = fil.texto.trim().toLowerCase()
    return registros.filter(r => {
      const d = diaLocal(r.fecha)
      if (fil.desde && d < fil.desde) return false
      if (fil.hasta && d > fil.hasta) return false
      if (fil.clienteId && r.clienteId !== fil.clienteId) return false
      if (fil.usuarioId && r.usuarioId !== fil.usuarioId) return false
      if (fil.cert && (r.estadoCert || 'Sin certificar') !== fil.cert) return false
      if (t && ![r.calle, r.entre1, r.entre2].join(' ').toLowerCase().includes(t)) return false
      return true
    })
  }, [registros, fil])
  const total = lista.reduce((s, r) => s + num(r.columnas), 0)

  function exportar() {
    exportarExcel(`columnas_${new Date().toISOString().slice(0, 10)}.xlsx`, [{
      nombre: 'Cuadras',
      filas: lista.map(r => ({
        Fecha: fechaCorta(r.fecha), Calle: r.calle, 'Entre calle': r.entre1, 'Y calle': r.entre2,
        Columnas: num(r.columnas),
        ...Object.fromEntries(colores.map(c => [`Litros ${c.nombre}`, num(r.litros?.[c.id])])),
        Cliente: r.clienteNombre, Usuario: r.usuarioNombre,
        'Estado trabajo': r.estadoOperativo, Certificación: r.estadoCert || 'Sin certificar',
        'Certificado N°': r.certificadoNumero || '', 'Latitud inicio': r.lat, 'Longitud inicio': r.lng, 'Latitud fin': r.lat2 || '', 'Longitud fin': r.lng2 || '',
        Fotos: (r.fotos || []).filter(f => f.url).map(f => f.url).join(' '), Observaciones: r.observaciones,
      })),
      anchos: [11, 24, 20, 20, 9, ...colores.map(() => 14), 20, 18, 13, 14, 12, 11, 11, 11, 11, 40, 30],
    }])
  }

  const actual = detalle && registros.find(r => r.id === detalle)

  return (
    <>
      <div className="tarjeta">
        <div className="fila">
          <Campo label="Buscar calle"><input value={fil.texto} onChange={e => cambiar('texto', e.target.value)} placeholder="Calle o intersección" /></Campo>
          <Campo label="Desde"><input type="date" value={fil.desde} onChange={e => cambiar('desde', e.target.value)} /></Campo>
          <Campo label="Hasta"><input type="date" value={fil.hasta} onChange={e => cambiar('hasta', e.target.value)} /></Campo>
          {usuario.rol !== 'cliente' && clientes.length > 0 && (
            <Campo label="Cliente">
              <select value={fil.clienteId} onChange={e => cambiar('clienteId', e.target.value)}>
                <option value="">Todos</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Campo>
          )}
          {usuario.rol === 'admin' && (
            <Campo label="Usuario">
              <select value={fil.usuarioId} onChange={e => cambiar('usuarioId', e.target.value)}>
                <option value="">Todos</option>
                {usuarios.filter(u => u.rol !== 'cliente').map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </Campo>
          )}
          <Campo label="Certificación">
            <select value={fil.cert} onChange={e => cambiar('cert', e.target.value)}>
              <option value="">Todas</option>
              {ESTADOS_CERT.map(x => <option key={x}>{x}</option>)}
            </select>
          </Campo>
        </div>
        <div className="acciones">
          <span style={{ alignSelf: 'center', flex: 1 }}><b>{lista.length}</b> cuadras · <b>{fmt(total)}</b> columnas</span>
          <button className="btn sec" onClick={exportar} disabled={!lista.length}>⬇ Exportar Excel</button>
          {usuario.rol !== 'cliente' && <button className="btn" onClick={() => ir('nuevo')}>➕ Nueva cuadra</button>}
        </div>
      </div>
      {lista.length === 0 ? <div className="tarjeta tenue">No hay cuadras para mostrar.</div> : (
        <div className="envoltura-tabla">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Calle</th><th>Entre</th><th className="num">Columnas</th><th>Usuario</th><th>Estado</th><th>Certificación</th><th>Fotos</th></tr></thead>
            <tbody>
              {lista.map(r => (
                <tr key={r.id} className="clic" onClick={() => setDetalle(r.id)}>
                  <td>{fechaCorta(r.fecha)}</td>
                  <td>{r.calle}</td>
                  <td>{r.entre1}{r.entre2 ? ' y ' + r.entre2 : ''}</td>
                  <td className="num"><b>{fmt(r.columnas)}</b></td>
                  <td>{r.usuarioNombre}</td>
                  <td><EtqOper v={r.estadoOperativo} /></td>
                  <td><EtqCert v={r.estadoCert} /></td>
                  <td>{(r.fotos || []).length || ''}{(r.fotos || []).some(f => f.pendiente) ? ' ⏳' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {actual && <DetalleRegistro r={actual} usuario={usuario} ir={ir} onCerrar={() => setDetalle(null)} />}
    </>
  )
}
