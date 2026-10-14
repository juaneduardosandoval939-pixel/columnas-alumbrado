// ── CONFIGURACIÓN SUPABASE ────────────────────────────────────────────────────
// Supabase → Project Settings → API: copiar la URL y la "anon public key".
// La anon key es pública por diseño: se puede dejar en el código.
//
// Alternativa: cargarlas en Vercel → Settings → Environment Variables como
// VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (tienen prioridad sobre esto).

export const SUPABASE_URL      = import.meta.env?.VITE_SUPABASE_URL      || 'PEGAR_URL_DEL_PROYECTO'
export const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'PEGAR_ANON_KEY'

// Carpeta (bucket) de Supabase Storage donde se guardan las fotos
export const BUCKET_FOTOS = 'fotos-columnas'
