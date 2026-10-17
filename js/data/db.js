// CAPA DE DATOS: base de datos relacional SQLite (sql.js) que se guarda en el navegador.
// El esquema está en db/schema.sql y los datos de ejemplo en db/datos.sql
// (los mismos archivos se pueden ejecutar en WebStorm).
const KEY = 'lce_sqlite_v1';
const SQLJS = 'https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/';

let SQL, db;
const T = {};     // espejo en memoria de cada tabla (lista de objetos) para que las pantallas lean rápido
const SNAP = {};  // "tabla:id" -> valores guardados en SQL (sirve para detectar qué cambió)

export const sha256 = async t =>
    [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))]
        .map(b => b.toString(16).padStart(2, '0')).join('');

// Relación entre los campos de las pantallas y las columnas SQL ("campo:columna"; sin ":" son iguales)
const ESQ = {
    usuarios: ['usuario', 'nombre', 'rol', 'hash'],
    categorias: ['nombre'],
    proveedores: ['nombre', 'nit', 'telefono'],
    clientes: ['nombre', 'nit', 'puntos'],
    productos: ['codigo', 'nombre', 'categoriaId:categoria_id', 'proveedorId:proveedor_id', 'precio', 'mayoreo', 'stock', 'stockMin:stock_min', 'vence', 'foto'],
    promociones: ['nombre', 'tipo', 'categoriaId:categoria_id', 'productoId:producto_id', 'monto', 'puntos'],
    cajas: ['usuarioId:usuario_id', 'apertura', 'cierre', 'montoInicial:monto_inicial', 'montoFinal:monto_final', 'esperado', 'diferencia', 'estado'],
    ventas: ['fecha', 'cajaId:caja_id', 'clienteId:cliente_id', 'promoId:promo_id', 'subtotal', 'descuento', 'total'],
    facturas: ['numero', 'ventaId:venta_id', 'fecha', 'nit', 'cliente', 'autorizacion', 'letras:total_letras', 'codigoControl:codigo_control', 'fechaLimite:fecha_limite', 'promoId:promo_id', 'venceQR:vence_qr', 'qrUsado:qr_usado', 'qr'],
    devoluciones: ['fecha', 'facturaId:factura_id', 'productoId:producto_id', 'usuarioId:usuario_id', 'cant:cantidad', 'motivo', 'monto'],
    compras: ['fecha', 'proveedorId:proveedor_id', 'productoId:producto_id', 'cant:cantidad', 'costo', 'total']
};
const COLS = {};
for (const t in ESQ) COLS[t] = ESQ[t].map(s => { const [j, c] = s.split(':'); return [j, c || j]; });

// La venta guarda el pago dentro del objeto; en SQL son 3 columnas
const ESPECIAL = {
    ventas: {
        cols: ['pago_tipo', 'recibido', 'referencia'],
        aSql: r => [r.pago?.tipo, r.pago?.recibido, r.pago?.ref],
        deSql: (o, f) => { o.pago = { tipo: f.pago_tipo, recibido: f.recibido, ref: f.referencia }; }
    }
};

const val = v => v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v;
const colsSql = t => [...COLS[t].map(([, c]) => c), ...(ESPECIAL[t]?.cols || [])];
const aSql = (t, r) => [...COLS[t].map(([j]) => r[j]), ...(ESPECIAL[t]?.aSql(r) || [])].map(val);
const deSql = (t, f) => {
    const o = { id: f.id };
    for (const [j, c] of COLS[t]) o[j] = f[c];
    if (t === 'facturas') o.qrUsado = !!o.qrUsado;
    ESPECIAL[t]?.deSql(o, f);
    return o;
};

const consulta = (sql, params = []) => {
    const st = db.prepare(sql);
    try { st.bind(params); const r = []; while (st.step()) r.push(st.getAsObject()); return r; }
    finally { st.free(); }
};
const transaccion = fn => {
    db.run('BEGIN');
    try { const r = fn(); db.run('COMMIT'); return r; }
    catch (x) { try { db.run('ROLLBACK'); } catch { } throw x; }
};
const traducir = m =>
    /FOREIGN KEY/i.test(m) ? 'Falta un dato relacionado o el registro está en uso por otros datos'
        : /UNIQUE/i.test(m) ? 'Ya existe un registro con ese valor (dato único)'
            : /NOT NULL/i.test(m) ? 'Falta un dato obligatorio'
                : /CHECK/i.test(m) ? 'Hay un valor que no es válido' : m;

// ---- Persistencia: el archivo SQLite completo se guarda en el navegador ----
let temporizador, sucio = false, avisado = false;
const aBase64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const deBase64 = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));
const exportarBytes = () => { const b = db.export(); db.run('PRAGMA foreign_keys = ON'); return b; }; // export() reinicia los PRAGMA
const persistirYa = () => {
    clearTimeout(temporizador);
    if (!db || !sucio) return;
    try { localStorage.setItem(KEY, aBase64(exportarBytes())); sucio = false; }
    catch (x) {
        console.error('No se pudo guardar la base de datos', x);
        if (!avisado) { avisado = true; alert('No hay espacio suficiente en el navegador para guardar los datos. Descargue un respaldo en Más → Respaldo de datos.'); }
    }
};
const programar = () => { sucio = true; clearTimeout(temporizador); temporizador = setTimeout(persistirYa, 250); };

// ---- API que usan las capas de negocio y presentación (misma de siempre) ----
export const DB = {
    todos: t => T[t],
    buscar: (t, id) => T[t].find(x => x.id == id),

    insertar(t, o) {
        try {
            transaccion(() => {
                const cols = colsSql(t);
                db.run(`INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, aSql(t, o));
                o.id = consulta('SELECT last_insert_rowid() AS id')[0].id;
                if (t === 'ventas') (o.lineas || []).forEach(l => db.run(
                    'INSERT INTO detalle_venta (venta_id, producto_id, categoria_id, nombre, cantidad, precio_unitario, subtotal, descuento, nota, gratis) VALUES (?,?,?,?,?,?,?,?,?,?)',
                    [o.id, l.productoId, l.cat, l.nombre, l.cant, l.precio, l.sub, l.desc, l.nota || '', l.gratis ? 1 : 0].map(val)));
            });
        } catch (x) { delete o.id; throw new Error(traducir(x.message)); }
        T[t].push(o); SNAP[t + ':' + o.id] = JSON.stringify(aSql(t, o));
        this.guardar(); return o;
    },

    actualizar(t, o) {
        try { db.run(`UPDATE ${t} SET ${colsSql(t).map(c => c + '=?').join(',')} WHERE id=?`, [...aSql(t, o), o.id]); }
        catch (x) { throw new Error(traducir(x.message)); }
        const i = T[t].findIndex(x => x.id == o.id); if (i >= 0) T[t][i] = o;
        SNAP[t + ':' + o.id] = JSON.stringify(aSql(t, o));
        this.guardar(); return o;
    },

    eliminar(t, id) {
        try { db.run(`DELETE FROM ${t} WHERE id=?`, [id]); }
        catch (x) { throw new Error(/FOREIGN KEY/i.test(x.message) ? 'No se puede eliminar: hay ventas, productos u otros registros que dependen de este' : traducir(x.message)); }
        T[t] = T[t].filter(x => x.id != id); delete SNAP[t + ':' + id];
        this.guardar();
    },

    // Envía a SQL los cambios hechos directamente sobre los objetos (stock, puntos, estado de caja...)
    guardar() {
        for (const t in ESQ) {
            const set = colsSql(t).map(c => c + '=?').join(',');
            for (const r of T[t]) {
                const v = aSql(t, r), j = JSON.stringify(v), k = t + ':' + r.id;
                if (SNAP[k] === j) continue;
                try { db.run(`UPDATE ${t} SET ${set} WHERE id=?`, [...v, r.id]); }
                catch (x) { throw new Error(traducir(x.message)); }
                SNAP[k] = j;
            }
        }
        programar();
    },

    // Utilidades para la pantalla "Base de datos"
    sql: texto => db.exec(texto),
    tablas: () => consulta("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .map(r => ({ nombre: r.name, filas: consulta(`SELECT COUNT(*) AS n FROM "${r.name}"`)[0].n })),
    columnas: t => consulta(`PRAGMA table_info("${t}")`),
    claves: t => consulta(`PRAGMA foreign_key_list("${t}")`),
    exportar: () => exportarBytes(),
    importar(bytes) {
        try {
            const p = new SQL.Database(bytes);
            const ok = p.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='productos'").length;
            p.close(); if (!ok) throw new Error('x');
        } catch { throw new Error('El archivo no es un respaldo válido de este sistema'); }
        sucio = false; clearTimeout(temporizador);          // evita que se sobrescriba el respaldo al recargar
        localStorage.setItem(KEY, aBase64(bytes));
    },
    reiniciar() { sucio = false; clearTimeout(temporizador); localStorage.removeItem(KEY); location.hash = ''; location.reload(); }
};

// ---- Arranque ----
const cargarScript = src => new Promise((ok, mal) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok;
    s.onerror = () => mal(new Error('No se pudo cargar sql.js (revise su conexión a internet)'));
    document.head.appendChild(s);
});
const leer = async url => {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`No se pudo leer ${url} (${r.status}). Verifique que la carpeta db/ esté junto a index.html`);
    return r.text();
};

function cargarEspejo() {
    for (const t in ESQ) T[t] = consulta(`SELECT * FROM ${t} ORDER BY id`).map(f => deSql(t, f));
    const ventas = new Map(T.ventas.map(v => [v.id, Object.assign(v, { lineas: [] })]));
    consulta('SELECT * FROM detalle_venta ORDER BY id').forEach(l => ventas.get(l.venta_id)?.lineas.push({
        productoId: l.producto_id, nombre: l.nombre, cat: l.categoria_id, cant: l.cantidad, precio: l.precio_unitario,
        sub: l.subtotal, desc: l.descuento, nota: l.nota || '', gratis: !!l.gratis
    }));
    // Datos que se obtienen relacionando tablas (no se repiten en SQL)
    T.devoluciones.forEach(d => { d.numero = DB.buscar('facturas', d.facturaId)?.numero; d.nombre = DB.buscar('productos', d.productoId)?.nombre; });
    T.compras.forEach(c => { c.nombre = DB.buscar('productos', c.productoId)?.nombre; });
    for (const t in ESQ) T[t].forEach(r => { SNAP[t + ':' + r.id] = JSON.stringify(aSql(t, r)); });
}

export async function iniciarDB() {
    try {
        if (!globalThis.initSqlJs) await cargarScript(SQLJS + 'sql-wasm.js');
        SQL = await globalThis.initSqlJs({ locateFile: f => SQLJS + f });
        const g = localStorage.getItem(KEY);
        if (g) db = new SQL.Database(deBase64(g));
        else { db = new SQL.Database(); db.exec(await leer('db/schema.sql')); db.exec(await leer('db/datos.sql')); }
        db.run('PRAGMA foreign_keys = ON');
        cargarEspejo();
        if (!g) { sucio = true; persistirYa(); }
        addEventListener('pagehide', persistirYa);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistirYa(); });
    } catch (x) {
        const app = document.getElementById('app');
        if (app) app.innerHTML = `<div style="max-width:560px;margin:15vh auto;padding:1.5rem;font-family:sans-serif"><h3>No se pudo iniciar la base de datos</h3><p>${String(x.message).replace(/</g, '&lt;')}</p>
      <button onclick="localStorage.removeItem('${KEY}');location.reload()">Restablecer datos y reintentar</button></div>`;
        throw x;
    }
}