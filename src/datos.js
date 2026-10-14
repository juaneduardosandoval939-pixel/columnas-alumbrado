// ── DATOS DE LA APP ───────────────────────────────────────────────────────────
// Cada colección se guarda en el navegador (localStorage) y se sincroniza con
// Supabase (tabla app_datos) mediante sync.js. Así la app funciona sin señal.

import { useSyncExternalStore } from 'react'
import { createSync } from './sync'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig'

// Rendimientos según "rendimiento insumos pintura de postes y analisis de costos.xlsx"
export const COLORES_DEFAULT = [
  { id: 'tormenta', nombre: 'Azul Tormenta Eléctrica', rendimiento: 0.30, stockMinimo: 40, hex: '#1f3f8f', activo: true },
  { id: 'traful',   nombre: 'Azul Traful',             rendimiento: 0.25, stockMinimo: 40, hex: '#2f8fd0', activo: true },
  { id: 'blanco',   nombre: 'Blanco',                  rendimiento: 0.20, stockMinimo: 40, hex: '#f2f2f2', activo: true },
]

// Usuario administrador inicial. Contraseña inicial: crear2026 (se pide cambiarla al entrar).
export const USUARIOS_DEFAULT = [
  {
    id: 'admin',
    nombre: 'Eduardo Sandoval',
    email: 'eduardo.sandoval@crearmantenimiento.com.ar',
    passHash: '',            // se completa al iniciar (ver asegurarHashes)
    passInicial: 'crear2026',
    debeCambiar: true,
    rol: 'admin',
    activo: true,
  },
]

export const ESTADOS_OPERATIVOS = ['En proceso', 'Terminado']
export const ESTADOS_CERT = ['Sin certificar', 'En revisión', 'Certificado', 'Rechazado', 'Facturado']
export const ROLES = { admin: 'Administrador', supervisor: 'Supervisor', cliente: 'Cliente' }

const COLECCIONES = [
  { nombre: 'usuarios',     defaults: USUARIOS_DEFAULT },
  { nombre: 'clientes',     defaults: [] },
  { nombre: 'colores',      defaults: COLORES_DEFAULT },
  { nombre: 'entradas',     defaults: [], ordenarPorIdDesc: true },
  { nombre: 'turnos',       defaults: [], ordenarPorIdDesc: true },
  { nombre: 'registros',    defaults: [], ordenarPorIdDesc: true },
  { nombre: 'certificados', defaults: [], ordenarPorIdDesc: true },
  { nombre: 'accesos',      defaults: [], ordenarPorIdDesc: true },
]

// ── Almacenamiento local + suscripciones ─────────────────────────────────────
const claveLS = n => 'col_datos_' + n
const parse = (s, def = null) => { try { const v = JSON.parse(s); return v ?? def } catch { return def } }
const oyentes = new Set()
const cache = {}

function leerCrudo(n) { return parse(localStorage.getItem(claveLS(n))) }
function avisar() { for (const k of Object.keys(cache)) delete cache[k]; oyentes.forEach(f => f()) }

export function leer(n) {
  if (!(n in cache)) {
    const c = COLECCIONES.find(x => x.nombre === n)
    cache[n] = leerCrudo(n) ?? (c?.defaults || [])
  }
  return cache[n]
}

function escribirLocal(n, lista) {
  localStorage.setItem(claveLS(n), JSON.stringify(lista))
}

export function guardarColeccion(n, lista) {
  escribirLocal(n, lista)
  avisar()
  sync.programar()
}

// Crea o reemplaza un elemento (por id)
export function guardar(n, item) {
  const lista = [...leer(n)]
  const i = lista.findIndex(x => String(x.id) === String(item.id))
  if (i >= 0) lista[i] = item
  else lista.unshift(item)
  guardarColeccion(n, lista)
  return item
}

// Aplica cambios parciales a un elemento existente
export function actualizar(n, id, cambios) {
  const actual = leer(n).find(x => String(x.id) === String(id))
  if (!actual) return null
  const nuevo = typeof cambios === 'function' ? cambios(actual) : { ...actual, ...cambios }
  return guardar(n, nuevo)
}

export function eliminar(n, id) {
  guardarColeccion(n, leer(n).filter(x => String(x.id) !== String(id)))
}

export function useColeccion(n) {
  return useSyncExternalStore(
    f => { oyentes.add(f); return () => oyentes.delete(f) },
    () => leer(n),
  )
}

// Id numérico creciente (fecha en ms + 3 dígitos al azar): sync.js ordena por id
export function nuevoId() {
  return String(Date.now()) + String(Math.floor(Math.random() * 1000)).padStart(3, '0')
}

// ── Sincronización ───────────────────────────────────────────────────────────
let estadoSync = { configurado: false, ok: null, ultima: null, error: '' }
const oyentesSync = new Set()

export const sync = createSync({
  url: SUPABASE_URL,
  key: SUPABASE_ANON_KEY,
  storage: localStorage,
  fetchFn: (...a) => fetch(...a),
  colecciones: COLECCIONES.map(c => ({
    ...c,
    leer: () => leerCrudo(c.nombre),
    escribir: lista => escribirLocal(c.nombre, lista),
  })),
  onCambio: avisar,
  onEstado: e => { estadoSync = e; oyentesSync.forEach(f => f()) },
})

export function useEstadoSync() {
  return useSyncExternalStore(
    f => { oyentesSync.add(f); return () => oyentesSync.delete(f) },
    () => estadoSync,
  )
}

// ── Contraseñas ──────────────────────────────────────────────────────────────
// Se guarda solo el hash (SHA-256 con el email como sal), nunca la contraseña.
export async function hashClave(email, clave) {
  const datos = new TextEncoder().encode(String(email).trim().toLowerCase() + '|' + clave)
  const h = await crypto.subtle.digest('SHA-256', datos)
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// Completa el hash de usuarios que todavía tienen contraseña inicial en texto
export async function asegurarHashes() {
  const lista = leer('usuarios')
  let cambio = false
  const nueva = await Promise.all(lista.map(async u => {
    if (u.passInicial && !u.passHash) {
      cambio = true
      const { passInicial, ...resto } = u
      return { ...resto, passHash: await hashClave(u.email, passInicial) }
    }
    return u
  }))
  if (cambio) guardarColeccion('usuarios', nueva)
}

// ── Cálculos ─────────────────────────────────────────────────────────────────
export const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : n }
export const fmt = (v, d = 0) => num(v).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d })
// Día local (hora de Argentina del dispositivo) en formato AAAA-MM-DD
export const diaLocal = iso => {
  if (!iso) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const fechaCorta = iso => {
  if (!iso) return ''
  const [a, m, d] = diaLocal(iso).split('-')
  return `${d}/${m}/${a}`
}
export const fechaHora = iso => iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : ''
export const hoyISO = () => diaLocal(new Date().toISOString())

// Litros teóricos de un registro según el rendimiento de cada color
export function litrosTeoricos(columnas, colores) {
  const r = {}
  for (const c of colores) if (c.activo !== false) r[c.id] = num(columnas) * num(c.rendimiento)
  return r
}

// Resumen de un turno: columnas, horas, litros reales y teóricos
export function resumenTurno(turno, registros, colores) {
  const regs = registros.filter(r => r.turnoId === turno.id)
  const columnas = regs.reduce((s, r) => s + num(r.columnas), 0)
  const fin = turno.fin ? new Date(turno.fin) : new Date()
  const horas = Math.max(0, (fin - new Date(turno.inicio)) / 36e5)
  const teoricos = litrosTeoricos(columnas, colores)
  const reales = turno.litros || {}
  const totalReal = Object.values(reales).reduce((s, v) => s + num(v), 0)
  const totalTeorico = Object.values(teoricos).reduce((s, v) => s + v, 0)
  return {
    registros: regs, cuadras: regs.length, columnas, horas,
    colHora: horas >= 0.25 ? columnas / horas : 0,   // turnos de menos de 15 min no cuentan
    teoricos, reales, totalReal, totalTeorico,
    litrosPorColumna: columnas > 0 ? totalReal / columnas : 0,
    desvio: totalTeorico > 0 && totalReal > 0 ? (totalReal - totalTeorico) / totalTeorico : null,
  }
}

// Stock por color: entradas − litros reales usados en turnos cerrados
export function stockColores(colores, entradas, turnos) {
  return colores.map(c => {
    const entrado = entradas.filter(e => e.colorId === c.id).reduce((s, e) => s + num(e.litros), 0)
    const usado = turnos.filter(t => t.estado === 'cerrado').reduce((s, t) => s + num(t.litros?.[c.id]), 0)
    return { ...c, entrado, usado, disponible: entrado - usado }
  })
}

// Registro de acceso (para la pantalla Accesos)
export function registrarAcceso(u) {
  guardar('accesos', {
    id: nuevoId(), usuarioId: u.id, nombre: u.nombre, email: u.email, rol: u.rol,
    fecha: new Date().toISOString(), dispositivo: navigator.userAgent.slice(0, 120),
  })
}
