// Alta / edición de una cuadra pintada
import { useEffect, useRef, useState } from 'react'
import { useColeccion, guardar, leer, nuevoId, num, fmt, litrosTeoricos, ESTADOS_OPERATIVOS, ESTADOS_CERT } from '../datos'
import { agregarFoto, descartarPendiente, subirPendientes } from '../fotos'
import { Campo, MapaCuadra, Fotos, obtenerGPS, buscarDireccion, colorCuadra } from '../ui'
import { deducirCuadra, callesEnPunto, largoCuadra } from '../calles'

const VACIO = {
  clienteId: '', calle: '', entre1: '', entre2: '', lat: '', lng: '', lat2: '', lng2: '',
  columnas: '', litros: {}, estadoOperativo: 'Terminado', estadoCert: 'Sin certificar', observaciones: '', fotos: [],
}

export default function FormRegistro({ usuario, ir, params }) {
  const registros = useColeccion('registros')
  const clientes = useColeccion('clientes').filter(c => c.activo !== false)
  const colores = useColeccion('colores').filter(c => c.activo !== false)
  const turnos = useColeccion('turnos')
  const editando = params.id ? registros.find(r => r.id === params.id) : null
  const [id] = useState(() => params.id || nuevoId())
  const [f, setF] = useState(() => editando ? { ...VACIO, ...editando } : { ...VACIO, clienteId: clientes.length === 1 ? clientes[0].id : '' })
  const [gps, setGps] = useState({ cargando: '', error: '', precision: {} })
  const [marcar, setMarcar] = useState(() => editando && !editando.lat2 ? 'fin' : 'inicio')
  const [opciones, setOpciones] = useState({ calle: [], entre1: [], entre2: [] })
  const [buscandoCalles, setBuscandoCalles] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [error, setError] = useState('')
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const nuevasFotos = useRef([])
  const inputFoto = useRef()
  const momentoFoto = useRef('antes')

  const turnoActivo = turnos.find(t => t.estado === 'abierto' && t.usuarioId === usuario.id)
  const necesitaTurno = usuario.rol === 'supervisor' && !editando && !turnoActivo
  const cambiar = (k, v) => setF(p => ({ ...p, [k]: v }))

  const inicio = { lat: f.lat, lng: f.lng }
  const fin = { lat: f.lat2, lng: f.lng2 }

  // Guarda un extremo de la cuadra (inicio = A, fin = B)
  function ponerPunto(cual, lat, lng) {
    setF(p => cual === 'inicio' ? { ...p, lat, lng } : { ...p, lat2: lat, lng2: lng })
    if (cual === 'inicio' && !f.lat2) setMarcar('fin')
  }

  async function tomarGPS(cual) {
    setGps(g => ({ ...g, cargando: cual, error: '' }))
    const r = await obtenerGPS()
    if (r.error) return setGps(g => ({ ...g, cargando: '', error: r.error }))
    ponerPunto(cual, r.lat, r.lng)
    setGps(g => ({ cargando: '', error: '', precision: { ...g.precision, [cual]: r.precision } }))
  }

  // Completa la calle intervenida y las transversales con los nombres de Google (o OpenStreetMap)
  async function completarCalles(pisar) {
    if (!f.lat || !f.lng || !navigator.onLine) return
    setBuscandoCalles(true)
    try {
      if (f.lat2 && f.lng2) {
        const d = await deducirCuadra({ lat: +f.lat, lng: +f.lng }, { lat: +f.lat2, lng: +f.lng2 })
        setOpciones({ calle: d.opcionesCalle, entre1: d.opcionesEntre1, entre2: d.opcionesEntre2 })
        setF(p => ({
          ...p,
          calle: pisar || !p.calle ? d.calle || p.calle : p.calle,
          entre1: pisar || !p.entre1 ? d.entre1 || p.entre1 : p.entre1,
          entre2: pisar || !p.entre2 ? d.entre2 || p.entre2 : p.entre2,
        }))
      } else {
        const n = await callesEnPunto(+f.lat, +f.lng)
        setOpciones(o => ({ ...o, calle: n, entre1: n }))
      }
    } finally { setBuscandoCalles(false) }
  }

  // Cada vez que cambian los extremos, vuelve a buscar los nombres (sin pisar lo que escribió el operario)
  useEffect(() => {
    const t = setTimeout(() => completarCalles(false), 700)
    return () => clearTimeout(t)
  }, [f.lat, f.lng, f.lat2, f.lng2])
  // Si se cargó sin señal, completa cuando vuelve internet
  useEffect(() => {
    const alVolver = () => completarCalles(false)
    window.addEventListener('online', alVolver)
    return () => window.removeEventListener('online', alVolver)
  })

  useEffect(() => { if (!editando && !necesitaTurno) tomarGPS('inicio') }, [])

  async function buscar() {
    if (!busqueda.trim()) return
    try {
      const r = await buscarDireccion(busqueda + ', Tucumán')
      setResultados(r)
      if (!r.length) setError('No se encontró la dirección')
    } catch { setError('Sin conexión para buscar direcciones') }
  }

  function elegirFoto(momento) {
    momentoFoto.current = momento
    inputFoto.current.click()
  }

  async function alElegirFotos(e) {
    const archivos = [...e.target.files]
    e.target.value = ''
    if (!archivos.length) return
    setSubiendoFoto(true)
    try {
      for (const a of archivos) {
        const foto = await agregarFoto(id, a, momentoFoto.current)
        nuevasFotos.current.push(foto.id)
        setF(p => ({ ...p, fotos: [...p.fotos, foto] }))
      }
    } catch (err) { setError(err.message) }
    setSubiendoFoto(false)
  }

  function quitarFoto(i) {
    const foto = f.fotos[i]
    if (foto.pendiente) descartarPendiente(foto.id)
    setF(p => ({ ...p, fotos: p.fotos.filter((_, j) => j !== i) }))
  }

  function cancelar() {
    if (!editando) nuevasFotos.current.forEach(descartarPendiente)
    ir(usuario.rol === 'supervisor' ? 'turno' : 'lista')
  }

  function enviar(e) {
    e.preventDefault()
    setError('')
    if (!f.calle.trim()) return setError('Completá la calle')
    if (!f.entre1.trim()) return setError('Completá al menos una calle que intercepta')
    if (num(f.columnas) <= 0) return setError('Indicá la cantidad de columnas pintadas')
    if (!f.lat || !f.lng) return setError('Falta marcar el inicio de la cuadra (A): tomá el GPS en la esquina o tocá el mapa')
    if (!editando && (!f.lat2 || !f.lng2)) return setError('Falta marcar el fin de la cuadra (B): tomá el GPS en la otra esquina o tocá el mapa')
    if (clientes.length && !f.clienteId) return setError('Seleccioná el cliente')
    const sinLitros = colores.filter(c => String(f.litros?.[c.id] ?? '').trim() === '')
    if (!editando && sinLitros.length) return setError(`Cargá los litros usados de ${sinLitros.map(c => c.nombre).join(', ')} (0 si no se usó)`)
    const cli = clientes.find(c => c.id === f.clienteId)
    // Si la foto se subió mientras se editaba, conservar la URL ya guardada
    const actual = leer('registros').find(r => r.id === id)
    const fotos = f.fotos.map(ft => actual?.fotos?.find(x => x.id === ft.id && x.url) || ft)
    const ahora = new Date().toISOString()
    guardar('registros', {
      ...(editando || {}),
      ...f,
      fotos,
      id,
      columnas: Math.round(num(f.columnas)),
      litros: Object.fromEntries(colores.map(c => [c.id, num(f.litros?.[c.id])])),
      calle: f.calle.trim(), entre1: f.entre1.trim(), entre2: f.entre2.trim(),
      clienteNombre: cli?.nombre || '',
      fecha: editando?.fecha || ahora,
      usuarioId: editando?.usuarioId || usuario.id,
      usuarioNombre: editando?.usuarioNombre || usuario.nombre,
      turnoId: editando ? editando.turnoId : (turnoActivo?.id || null),
      editado: editando ? ahora : undefined,
      editadoPor: editando ? usuario.nombre : undefined,
    })
    subirPendientes()
    setGuardado(true)
  }

  if (necesitaTurno) {
    return (
      <div className="tarjeta">
        <div className="aviso">Para cargar cuadras primero tenés que abrir tu turno.</div>
        <button className="btn" onClick={() => ir('turno')}>Ir a Mi turno</button>
      </div>
    )
  }

  if (guardado) {
    return (
      <div className="tarjeta" style={{ textAlign: 'center' }}>
        <div className="ok" style={{ fontSize: 17 }}>{editando ? '¡Cuadra actualizada!' : '¡Cuadra guardada!'}</div>
        <p className="tenue">{f.calle} entre {f.entre1}{f.entre2 ? ' y ' + f.entre2 : ''} — {fmt(f.columnas)} columnas</p>
        <div className="acciones" style={{ justifyContent: 'center' }}>
          {!editando && <button className="btn" onClick={() => ir('nuevo', { otra: Date.now() })}>Cargar otra cuadra</button>}
          <button className="btn sec" onClick={() => ir(usuario.rol === 'supervisor' ? 'turno' : 'lista')}>{usuario.rol === 'supervisor' ? 'Volver al turno' : 'Ir a la lista'}</button>
        </div>
      </div>
    )
  }

  const teor = litrosTeoricos(f.columnas, colores)
  const bloqueadoCert = editando && ['Certificado', 'Facturado'].includes(editando.estadoCert) && usuario.rol !== 'admin'

  return (
    <form onSubmit={enviar}>
      {error && <div className="error">{error}</div>}
      {bloqueadoCert && <div className="aviso">Esta cuadra ya está certificada: solo el administrador puede modificarla.</div>}

      <div className="tarjeta">
        <h2>📍 Ubicación de la cuadra</h2>
        <div className="tenue" style={{ marginBottom: 8 }}>Parate en una esquina y tocá <b>Inicio</b>; caminá hasta la otra esquina y tocá <b>Fin</b>. La cuadra se dibuja entre los dos puntos.</div>
        <div className="fila" style={{ marginBottom: 10 }}>
          {[['inicio', 'A · Inicio de cuadra', inicio], ['fin', 'B · Fin de cuadra', fin]].map(([cual, texto, p]) => (
            <div key={cual} className="punto-cuadra">
              <button type="button" className={'btn' + (p.lat ? ' sec' : '')} onClick={() => tomarGPS(cual)} disabled={!!gps.cargando}>
                {gps.cargando === cual ? 'Obteniendo GPS…' : `📡 ${texto}`}
              </button>
              <span className="tenue">{p.lat ? `${p.lat}, ${p.lng}${gps.precision[cual] ? ` (±${gps.precision[cual]} m)` : ''}` : 'Sin marcar'}</span>
            </div>
          ))}
        </div>
        {gps.error && <div className="aviso">{gps.error}. Podés buscar la dirección o tocar el mapa.</div>}
        <div className="acciones" style={{ marginBottom: 8, fontSize: 14 }}>
          <span style={{ alignSelf: 'center' }}>Tocar el mapa marca:</span>
          <label><input type="radio" checked={marcar === 'inicio'} onChange={() => setMarcar('inicio')} /> A · Inicio</label>
          <label><input type="radio" checked={marcar === 'fin'} onChange={() => setMarcar('fin')} /> B · Fin</label>
        </div>
        <div className="fila" style={{ marginBottom: 8 }}>
          <input placeholder="Buscar dirección o esquina…" value={busqueda} onChange={e => setBusqueda(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscar() } }} style={{ padding: 9, border: '1px solid var(--borde)', borderRadius: 8 }} />
          <button type="button" className="btn sec" style={{ flex: '0 0 auto' }} onClick={buscar}>Buscar</button>
        </div>
        {resultados.length > 0 && (
          <div className="tarjeta" style={{ padding: 8 }}>
            {resultados.map(r => (
              <div key={r.place_id} style={{ padding: 6, cursor: 'pointer', borderBottom: '1px solid var(--borde)' }}
                onClick={() => { ponerPunto(marcar, +(+r.lat).toFixed(6), +(+r.lon).toFixed(6)); setResultados([]) }}>{r.display_name}</div>
            ))}
          </div>
        )}
        <MapaCuadra inicio={inicio} fin={fin} color={colorCuadra(f)}
          onMover={(cual, lat, lng) => ponerPunto(cual, lat, lng)}
          onClic={(lat, lng) => ponerPunto(marcar, lat, lng)} />
        <div className="tenue" style={{ marginTop: 6 }}>
          Arrastrá A o B para dejarlos justo en la esquina.
          {f.lat2 ? ` Largo de la cuadra: ${fmt(largoCuadra(inicio, fin))} m.` : ''}
        </div>
      </div>

      <div className="tarjeta">
        <h2>🛣️ Cuadra</h2>
        {clientes.length > 0 && (
          <Campo label="Cliente *">
            <select value={f.clienteId} onChange={e => cambiar('clienteId', e.target.value)}>
              <option value="">Seleccioná…</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
        )}
        <div className="acciones" style={{ marginBottom: 8 }}>
          <button type="button" className="btn sec chico" onClick={() => completarCalles(true)} disabled={buscandoCalles || !f.lat}>
            {buscandoCalles ? 'Buscando calles…' : '🔄 Completar calles desde el mapa'}
          </button>
          {!navigator.onLine && <span className="tenue" style={{ alignSelf: 'center' }}>Sin señal: escribilas a mano o se completan al volver internet.</span>}
        </div>
        <CampoCalle label="Calle intervenida *" valor={f.calle} opciones={opciones.calle} onCambio={v => cambiar('calle', v)} ejemplo="Ej: Muñecas" />
        <div className="fila">
          <CampoCalle label="Desde (calle transversal en A) *" valor={f.entre1} opciones={opciones.entre1} onCambio={v => cambiar('entre1', v)} ejemplo="Ej: Madrid" />
          <CampoCalle label="Hasta (calle transversal en B)" valor={f.entre2} opciones={opciones.entre2} onCambio={v => cambiar('entre2', v)} ejemplo="Ej: Av. Francisco de Aguirre" />
        </div>
        <div className="fila">
          <Campo label="Columnas pintadas (unidades) *">
            <input type="number" inputMode="numeric" min="1" step="1" value={f.columnas} onChange={e => cambiar('columnas', e.target.value)} style={{ fontSize: 20, fontWeight: 700 }} />
          </Campo>
          <Campo label="Estado del trabajo">
            <select value={f.estadoOperativo} onChange={e => cambiar('estadoOperativo', e.target.value)}>
              {ESTADOS_OPERATIVOS.map(x => <option key={x}>{x}</option>)}
            </select>
          </Campo>
          {usuario.rol === 'admin' && (
            <Campo label="Certificación">
              <select value={f.estadoCert} onChange={e => cambiar('estadoCert', e.target.value)}>
                {ESTADOS_CERT.map(x => <option key={x}>{x}</option>)}
              </select>
            </Campo>
          )}
        </div>
      </div>

      <div className="tarjeta">
        <h2>🎨 Pintura usada en esta cuadra</h2>
        <div className="tenue" style={{ marginBottom: 8 }}>Litros de cada color (0 si no se usó). El estimado sale del rendimiento por columna.</div>
        <div className="fila">
          {colores.map(c => (
            <Campo key={c.id} label={<><span className="muestra-color" style={{ background: c.hex }} />{c.nombre} (L) *</>}>
              <input type="number" inputMode="decimal" min="0" step="0.1" value={f.litros?.[c.id] ?? ''}
                placeholder={num(f.columnas) > 0 ? `estimado ${fmt(teor[c.id], 2)}` : ''}
                onChange={e => setF(p => ({ ...p, litros: { ...p.litros, [c.id]: e.target.value } }))} />
            </Campo>
          ))}
        </div>
        {num(f.columnas) > 0 && (
          <button type="button" className="btn sec chico" onClick={() => setF(p => ({ ...p, litros: Object.fromEntries(colores.map(c => [c.id, +teor[c.id].toFixed(2)])) }))}>
            Usar el estimado ({colores.map(c => `${fmt(teor[c.id], 2)} L`).join(' · ')})
          </button>
        )}
      </div>

      <div className="tarjeta">
        <h2>📷 Fotos</h2>
        <div className="acciones" style={{ marginBottom: 10 }}>
          <button type="button" className="btn sec" onClick={() => elegirFoto('antes')} disabled={subiendoFoto}>Foto ANTES</button>
          <button type="button" className="btn sec" onClick={() => elegirFoto('despues')} disabled={subiendoFoto}>Foto DESPUÉS</button>
          {subiendoFoto && <span className="tenue" style={{ alignSelf: 'center' }}>Comprimiendo…</span>}
        </div>
        <input ref={inputFoto} type="file" accept="image/*" capture="environment" multiple hidden onChange={alElegirFotos} />
        <Fotos fotos={f.fotos} onQuitar={quitarFoto} />
        <div className="tenue" style={{ marginTop: 6 }}>⏳ = guardada en el celular, se sube sola cuando hay señal.</div>
      </div>

      <div className="tarjeta">
        <Campo label="Observaciones"><textarea value={f.observaciones} onChange={e => cambiar('observaciones', e.target.value)} placeholder="Columnas en mal estado, faltantes, etc." /></Campo>
        <div className="acciones">
          <button className="btn" disabled={bloqueadoCert}>{editando ? 'Guardar cambios' : 'Guardar cuadra'}</button>
          <button type="button" className="btn sec" onClick={cancelar}>Cancelar</button>
        </div>
      </div>
    </form>
  )
}

// Campo de calle con sugerencias tocables (las calles que encontró el GPS)
function CampoCalle({ label, valor, opciones, onCambio, ejemplo }) {
  const otras = (opciones || []).filter(o => o !== valor).slice(0, 4)
  return (
    <Campo label={label}>
      <input value={valor} onChange={e => onCambio(e.target.value)} placeholder={ejemplo} />
      {otras.length > 0 && (
        <div className="sugerencias">
          {otras.map(o => <button type="button" key={o} className="etq gris" onClick={() => onCambio(o)}>{o}</button>)}
        </div>
      )}
    </Campo>
  )
}
