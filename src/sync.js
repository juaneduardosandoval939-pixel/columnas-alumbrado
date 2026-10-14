// ── SINCRONIZACIÓN CON SUPABASE ───────────────────────────────────────────────
// Todos los dispositivos leen y escriben en la misma tabla (app_datos).
// El navegador guarda una copia local (localStorage) para que la app
// funcione rápido y sin señal; cuando hay conexión se sincroniza sola.
//
// Cada elemento (vehículo, registro, usuario, carga de combustible) es una
// fila propia, así dos personas cargando a la vez no se pisan.

const TABLA = 'app_datos'

// Campos de la flota que solo pueden crecer (odómetro / horómetro):
// si dos dispositivos difieren, se queda el valor más alto.
const CAMPOS_MAXIMO = ['km', 'horas', 'ultimoServiceKm', 'ultimoServiceHoras']

const j = v => JSON.stringify(v)
const parse = (s, def = null) => { try { const v = JSON.parse(s); return v ?? def } catch { return def } }

// prioridadLocal: en la primera sincronización de este dispositivo, sus datos
// ganan sobre los del servidor (para importar lo cargado en un navegador viejo).
export function createSync({ url, key, storage, fetchFn, colecciones, onCambio, onEstado, prioridadLocal = false }) {
  const configurado = !!url && !!key && !url.startsWith('PEGAR') && !key.startsWith('PEGAR')
  const base = configurado ? url.replace(/\/+$/, '') + '/rest/v1/' + TABLA : ''
  const headers = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }

  let corriendo = null   // promesa de la sincronización en curso
  let repetir = false    // hubo cambios durante la sincronización
  let timer = null
  const estado = { configurado, ok: null, ultima: null, pendientes: 0, error: '' }
  const avisarEstado = () => onEstado && onEstado({ ...estado })

  // ── Servidor ────────────────────────────────────────────────────────────────
  async function bajarTodo() {
    const filas = []
    const PAGINA = 1000
    for (let offset = 0; ; offset += PAGINA) {
      const r = await fetchFn(`${base}?select=coleccion,id,data,borrado&order=coleccion.asc,id.asc&limit=${PAGINA}&offset=${offset}`, { headers })
      if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200))
      const lote = await r.json()
      filas.push(...lote)
      if (lote.length < PAGINA) break
    }
    return filas
  }

  async function subir(filas) {
    if (!filas.length) return
    for (let i = 0; i < filas.length; i += 500) {
      const r = await fetchFn(`${base}?on_conflict=coleccion,id`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: j(filas.slice(i, i + 500)),
      })
      if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200))
    }
  }

  // ── Estado local por colección ──────────────────────────────────────────────
  const snapKey = c => 'col_sync_snap_' + c.nombre
  const borrKey = c => 'col_sync_borrados_' + c.nombre
  const borrados = nombre => new Set(parse(storage.getItem('col_sync_borrados_' + nombre), []))

  // Une lo local con lo del servidor. Devuelve { crudoLocal, lista, aSubir, borr }
  function fusionar(c, remotasCol) {
    const crudoLocal = c.leer()                       // array o null (nunca guardado)
    const snap = parse(storage.getItem(snapKey(c)))   // {id: json} de la última sync, o null
    const borr = new Set(parse(storage.getItem(borrKey(c)), []))
    const primera = snap === null
    const remotas = new Map(remotasCol.map(f => [String(f.id), f]))
    const servidorVacio = remotasCol.length === 0
    const defaultsIds = new Set((c.defaults || []).map(d => String(d.id)))

    let local = crudoLocal
    if (local === null) local = servidorVacio ? (c.defaults || []) : []
    const localMap = new Map(local.map(x => [String(x.id), x]))

    const resultado = new Map()
    const aSubir = []
    const ahora = new Date().toISOString()
    const pushFila = (id, data, borrado = false) =>
      aSubir.push({ coleccion: c.nombre, id, data: borrado ? null : data, borrado, actualizado: ahora })

    const ids = new Set([...localMap.keys(), ...remotas.keys(), ...(snap ? Object.keys(snap) : [])])
    for (const id of ids) {
      const l = localMap.get(id)
      const r = remotas.get(id)
      const s = snap ? snap[id] : undefined

      if (primera) {
        // Primera sincronización de este dispositivo
        if (r && r.borrado) { borr.add(id); continue }
        if (r && l) {
          let v
          if (prioridadLocal) {
            v = l
            if (c.maximos) {   // aun importando, km / horas no retroceden
              v = { ...l }
              for (const k of CAMPOS_MAXIMO)
                if (typeof r.data?.[k] === 'number' && (typeof v[k] !== 'number' || r.data[k] > v[k])) v[k] = r.data[k]
            }
          } else {
            v = r.data
            if (c.maximos) {   // km / horas: gana el mayor
              v = { ...v }
              for (const k of CAMPOS_MAXIMO)
                if (typeof l[k] === 'number' && (typeof v[k] !== 'number' || l[k] > v[k])) v[k] = l[k]
            }
          }
          if (j(v) !== j(r.data)) pushFila(id, v)
          resultado.set(id, v); continue
        }
        if (r) { resultado.set(id, r.data); continue }
        if (l) {
          // Solo existe en este dispositivo
          const esDefaultDeCodigo = defaultsIds.has(id)
          if (servidorVacio || c.subirTodoLocal || !esDefaultDeCodigo) { pushFila(id, l); resultado.set(id, l) }
        }
        continue
      }

      // Sincronizaciones siguientes: comparar contra la foto anterior
      const cambioLocal = l ? j(l) !== s : s !== undefined
      if (r && r.borrado) { borr.add(id); continue }   // alguien lo eliminó
      if (cambioLocal) {
        if (l) {
          let v = l
          // Conflicto real (otro dispositivo también lo cambió): no retroceder km/horas.
          // Si solo lo cambié yo (ej. corregir un km mal cargado), se respeta mi valor.
          if (c.maximos && r && r.data && j(r.data) !== s) {
            v = { ...l }
            for (const k of CAMPOS_MAXIMO)
              if (typeof r.data[k] === 'number' && (typeof v[k] !== 'number' || r.data[k] > v[k])) v[k] = r.data[k]
          }
          pushFila(id, v); resultado.set(id, v)
        }
        else { pushFila(id, null, true); borr.add(id) }  // lo eliminé yo
        continue
      }
      if (r) { resultado.set(id, r.data); continue }
      if (l && s === undefined) { pushFila(id, l); resultado.set(id, l) }
      // si estaba en la foto y ya no está en el servidor: se descarta
    }

    // Semillas de código (ej. historial cargado en data.js) que nunca se vieron
    if (c.sembrarDefaults) for (const d of c.defaults || []) {
      const id = String(d.id)
      if (!resultado.has(id) && !borr.has(id) && !remotas.has(id)) { resultado.set(id, d); pushFila(id, d) }
    }

    // Orden: registros por id descendente (más nuevos arriba); el resto respeta el orden local
    let lista = [...resultado.values()]
    if (c.ordenarPorIdDesc) lista.sort((a, b) => Number(b.id) - Number(a.id))
    else {
      const pos = new Map(local.map((x, i) => [String(x.id), i]))
      lista.sort((a, b) => (pos.get(String(a.id)) ?? 1e9) - (pos.get(String(b.id)) ?? 1e9))
    }
    return { crudoLocal, lista, aSubir, borr }
  }

  // ── Sincronización completa ─────────────────────────────────────────────────
  async function sincronizarUnaVez() {
    const filas = await bajarTodo()
    const porCol = {}
    for (const f of filas) (porCol[f.coleccion] ||= []).push(f)

    let huboCambios = false
    for (const c of colecciones) {
      const { crudoLocal, lista, aSubir, borr } = fusionar(c, porCol[c.nombre] || [])
      await subir(aSubir)
      // Si el usuario guardó algo mientras sincronizábamos, no lo pisamos: se repite
      if (j(c.leer()) !== j(crudoLocal)) { repetir = true; continue }
      if (j(lista) !== j(crudoLocal)) { c.escribir(lista); huboCambios = true }
      const snap = {}
      for (const x of lista) snap[String(x.id)] = j(x)
      storage.setItem(snapKey(c), j(snap))
      storage.setItem(borrKey(c), j([...borr]))
    }
    return huboCambios
  }

  async function sincronizar() {
    if (!configurado) { estado.ok = false; estado.error = 'Supabase no configurado'; avisarEstado(); return false }
    if (corriendo) { repetir = true; return corriendo }
    corriendo = (async () => {
      let cambios = false
      try {
        do {
          repetir = false
          if (await sincronizarUnaVez()) cambios = true
        } while (repetir)
        estado.ok = true; estado.error = ''; estado.ultima = new Date()
      } catch (e) {
        estado.ok = false; estado.error = String(e.message || e)
      } finally {
        corriendo = null
        avisarEstado()
      }
      if (cambios && onCambio) onCambio()
      return cambios
    })()
    return corriendo
  }

  // Después de cada guardado: sincroniza en medio segundo (agrupa varios guardados)
  function programar() {
    clearTimeout(timer)
    timer = setTimeout(sincronizar, 500)
  }

  // Olvida la foto de la última sincronización: la próxima se comporta como la primera
  function reiniciarFoto() {
    for (const c of colecciones) storage.removeItem(snapKey(c))
  }

  return { sincronizar, programar, estado: () => ({ ...estado }), borrados, reiniciarFoto }
}
