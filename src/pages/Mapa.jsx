// Mapa con todas las cuadras pintadas: cada cuadra es una línea de esquina a esquina
// (verde = terminada, azul = certificada, ámbar = en proceso)
import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Popup, useMap } from 'react-leaflet'
import { useColeccion, num, fmt, fechaCorta, ESTADOS_CERT, diaLocal } from '../datos'
import { Campo, CENTRO, CapaBase, LineaCuadra, colorCuadra, COLORES_CUADRA } from '../ui'
import { visibles, DetalleRegistro } from './Lista'

const LEYENDA = [
  ['Terminada (sin certificar)', COLORES_CUADRA.terminada],
  ['Certificada', COLORES_CUADRA.certificada],
  ['En proceso', COLORES_CUADRA.proceso],
]

// Encuadra todas las cuadras la primera vez que se abre el mapa
function EncuadrarTodo({ lista }) {
  const mapa = useMap()
  const hecho = useRef(false)
  useEffect(() => {
    if (hecho.current || !lista.length) return
    hecho.current = true
    const pts = lista.flatMap(r => [[num(r.lat), num(r.lng)], r.lat2 ? [num(r.lat2), num(r.lng2)] : null]).filter(Boolean)
    if (pts.length === 1) mapa.setView(pts[0], 17)
    else mapa.fitBounds(pts, { padding: [30, 30], maxZoom: 17 })
  }, [lista])
  return null
}

// Mapa de cuadras reutilizable (pantalla Mapa y Panel)
export function MapaCuadras({ lista, onDetalle, grande = true }) {
  return (
    <>
      <div className="acciones" style={{ fontSize: 13, marginBottom: 6 }}>
        {LEYENDA.map(([k, c]) => <span key={k} style={{ color: c }}><span className="muestra-linea" /><span style={{ color: 'var(--texto)' }}>{k}</span></span>)}
      </div>
      <div className={'mapa' + (grande ? ' grande' : '')} style={grande ? undefined : { height: 420 }}>
        <MapContainer center={CENTRO} zoom={14} style={{ height: '100%' }}>
          <CapaBase />
          {lista.filter(r => r.lat && r.lng).map(r => (
            <LineaCuadra key={r.id} inicio={[num(r.lat), num(r.lng)]} fin={r.lat2 ? [num(r.lat2), num(r.lng2)] : null} color={colorCuadra(r)}>
              <Popup>
                <b>{r.calle}</b><br />entre {r.entre1}{r.entre2 ? ' y ' + r.entre2 : ''}<br />
                {fmt(r.columnas)} columnas · {fechaCorta(r.fecha)}<br />
                {r.certificadoNumero ? <>Certificado N° {r.certificadoNumero}<br /></> : null}
                {r.usuarioNombre}<br />
                <button className="btn chico" style={{ marginTop: 6 }} onClick={() => onDetalle(r.id)}>Ver detalle y fotos</button>
              </Popup>
            </LineaCuadra>
          ))}
          <EncuadrarTodo lista={lista.filter(r => r.lat && r.lng)} />
        </MapContainer>
      </div>
    </>
  )
}

export default function Mapa({ usuario, ir }) {
  const registros = visibles(useColeccion('registros'), usuario)
  const [fil, setFil] = useState({ desde: '', hasta: '', cert: '' })
  const [detalle, setDetalle] = useState(null)
  const lista = useMemo(() => registros.filter(r => {
    if (!r.lat || !r.lng) return false
    const d = diaLocal(r.fecha)
    if (fil.desde && d < fil.desde) return false
    if (fil.hasta && d > fil.hasta) return false
    if (fil.cert && (r.estadoCert || 'Sin certificar') !== fil.cert) return false
    return true
  }), [registros, fil])
  const total = lista.reduce((s, r) => s + num(r.columnas), 0)
  const actual = detalle && registros.find(r => r.id === detalle)

  return (
    <>
      <div className="tarjeta">
        <div className="fila">
          <Campo label="Desde"><input type="date" value={fil.desde} onChange={e => setFil(p => ({ ...p, desde: e.target.value }))} /></Campo>
          <Campo label="Hasta"><input type="date" value={fil.hasta} onChange={e => setFil(p => ({ ...p, hasta: e.target.value }))} /></Campo>
          <Campo label="Certificación">
            <select value={fil.cert} onChange={e => setFil(p => ({ ...p, cert: e.target.value }))}>
              <option value="">Todas</option>
              {ESTADOS_CERT.map(x => <option key={x}>{x}</option>)}
            </select>
          </Campo>
        </div>
        <div style={{ fontSize: 13 }}><b>{lista.length}</b> cuadras · <b>{fmt(total)}</b> columnas</div>
      </div>
      <MapaCuadras lista={lista} onDetalle={setDetalle} />
      {actual && <DetalleRegistro r={actual} usuario={usuario} ir={ir} onCerrar={() => setDetalle(null)} />}
    </>
  )
}
