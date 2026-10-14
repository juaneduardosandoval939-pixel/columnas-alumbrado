// ── FOTOS ─────────────────────────────────────────────────────────────────────
// Las fotos se comprimen en el celular, se guardan en IndexedDB y se suben a
// Supabase Storage cuando hay señal. El registro guarda solo la URL final.

import { useEffect, useState } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, BUCKET_FOTOS } from './supabaseConfig'
import { leer, actualizar } from './datos'

const ANCHO_MAX = 1280
const CALIDAD = 0.72
const DB = 'columnas-fotos'
const STORE = 'pendientes'

function abrirDB() {
  return new Promise((ok, mal) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => ok(req.result)
    req.onerror = () => mal(req.error)
  })
}

async function tx(modo, fn) {
  const db = await abrirDB()
  return new Promise((ok, mal) => {
    const t = db.transaction(STORE, modo)
    const r = fn(t.objectStore(STORE))
    t.oncomplete = () => ok(r?.result)
    t.onerror = () => mal(t.error)
  })
}

const guardarPendiente = p => tx('readwrite', s => s.put(p))
const leerPendiente = id => tx('readonly', s => s.get(id))
const borrarPendiente = id => tx('readwrite', s => s.delete(id))
const todosPendientes = () => tx('readonly', s => s.getAll())

// Reduce la foto a 1280 px de ancho como máximo y la pasa a JPEG
export function comprimir(archivo) {
  return new Promise((ok, mal) => {
    const img = new Image()
    const url = URL.createObjectURL(archivo)
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la imagen')) }
    img.onload = () => {
      let { width: w, height: h } = img
      if (w > ANCHO_MAX) { h = Math.round(h * ANCHO_MAX / w); w = ANCHO_MAX }
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      c.toBlob(b => b ? ok(b) : mal(new Error('No se pudo comprimir')), 'image/jpeg', CALIDAD)
    }
    img.src = url
  })
}

// Agrega una foto a un registro: queda pendiente hasta que se suba
export async function agregarFoto(registroId, archivo, momento) {
  const blob = await comprimir(archivo)
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  await guardarPendiente({ id, registroId, blob })
  const foto = { id, momento, url: '', pendiente: true, fecha: new Date().toISOString() }
  subirPendientes()
  return foto
}

export async function descartarPendiente(id) {
  try { await borrarPendiente(id) } catch {}
}

const configurado = SUPABASE_URL && !SUPABASE_URL.startsWith('PEGAR')
let subiendo = false

// Sube todas las fotos pendientes y actualiza el registro con la URL
export async function subirPendientes() {
  if (subiendo || !configurado || !navigator.onLine) return
  subiendo = true
  try {
    const lista = await todosPendientes()
    for (const p of lista) {
      const existe = leer('registros').find(r => r.id === p.registroId)
      if (!existe) continue   // registro todavía no guardado (o eliminado)
      const ruta = `${p.registroId}/${p.id}.jpg`
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET_FOTOS}/${ruta}`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
          'Content-Type': 'image/jpeg',
          'x-upsert': 'true',
        },
        body: p.blob,
      })
      if (!r.ok) continue
      const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_FOTOS}/${ruta}`
      actualizar('registros', p.registroId, reg => ({
        ...reg,
        fotos: (reg.fotos || []).map(f => f.id === p.id ? { ...f, url, pendiente: false } : f),
      }))
      await borrarPendiente(p.id)
    }
  } catch (e) {
    console.warn('Error subiendo fotos:', e)
  } finally {
    subiendo = false
  }
}

export async function cantidadPendientes() {
  try { return (await todosPendientes()).length } catch { return 0 }
}

// Devuelve una URL para mostrar la foto (la subida o la guardada en el celular)
export function useUrlFoto(foto) {
  const [url, setUrl] = useState(foto?.url || '')
  useEffect(() => {
    if (foto?.url) { setUrl(foto.url); return }
    let local = ''
    let vivo = true
    leerPendiente(foto?.id).then(p => {
      if (p?.blob && vivo) { local = URL.createObjectURL(p.blob); setUrl(local) }
    }).catch(() => {})
    return () => { vivo = false; if (local) URL.revokeObjectURL(local) }
  }, [foto?.id, foto?.url])
  return url
}
