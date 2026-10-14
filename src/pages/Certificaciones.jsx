// Certificados: cantidad de columnas pintadas por calle e intersecciones
import { useMemo, useState } from 'react'
import { useColeccion, guardar, actualizar, leer, guardarColeccion, nuevoId, num, fmt, fechaCorta, diaLocal } from '../datos'
import { Campo, Modal, exportarExcel } from '../ui'

const ITEM = 'Pintura de columna de alumbrado público (3 colores)'

// Agrupa las cuadras por calle (corredor), ordenadas, con subtotal por calle
export function agruparPorCalle(regs) {
  const grupos = new Map()
  for (const r of regs) {
    const k = r.calle.trim()
    if (!grupos.has(k)) grupos.set(k, [])
    grupos.get(k).push(r)
  }
  return [...grupos.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .map(([calle, filas]) => ({
      calle,
      filas: filas.sort((a, b) => (a.entre1 || '').localeCompare(b.entre1 || '', 'es')),
      subtotal: filas.reduce((s, r) => s + num(r.columnas), 0),
    }))
}

function VistaCertificado({ cert, onCerrar }) {
  const registros = useColeccion('registros')
  const obra = useColeccion('clientes').find(c => c.id === cert.clienteId)?.obra || ''
  const regs = registros.filter(r => cert.registroIds.includes(r.id))
  const grupos = agruparPorCalle(regs)
  const total = regs.reduce((s, r) => s + num(r.columnas), 0)
  const precio = num(cert.precio)

  function excel() {
    const aoa = [
      ['CERTIFICADO DE OBRA N° ' + cert.numero],
      ['Crear Construcciones y Mantenimiento S.A.'],
      ['Cliente: ' + (cert.clienteNombre || '-')],
      ...(obra ? [['Obra: ' + obra]] : []),
      ['Período: ' + fechaCorta(cert.desde) + ' al ' + fechaCorta(cert.hasta) + '   ·   Emitido: ' + fechaCorta(cert.fecha)],
      ['Ítem: ' + ITEM + '   ·   Unidad: u'],
      [],
      ['CORREDOR (CALLE)', 'ENTRE CALLE', 'Y CALLE', 'COLUMNAS (u)', 'TOTAL CORREDOR (u)'],
    ]
    for (const g of grupos) g.filas.forEach((r, i) => aoa.push([i === 0 ? g.calle : '', r.entre1, r.entre2 || '', num(r.columnas), i === g.filas.length - 1 ? g.subtotal : '']))
    aoa.push(['TOTAL', '', '', total, total])
    if (precio) { aoa.push([]); aoa.push(['Precio unitario', '', '', precio]); aoa.push(['MONTO TOTAL', '', '', total * precio]) }
    aoa.push([], [], ['_______________________', '', '', '_______________________'], ['Firma y aclaración — Contratista', '', '', 'Firma y aclaración — Inspección'])
    exportarExcel(`Certificado_${String(cert.numero).padStart(2, '0')}_columnas.xlsx`, [{ nombre: 'Certificado ' + cert.numero, aoa, anchos: [30, 26, 26, 14, 20] }])
  }

  return (
    <Modal titulo={`Certificado N° ${cert.numero}`} onCerrar={onCerrar} ancho={860}>
      <div className="solo-impresion" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>CERTIFICADO DE OBRA N° {cert.numero}</h2>
        <div>Crear Construcciones y Mantenimiento S.A.</div>
      </div>
      <p>
        <b>Cliente:</b> {cert.clienteNombre || '-'}<br />
        {obra && <><b>Obra:</b> {obra}<br /></>}
        <b>Período:</b> {fechaCorta(cert.desde)} al {fechaCorta(cert.hasta)} · <b>Emitido:</b> {fechaCorta(cert.fecha)}<br />
        <b>Ítem:</b> {ITEM} · Unidad: u
      </p>
      <div className="envoltura-tabla">
        <table className="tabla">
          <thead><tr><th>Corredor (calle)</th><th>Entre calle</th><th>Y calle</th><th className="num">Columnas (u)</th><th className="num">Total corredor</th></tr></thead>
          <tbody>
            {grupos.map(g => g.filas.map((r, i) => (
              <tr key={r.id}>
                <td>{i === 0 ? <b>{g.calle}</b> : ''}</td><td>{r.entre1}</td><td>{r.entre2}</td>
                <td className="num">{fmt(r.columnas)}</td><td className="num">{i === g.filas.length - 1 ? <b>{fmt(g.subtotal)}</b> : ''}</td>
              </tr>
            )))}
            <tr><td colSpan={3}><b>TOTAL</b></td><td className="num"><b>{fmt(total)}</b></td><td className="num"><b>{fmt(total)}</b></td></tr>
            {precio > 0 && <tr><td colSpan={3}>Precio unitario $ {fmt(precio, 2)}</td><td colSpan={2} className="num"><b>$ {fmt(total * precio, 2)}</b></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="solo-impresion" style={{ marginTop: 60 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>_______________________<br />Firma y aclaración — Contratista</div>
          <div>_______________________<br />Firma y aclaración — Inspección</div>
        </div>
      </div>
      <div className="acciones no-imprimir" style={{ marginTop: 14 }}>
        <button className="btn" onClick={excel}>⬇ Excel</button>
        <button className="btn sec" onClick={() => window.print()}>🖨 Imprimir / PDF</button>
        <button className="btn sec" onClick={onCerrar}>Cerrar</button>
      </div>
    </Modal>
  )
}

function NuevoCertificado({ onCerrar, onCreado }) {
  const registros = useColeccion('registros')
  const clientes = useColeccion('clientes')
  const certificados = useColeccion('certificados')
  const activos = clientes.filter(c => c.activo !== false)
  const [f, setF] = useState({ clienteId: activos.length === 1 ? activos[0].id : '', desde: '', hasta: '', precio: '' })
  const [excluidos, setExcluidos] = useState(new Set())
  const cambiar = (k, v) => setF(p => ({ ...p, [k]: v }))

  // Solo cuadras terminadas y sin certificar (así nada se certifica dos veces)
  const candidatos = useMemo(() => registros.filter(r => {
    if (r.estadoOperativo !== 'Terminado') return false
    if (!['Sin certificar', 'En revisión', undefined, ''].includes(r.estadoCert)) return false
    if (clientes.length && r.clienteId !== f.clienteId) return false
    const d = diaLocal(r.fecha)
    if (f.desde && d < f.desde) return false
    if (f.hasta && d > f.hasta) return false
    return true
  }), [registros, f, clientes.length])
  const elegidos = candidatos.filter(r => !excluidos.has(r.id))
  const total = elegidos.reduce((s, r) => s + num(r.columnas), 0)
  const numero = Math.max(0, ...certificados.map(c => num(c.numero))) + 1

  function crear() {
    const cli = clientes.find(c => c.id === f.clienteId)
    const fechas = elegidos.map(r => diaLocal(r.fecha)).sort()
    const cert = {
      id: nuevoId(), numero, fecha: new Date().toISOString(),
      clienteId: f.clienteId, clienteNombre: cli?.nombre || '',
      desde: f.desde || fechas[0], hasta: f.hasta || fechas[fechas.length - 1],
      registroIds: elegidos.map(r => r.id), total, precio: num(f.precio) || 0, estado: 'Emitido',
    }
    guardar('certificados', cert)
    const ids = new Set(cert.registroIds)
    guardarColeccion('registros', leer('registros').map(r => ids.has(r.id)
      ? { ...r, estadoCert: 'Certificado', certificadoId: cert.id, certificadoNumero: cert.numero } : r))
    onCreado(cert)
  }

  return (
    <Modal titulo={`Nuevo certificado N° ${numero}`} onCerrar={onCerrar} ancho={860}>
      <div className="fila">
        {clientes.length > 0 && (
          <Campo label="Cliente">
            <select value={f.clienteId} onChange={e => cambiar('clienteId', e.target.value)}>
              <option value="">Seleccioná…</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
        )}
        <Campo label="Desde"><input type="date" value={f.desde} onChange={e => cambiar('desde', e.target.value)} /></Campo>
        <Campo label="Hasta"><input type="date" value={f.hasta} onChange={e => cambiar('hasta', e.target.value)} /></Campo>
        <Campo label="Precio unitario (opcional)"><input type="number" min="0" step="0.01" value={f.precio} onChange={e => cambiar('precio', e.target.value)} /></Campo>
      </div>
      <p><b>{elegidos.length}</b> cuadras · <b>{fmt(total)}</b> columnas{num(f.precio) > 0 ? ` · $ ${fmt(total * num(f.precio), 2)}` : ''}</p>
      {clientes.length > 0 && !f.clienteId ? <div className="aviso">Elegí el cliente del certificado.</div> : candidatos.length === 0 ? <div className="aviso">No hay cuadras terminadas sin certificar en ese período.</div> : (
        <div className="envoltura-tabla" style={{ maxHeight: 360, overflowY: 'auto' }}>
          <table className="tabla">
            <thead><tr><th></th><th>Fecha</th><th>Calle</th><th>Entre</th><th className="num">Columnas</th></tr></thead>
            <tbody>
              {candidatos.map(r => (
                <tr key={r.id}>
                  <td><input type="checkbox" checked={!excluidos.has(r.id)} onChange={() => setExcluidos(p => { const s = new Set(p); s.has(r.id) ? s.delete(r.id) : s.add(r.id); return s })} /></td>
                  <td>{fechaCorta(r.fecha)}</td><td>{r.calle}</td><td>{r.entre1}{r.entre2 ? ' y ' + r.entre2 : ''}</td><td className="num">{fmt(r.columnas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="acciones" style={{ marginTop: 14 }}>
        <button className="btn" disabled={!elegidos.length} onClick={crear}>Emitir certificado</button>
        <button className="btn sec" onClick={onCerrar}>Cancelar</button>
      </div>
    </Modal>
  )
}

export default function Certificaciones() {
  const certificados = useColeccion('certificados')
  const registros = useColeccion('registros')
  const [nuevo, setNuevo] = useState(false)
  const [ver, setVer] = useState(null)
  const [anular, setAnular] = useState(null)
  const pendientes = registros.filter(r => r.estadoOperativo === 'Terminado' && ['Sin certificar', 'En revisión', undefined, ''].includes(r.estadoCert))
  const colPendientes = pendientes.reduce((s, r) => s + num(r.columnas), 0)
  const colCert = registros.filter(r => ['Certificado', 'Facturado'].includes(r.estadoCert)).reduce((s, r) => s + num(r.columnas), 0)

  function facturar(c) {
    actualizar('certificados', c.id, { estado: 'Facturado' })
    const ids = new Set(c.registroIds)
    guardarColeccion('registros', leer('registros').map(r => ids.has(r.id) ? { ...r, estadoCert: 'Facturado' } : r))
  }
  function confirmarAnular() {
    const c = anular
    actualizar('certificados', c.id, { estado: 'Anulado' })
    const ids = new Set(c.registroIds)
    guardarColeccion('registros', leer('registros').map(r => ids.has(r.id)
      ? { ...r, estadoCert: 'Sin certificar', certificadoId: null, certificadoNumero: null } : r))
    setAnular(null)
  }

  const actual = ver && certificados.find(c => c.id === ver)
  return (
    <>
      <div className="grilla" style={{ marginBottom: 14 }}>
        <div className="dato"><div className="etiqueta">Columnas certificadas</div><div className="valor">{fmt(colCert)}</div></div>
        <div className="dato"><div className="etiqueta">Pendientes de certificar</div><div className="valor">{fmt(colPendientes)}</div><div className="tenue">{pendientes.length} cuadras terminadas</div></div>
        <div className="dato"><div className="etiqueta">Certificados emitidos</div><div className="valor">{certificados.filter(c => c.estado !== 'Anulado').length}</div></div>
      </div>
      <div className="acciones" style={{ marginBottom: 14 }}>
        <button className="btn" onClick={() => setNuevo(true)}>➕ Nuevo certificado</button>
      </div>
      {certificados.length === 0 ? <div className="tarjeta tenue">Todavía no hay certificados.</div> : (
        <div className="envoltura-tabla">
          <table className="tabla">
            <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Período</th><th className="num">Cuadras</th><th className="num">Columnas</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {certificados.map(c => (
                <tr key={c.id}>
                  <td><b>{c.numero}</b></td><td>{fechaCorta(c.fecha)}</td><td>{c.clienteNombre || '-'}</td>
                  <td>{fechaCorta(c.desde)} – {fechaCorta(c.hasta)}</td>
                  <td className="num">{c.registroIds.length}</td><td className="num"><b>{fmt(c.total)}</b></td>
                  <td><span className={'etq ' + (c.estado === 'Facturado' ? 'azul' : c.estado === 'Anulado' ? 'rojo' : 'verde')}>{c.estado}</span></td>
                  <td>
                    <div className="acciones">
                      <button className="btn chico" onClick={() => setVer(c.id)}>Ver</button>
                      {c.estado === 'Emitido' && <button className="btn sec chico" onClick={() => facturar(c)}>Facturado</button>}
                      {c.estado === 'Emitido' && <button className="btn sec chico" onClick={() => setAnular(c)}>Anular</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nuevo && <NuevoCertificado onCerrar={() => setNuevo(false)} onCreado={c => { setNuevo(false); setVer(c.id) }} />}
      {actual && <VistaCertificado cert={actual} onCerrar={() => setVer(null)} />}
      {anular && (
        <Modal titulo={`¿Anular el certificado N° ${anular.numero}?`} onCerrar={() => setAnular(null)}>
          <p>Las {anular.registroIds.length} cuadras vuelven a quedar "Sin certificar" para incluirlas en otro certificado.</p>
          <div className="acciones">
            <button className="btn peligro" onClick={confirmarAnular}>Sí, anular</button>
            <button className="btn sec" onClick={() => setAnular(null)}>No</button>
          </div>
        </Modal>
      )}
    </>
  )
}
