// Pinturas: rendimiento por columna, entradas de stock, consumo y proyección
import { useState } from 'react'
import { useColeccion, guardar, eliminar, nuevoId, num, fmt, fechaCorta, hoyISO, stockColores, diaLocal } from '../datos'
import { Campo, Modal } from '../ui'

function ModalEntrada({ colores, usuario, onCerrar }) {
  const [f, setF] = useState({ colorId: colores[0]?.id || '', litros: '', fecha: hoyISO(), remito: '' })
  const [error, setError] = useState('')
  function guardarEntrada() {
    if (num(f.litros) <= 0) return setError('Indicá los litros')
    guardar('entradas', { id: nuevoId(), ...f, litros: num(f.litros), cargadoPor: usuario.nombre, creado: new Date().toISOString() })
    onCerrar()
  }
  return (
    <Modal titulo="Cargar entrada de pintura" onCerrar={onCerrar}>
      {error && <div className="error">{error}</div>}
      <Campo label="Color">
        <select value={f.colorId} onChange={e => setF(p => ({ ...p, colorId: e.target.value }))}>
          {colores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </Campo>
      <div className="fila">
        <Campo label="Litros"><input type="number" min="0" step="0.1" value={f.litros} onChange={e => setF(p => ({ ...p, litros: e.target.value }))} /></Campo>
        <Campo label="Fecha"><input type="date" value={f.fecha} onChange={e => setF(p => ({ ...p, fecha: e.target.value }))} /></Campo>
      </div>
      <Campo label="Remito / proveedor"><input value={f.remito} onChange={e => setF(p => ({ ...p, remito: e.target.value }))} /></Campo>
      <div className="acciones">
        <button className="btn" onClick={guardarEntrada}>Guardar</button>
        <button className="btn sec" onClick={onCerrar}>Cancelar</button>
      </div>
    </Modal>
  )
}

function ModalColor({ color, onCerrar }) {
  const [f, setF] = useState(color || { id: nuevoId(), nombre: '', rendimiento: '', stockMinimo: 40, hex: '#cccccc', activo: true })
  function guardarColor() {
    if (!f.nombre.trim() || num(f.rendimiento) <= 0) return
    guardar('colores', { ...f, rendimiento: num(f.rendimiento), stockMinimo: num(f.stockMinimo) })
    onCerrar()
  }
  return (
    <Modal titulo={color ? 'Editar color' : 'Nuevo color'} onCerrar={onCerrar}>
      <Campo label="Nombre"><input value={f.nombre} onChange={e => setF(p => ({ ...p, nombre: e.target.value }))} /></Campo>
      <div className="fila">
        <Campo label="Rendimiento (litros por columna)"><input type="number" min="0" step="0.01" value={f.rendimiento} onChange={e => setF(p => ({ ...p, rendimiento: e.target.value }))} /></Campo>
        <Campo label="Stock mínimo (L)"><input type="number" min="0" value={f.stockMinimo} onChange={e => setF(p => ({ ...p, stockMinimo: e.target.value }))} /></Campo>
        <Campo label="Color de muestra"><input type="color" value={f.hex} onChange={e => setF(p => ({ ...p, hex: e.target.value }))} /></Campo>
      </div>
      <label style={{ display: 'block', marginBottom: 12 }}><input type="checkbox" checked={f.activo !== false} onChange={e => setF(p => ({ ...p, activo: e.target.checked }))} /> Activo</label>
      <div className="acciones">
        <button className="btn" onClick={guardarColor}>Guardar</button>
        <button className="btn sec" onClick={onCerrar}>Cancelar</button>
      </div>
    </Modal>
  )
}

export default function Materiales({ usuario }) {
  const colores = useColeccion('colores')
  const entradas = useColeccion('entradas')
  const turnos = useColeccion('turnos')
  const [entrada, setEntrada] = useState(false)
  const [editar, setEditar] = useState(undefined)
  const [aPintar, setAPintar] = useState(1000)
  const activos = colores.filter(c => c.activo !== false)
  const stock = stockColores(activos, entradas, turnos)
  const alcanzan = stock.length ? Math.floor(Math.min(...stock.map(s => s.rendimiento > 0 ? Math.max(0, s.disponible) / s.rendimiento : Infinity))) : 0

  return (
    <>
      <div className="acciones" style={{ marginBottom: 14 }}>
        <button className="btn" onClick={() => setEntrada(true)}>➕ Cargar entrada de pintura</button>
        <button className="btn sec" onClick={() => setEditar(null)}>Agregar color</button>
      </div>

      <div className="grilla" style={{ marginBottom: 14 }}>
        {stock.map(s => (
          <div className="dato" key={s.id}>
            <div className="etiqueta"><span className="muestra-color" style={{ background: s.hex }} />{s.nombre}</div>
            <div className="valor" style={{ color: s.disponible < num(s.stockMinimo) ? 'var(--rojo)' : undefined }}>{fmt(s.disponible, 1)} L</div>
            <div className="tenue">Entró {fmt(s.entrado, 0)} L · usado {fmt(s.usado, 1)} L · {fmt(s.rendimiento, 2)} L/columna</div>
            {s.disponible < num(s.stockMinimo) && <div className="etq rojo" style={{ marginTop: 6 }}>Bajo el mínimo ({fmt(s.stockMinimo)} L)</div>}
          </div>
        ))}
      </div>

      <div className="tarjeta">
        <h2>Proyección</h2>
        <p>Con el stock actual alcanza para pintar aproximadamente <b>{fmt(alcanzan)}</b> columnas (el color que primero se termina limita).</p>
        <div className="fila" style={{ maxWidth: 360 }}>
          <Campo label="Columnas a pintar"><input type="number" min="0" value={aPintar} onChange={e => setAPintar(e.target.value)} /></Campo>
        </div>
        <div className="envoltura-tabla">
          <table className="tabla">
            <thead><tr><th>Color</th><th className="num">L/columna</th><th className="num">Litros necesarios</th><th className="num">Disponible</th><th className="num">Faltante</th></tr></thead>
            <tbody>
              {stock.map(s => {
                const nec = num(aPintar) * num(s.rendimiento)
                const falta = Math.max(0, nec - s.disponible)
                return (
                  <tr key={s.id}>
                    <td><span className="muestra-color" style={{ background: s.hex }} />{s.nombre}</td>
                    <td className="num">{fmt(s.rendimiento, 2)}</td><td className="num">{fmt(nec, 1)}</td><td className="num">{fmt(s.disponible, 1)}</td>
                    <td className="num">{falta > 0 ? <span className="etq rojo">Comprar {fmt(Math.ceil(falta))} L</span> : <span className="etq verde">OK</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tarjeta">
        <h2>Colores y rendimientos</h2>
        <div className="envoltura-tabla">
          <table className="tabla">
            <thead><tr><th>Color</th><th className="num">L/columna</th><th className="num">Mínimo</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {colores.map(c => (
                <tr key={c.id}>
                  <td><span className="muestra-color" style={{ background: c.hex }} />{c.nombre}</td>
                  <td className="num">{fmt(c.rendimiento, 2)}</td><td className="num">{fmt(c.stockMinimo)} L</td>
                  <td>{c.activo !== false ? <span className="etq verde">Activo</span> : <span className="etq gris">Inactivo</span>}</td>
                  <td><button className="btn sec chico" onClick={() => setEditar(c)}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tarjeta">
        <h2>Entradas de pintura</h2>
        {entradas.length === 0 ? <div className="tenue">Sin entradas cargadas.</div> : (
          <div className="envoltura-tabla">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Color</th><th className="num">Litros</th><th>Remito / proveedor</th><th>Cargó</th><th></th></tr></thead>
              <tbody>
                {entradas.map(e => (
                  <tr key={e.id}>
                    <td>{fechaCorta(e.fecha)}</td><td>{colores.find(c => c.id === e.colorId)?.nombre || e.colorId}</td>
                    <td className="num">{fmt(e.litros, 1)}</td><td>{e.remito}</td><td>{e.cargadoPor}</td>
                    <td><button className="btn sec chico" onClick={() => eliminar('entradas', e.id)}>Quitar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {entrada && <ModalEntrada colores={activos} usuario={usuario} onCerrar={() => setEntrada(false)} />}
      {editar !== undefined && <ModalColor color={editar} onCerrar={() => setEditar(undefined)} />}
    </>
  )
}
