// ── NOMBRES DE CALLES A PARTIR DEL GPS ───────────────────────────────────────
// Con clave de Google (GOOGLE_MAPS_KEY) usa Google Geocoding: mismos nombres que
// Google Maps. Sin clave, o si Google no encuentra la esquina, completa con
// OpenStreetMap (Overpass), que es gratis.
import { GOOGLE_MAPS_KEY } from './supabaseConfig'

// Para comparar nombres sin importar mayúsculas, tildes ni "Av."/"Avenida"
export const normalizarCalle = n => String(n || '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/^(avenida|av\.?|calle|pasaje|pje\.?|boulevard|bv\.?)\s+/, '')
  .replace(/\s+/g, ' ').trim()

function sinRepetidos(nombres) {
  const vistos = new Set()
  return nombres.filter(n => {
    const k = normalizarCalle(n)
    if (!k || vistos.has(k)) return false
    vistos.add(k)
    return true
  })
}

async function conTiempo(url, opciones = {}, ms = 8000) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try { return await fetch(url, { ...opciones, signal: ctl.signal }) } finally { clearTimeout(t) }
}

// Google devuelve varias direcciones cercanas; en una esquina aparecen las dos calles
async function callesGoogle(lat, lng) {
  if (!GOOGLE_MAPS_KEY) return []
  const r = await conTiempo(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=es&region=ar&key=${GOOGLE_MAPS_KEY}`)
  const d = await r.json()
  if (d.status !== 'OK') {
    if (d.status !== 'ZERO_RESULTS') console.warn('Google Geocoding:', d.status, d.error_message || '')
    return []
  }
  const nombres = []
  for (const res of d.results.slice(0, 8)) {
    for (const c of res.address_components || []) {
      if (c.types.includes('route') || c.types.includes('intersection')) {
        nombres.push(...c.long_name.split(/\s+(?:&|y)\s+/))
      }
    }
  }
  return nombres
}

// Distancia en metros de un punto a un segmento (aproximación plana, alcanza para una cuadra)
function distSegmento(p, a, b) {
  const kx = 111320 * Math.cos(p.lat * Math.PI / 180), ky = 110540
  const ax = (a.lon - p.lng) * kx, ay = (a.lat - p.lat) * ky
  const bx = (b.lon - p.lng) * kx, by = (b.lat - p.lat) * ky
  const dx = bx - ax, dy = by - ay
  const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0
  return Math.hypot(ax + t * dx, ay + t * dy)
}

// Calles de OpenStreetMap a menos de 30 m, ordenadas de la más cercana a la más lejana
async function callesOSM(lat, lng) {
  const q = `[out:json][timeout:10];way(around:30,${lat},${lng})[highway][name];out tags geom;`
  const r = await conTiempo('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q) })
  const d = await r.json()
  const p = { lat, lng }
  return (d.elements || [])
    .map(w => {
      const g = w.geometry || []
      let min = Infinity
      for (let i = 1; i < g.length; i++) min = Math.min(min, distSegmento(p, g[i - 1], g[i]))
      return { nombre: w.tags.name, dist: min }
    })
    .sort((a, b) => a.dist - b.dist)
    .map(x => x.nombre)
}

// Nombres de las calles que pasan por un punto (sin repetidos, primero las más cercanas)
export async function callesEnPunto(lat, lng) {
  if (!lat || !lng || !navigator.onLine) return []
  let nombres = []
  try { nombres = await callesGoogle(lat, lng) } catch { /* sin Google: sigue con OSM */ }
  if (sinRepetidos(nombres).length < 2) {
    try { nombres = [...nombres, ...await callesOSM(lat, lng)] } catch { /* sin conexión */ }
  }
  return sinRepetidos(nombres)
}

// Con el inicio y el fin de la cuadra deduce la calle intervenida y las dos transversales.
// La calle intervenida es la que aparece en las dos esquinas (o la del medio de la cuadra).
export async function deducirCuadra(ini, fin) {
  const [enIni, enFin] = await Promise.all([callesEnPunto(ini.lat, ini.lng), callesEnPunto(fin.lat, fin.lng)])
  const enFinN = new Set(enFin.map(normalizarCalle))
  let calle = enIni.find(n => enFinN.has(normalizarCalle(n)))
  let enMedio = []
  if (!calle) {
    enMedio = await callesEnPunto((ini.lat + fin.lat) / 2, (ini.lng + fin.lng) / 2)
    calle = enMedio[0] || ''
  }
  const k = normalizarCalle(calle)
  const otras = lista => lista.filter(n => normalizarCalle(n) !== k)
  return {
    calle,
    entre1: otras(enIni)[0] || '',
    entre2: otras(enFin)[0] || '',
    opcionesCalle: sinRepetidos([calle, ...enMedio, ...enIni, ...enFin].filter(Boolean)),
    opcionesEntre1: otras(enIni),
    opcionesEntre2: otras(enFin),
  }
}

// Largo aproximado de la cuadra en metros
export function largoCuadra(a, b) {
  if (!a?.lat || !b?.lat) return 0
  return distSegmento({ lat: +a.lat, lng: +a.lng }, { lat: +b.lat, lon: +b.lng }, { lat: +b.lat, lon: +b.lng })
}
