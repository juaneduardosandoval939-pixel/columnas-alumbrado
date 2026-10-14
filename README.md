# Columnas de Alumbrado — CREAR

Sistema para registrar la pintura de columnas de alumbrado público: ubicación GPS por cuadra, fotos, cantidad de columnas, turnos con litros usados de cada color, productividad, stock de pintura y certificados.

Misma tecnología que la app de Mantenimiento de Flota: React (Vite) + Supabase (base de datos y fotos) + Vercel (publicación). Funciona sin señal: lo cargado queda en el celular y se sube solo cuando vuelve internet.

## Qué hace cada rol

| Rol | Pantallas |
|---|---|
| Administrador | Panel, Nueva cuadra, Lista, Mapa, Certificaciones, Turnos y productividad, Pinturas y stock, Clientes, Usuarios, Accesos |
| Supervisor | Mi turno (abrir / cerrar con litros), Nueva cuadra, Lista y Mapa de sus cuadras |
| Cliente | Lista y Mapa de las cuadras de su cliente |

## Flujo de trabajo

1. El supervisor abre su **turno**.
2. Por cada cuadra pintada carga: GPS (automático, ajustable en el mapa), calle, entre qué calles, **cantidad de columnas**, fotos de antes/después y observaciones.
3. Al terminar **cierra el turno** cargando los litros usados de cada color (el sistema muestra el estimado según el rendimiento).
4. El administrador ve la **productividad** (columnas por hora, litros por columna, desvío real vs. estimado) y el **stock**.
5. En **Certificaciones** elige cliente y período: el certificado agrupa por calle (corredor) con sus intersecciones y cantidades. Se exporta a Excel o se imprime/guarda en PDF. Las cuadras certificadas no pueden volver a certificarse (salvo que se anule el certificado).

## Rendimientos cargados (editables en "Pinturas y stock")

| Color | Litros por columna |
|---|---|
| Azul Tormenta Eléctrica | 0,30 |
| Azul Traful | 0,25 |
| Blanco | 0,20 |

Fuente: "rendimiento insumos pintura de postes y analisis de costos.xlsx".

## Puesta en marcha (una sola vez)

### 1. Supabase (base de datos y fotos)
1. Entrar a supabase.com → New project (por ejemplo `columnas-crear`, región São Paulo).
2. SQL Editor → New query → pegar todo `supabase/supabase_setup.sql` → Run. Crea la tabla y la carpeta de fotos `fotos-columnas`.
3. Project Settings → API → copiar **Project URL** y **anon public key**.

### 2. Código en GitHub
1. Crear un repositorio nuevo (ej. `columnas-alumbrado-app`) y subir esta carpeta (sin `node_modules` ni `dist`).

### 3. Publicar en Vercel
1. vercel.com → Add New → Project → importar el repositorio.
2. En Environment Variables cargar:
   - `VITE_SUPABASE_URL` = Project URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` = anon public key
3. Deploy. La dirección queda tipo `columnas-crear.vercel.app`.

(Alternativa: pegar URL y key directamente en `src/supabaseConfig.js`.)

### 4. Primer ingreso
- Usuario: `eduardo.sandoval@crearmantenimiento.com.ar`
- Contraseña inicial: `crear2026` (pide cambiarla en el primer ingreso)
- Luego cargar Clientes, Usuarios (supervisores) y las entradas de pintura.

En el celular: abrir la dirección en Chrome → menú ⋮ → "Agregar a pantalla principal".

## Probar en la PC antes de publicar (versión local)

1. Instalar **Node.js** (https://nodejs.org, botón LTS) — una sola vez.
2. Descargar el código (GitHub → Code → Download ZIP) y descomprimirlo.
3. Doble clic en **`iniciar-prueba-local.bat`**. La primera vez instala lo necesario; después abre el sistema en `http://localhost:5173`.
4. Para probar desde el celular en la misma red WiFi: abrir `http://IP-DE-LA-PC:5173` (la IP aparece en la ventana negra como "Network"). El GPS en el celular solo funciona con la versión publicada (https).

Sin configuración, la versión local guarda los datos **solo en ese navegador** (ideal para probar pantallas y cálculos sin tocar datos reales). Para probar la sincronización entre equipos, copiar `.env.example` como `.env.local` y completar con un proyecto Supabase de prueba.

## Probar en GitHub Codespaces (sin instalar nada)

1. En GitHub: botón verde **Code → Codespaces → Create codespace on desarrollo** (o abrir el que ya existe).
2. Esperar a que termine de instalar (la primera vez, 1–2 minutos).
3. En la terminal de abajo escribir: `npm run dev -- --host` y Enter.
4. Aparece un aviso "Abrir en el navegador": se abre el sistema en una dirección https propia del Codespace.
5. Para probarlo desde el celular: pestaña **Puertos** → clic derecho en el 5173 → **Visibilidad del puerto → Pública**, y abrir esa dirección en el celular (con https el GPS funciona).

## Ramas
- `main` → versión publicada (la que usan los supervisores).
- `desarrollo` → cambios en prueba. Vercel genera una dirección de prueba para cada cambio en esta rama, sin afectar a la publicada.

## Para programadores

```bash
npm install
npm run dev      # desarrollo
npm run build    # genera dist/
```

- `src/datos.js` — colecciones, cálculos (rendimiento, productividad, stock), sesión.
- `src/sync.js` — sincronización localStorage ↔ Supabase (tabla `app_datos`), igual que la app de flota.
- `src/fotos.js` — compresión, cola de fotos en IndexedDB y subida a Supabase Storage.
- `src/pages/` — una pantalla por archivo.

## A tener en cuenta
- Supabase gratis pausa el proyecto si pasa 7 días sin uso; se reactiva desde el panel de Supabase. Con uso diario no pasa.
- Las contraseñas se guardan cifradas (hash). Igual que en la app de flota, la base es accesible con la anon key: no guardar datos sensibles.
- Si dos administradores emiten un certificado al mismo tiempo sin señal, podrían repetir número: emitir certificados con conexión.
