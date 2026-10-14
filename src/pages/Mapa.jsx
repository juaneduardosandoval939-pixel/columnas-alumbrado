// Mapa con todas las cuadras pintadas
import { useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { useColeccion, num, fmt, fechaCorta, ESTADOS_CERT, diaLocal } from '../datos'
import { Campo, CENTRO } from '../ui'
import { visibles, DetalleRegistro } from './Lista'

const COLOR = { 'Sin certificar': '#7a8a90', 'En revisión': '#d39e00', Certificado: '#1e7a46', Rechazado: '#c0392b', Facturado: '#2563a8' }

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
  const centro = lista.length ? [num(lista[0].lat), num(lista[0].lng)] : CENTRO
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
        <div className="acciones" style={{ fontSize: 13 }}>
          <span style={{ flex: 1 }}><b>{lista.length}</b> cuadras · <b>{fmt(total)}</b> columnas</span>
          {Object.entries(COLOR).map(([k, c]) => <span key={k}><span className="muestra-color" style={{ background: c, borderRadius: '50%' }} />{k}</span>)}
        </div>
      </div>
      <div className="mapa grande">
        <MapContainer center={centro} zoom={14} style={{ height: '100%' }}>
          <TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {lista.map(r => (
            <CircleMarker key={r.id} center={[num(r.lat), num(r.lng)]} radius={7 + Math.min(10, num(r.columnas) / 2)}
              pathOptions={{ color: '#fff', weight: 2, fillColor: COLOR[r.estadoCert || 'Sin certificar'] || '#7a8a90', fillOpacity: 0.9 }}>
              <Popup>
                <b>{r.calle}</b><br />entre {r.entre1}{r.entre2 ? ' y ' + r.entre2 : ''}<br />
                {fmt(r.columnas)} columnas · {fechaCorta(r.fecha)}<br />
                {r.usuarioNombre}<br />
                <button className="btn chico" style={{ marginTop: 6 }} onClick={() => setDetalle(r.id)}>Ver detalle y fotos</button>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      {actual && <DetalleRegistro r={actual} usuario={usuario} ir={ir} onCerrar={() => setDetalle(null)} />}
    </>
  )
}
