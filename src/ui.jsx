// ── COMPONENTES COMPARTIDOS ───────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
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
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
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

// ── Mapas ───────────────────────────────────────────────────────────────────
export function CapaBase() {
  return <TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
}

// Color de la cuadra en el mapa: verde terminada, azul certificada, ámbar en proceso
export const COLORES_CUADRA = { terminada: '#16a34a', certificada: '#2563eb', proceso: '#d97706' }
export function colorCuadra(r) {
  if (['Certificado', 'Facturado'].includes(r.estadoCert) || r.certificadoId) return COLORES_CUADRA.certificada
  if (r.estadoOperativo === 'En proceso') return COLORES_CUADRA.proceso
  return COLORES_CUADRA.terminada
}

// Desplaza un tramo "px" pixeles hacia un costado (para dibujar a los lados de la calle)
function desplazar(mapa, a, b, px) {
  const z = mapa.getZoom()
  const pa = mapa.project(a, z), pb = mapa.project(b, z)
  const dx = pb.x - pa.x, dy = pb.y - pa.y, l = Math.hypot(dx, dy) || 1
  const nx = -dy / l * px, ny = dx / l * px
  return [mapa.unproject([pa.x + nx, pa.y + ny], z), mapa.unproject([pb.x + nx, pb.y + ny], z)]
}

// Cuadra dibujada como dos líneas paralelas a los costados de la calle (las veredas),
// así el nombre de la calle del mapa queda libre en el medio y se sigue leyendo.
// Sin punto de fin (cuadras viejas) se muestra un círculo.
export function LineaCuadra({ inicio, fin, color, children, onClick }) {
  const mapa = useMap()
  const [zoom, setZoom] = useState(mapa.getZoom())
  useMapEvents({ zoomend: () => setZoom(mapa.getZoom()) })
  const eventos = onClick ? { click: onClick } : undefined
  if (!fin?.[0] || !fin?.[1]) {
    return (
      <CircleMarker center={inicio} radius={8} pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.9 }} eventHandlers={eventos}>
        {children}
      </CircleMarker>
    )
  }
  const sep = zoom >= 18 ? 11 : zoom >= 16 ? 8 : 0
  const ancho = zoom >= 16 ? 4 : 5
  const estilo = { color, weight: ancho, opacity: 0.9, lineCap: 'round', interactive: false }
  return (
    <>
      {sep ? (
        <>
          <Polyline positions={desplazar(mapa, inicio, fin, sep)} pathOptions={estilo} />
          <Polyline positions={desplazar(mapa, inicio, fin, -sep)} pathOptions={estilo} />
        </>
      ) : <Polyline positions={[inicio, fin]} pathOptions={estilo} />}
      {/* franja invisible más ancha para poder tocar la cuadra con el dedo */}
      <Polyline positions={[inicio, fin]} pathOptions={{ color, weight: 26, opacity: 0 }} eventHandlers={eventos}>{children}</Polyline>
    </>
  )
}

function Encuadrar({ puntos }) {
  const mapa = useMap()
  const clave = puntos.map(p => p.join(',')).join(';')
  useEffect(() => {
    if (!puntos.length) return
    if (puntos.length === 1) mapa.setView(puntos[0], Math.max(mapa.getZoom(), 17))
    else mapa.fitBounds(puntos, { padding: [40, 40], maxZoom: 18 })
  }, [clave])
  return null
}
function ClicEnMapa({ onClic }) {
  useMapEvents({ click: e => onClic(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)) })
  return null
}

const icono = (texto, fondo) => L.divIcon({
  className: '',
  html: `<div style="background:${fondo};color:#fff;font-weight:700;border:2px solid #fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.4)">${texto}</div>`,
  iconSize: [26, 26], iconAnchor: [13, 13],
})
const ICONO_INICIO = icono('A', '#16a34a')
const ICONO_FIN = icono('B', '#dc2626')

// Mapa para marcar el inicio (A) y el fin (B) de la cuadra; los marcadores se pueden arrastrar
export function MapaCuadra({ inicio, fin, color, onMover, onClic }) {
  const pIni = inicio?.lat && inicio?.lng ? [+inicio.lat, +inicio.lng] : null
  const pFin = fin?.lat && fin?.lng ? [+fin.lat, +fin.lng] : null
  const mover = cual => ({ dragend: e => { const p = e.target.getLatLng(); onMover(cual, +p.lat.toFixed(6), +p.lng.toFixed(6)) } })
  return (
    <div className="mapa">
      <MapContainer center={pIni || pFin || CENTRO} zoom={pIni ? 17 : 13} style={{ height: '100%' }}>
        <CapaBase />
        {pIni && pFin && <LineaCuadra inicio={pIni} fin={pFin} color={color} />}
        {pIni && <Marker position={pIni} icon={ICONO_INICIO} draggable eventHandlers={mover('inicio')} />}
        {pFin && <Marker position={pFin} icon={ICONO_FIN} draggable eventHandlers={mover('fin')} />}
        <ClicEnMapa onClic={onClic} />
        <Encuadrar puntos={[pIni, pFin].filter(Boolean)} />
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
