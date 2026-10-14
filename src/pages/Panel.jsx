// Panel general del administrador
import { useColeccion, num, fmt, fechaHora, stockColores, diaLocal, hoyISO } from '../datos'
import { Barras } from '../ui'

export default function Panel({ ir }) {
  const registros = useColeccion('registros')
  const turnos = useColeccion('turnos')
  const colores = useColeccion('colores').filter(c => c.activo !== false)
  const entradas = useColeccion('entradas')

  const suma = l => l.reduce((s, r) => s + num(r.columnas), 0)
  const hoy = hoyISO()
  const mes = hoy.slice(0, 7)
  const delMes = registros.filter(r => diaLocal(r.fecha).startsWith(mes))
  const deHoy = registros.filter(r => diaLocal(r.fecha) === hoy)
  const certificadas = suma(registros.filter(r => ['Certificado', 'Facturado'].includes(r.estadoCert)))
  const pendientes = suma(registros.filter(r => r.estadoOperativo === 'Terminado' && !['Certificado', 'Facturado'].includes(r.estadoCert)))
  const abiertos = turnos.filter(t => t.estado === 'abierto')
  const stock = stockColores(colores, entradas, turnos)
  const bajos = stock.filter(s => s.disponible < num(s.stockMinimo))

  // Columnas por día, últimos 14 días
  const dias = [...Array(14)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i))
    const k = diaLocal(d.toISOString())
    return { nombre: d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' }), valor: suma(registros.filter(r => diaLocal(r.fecha) === k)) }
  })
  // Columnas del mes por supervisor
  const porUsuario = Object.values(delMes.reduce((a, r) => {
    a[r.usuarioId] = a[r.usuarioId] || { nombre: r.usuarioNombre, valor: 0 }
    a[r.usuarioId].valor += num(r.columnas)
    return a
  }, {})).sort((a, b) => b.valor - a.valor)

  return (
    <>
      {bajos.length > 0 && (
        <div className="aviso" style={{ cursor: 'pointer' }} onClick={() => ir('materiales')}>
          ⚠ Stock bajo: {bajos.map(s => `${s.nombre} (${fmt(s.disponible, 0)} L)`).join(', ')}
        </div>
      )}
      <div className="grilla" style={{ marginBottom: 14 }}>
        <div className="dato"><div className="etiqueta">Columnas hoy</div><div className="valor">{fmt(suma(deHoy))}</div><div className="tenue">{deHoy.length} cuadras</div></div>
        <div className="dato"><div className="etiqueta">Columnas este mes</div><div className="valor">{fmt(suma(delMes))}</div><div className="tenue">{delMes.length} cuadras</div></div>
        <div className="dato"><div className="etiqueta">Total pintadas</div><div className="valor">{fmt(suma(registros))}</div><div className="tenue">{registros.length} cuadras</div></div>
        <div className="dato" style={{ cursor: 'pointer' }} onClick={() => ir('certificaciones')}><div className="etiqueta">Certificadas</div><div className="valor">{fmt(certificadas)}</div><div className="tenue">Pendientes: {fmt(pendientes)}</div></div>
      </div>

      <div className="tarjeta">
        <h2>Turnos abiertos ahora</h2>
        {abiertos.length === 0 ? <div className="tenue">No hay turnos abiertos.</div> : abiertos.map(t => (
          <div key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--borde)' }}>
            <b>{t.usuarioNombre}</b> · desde {fechaHora(t.inicio)} · {fmt(suma(registros.filter(r => r.turnoId === t.id)))} columnas
          </div>
        ))}
      </div>

      <div className="tarjeta">
        <h2>Columnas pintadas — últimos 14 días</h2>
        <Barras datos={dias} formato={v => fmt(v)} />
      </div>

      <div className="tarjeta">
        <h2>Columnas del mes por supervisor</h2>
        {porUsuario.length === 0 ? <div className="tenue">Sin datos este mes.</div> : <Barras datos={porUsuario} formato={v => fmt(v)} />}
      </div>

      <div className="tarjeta">
        <h2>Stock de pintura</h2>
        <Barras datos={stock.map(s => ({ nombre: s.nombre, valor: Math.max(0, s.disponible), color: s.hex === '#f2f2f2' ? '#b8c2bd' : s.hex }))} formato={v => fmt(v, 0) + ' L'} />
      </div>
    </>
  )
}
