// ── CONFIGURACIÓN SUPABASE ────────────────────────────────────────────────────
// Proyecto Supabase "columnas-crear" (São Paulo). URL y "anon public key".
// La anon key es pública por diseño: se puede dejar en el código.
//
// Alternativa: cargarlas en Vercel → Settings → Environment Variables como
// VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (tienen prioridad sobre esto).

export const SUPABASE_URL      = import.meta.env?.VITE_SUPABASE_URL      || 'https://gqwpakmedpcwehdwbeqz.supabase.co'
export const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxd3Bha21lZHBjd2VoZHdiZXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5OTAzODYsImV4cCI6MjEwNzU2NjM4Nn0.CoA9bRDZIYnEhhr7bCue7w2sIMC10VerxXZmLePLrh0'

// Carpeta (bucket) de Supabase Storage donde se guardan las fotos
export const BUCKET_FOTOS = 'fotos-columnas'

// Clave de Google Maps (Geocoding API) para completar los nombres de las calles
// con los de Google. Restringirla en Google Cloud a los dominios de la app.
// Vacía: se usan los nombres de OpenStreetMap.
export const GOOGLE_MAPS_KEY = import.meta.env?.VITE_GOOGLE_MAPS_KEY || ''
