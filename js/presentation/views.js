// CAPA DE PRESENTACIÓN: pantallas (HTML + eventos). Llama a los servicios.
import { DB, sha256 } from '../data/db.js';
import { AuthService, VentaService, CajaService, DevolucionService, CompraService, AlertaService, PromocionService, EMPRESA, q, fecha, suma } from '../business/services.js';
import { imgProd, comprimirFoto } from './imagenes.js';

// ======================================================================
// Utilidades
// ======================================================================
export const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const esMovil = () => window.matchMedia('(max-width: 991.98px)').matches;
const alerta = (t, m) => `<div class="alert alert-${t} py-2">${m}</div>`;
const sinDatos = m => `<div class="text-center text-muted py-4"><i class="bi bi-bar-chart fs-1 d-block"></i>${m}</div>`;
const tabla = (enc, filas) => `<div class="table-responsive"><table class="table table-sm table-hover align-middle tabla-card"><thead><tr>${enc.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${filas.length ? filas.map(f => `<tr>${f.map((c, i) => `<td data-l="${e(enc[i])}">${c}</td>`).join('')}</tr>`).join('') : `<tr class="vacio"><td colspan="${enc.length}" class="text-center text-muted py-5"><i class="bi bi-inbox fs-1 d-block"></i>Sin registros</td></tr>`}</tbody></table></div>`;
const nombreDe = (t, id) => e(DB.buscar(t, id)?.nombre ?? '');
const opciones = t => () => DB.todos(t).map(x => [x.id, x.nombre]);
const prodCelda = (id, nombre) => imgProd(DB.buscar('productos', id), 'sm') + ' ' + e(nombre);
const cab = (ico, titulo, sub = '', extra = '') => `<div class="cab"><div class="cab-i"><i class="bi ${ico}"></i></div><div class="flex-grow-1 min-w-0"><h4 class="m-0">${titulo}</h4>${sub ? `<div class="text-muted small">${sub}</div>` : ''}</div>${extra ? `<div class="ms-auto">${extra}</div>` : ''}</div>`;

// Avisos flotantes
export const toast = (m, t = 'danger') => {
    let c = document.getElementById('toasts');
    if (!c) { c = document.createElement('div'); c.id = 'toasts'; document.body.appendChild(c); }
    const el = document.createElement('div'); el.className = `lce-toast ${t}`;
    const ico = { success: 'bi-check-circle-fill', danger: 'bi-x-circle-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' }[t];
    el.innerHTML = `<i class="bi ${ico}"></i><span>${e(m)}</span>`; c.appendChild(el);
    setTimeout(() => { el.classList.add('salir'); setTimeout(() => el.remove(), 300); }, 3800);
};
const aviso = (root, m, t = 'danger') => toast(m, t);

// Confirmación en ventana (reemplaza al confirm() del navegador)
export const confirmar = (msg, titulo = 'Confirmar', peligro = true) => new Promise(ok => {
    const id = 'c' + Date.now();
    document.body.insertAdjacentHTML('beforeend', `<div class="modal fade" id="${id}" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0 shadow">
    <div class="modal-body text-center p-4"><div class="icono-gde ${peligro ? 'bg-danger' : 'bg-primary'}"><i class="bi ${peligro ? 'bi-trash3' : 'bi-question-lg'}"></i></div>
    <h5 class="mt-3">${e(titulo)}</h5><p class="text-muted mb-4">${e(msg)}</p>
    <div class="d-flex gap-2"><button class="btn btn-outline-secondary flex-fill" data-bs-dismiss="modal">Cancelar</button><button class="btn ${peligro ? 'btn-danger' : 'btn-lce'} flex-fill" id="${id}ok">Aceptar</button></div></div></div></div></div>`);
    const el = document.getElementById(id), m = new bootstrap.Modal(el); let r = false;
    el.querySelector('#' + id + 'ok').onclick = () => { r = true; m.hide(); };
    el.addEventListener('hidden.bs.modal', () => { el.remove(); ok(r); });
    m.show();
});

// Validación de formularios con mensajes claros por campo
const mensaje = i => i.validity.valueMissing ? 'Este campo es obligatorio'
    : i.validity.rangeUnderflow ? `El valor mínimo es ${i.min}` : i.validity.rangeOverflow ? `El valor máximo es ${i.max}`
        : i.validity.typeMismatch ? 'El formato no es válido' : 'El valor no es válido';
const marcar = (i, m) => { i.classList.add('is-invalid'); i.insertAdjacentHTML('afterend', `<div class="campo-error">${m}</div>`); i.focus(); };
const limpiar = f => { f.querySelectorAll('.is-invalid').forEach(i => i.classList.remove('is-invalid')); f.querySelectorAll('.campo-error').forEach(x => x.remove()); };
const validar = f => {
    limpiar(f); let ok = true;
    f.querySelectorAll('input,select').forEach(i => { if (ok && !i.checkValidity()) { ok = false; marcar(i, mensaje(i)); } });
    return ok;
};

// Exportar a Excel (CSV) y descargar archivos
const plano = h => String(h).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const descargar = (nombre, texto, tipo = 'text/csv;charset=utf-8') => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto], { type: tipo })); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
const exportarCSV = (nombre, enc, filas) => {
    const idx = enc.map((h, i) => h ? i : -1).filter(i => i >= 0), celda = v => '"' + plano(v).replace(/"/g, '""') + '"';
    const lineas = [idx.map(i => celda(enc[i])).join(','), ...filas.map(f => idx.map(i => celda(f[i])).join(','))];
    descargar(`${nombre}-${new Date().toISOString().slice(0, 10)}.csv`, '\ufeff' + lineas.join('\r\n'));
    toast('Archivo descargado (ábralo con Excel)', 'success');
};
const btnCSV = '<button type="button" class="btn btn-outline-success no-print" data-csv><i class="bi bi-file-earmark-excel"></i> <span class="d-none d-sm-inline">Excel</span></button>';
const filtro = (id = 'filtro') => `<div class="input-group"><span class="input-group-text"><i class="bi bi-search"></i></span><input id="${id}" class="form-control" placeholder="Buscar en la lista…"></div>`;
const enlazarFiltro = root => {
    const f = root.querySelector('#filtro'); if (!f) return;
    f.oninput = () => { const s = f.value.toLowerCase(); root.querySelectorAll('tbody tr:not(.vacio)').forEach(tr => tr.classList.toggle('d-none', !!s && !tr.textContent.toLowerCase().includes(s))); };
};

// ======================================================================
// Login
// ======================================================================
export function login(app, onOk) {
    app.innerHTML = `<div class="login"><div class="login-wrap card">
    <div class="login-brand d-none d-md-flex"><div><i class="bi bi-shop display-3"></i><h2 class="mt-3 fw-bold">Las Casas del Escuintleco</h2>
      <p class="opacity-75">Punto de venta e inventario para productos de consumo masivo.</p>
      <ul class="list-unstyled mt-4 mb-0"><li><i class="bi bi-check2-circle"></i> Ventas, facturas con QR y promociones</li><li><i class="bi bi-check2-circle"></i> Control de caja y devoluciones</li><li><i class="bi bi-check2-circle"></i> Inventario y reportes en tiempo real</li></ul></div></div>
    <div class="login-form"><div class="text-center d-md-none mb-3"><i class="bi bi-shop fs-1 text-lce"></i><h4>Las Casas del Escuintleco</h4></div>
      <h4 class="mb-1">Bienvenido</h4><p class="text-muted">Inicie sesión para continuar</p>
      <form id="f" novalidate>
        <label class="form-label">Usuario</label>
        <div class="input-group"><span class="input-group-text"><i class="bi bi-person"></i></span><input class="form-control" name="u" autocomplete="username" autofocus></div>
        <div class="campo-error mb-2" id="eu"></div>
        <label class="form-label mt-2">Contraseña</label>
        <div class="input-group"><span class="input-group-text"><i class="bi bi-lock"></i></span><input class="form-control" type="password" name="c" autocomplete="current-password">
          <button type="button" id="ver" class="btn btn-outline-secondary" tabindex="-1"><i class="bi bi-eye"></i></button></div>
        <div class="campo-error" id="ec"></div>
        <div id="caps" class="small text-warning mt-1 d-none"><i class="bi bi-exclamation-triangle"></i> Las mayúsculas están activadas</div>
        <button id="btn" class="btn btn-lce btn-lg w-100 mt-4">Ingresar</button></form>
      <div class="small text-muted mt-4 mb-1">Roles</div>
      <div class="d-flex gap-2 flex-wrap">${[['admin', 'admin123', 'Administrador'], ['cajero', 'cajero123', 'Cajero'], ['bodega', 'bodega123', 'Bodega']].map(([u, c, t]) => `<button type="button" class="chip" data-u="${u}" data-c="${c}">${t}</button>`).join('')}</div>
    </div></div></div>`;
    const f = app.querySelector('#f'), card = app.querySelector('.login-wrap'), btn = app.querySelector('#btn');
    const limpia = () => { f.querySelectorAll('.is-invalid').forEach(i => i.classList.remove('is-invalid')); app.querySelectorAll('.campo-error').forEach(x => x.textContent = ''); };
    const error = (n, m) => {
        const inp = f.elements[n]; inp.classList.remove('is-invalid'); void inp.offsetWidth; inp.classList.add('is-invalid');
        app.querySelector('#e' + n).textContent = m; card.classList.remove('sacudir'); void card.offsetWidth; card.classList.add('sacudir'); inp.focus();
    };
    f.addEventListener('input', limpia);
    f.addEventListener('keyup', ev => app.querySelector('#caps').classList.toggle('d-none', !ev.getModifierState?.('CapsLock')));
    app.querySelector('#ver').onclick = () => { const c = f.elements.c; c.type = c.type === 'password' ? 'text' : 'password'; app.querySelector('#ver i').className = c.type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash'; };
    app.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { f.elements.u.value = b.dataset.u; f.elements.c.value = b.dataset.c; limpia(); f.elements.c.focus(); });
    f.onsubmit = async ev => {
        ev.preventDefault(); limpia();
        const u = f.elements.u.value.trim(), c = f.elements.c.value;
        if (!u) return error('u', 'Escriba su nombre de usuario');
        if (!c) return error('c', 'Escriba su contraseña');
        btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Verificando...';
        try { const us = await AuthService.login(u, c); toast(`¡Bienvenido, ${us.nombre}!`, 'success'); onOk(); }
        catch (err) { btn.disabled = false; btn.textContent = 'Ingresar'; error(err.campo || 'u', err.message); }
    };
}

// ======================================================================
// CRUD genérico (catálogos): formulario a la izquierda, lista a la derecha
// ======================================================================
const campo = (c, r) => {
    const v = r[c.k] ?? '', req = c.req !== false && !(c.tipo === 'password' && r.id) ? 'required' : '';
    const input = c.tipo === 'select'
        ? `<select class="form-select" name="${c.k}" ${req}><option value="">Seleccione...</option>${c.opciones().map(([val, txt]) => `<option value="${val}" ${val == v ? 'selected' : ''}>${e(txt)}</option>`).join('')}</select>`
        : c.tipo === 'archivo'
            ? `<input class="form-control" type="file" name="${c.k}" accept="image/*">${r.foto ? '<div class="small text-muted mt-1">Ya tiene foto; elija otra para reemplazarla</div>' : ''}`
            : `<input class="form-control" name="${c.k}" ${req} type="${c.tipo || 'text'}" ${c.tipo === 'number' ? 'step="0.01" min="0"' : ''} value="${c.tipo === 'password' ? '' : e(v)}">`;
    return `<div class="col-12 ${c.ancho ? '' : 'col-sm-6'}"><label class="form-label">${c.label}</label>${input}</div>`;
};

const crud = cfg => root => {
    let editando = null;
    const dibujar = () => {
        const reg = editando ? DB.buscar(cfg.tabla, editando) : {}, regs = DB.todos(cfg.tabla);
        const enc = cfg.cols.map(c => c[0]), base = regs.map(r => cfg.cols.map(c => c[1](r)));
        const filas = regs.map((r, i) => [...base[i], `<div class="text-nowrap"><button class="btn btn-sm btn-outline-primary" data-ed="${r.id}" title="Editar"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" data-del="${r.id}" title="Eliminar"><i class="bi bi-trash"></i></button></div>`]);
        root.innerHTML = cab(cfg.icono, cfg.titulo, cfg.sub) + `<div class="row g-3">
      <div class="col-xl-4"><div class="card sticky-form"><div class="card-body">
        <h6 class="mb-3">${editando ? '<i class="bi bi-pencil-square text-lce"></i> Editar registro' : '<i class="bi bi-plus-circle text-lce"></i> Nuevo registro'}</h6>
        <form id="f" class="row g-3" novalidate>${cfg.campos.map(c => campo(c, reg)).join('')}
          <div class="col-12 d-flex gap-2"><button class="btn btn-lce flex-fill"><i class="bi bi-save"></i> ${editando ? 'Actualizar' : 'Guardar'}</button>${editando ? '<button type="button" id="cancel" class="btn btn-outline-secondary">Cancelar</button>' : ''}</div></form></div></div></div>
      <div class="col-xl-8"><div class="card"><div class="card-body"><div class="d-flex gap-2 mb-3">${filtro()}${btnCSV}</div>${tabla([...enc, ''], filas)}</div></div></div></div>`;
        enlazarFiltro(root);
        root.querySelector('[data-csv]').onclick = () => exportarCSV(cfg.tabla, enc, base);
        root.querySelector('#f').onsubmit = async ev => {
            ev.preventDefault(); const f = ev.target;
            if (!validar(f)) return;
            const fd = new FormData(f), o = editando ? { ...DB.buscar(cfg.tabla, editando) } : { ...(cfg.defecto || {}) };
            for (const c of cfg.campos) {
                let v = fd.get(c.k);
                if (c.tipo === 'archivo') { // foto opcional: si no eligen archivo se conserva la anterior
                    if (v && v.size) { try { o[c.k] = await comprimirFoto(v); } catch (x) { return marcar(f.elements[c.k], x.message); } }
                    continue;
                }
                if (c.k === 'clave') { if (v) o.hash = await sha256(v); continue; }
                if (c.tipo === 'number' || c.numero) v = v === '' || v === null ? null : Number(v);
                o[c.k] = v;
            }
            if (cfg.unico) { // evita duplicados (código, usuario, NIT...)
                const dup = DB.todos(cfg.tabla).find(r => String(r[cfg.unico]).toLowerCase() === String(o[cfg.unico]).toLowerCase() && r.id != editando);
                if (dup) return marcar(f.elements[cfg.unico], cfg.unicoMsg || 'Ya existe un registro con ese valor');
            }
            try { editando ? DB.actualizar(cfg.tabla, o) : DB.insertar(cfg.tabla, o); }
            catch (x) { return toast(x.message, 'danger'); }
            toast(editando ? 'Registro actualizado' : 'Registro guardado', 'success');
            editando = null; dibujar();
        };
        root.querySelector('#cancel')?.addEventListener('click', () => { editando = null; dibujar(); });
        root.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => { editando = b.dataset.ed; dibujar(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
        root.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
            if (!await confirmar('Este registro se eliminará de forma permanente.', 'Eliminar registro')) return;
            try { DB.eliminar(cfg.tabla, b.dataset.del); toast('Registro eliminado', 'info'); dibujar(); }
            catch (x) { toast(x.message, 'danger'); }
        });
    };
    dibujar();
};

export const clientes = crud({ icono: 'bi-people', titulo: 'Clientes', sub: 'Datos para facturar y acumular puntos', tabla: 'clientes', defecto: { puntos: 0 },
    unico: 'nit', unicoMsg: 'Ya existe un cliente con ese NIT',
    campos: [{ k: 'nombre', label: 'Nombre', ancho: true }, { k: 'nit', label: 'NIT', ancho: true }],
    cols: [['Nombre', r => e(r.nombre)], ['NIT', r => e(r.nit)], ['Puntos', r => `<span class="badge bg-warning text-dark">${r.puntos} pts</span>`]] });

export const proveedores = crud({ icono: 'bi-truck', titulo: 'Proveedores', sub: 'Quienes abastecen el negocio', tabla: 'proveedores',
    campos: [{ k: 'nombre', label: 'Nombre', ancho: true }, { k: 'nit', label: 'NIT' }, { k: 'telefono', label: 'Teléfono' }],
    cols: [['Nombre', r => e(r.nombre)], ['NIT', r => e(r.nit)], ['Teléfono', r => e(r.telefono)]] });

export const productos = crud({ icono: 'bi-box-seam', titulo: 'Productos y precios', sub: 'Catálogo, precios de venta y mayoreo', tabla: 'productos',
    unico: 'codigo', unicoMsg: 'Ya existe un producto con ese código',
    campos: [{ k: 'codigo', label: 'Código' }, { k: 'nombre', label: 'Producto' },
        { k: 'categoriaId', label: 'Familia', tipo: 'select', numero: true, opciones: opciones('categorias') },
        { k: 'proveedorId', label: 'Proveedor', tipo: 'select', numero: true, opciones: opciones('proveedores') },
        { k: 'precio', label: 'Precio (Q)', tipo: 'number' }, { k: 'mayoreo', label: 'Precio mayoreo (Q)', tipo: 'number' },
        { k: 'stock', label: 'Existencia', tipo: 'number' }, { k: 'stockMin', label: 'Mínimo', tipo: 'number' },
        { k: 'vence', label: 'Vence', tipo: 'date', req: false, ancho: true },
        { k: 'foto', label: 'Foto propia (opcional)', tipo: 'archivo', req: false, ancho: true }],
    cols: [['', r => imgProd(r, 'sm')], ['Código', r => e(r.codigo)], ['Producto', r => e(r.nombre)], ['Familia', r => nombreDe('categorias', r.categoriaId)], ['Precio', r => q(r.precio)], ['Mayoreo', r => q(r.mayoreo)], ['Stock', r => r.stock]] });

export const usuarios = crud({ icono: 'bi-person-gear', titulo: 'Usuarios (acceso)', sub: 'Quién puede entrar y con qué rol', tabla: 'usuarios',
    unico: 'usuario', unicoMsg: 'Ese nombre de usuario ya está en uso',
    campos: [{ k: 'usuario', label: 'Usuario' }, { k: 'nombre', label: 'Nombre' },
        { k: 'rol', label: 'Rol', tipo: 'select', opciones: () => ['ADMIN', 'CAJERO', 'BODEGA'].map(x => [x, x]) },
        { k: 'clave', label: 'Contraseña', tipo: 'password' }],
    cols: [['Usuario', r => e(r.usuario)], ['Nombre', r => e(r.nombre)], ['Rol', r => `<span class="badge bg-secondary">${r.rol}</span>`]] });

export const promociones = crud({ icono: 'bi-gift', titulo: 'Promociones', sub: 'Se canjean leyendo el QR de la factura', tabla: 'promociones',
    campos: [{ k: 'nombre', label: 'Nombre', ancho: true },
        { k: 'tipo', label: 'Tipo', tipo: 'select', opciones: () => [['GRATIS', 'Producto gratuito'], ['VALE', 'Vale de regalo'], ['2DO_MITAD', '2.º a mitad de precio'], ['MAYOREO', 'Compra por mayoreo'], ['PUNTOS', 'Puntos por producto']] },
        { k: 'categoriaId', label: 'Familia', tipo: 'select', numero: true, opciones: opciones('categorias') },
        { k: 'productoId', label: 'Producto', tipo: 'select', numero: true, req: false, opciones: opciones('productos') },
        { k: 'monto', label: 'Monto vale (Q)', tipo: 'number', req: false }, { k: 'puntos', label: 'Puntos', tipo: 'number', req: false }],
    cols: [['Nombre', r => e(r.nombre)], ['Tipo', r => `<span class="badge bg-success">${r.tipo}</span>`], ['Detalle', r => e(PromocionService.describir(r))]] });

// ======================================================================
// Mensajería / Inicio / Conocimiento
// ======================================================================
export function mensajeria(root) {
    const l = AlertaService.lista();
    root.innerHTML = cab('bi-chat-dots', 'Mensajería', 'Avisos del sistema: existencias y vencimientos') +
        (l.length ? `<div class="row g-3">${l.map(a => `<div class="col-md-6 col-xl-4"><div class="card h-100 border-start border-4 border-${a.t}"><div class="card-body d-flex gap-3 align-items-center"><div class="icono bg-${a.t}"><i class="bi ${a.t === 'danger' ? 'bi-hourglass-split' : 'bi-box-seam'}"></i></div><div class="fw-semibold">${e(a.m)}</div></div></div></div>`).join('')}</div>`
            : `<div class="card"><div class="card-body text-center py-5"><i class="bi bi-check2-circle display-1 text-success"></i><h5 class="mt-3">Todo en orden</h5><p class="text-muted mb-0">No hay avisos pendientes.</p></div></div>`);
}

export function inicio(root) {
    const u = AuthService.usuario(), ventas = DB.todos('ventas'), caja = CajaService.abierta();
    const dia = i => new Date(i).toLocaleDateString('en-CA'), hoy = dia(Date.now());
    const vHoy = ventas.filter(v => dia(v.fecha) === hoy), totalHoy = suma(vHoy, v => v.total);
    const bajos = DB.todos('productos').filter(p => p.stock <= p.stockMin).length;
    const h = new Date().getHours(), saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    const rapidos = u.rol === 'BODEGA'
        ? [['bi-box-seam', 'Inventario', 'Existencias y vencimientos', '#/inventario'], ['bi-truck', 'Registrar compra', 'Ingreso de producto', '#/compras'], ['bi-tags', 'Productos y precios', 'Catálogo', '#/productos'], ['bi-people', 'Proveedores', 'Catálogo', '#/proveedores']]
        : [['bi-cart-check', 'Despachar', 'Nueva venta', '#/pos'], ['bi-safe', 'Caja', 'Apertura y corte', '#/caja'], ['bi-qr-code-scan', 'Leer QR', 'Canjear promoción', '#/qr'], ['bi-receipt', 'Facturas', 'Historial', '#/facturas']];

    // Ventas de los últimos 7 días
    const dias = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
    const porDia = dias.map(d => suma(ventas.filter(v => dia(v.fecha) === dia(d)), v => v.total)), max = Math.max(...porDia, 1);
    const barras = dias.map((d, i) => `<div class="barra"><div class="barra-zona"><div class="barra-v" style="height:${Math.max(porDia[i] / max * 100, 3)}%"><b>${porDia[i] ? Math.round(porDia[i]) : ''}</b></div></div><small>${d.toLocaleDateString('es-GT', { weekday: 'short' })}</small></div>`).join('');

    // Top productos
    const mapa = {}; ventas.forEach(v => v.lineas.forEach(l => { if (!l.gratis) mapa[l.productoId] = (mapa[l.productoId] || 0) + l.cant; }));
    const top = Object.entries(mapa).sort((a, b) => b[1] - a[1]).slice(0, 5), maxTop = top[0]?.[1] || 1;
    const topHtml = top.length ? top.map(([id, n]) => { const p = DB.buscar('productos', id); return `<div class="d-flex align-items-center gap-3 mb-3">${imgProd(p, 'md')}<div class="flex-grow-1 min-w-0"><div class="d-flex justify-content-between gap-2"><b class="text-truncate">${e(p?.nombre)}</b><span class="text-muted text-nowrap">${n} und.</span></div><div class="progress" style="height:7px"><div class="progress-bar" style="width:${n / maxTop * 100}%;background:var(--lce)"></div></div></div></div>`; }).join('') : sinDatos('Aún no hay ventas');

    // Ventas por familia (dona)
    const fam = {}; ventas.forEach(v => v.lineas.forEach(l => { fam[l.cat] = (fam[l.cat] || 0) + l.sub - l.desc; }));
    const totFam = suma(Object.values(fam), x => x), COL = ['#9a4f93', '#e07a5f', '#f2cc8f', '#3d85c6', '#81b29a', '#f4a261', '#6a4c93'];
    let acc = 0; const trozos = Object.entries(fam).map(([c, v], i) => { const ini = acc / totFam * 100; acc += v; return { c, v, col: COL[i % COL.length], ini, fin: acc / totFam * 100 }; });
    const donut = totFam > 0 ? `<div class="donut" style="background:conic-gradient(${trozos.map(t => `${t.col} ${t.ini}% ${t.fin}%`).join(',')})"><div class="donut-c"><small class="text-muted">Total</small><b>${q(totFam)}</b></div></div>
    <div class="mt-3 d-grid gap-1">${trozos.map(t => `<div class="leyenda"><i style="background:${t.col}"></i><span class="flex-grow-1 text-truncate">${nombreDe('categorias', t.c)}</span><b>${Math.round(t.v / totFam * 100)}%</b></div>`).join('')}</div>` : sinDatos('Sin ventas por familia');

    const ult = DB.todos('facturas').slice(-5).reverse().map(f => `<a href="#/factura/${f.numero}" class="d-flex justify-content-between align-items-center py-2 border-bottom text-decoration-none text-reset"><div><b>#${f.numero}</b><div class="small text-muted">${e(f.cliente)}</div></div><b class="text-lce">${q(DB.buscar('ventas', f.ventaId).total)}</b></a>`).join('');
    const avisos = AlertaService.lista().slice(0, 4).map(a => `<div class="d-flex gap-2 align-items-center mb-2"><span class="badge bg-${a.t} ${a.t === 'warning' ? 'text-dark' : ''}"><i class="bi bi-exclamation-lg"></i></span><span class="small">${e(a.m)}</span></div>`).join('');
    const kpi = (i, t, v, c) => `<div class="col-6 col-xl"><div class="kpi"><div class="icono bg-${c}"><i class="bi ${i}"></i></div><div class="min-w-0"><div class="text-muted small">${t}</div><div class="kpi-v text-truncate">${v}</div></div></div></div>`;
    const acceso = (i, t, d, hh) => `<div class="col-6 col-lg-3"><a href="${hh}" class="card tarjeta-link h-100 text-decoration-none text-reset"><div class="card-body text-center py-4"><i class="bi ${i} fs-1 text-lce"></i><div class="fw-bold mt-2">${t}</div><div class="small text-muted">${d}</div></div></a></div>`;

    root.innerHTML = `<div class="hero mb-3"><div class="d-flex flex-wrap align-items-center gap-3">
      <div class="flex-grow-1"><div class="opacity-75 text-capitalize">${new Date().toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h3 class="fw-bold mb-2">${saludo}, ${e(u.nombre)} 👋</h3>
        <span class="badge ${caja ? 'bg-success' : 'bg-light text-dark'} fs-6"><i class="bi bi-safe"></i> Caja ${caja ? 'abierta' : 'cerrada'}</span></div>
      <a href="${rapidos[0][3]}" class="btn btn-light btn-lg text-lce"><i class="bi ${rapidos[0][0]}"></i> ${rapidos[0][1]}</a></div></div>
    <div class="row g-3 mb-3">${kpi('bi-bag-check', 'Ventas de hoy', vHoy.length, 'success')}${kpi('bi-cash-stack', 'Total vendido hoy', q(totalHoy), 'primary')}
      ${kpi('bi-receipt-cutoff', 'Ticket promedio', q(vHoy.length ? totalHoy / vHoy.length : 0), 'info')}${kpi('bi-exclamation-triangle', 'Stock bajo', bajos, bajos ? 'warning' : 'secondary')}${kpi('bi-safe', 'Mi caja', caja ? 'Abierta' : 'Cerrada', caja ? 'success' : 'danger')}</div>
    <div class="row g-3 mb-3">${rapidos.map(r => acceso(...r)).join('')}</div>
    <div class="row g-3 mb-3"><div class="col-lg-8"><div class="card h-100"><div class="card-body"><h6><i class="bi bi-graph-up text-lce"></i> Ventas de los últimos 7 días (Q)</h6><div class="barras">${barras}</div></div></div></div>
      <div class="col-lg-4"><div class="card h-100"><div class="card-body"><h6><i class="bi bi-pie-chart text-lce"></i> Ventas por familia</h6>${donut}</div></div></div></div>
    <div class="row g-3"><div class="col-lg-4"><div class="card h-100"><div class="card-body"><h6><i class="bi bi-trophy text-lce"></i> Más vendidos</h6>${topHtml}</div></div></div>
      <div class="col-lg-4"><div class="card h-100"><div class="card-body"><h6><i class="bi bi-receipt text-lce"></i> Últimas facturas</h6>${ult || sinDatos('Sin facturas')}</div></div></div>
      <div class="col-lg-4"><div class="card h-100"><div class="card-body"><h6><i class="bi bi-bell text-lce"></i> Avisos</h6>${avisos || sinDatos('Sin avisos pendientes')}</div></div></div></div>`;
}

export function conocimiento(root) {
    const tarj = (i, t, c) => `<div class="col-md-6 col-xl-4"><div class="card h-100"><div class="card-body"><div class="d-flex align-items-center gap-2 mb-2"><i class="bi ${i} fs-3 text-lce"></i><h6 class="m-0">${t}</h6></div>${c}</div></div></div>`;
    root.innerHTML = cab('bi-info-circle', 'Acerca del proyecto', e(EMPRESA.nombre)) + `<div class="row g-3">
    ${tarj('bi-shop', 'El negocio', 'Venta de productos de consumo masivo a colonias residenciales: pastas, cárnicos, embutidos, lácteos, golosinas, aguas gaseosas y carbonatados.')}
    ${tarj('bi-layers', 'Modelo de desarrollo', '3 capas: <b>presentación</b> (views), <b>negocio</b> (services) y <b>datos</b> (db), bajo el patrón MVC.')}
    ${tarj('bi-hexagon', 'Arquitectura', 'DDD y Hexagonal: los servicios son los casos de uso y la base de datos es el puerto de salida. Documentado con el Modelo C4.')}
    ${tarj('bi-database', 'Base de datos', 'Relacional SQLite: 12 tablas con llaves foráneas, restricciones, índices y vistas. Acceso por usuarios, roles y contraseñas en hash SHA-256.')}
    ${tarj('bi-stars', 'Software libre y gratuito', 'Bootstrap, SQLite (sql.js), qrcodejs, html5-qrcode y fotos de Wikipedia/Wikimedia Commons (licencias libres).')}
    ${tarj('bi-keyboard', 'Atajos', '<b>Ctrl + K</b> busca en todo el sistema.<br><b>F2</b> busca producto y <b>F9</b> cobra, en el punto de venta.')}
  </div>`;
}

// ======================================================================
// Búsqueda global
// ======================================================================
export function abrirBuscador() {
    if (document.getElementById('buscador')) return;
    document.body.insertAdjacentHTML('beforeend', `<div class="modal fade" id="buscador" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-scrollable"><div class="modal-content border-0 shadow">
    <div class="modal-header border-0 pb-0"><div class="input-group input-group-lg"><span class="input-group-text"><i class="bi bi-search"></i></span><input id="bq" class="form-control" placeholder="Buscar productos, clientes o facturas…" autocomplete="off"></div></div>
    <div class="modal-body" id="bres"><div class="text-center text-muted py-4">Escriba para buscar…<div class="small mt-1">Atajo: Ctrl + K</div></div></div></div></div></div>`);
    const el = document.getElementById('buscador'), m = new bootstrap.Modal(el), inp = el.querySelector('#bq'), res = el.querySelector('#bres');
    el.addEventListener('shown.bs.modal', () => inp.focus());
    el.addEventListener('hidden.bs.modal', () => el.remove());
    inp.oninput = () => {
        const s = inp.value.trim().toLowerCase(); if (!s) return;
        const ps = DB.todos('productos').filter(p => (p.nombre + ' ' + p.codigo).toLowerCase().includes(s)).slice(0, 5);
        const cs = DB.todos('clientes').filter(c => (c.nombre + ' ' + c.nit).toLowerCase().includes(s)).slice(0, 5);
        const fs = DB.todos('facturas').filter(f => (f.numero + ' ' + f.cliente + ' ' + f.nit).toLowerCase().includes(s)).slice(-5).reverse();
        const grupo = (t, ico, items) => items.length ? `<h6 class="text-muted mt-3"><i class="bi ${ico}"></i> ${t}</h6>${items.join('')}` : '';
        const item = (href, html) => `<a href="${href}" data-bs-dismiss="modal" class="res-item">${html}</a>`;
        const html = grupo('Productos', 'bi-box-seam', ps.map(p => item('#/inventario', `${imgProd(p, 'sm')}<div class="flex-grow-1"><b>${e(p.nombre)}</b><div class="small text-muted">Código ${e(p.codigo)} · stock ${p.stock}</div></div><b class="text-lce">${q(p.precio)}</b>`)))
            + grupo('Clientes', 'bi-people', cs.map(c => item('#/clientes', `<div class="icono bg-secondary" style="width:36px;height:36px;font-size:1rem"><i class="bi bi-person"></i></div><div class="flex-grow-1"><b>${e(c.nombre)}</b><div class="small text-muted">NIT ${e(c.nit)}</div></div><span class="badge bg-warning text-dark">${c.puntos} pts</span>`)))
            + grupo('Facturas', 'bi-receipt', fs.map(f => item(`#/factura/${f.numero}`, `<div class="icono bg-primary" style="width:36px;height:36px;font-size:1rem"><i class="bi bi-receipt"></i></div><div class="flex-grow-1"><b>Factura ${f.numero}</b><div class="small text-muted">${e(f.cliente)}</div></div><b class="text-lce">${q(DB.buscar('ventas', f.ventaId).total)}</b>`)));
        res.innerHTML = html || '<div class="text-center text-muted py-4"><i class="bi bi-emoji-neutral fs-1 d-block"></i>Sin resultados</div>';
    };
    m.show();
}

// ======================================================================
// Inventario / Compras
// ======================================================================
export function inventario(root) {
    const ps = DB.todos('productos'), enc = ['', 'Producto', 'Familia', 'Existencia', 'Mínimo', 'Vence', 'Estado'];
    const filas = ps.map(p => [imgProd(p, 'sm'), e(p.nombre), nombreDe('categorias', p.categoriaId), p.stock, p.stockMin, p.vence || '-',
        p.stock <= p.stockMin ? '<span class="badge bg-warning text-dark">Stock bajo</span>' : '<span class="badge bg-success">OK</span>']);
    const kpi = (i, t, v, c) => `<div class="col-12 col-md-4"><div class="kpi"><div class="icono bg-${c}"><i class="bi ${i}"></i></div><div><div class="text-muted small">${t}</div><div class="kpi-v">${v}</div></div></div></div>`;
    root.innerHTML = cab('bi-boxes', 'Inventario', 'Existencias, mínimos y vencimientos') +
        `<div class="row g-3 mb-3">${kpi('bi-box-seam', 'Productos', ps.length, 'primary')}${kpi('bi-cash-coin', 'Valor del inventario (a precio de venta)', q(suma(ps, p => p.stock * p.precio)), 'success')}${kpi('bi-exclamation-triangle', 'Con stock bajo', ps.filter(p => p.stock <= p.stockMin).length, 'warning')}</div>
    <div class="card"><div class="card-body"><div class="d-flex gap-2 mb-3">${filtro()}${btnCSV}</div>${tabla(enc, filas)}</div></div>`;
    enlazarFiltro(root); root.querySelector('[data-csv]').onclick = () => exportarCSV('inventario', enc, filas);
}

export function compras(root) {
    const enc = ['Fecha', 'Proveedor', 'Producto', 'Cant', 'Costo', 'Total'];
    const filas = DB.todos('compras').slice().reverse().map(c => [fecha(c.fecha), nombreDe('proveedores', c.proveedorId), prodCelda(c.productoId, c.nombre), c.cant, q(c.costo), q(c.total)]);
    root.innerHTML = cab('bi-truck', 'Compras de producto', 'Ingreso de mercadería a las existencias') + `<div class="row g-3">
    <div class="col-xl-4"><div class="card"><div class="card-body"><form id="f" class="row g-3" novalidate>
      ${campo({ k: 'proveedorId', label: 'Proveedor', tipo: 'select', ancho: true, opciones: opciones('proveedores') }, {})}
      ${campo({ k: 'productoId', label: 'Producto', tipo: 'select', ancho: true, opciones: opciones('productos') }, {})}
      ${campo({ k: 'cant', label: 'Cantidad', tipo: 'number' }, {})}${campo({ k: 'costo', label: 'Costo unitario (Q)', tipo: 'number' }, {})}
      <div class="col-12"><div class="total-box d-flex justify-content-between"><span>Total de la compra</span><b id="tc">Q 0.00</b></div></div>
      <div class="col-12"><button class="btn btn-lce btn-lg w-100"><i class="bi bi-check2-circle"></i> Registrar compra</button></div></form></div></div></div>
    <div class="col-xl-8"><div class="card"><div class="card-body"><div class="d-flex gap-2 mb-3">${filtro()}${btnCSV}</div>${tabla(enc, filas)}</div></div></div></div>`;
    enlazarFiltro(root); root.querySelector('[data-csv]').onclick = () => exportarCSV('compras', enc, filas);
    const f = root.querySelector('#f'), total = () => { root.querySelector('#tc').textContent = q(Number(f.elements.cant.value || 0) * Number(f.elements.costo.value || 0)); };
    f.elements.cant.oninput = total; f.elements.costo.oninput = total;
    f.onsubmit = ev => {
        ev.preventDefault(); if (!validar(f)) return;
        const fd = new FormData(f);
        if (+fd.get('cant') <= 0) return marcar(f.elements.cant, 'La cantidad debe ser mayor que cero');
        try { CompraService.registrar({ proveedorId: +fd.get('proveedorId'), productoId: +fd.get('productoId'), cant: +fd.get('cant'), costo: +fd.get('costo') }); }
        catch (x) { return toast(x.message, 'danger'); }
        toast('Compra registrada, existencias actualizadas', 'success'); compras(root);
    };
}

// ======================================================================
// Escáner (QR y códigos de barras) con la cámara
// ======================================================================
export function escanear(onTexto) {
    const id = 'm' + Date.now();
    document.body.insertAdjacentHTML('beforeend', `<div class="modal fade" id="${id}"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0">
    <div class="modal-header"><h6 class="m-0"><i class="bi bi-camera"></i> Escanear código</h6><button class="btn-close" data-bs-dismiss="modal"></button></div>
    <div class="modal-body"><div id="lector"></div><div class="text-center small text-muted mt-2">Apunte la cámara al código QR o de barras</div></div></div></div></div>`);
    const el = document.getElementById(id), modal = new bootstrap.Modal(el), lector = new Html5Qrcode('lector');
    el.addEventListener('shown.bs.modal', () => lector.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 200 } },
        t => { lector.stop().catch(() => { }); modal.hide(); onTexto(t); })
        .catch(() => toast('No se pudo abrir la cámara (use HTTPS y permita el acceso).', 'danger')));
    el.addEventListener('hidden.bs.modal', () => { if (lector.isScanning) lector.stop().catch(() => { }); el.remove(); });
    modal.show();
}

export function leerQR(root) {
    root.innerHTML = cab('bi-qr-code-scan', 'Lectura de código QR', 'Canjee la promoción de una factura') + `<div class="row g-3">
    <div class="col-lg-6"><div class="card h-100"><div class="card-body p-4">
      <button id="cam" class="btn btn-lce btn-lg w-100 mb-3"><i class="bi bi-camera"></i> Escanear con la cámara</button>
      <div class="text-center text-muted small mb-3">— o pegue el enlace del QR —</div>
      <div class="input-group input-group-lg"><input id="txt" class="form-control" placeholder="https://…/promo.html?f=000001…"><button id="ok" class="btn btn-outline-secondary">Leer</button></div>
      <div id="res" class="mt-3"></div></div></div></div>
    <div class="col-lg-6"><div class="card h-100"><div class="card-body p-4"><h6><i class="bi bi-question-circle text-lce"></i> ¿Cómo funciona?</h6>
      <ol class="pasos"><li>Cada factura trae un código QR con una promoción para la próxima compra.</li><li>El cliente lo escanea con su celular y ve su promoción.</li><li>En caja se lee el mismo QR (cámara o enlace).</li><li>La promoción se aplica a la venta actual y el código queda canjeado.</li></ol></div></div></div></div>`;
    const leer = t => {
        try {
            const { factura, promo } = PromocionService.leerQR(t);
            root.querySelector('#res').innerHTML = `<div class="card border border-success"><div class="card-body">
        <div class="d-flex align-items-center gap-3 mb-2">${promo.productoId ? imgProd(DB.buscar('productos', promo.productoId), 'md') : ''}<h5 class="m-0">Factura ${factura.numero}</h5></div>
        <span class="badge bg-success mb-2">${promo.tipo}</span><p class="fs-5 fw-bold mb-1">${e(promo.nombre)}</p><p>${e(PromocionService.describir(promo))}</p>
        <button id="aplicar" class="btn btn-lce w-100"><i class="bi bi-check2-circle"></i> Aplicar en la venta actual</button></div></div>`;
            root.querySelector('#aplicar').onclick = () => { VentaService.promo = promo; VentaService.qrFactura = factura; location.hash = '#/pos'; };
        } catch (err) { root.querySelector('#res').innerHTML = ''; aviso(root, err.message); }
    };
    root.querySelector('#ok').onclick = () => {
        const v = root.querySelector('#txt').value;
        if (!v.trim()) return aviso(root, 'Pegue el enlace del QR o use la cámara', 'warning');
        leer(v);
    };
    root.querySelector('#cam').onclick = () => escanear(leer);
}

// ======================================================================
// Despacho / Punto de venta
// ======================================================================
let teclaPos = null;
export function pos(root) {
    if (!CajaService.abierta()) {
        root.innerHTML = cab('bi-cart-check', 'Despacho de producto', 'Venta en mostrador') + `<div class="card mx-auto" style="max-width:520px"><div class="card-body text-center p-5">
      <div class="icono-gde bg-secondary"><i class="bi bi-lock"></i></div><h4 class="mt-3">La caja está cerrada</h4>
      <p class="text-muted">Para despachar primero indique con cuánto dinero inicia la caja.</p><a class="btn btn-lce btn-lg" href="#/caja"><i class="bi bi-cash-coin"></i> Abrir caja</a></div></div>`;
        return;
    }
    let cat = 0, abierto = false, pago = { tipo: 'EFECTIVO', recibido: '', ref: '' };
    const err = m => toast(m, 'danger');
    const run = fn => { try { fn(); dibujar(); } catch (x) { err(x.message); } };
    const aplicarQR = t => {
        try {
            const { factura, promo } = PromocionService.leerQR(t);
            VentaService.promo = promo; VentaService.qrFactura = factura;
            toast(`Promoción aplicada: ${promo.nombre}`, 'success'); dibujar();
        } catch (x) { err(x.message); }
    };
    const abrir = v => { abierto = v; root.querySelector('#carritoCol')?.classList.toggle('abierto', v); root.querySelector('#carritoFondo')?.classList.toggle('on', v); };

    // Atajos: F2 busca producto · F9 cobra
    if (teclaPos) document.removeEventListener('keydown', teclaPos);
    teclaPos = ev => {
        if (ev.key === 'F2') { ev.preventDefault(); root.querySelector('#codigo')?.focus(); }
        if (ev.key === 'F9') { ev.preventDefault(); root.querySelector('#cobrar')?.click(); }
    };
    document.addEventListener('keydown', teclaPos);

    function dibujar() {
        const d = VentaService.detalle(), cli = VentaService.cliente, promo = VentaService.promo;
        const prods = DB.todos('productos').filter(p => !cat || p.categoriaId == cat);
        const n = suma(d.filas.filter(f => !f.gratis), f => f.cant);
        const enCarro = id => VentaService.lineas.find(l => l.productoId === id)?.cant || 0;
        root.innerHTML = cab('bi-cart-check', 'Despacho de producto', 'Toque un producto, lea el código o use F2 para buscar',
            `<button id="vaciar" class="btn btn-outline-danger" ${d.filas.length ? '' : 'disabled'}><i class="bi bi-x-circle"></i> <span class="d-none d-sm-inline">Vaciar venta</span></button>`) + `
      <div class="row g-3">
      <div class="col-xl-7">
        <div class="chips mb-3"><button class="chip ${!cat ? 'on' : ''}" data-cat="0">Todo</button>
          ${DB.todos('categorias').map(c => `<button class="chip ${cat == c.id ? 'on' : ''}" data-cat="${c.id}">${e(c.nombre)}</button>`).join('')}</div>
        <form id="lectura" class="input-group input-group-lg mb-3"><span class="input-group-text"><i class="bi bi-upc-scan"></i></span>
          <input id="codigo" class="form-control" placeholder="Código o nombre… (Enter agrega)" autocomplete="off">
          <button type="button" id="camCod" class="btn btn-outline-secondary" title="Escanear con la cámara"><i class="bi bi-camera"></i></button><button class="btn btn-lce">Agregar</button></form>
        <div class="row g-3" id="tiles">${prods.map(p => `<div class="col-6 col-md-4 col-xxl-3 tile-col" data-n="${e((p.nombre + ' ' + p.codigo).toLowerCase())}">
          <div class="tile ${p.stock < 1 ? 'agotado' : ''}" data-cod="${e(p.codigo)}">${enCarro(p.id) ? `<span class="tile-n">${enCarro(p.id)}</span>` : ''}${imgProd(p, 'lg')}
          <div class="tile-nombre">${e(p.nombre)}</div><div class="tile-precio">${q(p.precio)}</div>
          <div class="small ${p.stock <= p.stockMin ? 'text-danger' : 'text-muted'}">${p.stock < 1 ? 'Agotado' : 'Stock: ' + p.stock}</div></div></div>`).join('')}</div>
      </div>
      <div class="col-xl-5 carrito-col ${abierto ? 'abierto' : ''}" id="carritoCol"><div class="card carrito"><div class="card-body p-3 p-xl-4">
        <div class="d-flex align-items-center mb-2"><h5 class="m-0 flex-grow-1"><i class="bi bi-cart3 text-lce"></i> Venta actual</h5><button class="btn btn-sm btn-outline-secondary carrito-cerrar" id="cerrarCarrito"><i class="bi bi-chevron-down"></i></button></div>
        <div style="max-height:280px;overflow:auto">${d.filas.length ? d.filas.map((f, i) => `<div class="item d-flex align-items-center gap-2 py-2 border-bottom">${imgProd(DB.buscar('productos', f.productoId), 'sm')}
          <div class="flex-grow-1 min-w-0"><div class="fw-bold text-truncate">${e(f.nombre)} ${f.nota ? `<span class="badge bg-success">${f.nota}</span>` : ''}</div>
          <div class="small text-muted">${q(f.precio)} c/u${f.desc > 0 ? ` · desc. -${q(f.desc)}` : ''}</div></div>
          ${f.gratis ? '' : `<div class="btn-group btn-group-sm"><button class="btn btn-outline-secondary" data-m="${i}">−</button><span class="btn btn-light disabled px-2">${f.cant}</span><button class="btn btn-outline-secondary" data-p="${i}">+</button></div>`}
          <div class="text-end fw-bold" style="width:76px">${q(f.sub)}</div>
          ${f.gratis ? '' : `<button class="btn btn-sm text-danger px-1" data-q="${i}"><i class="bi bi-trash"></i></button>`}</div>`).join('')
            : '<div class="text-center text-muted py-4"><i class="bi bi-cart display-5"></i><p class="mb-0">Toque un producto para agregarlo</p></div>'}</div>
        <select id="cli" class="form-select mt-3"><option value="">Consumidor Final (CF)</option>${DB.todos('clientes').filter(c => c.nit !== 'CF').map(c => `<option value="${c.id}" ${cli?.id == c.id ? 'selected' : ''}>${e(c.nombre)} · ${e(c.nit)}</option>`).join('')}</select>
        <div class="input-group mt-2"><input id="qr" class="form-control" placeholder="Enlace del QR de promoción"><button id="aplicarQR" class="btn btn-outline-secondary">Aplicar</button><button id="camara" class="btn btn-outline-secondary"><i class="bi bi-camera"></i></button></div>
        ${promo ? `<div class="alert alert-success py-2 mt-2 mb-0 d-flex justify-content-between"><span><i class="bi bi-gift"></i> ${e(promo.nombre)}</span><a href="#" id="quitarPromo">quitar</a></div>` : ''}
        ${cli && cli.puntos > 0 ? `<div class="form-check mt-2"><input class="form-check-input" type="checkbox" id="pts" ${VentaService.usarPuntos ? 'checked' : ''}><label class="form-check-label" for="pts">Usar ${cli.puntos} puntos (1 pt = Q1)</label></div>` : ''}
        <div class="d-flex justify-content-between mt-3 text-muted"><span>Subtotal</span><span>${q(d.subtotal)}</span></div>
        <div class="d-flex justify-content-between text-success"><span>Descuento</span><span>- ${q(d.descuento)}</span></div>
        <div class="d-flex justify-content-between fs-2 fw-bold border-top pt-2"><span>Total</span><span class="text-lce">${q(d.total)}</span></div>
        <div class="btn-group w-100 my-3" role="group">${[['EFECTIVO', 'bi-cash', 'Efectivo'], ['DEBITO', 'bi-credit-card', 'Débito'], ['CREDITO', 'bi-credit-card-2-front', 'Crédito']].map(([v, i, t]) => `<input type="radio" class="btn-check" name="tp" id="tp${v}" value="${v}" ${pago.tipo === v ? 'checked' : ''}><label class="btn btn-outline-secondary pago-op" for="tp${v}"><i class="bi ${i}"></i> ${t}</label>`).join('')}</div>
        ${pago.tipo === 'EFECTIVO'
            ? `<div class="input-group input-group-lg"><span class="input-group-text">Q</span><input id="recibido" type="number" step="0.01" min="0" class="form-control" placeholder="Monto recibido" value="${pago.recibido}"></div>
             <div class="d-flex gap-2 flex-wrap mt-2">${[['Exacto', 0], ['Q50', 50], ['Q100', 100], ['Q200', 200]].map(([t, v]) => `<button type="button" class="chip" data-rap="${v}">${t}</button>`).join('')}</div><div id="cambio" class="mt-2 fw-bold"></div>`
            : `<input id="ref" class="form-control form-control-lg" maxlength="4" inputmode="numeric" placeholder="Últimos 4 dígitos de la tarjeta" value="${e(pago.ref)}">`}
        <div class="campo-error" id="epago"></div>
        <button id="cobrar" class="btn btn-lce btn-lg w-100 mt-3" ${d.filas.length ? '' : 'disabled'}><i class="bi bi-receipt"></i> Cobrar y facturar <small class="opacity-75 d-none d-xl-inline">(F9)</small></button>
      </div></div></div></div>
      <button id="verCarrito" class="btn btn-lce btn-lg carrito-barra shadow-lg d-flex justify-content-between align-items-center"><span><i class="bi bi-cart3"></i> ${n} producto${n === 1 ? '' : 's'}</span><b>${q(d.total)}</b><span>Ver venta <i class="bi bi-chevron-up"></i></span></button>
      <div class="carrito-fondo ${abierto ? 'on' : ''}" id="carritoFondo"></div>`;

        const $ = s => root.querySelector(s), msgPago = m => { $('#epago').textContent = m; };
        root.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { cat = +b.dataset.cat; dibujar(); });
        root.querySelectorAll('.tile').forEach(t => t.onclick = () => run(() => VentaService.agregar(t.dataset.cod, 1)));
        $('#codigo').oninput = ev => { const s = ev.target.value.toLowerCase(); root.querySelectorAll('.tile-col').forEach(c => c.classList.toggle('d-none', !!s && !c.dataset.n.includes(s))); };
        $('#lectura').onsubmit = ev => { ev.preventDefault(); const v = $('#codigo').value; if (!v.trim()) return; run(() => VentaService.agregar(v, 1)); };
        $('#camCod').onclick = () => escanear(t => run(() => VentaService.agregar(t, 1)));
        $('#vaciar').onclick = async () => { if (await confirmar('Se quitarán todos los productos de la venta actual.', 'Vaciar venta')) { VentaService.reset(); dibujar(); } };
        root.querySelectorAll('[data-q]').forEach(b => b.onclick = () => run(() => VentaService.quitar(+b.dataset.q)));
        root.querySelectorAll('[data-p]').forEach(b => b.onclick = () => run(() => VentaService.cambiar(+b.dataset.p, 1)));
        root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => run(() => VentaService.cambiar(+b.dataset.m, -1)));
        $('#cli').onchange = ev => { VentaService.cliente = DB.buscar('clientes', ev.target.value) || null; VentaService.usarPuntos = false; dibujar(); };
        $('#aplicarQR').onclick = () => aplicarQR($('#qr').value);
        $('#camara').onclick = () => escanear(aplicarQR);
        $('#quitarPromo')?.addEventListener('click', ev => { ev.preventDefault(); VentaService.promo = null; VentaService.qrFactura = null; dibujar(); });
        $('#pts')?.addEventListener('change', ev => { VentaService.usarPuntos = ev.target.checked; dibujar(); });
        $('#verCarrito').onclick = () => abrir(true);
        $('#cerrarCarrito').onclick = () => abrir(false);
        $('#carritoFondo').onclick = () => abrir(false);
        root.querySelectorAll('[name=tp]').forEach(r => r.onchange = () => { pago.tipo = r.value; dibujar(); });
        root.querySelectorAll('[data-rap]').forEach(b => b.onclick = () => { pago.recibido = +b.dataset.rap ? String(b.dataset.rap) : d.total.toFixed(2); dibujar(); });
        $('#ref')?.addEventListener('input', ev => { pago.ref = ev.target.value.replace(/\D/g, ''); ev.target.value = pago.ref; msgPago(''); });
        $('#recibido')?.addEventListener('input', ev => {
            pago.recibido = ev.target.value; msgPago('');
            const dif = Number(pago.recibido || 0) - d.total;
            $('#cambio').innerHTML = !pago.recibido ? '' : dif >= 0 ? `<span class="text-success">Cambio: ${q(dif)}</span>` : `<span class="text-danger">Faltan ${q(-dif)}</span>`;
        });
        $('#recibido')?.dispatchEvent(new Event('input'));
        $('#cobrar').onclick = () => {
            if (pago.tipo === 'EFECTIVO') {
                if (!pago.recibido) return msgPago('Escriba el monto que entrega el cliente');
                if (Number(pago.recibido) < d.total) return msgPago(`El monto no alcanza: faltan ${q(d.total - Number(pago.recibido))}`);
            } else if (pago.ref.length !== 4) return msgPago('Escriba los últimos 4 dígitos de la tarjeta');
            try {
                const r = VentaService.cobrar({ tipo: pago.tipo, recibido: Number(pago.recibido || 0), ref: pago.ref });
                pago = { tipo: 'EFECTIVO', recibido: '', ref: '' };
                toast(r.cambio > 0 ? `Venta registrada. Cambio: ${q(r.cambio)}` : 'Venta registrada', 'success');
                location.hash = '#/factura/' + r.factura.numero;
            } catch (x) { err(x.message); }
        };
        if (!esMovil()) $('#codigo').focus(); // en el celular no se abre el teclado solo
    }
    dibujar();
}

// ======================================================================
// Factura (formato del ejemplo del PDF) y listado
// ======================================================================
export const factura = num => root => {
    const f = DB.todos('facturas').find(x => x.numero === num);
    if (!f) { root.innerHTML = alerta('danger', 'Factura no encontrada'); return; }
    const v = DB.buscar('ventas', f.ventaId), promo = DB.buscar('promociones', f.promoId);
    root.innerHTML = `<div class="row g-3 justify-content-center">
    <div class="col-lg-5 col-xl-4 no-print"><div class="card mb-3"><div class="card-body p-4 text-center">
      <div class="icono-gde bg-success"><i class="bi bi-check-lg"></i></div><h4 class="mt-3">¡Venta registrada!</h4>
      <div class="display-6 fw-bold text-lce">${q(v.total)}</div><div class="text-muted mb-3">Factura ${f.numero} · ${e(f.cliente)}</div>
      <div class="d-grid gap-2"><button class="btn btn-lce btn-lg" onclick="window.print()"><i class="bi bi-printer"></i> Imprimir / PDF</button>
        <button id="compartir" class="btn btn-success btn-lg"><i class="bi bi-share"></i> Compartir por WhatsApp</button>
        <a class="btn btn-outline-secondary btn-lg" href="#/pos"><i class="bi bi-cart-plus"></i> Nueva venta</a></div></div></div>
      ${promo ? `<div class="card border border-2 border-warning"><div class="card-body d-flex gap-3 align-items-center">${promo.productoId ? imgProd(DB.buscar('productos', promo.productoId), 'md') : '<div class="icono bg-warning"><i class="bi bi-gift"></i></div>'}
        <div><div class="small text-muted">Promoción para su próxima compra</div><b>${e(promo.nombre)}</b><div class="small">${e(PromocionService.describir(promo))}</div></div></div></div>` : ''}</div>
    <div class="col-lg-6 col-xl-5"><div class="factura mx-auto">
      <div class="text-center fw-bold fs-6">NIT: ${EMPRESA.nit}<br>FACTURA Nro.: ${f.numero}<br>AUTORIZACIÓN Nro.: ${f.autorizacion}</div><hr>
      <div><b>FECHA:</b> ${fecha(f.fecha)}<br><b>NIT / CI:</b> ${e(f.nit)}<br><b>Señor(es):</b> ${e(f.cliente)}</div>
      <table class="my-2"><thead><tr><th>CANT</th><th>DETALLE</th><th class="text-end">P. UNIT</th><th class="text-end">SUB TOTAL</th></tr></thead><tbody>
      ${v.lineas.map(l => `<tr><td>${l.cant}</td><td>${e(l.nombre)}</td><td class="text-end">${l.precio.toFixed(2)}</td><td class="text-end">${l.sub.toFixed(2)}</td></tr>`).join('')}</tbody></table>
      ${v.descuento > 0 ? `<div class="d-flex justify-content-between small"><span>Descuento</span><span>- ${v.descuento.toFixed(2)}</span></div>` : ''}
      <div class="fw-bold d-flex justify-content-between border-top border-bottom py-1"><span>Total a pagar</span><span>${q(v.total)}</span></div>
      <div class="mt-1"><b>Son:</b> ${f.letras}</div>
      <div class="mt-2"><b>Código de Control:</b> ${f.codigoControl}<br><b>Fecha Límite de Emisión:</b> ${f.fechaLimite}</div>
      <div id="qr" class="d-flex justify-content-center my-3"></div>
      <div class="text-center small">Escanee el código QR con su celular para conocer su promoción.</div>
      <div class="text-center small mt-2">"ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS. EL USO ILÍCITO DE ESTA SERÁ SANCIONADO DE ACUERDO A LEY"</div>
    </div></div></div>`;
    new QRCode(root.querySelector('#qr'), { text: f.qr, width: 190, height: 190, correctLevel: QRCode.CorrectLevel.L });
    root.querySelector('#compartir').onclick = () => {
        const texto = `Factura ${f.numero} – ${EMPRESA.nombre}. Total ${q(v.total)}. Mira tu promoción: ${f.qr}`;
        if (navigator.share) navigator.share({ title: 'Factura ' + f.numero, text: texto, url: f.qr }).catch(() => { });
        else window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
    };
};

export function facturas(root) {
    const enc = ['No.', 'Fecha', 'Cliente', 'NIT', 'Total', ''], regs = DB.todos('facturas').slice().reverse();
    const filas = regs.map(f => [f.numero, fecha(f.fecha), e(f.cliente), e(f.nit), q(DB.buscar('ventas', f.ventaId).total), `<a class="btn btn-sm btn-outline-primary" href="#/factura/${f.numero}"><i class="bi bi-eye"></i> Ver</a>`]);
    root.innerHTML = cab('bi-receipt', 'Facturas emitidas', `${regs.length} factura${regs.length === 1 ? '' : 's'}`) + `<div class="card"><div class="card-body"><div class="d-flex gap-2 mb-3">${filtro()}${btnCSV}</div>${tabla(enc, filas)}</div></div>`;
    enlazarFiltro(root); root.querySelector('[data-csv]').onclick = () => exportarCSV('facturas', enc, filas);
}

// ======================================================================
// Devoluciones
// ======================================================================
export function devoluciones(root) {
    const enc = ['Fecha', 'Factura', 'Producto', 'Cant', 'Motivo', 'Monto'];
    const filas = DB.todos('devoluciones').slice().reverse().map(d => [fecha(d.fecha), d.numero, prodCelda(d.productoId, d.nombre), d.cant, d.motivo === 'DAÑO' ? '<span class="badge bg-danger">Daño</span>' : '<span class="badge bg-warning text-dark">Vencimiento</span>', q(d.monto)]);
    root.innerHTML = cab('bi-arrow-return-left', 'Devoluciones', 'Por daño o vencimiento (el producto sale del inventario)') + `<div class="row g-3">
    <div class="col-xl-5"><div class="card"><div class="card-body"><h6><i class="bi bi-1-circle text-lce"></i> Busque la factura</h6>
      <form id="bus" class="input-group input-group-lg mb-3"><input id="num" class="form-control" placeholder="No. de factura (ej. 000001)" inputmode="numeric"><button class="btn btn-lce"><i class="bi bi-search"></i> Buscar</button></form><div id="det"></div></div></div></div>
    <div class="col-xl-7"><div class="card"><div class="card-body"><div class="d-flex gap-2 mb-3">${filtro()}${btnCSV}</div>${tabla(enc, filas)}</div></div></div></div>`;
    enlazarFiltro(root); root.querySelector('[data-csv]').onclick = () => exportarCSV('devoluciones', enc, filas);
    root.querySelector('#bus').onsubmit = ev => {
        ev.preventDefault();
        const num = root.querySelector('#num').value.trim();
        if (!num) return aviso(root, 'Escriba el número de factura', 'warning');
        const f = DB.todos('facturas').find(x => x.numero === num.padStart(6, '0'));
        if (!f) return aviso(root, `La factura ${num} no existe`);
        const v = DB.buscar('ventas', f.ventaId), lineas = v.lineas.filter(l => !l.gratis);
        root.querySelector('#det').innerHTML = `<h6 class="mt-2"><i class="bi bi-2-circle text-lce"></i> Elija el producto</h6><div class="small text-muted mb-2">Factura <b>${f.numero}</b> · ${e(f.cliente)}</div>
      <form id="dev">${lineas.map((l, i) => `<input type="radio" class="btn-check" name="p" id="r${i}" value="${l.productoId}" ${i === 0 ? 'checked' : ''}><label class="opcion mb-2" for="r${i}">${imgProd(DB.buscar('productos', l.productoId), 'md')}<div class="flex-grow-1"><b>${e(l.nombre)}</b><div class="small text-muted">Vendido: ${l.cant}</div></div></label>`).join('')}
        <div class="row g-2 mt-1"><div class="col-5"><label class="form-label">Cantidad</label><input name="c" type="number" min="1" value="1" class="form-control"></div>
        <div class="col-7"><label class="form-label">Motivo</label><select name="m" class="form-select"><option value="DAÑO">Daño</option><option value="VENCIMIENTO">Vencimiento</option></select></div></div>
        <button class="btn btn-lce btn-lg w-100 mt-3"><i class="bi bi-arrow-return-left"></i> Registrar devolución</button></form>`;
        root.querySelector('#dev').onsubmit = e2 => {
            e2.preventDefault(); const fd = new FormData(e2.target);
            try { DevolucionService.registrar({ numero: f.numero, productoId: +fd.get('p'), cant: +fd.get('c'), motivo: fd.get('m') }); toast('Devolución registrada', 'success'); devoluciones(root); }
            catch (err) { aviso(root, err.message); }
        };
    };
}

// ======================================================================
// Caja (apertura y cierre con arqueo de billetes)
// ======================================================================
const DEN = [200, 100, 50, 20, 10, 5, 1];
export function caja(root) {
    const c = CajaService.abierta();
    if (!c) {
        root.innerHTML = cab('bi-safe', 'Apertura de caja', 'Indique con cuánto dinero inicia el turno') + `<div class="card mx-auto" style="max-width:520px"><div class="card-body p-4">
      <form id="f"><label class="form-label">Monto con el que inicia la caja (Q)</label>
      <div class="input-group input-group-lg"><span class="input-group-text">Q</span><input name="m" type="number" step="0.01" min="0" class="form-control" required></div>
      <div class="d-flex gap-2 flex-wrap mt-2 mb-3">${[100, 200, 500, 1000].map(v => `<button type="button" class="chip" data-v="${v}">Q${v}</button>`).join('')}</div>
      <button class="btn btn-lce btn-lg w-100"><i class="bi bi-unlock"></i> Abrir caja</button></form></div></div>`;
        const f = root.querySelector('#f');
        root.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { f.elements.m.value = b.dataset.v; });
        f.onsubmit = ev => {
            ev.preventDefault();
            if (!validar(f)) return;
            try { CajaService.abrir(Number(f.elements.m.value)); toast('Caja abierta. ¡Buenas ventas!', 'success'); caja(root); }
            catch (err) { aviso(root, err.message); }
        };
        return;
    }
    const r = CajaService.resumen(c);
    const kpi = (i, t, v, col) => `<div class="col-6 col-lg-4 col-xl"><div class="kpi"><div class="icono bg-${col}"><i class="bi ${i}"></i></div><div class="min-w-0"><div class="text-muted small">${t}</div><div class="kpi-v text-truncate">${v}</div></div></div></div>`;
    root.innerHTML = cab('bi-safe', `Caja #${c.id} abierta`, `Desde ${fecha(c.apertura)}`) + `<div class="row g-3 mb-3">
      ${kpi('bi-unlock', 'Monto inicial', q(c.montoInicial), 'secondary')}${kpi('bi-bag-check', 'Ventas realizadas', r.cantidad, 'primary')}${kpi('bi-cash', 'Ventas en efectivo', q(r.efectivo), 'success')}${kpi('bi-credit-card', 'Ventas con tarjeta', q(r.tarjetas), 'info')}${kpi('bi-wallet2', 'Efectivo esperado', q(r.esperado), 'warning')}</div>
    <div class="row g-3"><div class="col-lg-7"><div class="card h-100"><div class="card-body"><h6><i class="bi bi-calculator text-lce"></i> Arqueo: cuente billetes y monedas</h6>
      <div class="row g-2">${DEN.map(d => `<div class="col-6 col-md-4"><div class="input-group"><span class="input-group-text fw-bold" style="min-width:64px">Q${d}</span><input type="number" min="0" class="form-control" data-den="${d}" placeholder="0"></div></div>`).join('')}</div></div></div></div>
      <div class="col-lg-5"><div class="card h-100"><div class="card-body"><h6><i class="bi bi-lock text-lce"></i> Cerrar caja (corte)</h6>
        <form id="f"><label class="form-label">Monto contado (Q)</label>
        <div class="input-group input-group-lg"><span class="input-group-text">Q</span><input id="monto" name="m" type="number" step="0.01" min="0" class="form-control" required></div>
        <div class="total-box d-flex justify-content-between mt-3"><span>Diferencia con lo esperado</span><b id="dif">—</b></div>
        <button class="btn btn-danger btn-lg w-100 mt-3"><i class="bi bi-lock"></i> Cerrar caja</button></form></div></div></div></div>`;
    const monto = root.querySelector('#monto'), dif = root.querySelector('#dif');
    const calcDif = () => { if (monto.value === '') { dif.textContent = '—'; return; } const d = Number(monto.value) - r.esperado; dif.textContent = (d > 0 ? '+' : '') + q(d); dif.className = d === 0 ? 'text-success' : d > 0 ? 'text-primary' : 'text-danger'; };
    monto.oninput = calcDif;
    root.querySelectorAll('[data-den]').forEach(i => i.oninput = () => { monto.value = suma([...root.querySelectorAll('[data-den]')], x => Number(x.dataset.den) * Number(x.value || 0)).toFixed(2); calcDif(); });
    root.querySelector('#f').onsubmit = async ev => {
        ev.preventDefault();
        if (!validar(ev.target)) return;
        if (!await confirmar('Después del cierre no podrá registrar más ventas en esta caja.', 'Cerrar caja', false)) return;
        try {
            const x = CajaService.cerrar(Number(monto.value));
            root.innerHTML = cab('bi-safe', 'Caja cerrada', `Corte de la caja #${x.id}`) + `<div class="card mx-auto" style="max-width:560px"><div class="card-body text-center p-4">
        <div class="icono-gde ${x.diferencia === 0 ? 'bg-success' : 'bg-warning'}"><i class="bi ${x.diferencia === 0 ? 'bi-check-lg' : 'bi-exclamation-lg'}"></i></div>
        <h4 class="mt-3">${x.diferencia === 0 ? '¡Caja cuadrada!' : 'Hay una diferencia'}</h4>
        <div class="row text-center mt-3"><div class="col"><div class="text-muted small">Esperado</div><b>${q(x.esperado)}</b></div><div class="col"><div class="text-muted small">Contado</div><b>${q(x.montoFinal)}</b></div><div class="col"><div class="text-muted small">Diferencia</div><b class="${x.diferencia === 0 ? 'text-success' : 'text-danger'}">${q(x.diferencia)}</b></div></div>
        <a class="btn btn-lce btn-lg w-100 mt-4" href="#/rep/corte"><i class="bi bi-file-earmark-text"></i> Ver reporte de corte de caja</a></div></div>`;
        } catch (err) { aviso(root, err.message); }
    };
}

// ======================================================================
// Reportes e ingresos/egresos
// ======================================================================
export const reporte = tipo => root => {
    const T = {
        corte: ['Reporte de corte de caja', 'bi-safe', ['#', 'Cajero', 'Apertura', 'Inicial', 'Ventas', 'Esperado', 'Final', 'Diferencia', 'Estado'],
            () => DB.todos('cajas').map(c => { const r = CajaService.resumen(c); return [c.id, nombreDe('usuarios', c.usuarioId), fecha(c.apertura), q(c.montoInicial), q(r.totalVentas), q(r.esperado), c.montoFinal == null ? '-' : q(c.montoFinal), c.diferencia == null ? '-' : q(c.diferencia), c.estado === 'ABIERTA' ? '<span class="badge bg-success">Abierta</span>' : '<span class="badge bg-secondary">Cerrada</span>']; })],
        devoluciones: ['Reporte de devoluciones', 'bi-arrow-return-left', ['Fecha', 'Factura', 'Producto', 'Cant', 'Motivo', 'Monto'],
            () => DB.todos('devoluciones').map(d => [fecha(d.fecha), d.numero, prodCelda(d.productoId, d.nombre), d.cant, d.motivo, q(d.monto)])],
        clientes: ['Reporte de clientes', 'bi-people', ['Cliente', 'NIT', 'Compras', 'Total comprado', 'Puntos'],
            () => DB.todos('clientes').map(c => { const v = DB.todos('ventas').filter(x => x.clienteId == c.id); return [e(c.nombre), e(c.nit), v.length, q(suma(v, x => x.total)), c.puntos]; })],
        compras: ['Reporte de compras de producto para existencias', 'bi-truck', ['Fecha', 'Proveedor', 'Producto', 'Cant', 'Costo', 'Total'],
            () => DB.todos('compras').map(c => [fecha(c.fecha), nombreDe('proveedores', c.proveedorId), prodCelda(c.productoId, c.nombre), c.cant, q(c.costo), q(c.total)])]
    }[tipo];
    if (!T) { root.innerHTML = alerta('warning', 'Reporte no encontrado'); return; }
    const filas = T[3]();
    root.innerHTML = cab(T[1], T[0], '', `<div class="d-flex gap-2 no-print">${btnCSV}<button class="btn btn-lce" onclick="window.print()"><i class="bi bi-printer"></i> <span class="d-none d-sm-inline">Imprimir</span></button></div>`)
        + `<div class="card"><div class="card-body">${tabla(T[2], filas)}</div></div>`;
    root.querySelector('[data-csv]').onclick = () => exportarCSV('reporte-' + tipo, T[2], filas);
};

export function contabilidad(root) {
    const ing = suma(DB.todos('ventas'), v => v.total), com = suma(DB.todos('compras'), c => c.total), dev = suma(DB.todos('devoluciones'), d => d.monto), bal = ing - com - dev;
    const max = Math.max(ing, com, dev, 1);
    const kpi = (i, t, v, c) => `<div class="col-6 col-xl-3"><div class="kpi"><div class="icono bg-${c}"><i class="bi ${i}"></i></div><div class="min-w-0"><div class="text-muted small">${t}</div><div class="kpi-v text-truncate">${v}</div></div></div></div>`;
    const barra = (t, v, c) => `<div class="mb-3"><div class="d-flex justify-content-between"><b>${t}</b><span>${q(v)}</span></div><div class="progress" style="height:14px"><div class="progress-bar bg-${c}" style="width:${v / max * 100}%"></div></div></div>`;
    root.innerHTML = cab('bi-calculator', 'Ingresos y egresos', 'Resumen contable del negocio') + `<div class="row g-3 mb-3">
    ${kpi('bi-graph-up-arrow', 'Ingresos (ventas)', q(ing), 'success')}${kpi('bi-graph-down-arrow', 'Egresos (compras)', q(com), 'danger')}${kpi('bi-arrow-return-left', 'Devoluciones', q(dev), 'warning')}${kpi('bi-piggy-bank', 'Balance', q(bal), bal >= 0 ? 'primary' : 'danger')}</div>
    <div class="card"><div class="card-body"><h6 class="mb-3">Comparativo</h6>${barra('Ingresos', ing, 'success')}${barra('Compras', com, 'danger')}${barra('Devoluciones', dev, 'warning')}</div></div>`;
}

// ======================================================================
// Respaldo de datos (archivo .db de SQLite)
// ======================================================================
export function respaldo(root) {
    root.innerHTML = cab('bi-cloud-arrow-down', 'Respaldo de datos', 'Guarde o recupere toda la base de datos') + `<div class="row g-3">
    <div class="col-lg-6"><div class="card h-100"><div class="card-body text-center p-4"><div class="icono-gde bg-success"><i class="bi bi-download"></i></div><h5 class="mt-3">Descargar respaldo</h5>
      <p class="text-muted">Descarga la base de datos completa en un archivo <b>.db</b> (SQLite). También lo puede abrir en WebStorm.</p><button id="bajar" class="btn btn-success btn-lg w-100"><i class="bi bi-download"></i> Descargar respaldo</button></div></div></div>
    <div class="col-lg-6"><div class="card h-100"><div class="card-body text-center p-4"><div class="icono-gde bg-primary"><i class="bi bi-upload"></i></div><h5 class="mt-3">Restaurar respaldo</h5>
      <p class="text-muted">Reemplaza los datos actuales por los del archivo .db elegido.</p><input id="arch" type="file" accept=".db,.sqlite" class="form-control mb-2"><button id="subir" class="btn btn-primary btn-lg w-100"><i class="bi bi-upload"></i> Restaurar</button></div></div></div>
    <div class="col-12"><div class="alert alert-info mb-0"><i class="bi bi-info-circle"></i> Los datos se guardan en este navegador. Haga un respaldo antes de limpiar el historial o cambiar de equipo.</div></div></div>`;
    root.querySelector('#bajar').onclick = () => {
        descargar(`lce-respaldo-${new Date().toISOString().slice(0, 10)}.db`, DB.exportar(), 'application/octet-stream'); toast('Respaldo descargado', 'success');
    };
    root.querySelector('#subir').onclick = async () => {
        const f = root.querySelector('#arch').files[0]; if (!f) return toast('Elija primero el archivo del respaldo (.db)', 'warning');
        if (!await confirmar('Se reemplazarán TODOS los datos actuales por los del respaldo.', 'Restaurar respaldo')) return;
        try { DB.importar(new Uint8Array(await f.arrayBuffer())); toast('Respaldo restaurado', 'success'); setTimeout(() => location.reload(), 700); }
        catch (x) { toast(x.message, 'danger'); }
    };
}

// ======================================================================
// Base de datos: tablas, relaciones y consola SQL de solo lectura
// ======================================================================
const valor = v => v === null || v === undefined ? '<span class="text-muted">NULL</span>' : (s => e(s.length > 48 ? s.slice(0, 48) + '…' : s))(String(v));
const EJEMPLOS = [
    ['Productos por familia', 'SELECT p.codigo, p.nombre, c.nombre AS familia, p.precio, p.stock\nFROM productos p\nJOIN categorias c ON c.id = p.categoria_id\nORDER BY c.nombre, p.nombre'],
    ['Facturas con su venta', 'SELECT f.numero, f.cliente, v.total, v.pago_tipo\nFROM facturas f\nJOIN ventas v ON v.id = f.venta_id\nORDER BY f.id DESC'],
    ['Ingresos por familia', 'SELECT c.nombre AS familia, SUM(d.subtotal - d.descuento) AS ingresos\nFROM detalle_venta d\nJOIN categorias c ON c.id = d.categoria_id\nGROUP BY c.id\nORDER BY ingresos DESC'],
    ['Más vendidos (vista)', 'SELECT * FROM v_ventas_por_producto'],
    ['Stock bajo (vista)', 'SELECT * FROM v_stock_bajo']
];
const soloLectura = s => /^\s*(select|with|explain|pragma\s+(table_info|foreign_key_list|index_list))\b/i.test(s)
    && !/\b(insert|update|delete|drop|alter|create|replace|attach|detach|vacuum|reindex)\b/i.test(s.replace(/'[^']*'/g, "''"));

export function baseDatos(root) {
    const tablas = DB.tablas();
    root.innerHTML = cab('bi-database', 'Base de datos', 'SQLite: motor relacional real que corre dentro del navegador',
        '<button id="bajar" class="btn btn-success"><i class="bi bi-download"></i> <span class="d-none d-sm-inline">Descargar .db</span></button>') + `
    <div class="row g-3 mb-3">
      <div class="col-lg-3"><div class="card h-100"><div class="card-body"><h6><i class="bi bi-table text-lce"></i> Tablas (${tablas.length})</h6>
        <div class="list-group list-group-flush">${tablas.map(t => `<button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" data-t="${t.nombre}">${t.nombre}<span class="badge bg-secondary rounded-pill">${t.filas}</span></button>`).join('')}</div></div></div></div>
      <div class="col-lg-9"><div class="card h-100"><div class="card-body" id="detalle"></div></div></div></div>
    <div class="card"><div class="card-body"><h6><i class="bi bi-terminal text-lce"></i> Consola SQL <small class="text-muted fw-normal">(solo consultas de lectura)</small></h6>
      <div class="d-flex gap-2 flex-wrap mb-2">${EJEMPLOS.map(([t], i) => `<button class="chip" data-ej="${i}">${t}</button>`).join('')}</div>
      <textarea id="sql" class="form-control font-monospace mb-2" rows="4" spellcheck="false">SELECT * FROM productos</textarea>
      <button id="ejecutar" class="btn btn-lce"><i class="bi bi-play-fill"></i> Ejecutar (Ctrl + Enter)</button>
      <div id="resultado" class="mt-3"></div></div></div>`;

    const verTabla = n => {
        root.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('active', b.dataset.t === n));
        const cols = DB.columnas(n), fks = Object.fromEntries(DB.claves(n).map(k => [k.from, `${k.table}(${k.to})`]));
        const datos = DB.sql(`SELECT * FROM "${n}" LIMIT 50`)[0];
        root.querySelector('#detalle').innerHTML = `<h6><i class="bi bi-diagram-3 text-lce"></i> Estructura de <b>${n}</b></h6>
      ${tabla(['Columna', 'Tipo', 'Clave', 'Obligatorio', 'Referencia'], cols.map(c => [`<b>${e(c.name)}</b>`, e(c.type),
            c.pk ? '<span class="badge bg-warning text-dark">PK</span>' : fks[c.name] ? '<span class="badge bg-info text-dark">FK</span>' : '',
            c.notnull ? 'Sí' : 'No', fks[c.name] ? '→ ' + e(fks[c.name]) : '']))}
      <h6 class="mt-3"><i class="bi bi-list-ul text-lce"></i> Registros <small class="text-muted fw-normal">(primeros 50)</small></h6>
      ${datos ? tabla(datos.columns, datos.values.map(f => f.map(valor))) : '<div class="text-muted">La tabla está vacía</div>'}`;
    };
    const ejecutar = () => {
        const t = root.querySelector('#sql').value.trim(), out = root.querySelector('#resultado');
        if (!t) return toast('Escriba una consulta SQL', 'warning');
        if (!soloLectura(t)) return toast('Solo se permiten consultas de lectura (SELECT)', 'warning');
        try {
            const ini = performance.now(), r = DB.sql(t)[0], ms = Math.round(performance.now() - ini);
            out.innerHTML = r ? `<div class="small text-muted mb-2">${r.values.length} fila(s) · ${ms} ms</div>${tabla(r.columns, r.values.map(f => f.map(valor)))}` : '<div class="alert alert-info py-2">La consulta no devolvió filas</div>';
        } catch (x) { out.innerHTML = alerta('danger', e(x.message)); }
    };
    root.querySelectorAll('[data-t]').forEach(b => b.onclick = () => verTabla(b.dataset.t));
    root.querySelectorAll('[data-ej]').forEach(b => b.onclick = () => { root.querySelector('#sql').value = EJEMPLOS[+b.dataset.ej][1]; ejecutar(); });
    root.querySelector('#ejecutar').onclick = ejecutar;
    root.querySelector('#sql').addEventListener('keydown', ev => { if (ev.ctrlKey && ev.key === 'Enter') { ev.preventDefault(); ejecutar(); } });
    root.querySelector('#bajar').onclick = () => { descargar(`lce-${new Date().toISOString().slice(0, 10)}.db`, DB.exportar(), 'application/octet-stream'); toast('Archivo .db descargado', 'success'); };
    verTabla('productos'); ejecutar();
}