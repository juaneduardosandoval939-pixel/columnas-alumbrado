# Columnas de Alumbrado — CREAR

Sistema web para registrar la pintura de columnas de alumbrado público (Crear Construcciones y Mantenimiento S.A., Tucumán).
Misma arquitectura que `mantenimiento-flota-app`: React 18 + Vite, datos sincronizados con Supabase (tabla genérica `app_datos`), publicado en Vercel. Todo el texto de la interfaz es en español rioplatense (voseo: "cargá", "elegí").

## Ramas
- `main` = versión publicada para los supervisores. No se trabaja directo acá.
- `desarrollo` = cambios en prueba. Todo cambio va primero a `desarrollo`; se pasa a `main` solo cuando el usuario lo aprueba.

## Comandos
- `npm install` · `npm run dev -- --host` (prueba) · `npm run build` (debe compilar sin errores antes de subir cualquier cambio).
- No hay tests automáticos: verificar los cambios abriendo la app (login inicial `eduardo.sandoval@crearmantenimiento.com.ar` / `crear2026`).

## Estructura
- `src/datos.js` — colecciones (usuarios, clientes, colores, entradas, turnos, registros, certificados, accesos), hooks `useColeccion`, `guardar/actualizar/eliminar`, cálculos (rendimiento, `resumenTurno`, `stockColores`), fechas en hora local (`diaLocal`, `fechaCorta`).
- `src/sync.js` — sincronización localStorage ↔ Supabase (copiada de la app de flota). Ordena por `id` numérico: usar siempre `nuevoId()`.
- `src/fotos.js` — compresión, cola en IndexedDB y subida a Supabase Storage (bucket `fotos-columnas`).
- `src/ui.jsx` — componentes compartidos (Campo, Modal, mapa, fotos, exportar Excel, barras).
- `src/pages/` — una pantalla por archivo. Menú y permisos por rol en `src/App.jsx` (`MENU`).
- `supabase/supabase_setup.sql` — tabla y bucket.

## Reglas de negocio
- Un **registro** = una cuadra: calle, entre calle 1 y 2, GPS, cantidad de columnas (unidades), fotos antes/después.
- 3 colores con rendimiento en litros por columna: Azul Tormenta Eléctrica 0,30 · Azul Traful 0,25 · Blanco 0,20 (editables).
- El supervisor abre turno → carga cuadras → cierra turno cargando litros reales por color. Productividad = columnas/hora, litros/columna y desvío vs. estimado.
- Certificado = cuadras terminadas sin certificar de un cliente y período, agrupadas por calle con intersecciones y subtotales. Una cuadra certificada no se vuelve a certificar salvo que se anule el certificado.
- La app debe seguir funcionando sin señal (todo se guarda local primero).

## Versión de prueba en la PC de Eduardo
- `escritorio/instalar.bat` instala todo y clona `desarrollo` en el escritorio; `escritorio/iniciar.bat` levanta Vite en `localhost:5173`; `escritorio/actualizar.bat` hace `git pull` cada 15 s, así cada push a `desarrollo` se ve en vivo (HMR).
- Por eso: subir a `desarrollo` solo cambios que compilan (`npm run build`), en commits chicos y con mensaje claro en español (Eduardo los ve en la ventana de actualizaciones).
- Los `.bat` van con fin de línea CRLF (`.gitattributes`).

## Segundo cerebro (Obsidian en Google Drive)
- Nota del proyecto: `Obsidian Vault/App-Columnas-CREAR.md`. Después de cada cambio importante, actualizar ahí el estado, el historial de cambios y los pendientes.
