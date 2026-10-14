// ── COMPONENTES COMPARTIDOS ───────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import * as XLSX from 'xlsx'
import iconoUrl from 'leaflet/dist/images/marker-icon.png'
import icono2xUrl from 'leaflet/dist/images/marker-icon-2x.png'
import sombraUrl from 'leaflet/dist/images/marker-shadow.png'
import { useUrlFoto } from './fotos'

export const ICONO = new L.Icon({
  iconUrl: iconoUrl, iconRetinaUrl: icono2xUrl, shadowUrl: sombraUrl,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})

// Centro por defecto: San Miguel de Tucumán
export const CENTRO = [-26.8241, -65.2226]

export function Campo({ label, children }) {
  return <div className="campo"><label>{label}</label>{children}</div>
}

export function Modal({ titulo, onCerrar, children, ancho }) {
  return (
    <div className="modal-fondo" onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div className="modal" style={ancho ? { maxWidth: ancho } : undefined}>
        {titulo && <h2>{titulo}</h2>}
        {children}
      </div>
    </div>
  )
}

const COLOR_CERT = { 'Sin certificar': 'gris', 'En revisión': 'ambar', Certificado: 'verde', Rechazado: 'rojo', Facturado: 'azul' }
const COLOR_OPER = { 'En proceso': 'ambar', Terminado: 'verde' }
export function EtqCert({ v }) { return <span className={'etq ' + (COLOR_CERT[v] || 'gris')}>{v || 'Sin certificar'}</span> }
export function EtqOper({ v }) { return <span className={'etq ' + (COLOR_OPER[v] || 'gris')}>{v || '-'}</span> }

// ── GPS y direcciones ────────────────────────────────────────────────────────
export function obtenerGPS() {
  return new Promise(ok => {
    if (!navigator.geolocation) return ok({ error: 'Este dispositivo no tiene GPS' })
    navigator.geolocation.getCurrentPosition(
      p => ok({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), precision: Math.round(p.coords.accuracy) }),
      e => ok({ error: e.code === 1 ? 'Permiso de ubicación bloqueado: habilitalo en el navegador' : 'No se pudo obtener la ubicación' }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    )
  })
}

export async function calleDesdeGPS(lat, lng) {
  if (!navigator.onLine) return ''
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`)
    const a = (await r.json()).address || {}
    return a.road || a.pedestrian || a.suburb || ''
  } catch { return '' }
}

export async function buscarDireccion(texto) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(texto)}&format=json&limit=5&countrycodes=ar`)
  return r.json()
}

// ── Mapa para ubicar un punto (marcador arrastrable) ─────────────────────────
function Recentrar({ lat, lng }) {
  const mapa = useMap()
  useEffect(() => { if (lat && lng) mapa.setView([lat, lng], Math.max(mapa.getZoom(), 17)) }, [lat, lng])
  return null
}
function ClicEnMapa({ onMover }) {
  useMapEvents({ click: e => onMover(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)) })
  return null
}
export function MapaPunto({ lat, lng, onMover }) {
  const pos = lat && lng ? [lat, lng] : null
  return (
    <div className="mapa">
      <MapContainer center={pos || CENTRO} zoom={pos ? 17 : 13} style={{ height: '100%' }}>
        <TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {pos && (
          <Marker position={pos} icon={ICONO} draggable eventHandlers={{
            dragend: e => { const p = e.target.getLatLng(); onMover(+p.lat.toFixed(6), +p.lng.toFixed(6)) },
          }} />
        )}
        <ClicEnMapa onMover={onMover} />
        <Recentrar lat={lat} lng={lng} />
      </MapContainer>
    </div>
  )
}

// ── Fotos ────────────────────────────────────────────────────────────────────
export function Foto({ foto, onQuitar, onVer }) {
  const url = useUrlFoto(foto)
  return (
    <div className="foto">
      {url ? <img src={url} alt="" onClick={() => onVer && onVer(url)} /> : <div className="tenue" style={{ padding: 8 }}>Cargando…</div>}
      <span className="marca-foto">{foto.momento === 'antes' ? 'Antes' : 'Después'}{foto.pendiente ? ' · ⏳' : ''}</span>
      {onQuitar && <button className="quitar" onClick={onQuitar} title="Quitar">×</button>}
    </div>
  )
}

export function Fotos({ fotos, onQuitar }) {
  const [ver, setVer] = useState('')
  if (!fotos?.length) return <div className="tenue">Sin fotos</div>
  return (
    <>
      <div className="fotos">
        {fotos.map((f, i) => <Foto key={f.id} foto={f} onVer={setVer} onQuitar={onQuitar ? () => onQuitar(i) : null} />)}
      </div>
      {ver && <Modal onCerrar={() => setVer('')} ancho={900}><img className="visor" src={ver} alt="" /><div style={{ textAlign: 'right', marginTop: 10 }}><button className="btn sec" onClick={() => setVer('')}>Cerrar</button></div></Modal>}
    </>
  )
}

// ── Excel ────────────────────────────────────────────────────────────────────
// hojas: [{ nombre, filas: [ {col: valor} ] , anchos? }]
export function exportarExcel(nombreArchivo, hojas) {
  const libro = XLSX.utils.book_new()
  for (const h of hojas) {
    const hoja = h.aoa ? XLSX.utils.aoa_to_sheet(h.aoa) : XLSX.utils.json_to_sheet(h.filas)
    if (h.anchos) hoja['!cols'] = h.anchos.map(w => ({ wch: w }))
    if (h.unir) hoja['!merges'] = h.unir
    XLSX.utils.book_append_sheet(libro, hoja, h.nombre.slice(0, 31))
  }
  XLSX.writeFile(libro, nombreArchivo)
}

export function Barras({ datos, formato = v => v }) {
  const max = Math.max(1, ...datos.map(d => d.valor))
  return (
    <div className="barras">
      {datos.map(d => (
        <div className="barra-h" key={d.nombre}>
          <span className="nombre" title={d.nombre}>{d.nombre}</span>
          <span className="pista"><span className="relleno" style={{ width: (d.valor / max * 100) + '%', background: d.color || undefined }} /></span>
          <span style={{ width: 70, textAlign: 'right' }}>{formato(d.valor)}</span>
        </div>
      ))}
    </div>
  )
}
