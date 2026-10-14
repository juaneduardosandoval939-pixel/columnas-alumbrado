// Turnos y productividad (administrador)
import { useMemo, useState } from 'react'
import { useColeccion, num, fmt, fechaHora, fechaCorta, resumenTurno, diaLocal } from '../datos'
import { Campo, Barras, exportarExcel } from '../ui'
import { CerrarTurnoModal } from './Turno'

const pct = v => v == null ? '-' : (v > 0 ? '+' : '') + fmt(v * 100, 0) + '%'

export default function Turnos() {
  const turnos = useColeccion('turnos')
  const registros = useColeccion('registros')
  const colores = useColeccion('colores').filter(c => c.activo !== false)
  const usuarios = useColeccion('usuarios')
  const [fil, setFil] = useState({ desde: '', hasta: '', usuarioId: '' })
  const [cerrar, setCerrar] = useState(null)

  const filas = useMemo(() => turnos.filter(t => {
    const d = diaLocal(t.inicio)
    if (fil.desde && d < fil.desde) return false
    if (fil.hasta && d > fil.hasta) return false
    if (fil.usuarioId && t.usuarioId !== fil.usuarioId) return false
    return true
  }).map(t => ({ t, r: resumenTurno(t, registros, colores) })), [turnos, registros, colores, fil])

  const cerrados = filas.filter(x => x.t.estado === 'cerrado')
  const tot = cerrados.reduce((a, { r }) => ({ col: a.col + r.columnas, h: a.h + r.horas, l: a.l + r.totalReal, lt: a.lt + r.totalTeorico }), { col: 0, h: 0, l: 0, lt: 0 })
  const colHoraTotal = tot.h >= 0.25 ? tot.col / tot.h : 0

  // Productividad por supervisor (turnos cerrados)
  const porUsuario = Object.values(cerrados.reduce((acc, { t, r }) => {
    const k = t.usuarioId
    acc[k] = acc[k] || { nombre: t.usuarioNombre, col: 0, h: 0, turnos: 0 }
    acc[k].col += r.columnas; acc[k].h += r.horas; acc[k].turnos++
    return acc
  }, {}))

  function exportar() {
    exportarExcel(`turnos_productividad_${new Date().toISOString().slice(0, 10)}.xlsx`, [{
      nombre: 'Turnos',
      filas: filas.map(({ t, r }) => {
        const fila = {
          Supervisor: t.usuarioNombre, Inicio: fechaHora(t.inicio), Fin: fechaHora(t.fin), Estado: t.estado,
          Horas: +r.horas.toFixed(2), Cuadras: r.cuadras, Columnas: r.columnas, 'Columnas/hora': +r.colHora.toFixed(2),
        }
        for (const c of colores) {
          fila[`${c.nombre} real (L)`] = num(r.reales[c.id])
          fila[`${c.nombre} estimado (L)`] = +num(r.teoricos[c.id]).toFixed(2)
        }
        fila['Litros totales'] = r.totalReal
        fila['L por columna'] = +r.litrosPorColumna.toFixed(3)
        fila['Desvío vs estimado'] = r.desvio == null ? '' : +(r.desvio * 100).toFixed(1) + '%'
        fila.Observaciones = t.observacionesCierre || ''
        return fila
      }),
    }])
  }

  return (
    <>
      <div className="tarjeta">
        <div className="fila">
          <Campo label="Desde"><input type="date" value={fil.desde} onChange={e => setFil(p => ({ ...p, desde: e.target.value }))} /></Campo>
          <Campo label="Hasta"><input type="date" value={fil.hasta} onChange={e => setFil(p => ({ ...p, hasta: e.target.value }))} /></Campo>
          <Campo label="Supervisor">
            <select value={fil.usuarioId} onChange={e => setFil(p => ({ ...p, usuarioId: e.target.value }))}>
              <option value="">Todos</option>
              {usuarios.filter(u => u.rol !== 'cliente').map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </Campo>
          <div style={{ flex: '0 0 auto' }} className="campo"><button className="btn sec" onClick={exportar} disabled={!filas.length}>⬇ Exportar Excel</button></div>
        </div>
      </div>

      <div className="grilla" style={{ marginBottom: 14 }}>
        <div className="dato"><div className="etiqueta">Turnos cerrados</div><div className="valor">{cerrados.length}</div></div>
        <div className="dato"><div className="etiqueta">Columnas pintadas</div><div className="valor">{fmt(tot.col)}</div></div>
        <div className="dato"><div className="etiqueta">Columnas por hora</div><div className="valor">{colHoraTotal ? fmt(colHoraTotal, 1) : '-'}</div></div>
        <div className="dato"><div className="etiqueta">Litros por columna</div><div className="valor">{fmt(tot.col ? tot.l / tot.col : 0, 3)}</div><div className="tenue">estimado {fmt(tot.col ? tot.lt / tot.col : 0, 3)}</div></div>
      </div>

      {porUsuario.length > 0 && (
        <div className="tarjeta">
          <h2>Columnas por hora, por supervisor</h2>
          <Barras datos={porUsuario.map(u => ({ nombre: u.nombre, valor: u.h >= 0.25 ? u.col / u.h : 0 }))} formato={v => fmt(v, 1)} />
        </div>
      )}

      {filas.length === 0 ? <div className="tarjeta tenue">No hay turnos en este período.</div> : (
        <div className="envoltura-tabla">
          <table className="tabla">
            <thead>
              <tr>
                <th>Supervisor</th><th>Inicio</th><th className="num">Horas</th><th className="num">Cuadras</th><th className="num">Columnas</th><th className="num">Col/h</th>
                {colores.map(c => <th key={c.id} className="num"><span className="muestra-color" style={{ background: c.hex }} />{c.nombre.replace('Azul ', '')} L</th>)}
                <th className="num">L/col</th><th className="num">Desvío</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ t, r }) => (
                <tr key={t.id}>
                  <td>{t.usuarioNombre}</td><td>{fechaHora(t.inicio)}</td>
                  <td className="num">{fmt(r.horas, 1)}</td><td className="num">{r.cuadras}</td><td className="num"><b>{fmt(r.columnas)}</b></td><td className="num">{r.colHora ? fmt(r.colHora, 1) : '-'}</td>
                  {colores.map(c => <td key={c.id} className="num" title={`Estimado ${fmt(r.teoricos[c.id], 2)} L`}>{t.estado === 'cerrado' ? fmt(r.reales[c.id], 1) : '-'}</td>)}
                  <td className="num">{t.estado === 'cerrado' ? fmt(r.litrosPorColumna, 3) : '-'}</td>
                  <td className="num" style={{ color: r.desvio > 0.1 ? 'var(--rojo)' : undefined }}>{t.estado === 'cerrado' ? pct(r.desvio) : '-'}</td>
                  <td>
                    {t.estado === 'abierto'
                      ? <button className="btn chico" onClick={() => setCerrar(t)}>Cerrar</button>
                      : <button className="btn sec chico" onClick={() => setCerrar(t)}>Editar litros</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="tenue" style={{ marginTop: 8 }}>Desvío = litros reales vs. estimados por rendimiento (en rojo si supera el 10%). Período: {fil.desde ? fechaCorta(fil.desde) : 'inicio'} – {fil.hasta ? fechaCorta(fil.hasta) : 'hoy'}.</div>
      {cerrar && <CerrarTurnoModal turno={cerrar} onCerrar={() => setCerrar(null)} onListo={() => setCerrar(null)} />}
    </>
  )
}
