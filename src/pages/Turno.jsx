// Turno del supervisor: abrir, cargar cuadras y cerrar con los litros usados
import { useState } from 'react'
import { useColeccion, guardar, actualizar, nuevoId, num, fmt, fechaHora, resumenTurno, litrosDeCuadras } from '../datos'
import { Campo, Modal, EtqOper } from '../ui'

export function CerrarTurnoModal({ turno, onCerrar, onListo }) {
  const colores = useColeccion('colores').filter(c => c.activo !== false)
  const registros = useColeccion('registros')
  const r = resumenTurno(turno, registros, colores)
  const enCuadras = litrosDeCuadras(r.registros, colores)
  const hayEnCuadras = Object.values(enCuadras).some(v => v > 0)
  // Propone lo que el operario fue cargando en cada cuadra; se puede corregir con lo real
  const [litros, setLitros] = useState(() => Object.fromEntries(colores.map(c => [c.id,
    turno.litros?.[c.id] ?? (hayEnCuadras ? +enCuadras[c.id].toFixed(2) : '')])))
  const [obs, setObs] = useState(turno.observacionesCierre || '')
  const [error, setError] = useState('')

  function cerrar() {
    const faltan = colores.filter(c => String(litros[c.id]).trim() === '')
    if (faltan.length) return setError('Cargá los litros usados de cada color (0 si no se usó)')
    actualizar('turnos', turno.id, t => ({
      ...t,
      estado: 'cerrado',
      fin: t.fin || new Date().toISOString(),
      litros: Object.fromEntries(colores.map(c => [c.id, num(litros[c.id])])),
      observacionesCierre: obs,
    }))
    onListo()
  }

  return (
    <Modal titulo="Cerrar turno" onCerrar={onCerrar}>
      <p>Cuadras: <b>{r.cuadras}</b> · Columnas pintadas: <b>{fmt(r.columnas)}</b> · Duración: <b>{fmt(r.horas, 1)} h</b></p>
      {error && <div className="error">{error}</div>}
      <div className="tenue" style={{ marginBottom: 8 }}>Litros de pintura usados en el turno. Se completa con lo cargado en cada cuadra; corregilo si el consumo real fue distinto.</div>
      {colores.map(c => (
        <Campo key={c.id} label={<><span className="muestra-color" style={{ background: c.hex }} />{c.nombre} — cargado en cuadras {fmt(enCuadras[c.id], 2)} L · estimado {fmt(r.teoricos[c.id], 2)} L</>}>
          <input type="number" inputMode="decimal" min="0" step="0.1" value={litros[c.id]} onChange={e => setLitros(p => ({ ...p, [c.id]: e.target.value }))} />
        </Campo>
      ))}
      <Campo label="Observaciones del turno"><textarea value={obs} onChange={e => setObs(e.target.value)} /></Campo>
      <div className="acciones">
        <button className="btn" onClick={cerrar}>Cerrar turno</button>
        <button className="btn sec" onClick={onCerrar}>Cancelar</button>
      </div>
    </Modal>
  )
}

export default function Turno({ usuario, ir }) {
  const turnos = useColeccion('turnos')
  const registros = useColeccion('registros')
  const colores = useColeccion('colores').filter(c => c.activo !== false)
  const [cerrando, setCerrando] = useState(false)
  const activo = turnos.find(t => t.estado === 'abierto' && t.usuarioId === usuario.id)
  const anteriores = turnos.filter(t => t.estado === 'cerrado' && t.usuarioId === usuario.id).slice(0, 10)

  function abrir() {
    guardar('turnos', { id: nuevoId(), usuarioId: usuario.id, usuarioNombre: usuario.nombre, inicio: new Date().toISOString(), estado: 'abierto', litros: {} })
  }

  if (!activo) {
    return (
      <>
        <div className="tarjeta" style={{ textAlign: 'center' }}>
          <p>No tenés un turno abierto.</p>
          <button className="btn grande" onClick={abrir}>▶ Abrir turno</button>
        </div>
        {anteriores.length > 0 && (
          <div className="tarjeta">
            <h2>Mis últimos turnos</h2>
            <div className="envoltura-tabla">
              <table className="tabla">
                <thead><tr><th>Inicio</th><th className="num">Cuadras</th><th className="num">Columnas</th><th className="num">Litros</th></tr></thead>
                <tbody>
                  {anteriores.map(t => { const r = resumenTurno(t, registros, colores); return (
                    <tr key={t.id}><td>{fechaHora(t.inicio)}</td><td className="num">{r.cuadras}</td><td className="num">{fmt(r.columnas)}</td><td className="num">{fmt(r.totalReal, 1)}</td></tr>
                  ) })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    )
  }

  const r = resumenTurno(activo, registros, colores)
  return (
    <>
      <div className="grilla" style={{ marginBottom: 14 }}>
        <div className="dato"><div className="etiqueta">Turno abierto desde</div><div className="valor" style={{ fontSize: 18 }}>{fechaHora(activo.inicio)}</div></div>
        <div className="dato"><div className="etiqueta">Cuadras</div><div className="valor">{r.cuadras}</div></div>
        <div className="dato"><div className="etiqueta">Columnas pintadas</div><div className="valor">{fmt(r.columnas)}</div></div>
        <div className="dato"><div className="etiqueta">Columnas por hora</div><div className="valor">{r.colHora ? fmt(r.colHora, 1) : '-'}</div></div>
      </div>
      <button className="btn grande" style={{ marginBottom: 14 }} onClick={() => ir('nuevo')}>➕ Cargar cuadra</button>
      <div className="tarjeta">
        <h2>Cuadras de este turno</h2>
        {r.registros.length === 0 ? <div className="tenue">Todavía no cargaste cuadras.</div> : (
          <div className="envoltura-tabla">
            <table className="tabla">
              <thead><tr><th>Calle</th><th>Entre</th><th className="num">Columnas</th><th>Estado</th></tr></thead>
              <tbody>
                {r.registros.map(x => (
                  <tr key={x.id} className="clic" onClick={() => ir('nuevo', { id: x.id })}>
                    <td>{x.calle}</td><td>{x.entre1}{x.entre2 ? ' y ' + x.entre2 : ''}</td><td className="num">{x.columnas}</td><td><EtqOper v={x.estadoOperativo} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <button className="btn peligro grande" onClick={() => setCerrando(true)}>⏹ Cerrar turno</button>
      {cerrando && <CerrarTurnoModal turno={activo} onCerrar={() => setCerrando(false)} onListo={() => setCerrando(false)} />}
    </>
  )
}
