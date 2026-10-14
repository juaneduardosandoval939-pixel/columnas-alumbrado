// Alta / edición de una cuadra pintada
import { useEffect, useRef, useState } from 'react'
import { useColeccion, guardar, leer, nuevoId, num, fmt, litrosTeoricos, ESTADOS_OPERATIVOS, ESTADOS_CERT } from '../datos'
import { agregarFoto, descartarPendiente, subirPendientes } from '../fotos'
import { Campo, MapaPunto, Fotos, obtenerGPS, calleDesdeGPS, buscarDireccion } from '../ui'

const VACIO = {
  clienteId: '', calle: '', entre1: '', entre2: '', lat: '', lng: '',
  columnas: '', estadoOperativo: 'Terminado', estadoCert: 'Sin certificar', observaciones: '', fotos: [],
}

export default function FormRegistro({ usuario, ir, params }) {
  const registros = useColeccion('registros')
  const clientes = useColeccion('clientes').filter(c => c.activo !== false)
  const colores = useColeccion('colores').filter(c => c.activo !== false)
  const turnos = useColeccion('turnos')
  const editando = params.id ? registros.find(r => r.id === params.id) : null
  const [id] = useState(() => params.id || nuevoId())
  const [f, setF] = useState(() => editando ? { ...VACIO, ...editando } : { ...VACIO, clienteId: clientes.length === 1 ? clientes[0].id : '' })
  const [gps, setGps] = useState({ cargando: false, error: '', precision: null })
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

  async function tomarGPS() {
    setGps({ cargando: true, error: '', precision: null })
    const r = await obtenerGPS()
    if (r.error) return setGps({ cargando: false, error: r.error, precision: null })
    setF(p => ({ ...p, lat: r.lat, lng: r.lng }))
    setGps({ cargando: false, error: '', precision: r.precision })
    const calle = await calleDesdeGPS(r.lat, r.lng)
    if (calle) setF(p => p.calle ? p : { ...p, calle })
  }

  useEffect(() => { if (!editando && !necesitaTurno) tomarGPS() }, [])

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
    if (!f.lat || !f.lng) return setError('Falta la ubicación: tomá el GPS o marcá el punto en el mapa')
    if (clientes.length && !f.clienteId) return setError('Seleccioná el cliente')
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
        <h2>📍 Ubicación</h2>
        <div className="acciones" style={{ marginBottom: 10 }}>
          <button type="button" className="btn sec" onClick={tomarGPS} disabled={gps.cargando}>{gps.cargando ? 'Obteniendo GPS…' : '📡 Tomar GPS'}</button>
          {f.lat && <span className="tenue" style={{ alignSelf: 'center' }}>{f.lat}, {f.lng}{gps.precision ? ` (±${gps.precision} m)` : ''}</span>}
        </div>
        {gps.error && <div className="aviso">{gps.error}. Podés buscar la dirección o tocar el mapa.</div>}
        <div className="fila" style={{ marginBottom: 8 }}>
          <input placeholder="Buscar dirección…" value={busqueda} onChange={e => setBusqueda(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscar() } }} style={{ padding: 9, border: '1px solid var(--borde)', borderRadius: 8 }} />
          <button type="button" className="btn sec" style={{ flex: '0 0 auto' }} onClick={buscar}>Buscar</button>
        </div>
        {resultados.length > 0 && (
          <div className="tarjeta" style={{ padding: 8 }}>
            {resultados.map(r => (
              <div key={r.place_id} style={{ padding: 6, cursor: 'pointer', borderBottom: '1px solid var(--borde)' }}
                onClick={() => { setF(p => ({ ...p, lat: +(+r.lat).toFixed(6), lng: +(+r.lon).toFixed(6) })); setResultados([]) }}>{r.display_name}</div>
            ))}
          </div>
        )}
        <MapaPunto lat={f.lat} lng={f.lng} onMover={(lat, lng) => setF(p => ({ ...p, lat, lng }))} />
        <div className="tenue" style={{ marginTop: 6 }}>Tocá el mapa o arrastrá el marcador para ajustar el punto exacto.</div>
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
        <Campo label="Calle *"><input value={f.calle} onChange={e => cambiar('calle', e.target.value)} placeholder="Ej: Av. Sarmiento" /></Campo>
        <div className="fila">
          <Campo label="Entre calle *"><input value={f.entre1} onChange={e => cambiar('entre1', e.target.value)} placeholder="Ej: Laprida" /></Campo>
          <Campo label="Y calle"><input value={f.entre2} onChange={e => cambiar('entre2', e.target.value)} placeholder="Ej: 25 de Mayo" /></Campo>
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
        {num(f.columnas) > 0 && (
          <div className="tenue">Pintura estimada: {colores.map(c => `${c.nombre} ${fmt(teor[c.id], 2)} L`).join(' · ')}</div>
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
