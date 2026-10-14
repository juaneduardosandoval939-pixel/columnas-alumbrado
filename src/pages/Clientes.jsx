// Clientes (municipios, empresas) para asignar cuadras y certificados
import { useState } from 'react'
import { useColeccion, guardar, nuevoId, num, fmt } from '../datos'
import { Campo, Modal } from '../ui'

export default function Clientes() {
  const clientes = useColeccion('clientes')
  const registros = useColeccion('registros')
  const [editar, setEditar] = useState(undefined)
  const [f, setF] = useState({})

  function abrir(c) {
    setF(c || { id: nuevoId(), nombre: '', cuit: '', contacto: '', obra: '', activo: true })
    setEditar(c || null)
  }
  function guardarCliente() {
    if (!f.nombre?.trim()) return
    guardar('clientes', { ...f, nombre: f.nombre.trim() })
    setEditar(undefined)
  }

  return (
    <>
      <div className="acciones" style={{ marginBottom: 14 }}><button className="btn" onClick={() => abrir(null)}>➕ Nuevo cliente</button></div>
      {clientes.length === 0 ? <div className="tarjeta tenue">Todavía no hay clientes. Si cargás al menos uno, cada cuadra se asigna a un cliente y los certificados se arman por cliente.</div> : (
        <div className="envoltura-tabla">
          <table className="tabla">
            <thead><tr><th>Cliente</th><th>Obra / licitación</th><th>Contacto</th><th className="num">Columnas</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {clientes.map(c => (
                <tr key={c.id}>
                  <td><b>{c.nombre}</b>{c.cuit ? <div className="tenue">CUIT {c.cuit}</div> : null}</td>
                  <td>{c.obra}</td><td>{c.contacto}</td>
                  <td className="num">{fmt(registros.filter(r => r.clienteId === c.id).reduce((s, r) => s + num(r.columnas), 0))}</td>
                  <td>{c.activo !== false ? <span className="etq verde">Activo</span> : <span className="etq gris">Inactivo</span>}</td>
                  <td><button className="btn sec chico" onClick={() => abrir(c)}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editar !== undefined && (
        <Modal titulo={editar ? 'Editar cliente' : 'Nuevo cliente'} onCerrar={() => setEditar(undefined)}>
          <Campo label="Nombre *"><input value={f.nombre} onChange={e => setF(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Municipalidad de San Miguel de Tucumán" /></Campo>
          <div className="fila">
            <Campo label="CUIT"><input value={f.cuit} onChange={e => setF(p => ({ ...p, cuit: e.target.value }))} /></Campo>
            <Campo label="Contacto"><input value={f.contacto} onChange={e => setF(p => ({ ...p, contacto: e.target.value }))} /></Campo>
          </div>
          <Campo label="Obra / licitación (aparece en el certificado)"><input value={f.obra} onChange={e => setF(p => ({ ...p, obra: e.target.value }))} /></Campo>
          <label style={{ display: 'block', marginBottom: 12 }}><input type="checkbox" checked={f.activo !== false} onChange={e => setF(p => ({ ...p, activo: e.target.checked }))} /> Activo</label>
          <div className="acciones">
            <button className="btn" onClick={guardarCliente}>Guardar</button>
            <button className="btn sec" onClick={() => setEditar(undefined)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </>
  )
}
