import { iniciarDB, DB } from '../data/db.js';
import { AuthService, AlertaService } from '../business/services.js';
import * as V from './views.js';
import { iniciarImagenes } from './imagenes.js';

// Encabezado idéntico al del PDF: Mensajería | Ventas | Punto de Venta | ... | Más ▾
const MENU = [
    ['Mensajería', [['Avisos', 'mensajeria']]],
    ['Ventas', [['Clientes', 'clientes'], ['Facturas', 'facturas']]],
    ['Punto de Venta', [['Despacho de producto', 'pos'], ['Devoluciones', 'devoluciones'], ['Apertura / cierre de caja', 'caja'], ['Leer código QR', 'qr']]],
    ['Contabilidad', [['Ingresos y egresos', 'contabilidad'], ['Corte de caja', 'rep/corte']]],
    ['Compras', [['Proveedores', 'proveedores'], ['Registrar compra', 'compras']]],
    ['Almacén', [['Productos y precios', 'productos'], ['Inventario', 'inventario']]],
    ['Manufacturing', [['Fuera del alcance', 'conocimiento']]],
    ['Recursos humanos', [['Usuarios', 'usuarios']]],
    ['Conocimiento', [['Acerca del proyecto', 'conocimiento']]],
    ['Informes', [['Corte de caja', 'rep/corte'], ['Devoluciones', 'rep/devoluciones'], ['Clientes', 'rep/clientes'], ['Compras', 'rep/compras']]],
    ['Más', [['Promociones (QR)', 'promociones'], ['Base de datos', 'basedatos'], ['Respaldo de datos', 'respaldo'], ['Reiniciar datos', 'reiniciar']]]
];
const PERMISOS = { usuarios: ['ADMIN'], promociones: ['ADMIN'], respaldo: ['ADMIN'], basedatos: ['ADMIN'], proveedores: ['ADMIN', 'BODEGA'], compras: ['ADMIN', 'BODEGA'], productos: ['ADMIN', 'BODEGA'], inventario: ['ADMIN', 'BODEGA', 'CAJERO'], pos: ['ADMIN', 'CAJERO'], devoluciones: ['ADMIN', 'CAJERO'], caja: ['ADMIN', 'CAJERO'], qr: ['ADMIN', 'CAJERO'] };
const permitido = (ruta, rol) => !PERMISOS[ruta] || PERMISOS[ruta].includes(rol);

// Atajos de la barra inferior (celular) según el rol
const NAV = {
    BODEGA: [['inicio', 'bi-house-door', 'Inicio'], ['inventario', 'bi-box-seam', 'Inventario'], ['compras', 'bi-truck', 'Compras'], ['productos', 'bi-tags', 'Productos']],
    OTROS: [['inicio', 'bi-house-door', 'Inicio'], ['pos', 'bi-cart-check', 'Vender'], ['caja', 'bi-safe', 'Caja'], ['facturas', 'bi-receipt', 'Facturas']]
};

const RUTAS = {
    inicio: V.inicio, mensajeria: V.mensajeria, clientes: V.clientes, facturas: V.facturas, pos: V.pos, devoluciones: V.devoluciones, caja: V.caja,
    qr: V.leerQR, contabilidad: V.contabilidad, proveedores: V.proveedores, compras: V.compras, productos: V.productos,
    inventario: V.inventario, usuarios: V.usuarios, conocimiento: V.conocimiento, promociones: V.promociones, respaldo: V.respaldo, basedatos: V.baseDatos,
    factura: V.factura, rep: V.reporte
};

// ---- Detección de dispositivo: celular / táctil ----
const mq = window.matchMedia('(max-width: 991.98px)'), tactil = window.matchMedia('(pointer: coarse)');
const detectar = () => { const c = document.documentElement.classList; c.toggle('es-movil', mq.matches); c.toggle('es-tactil', tactil.matches); };
detectar(); mq.addEventListener('change', detectar); tactil.addEventListener('change', detectar);

// ---- Tema claro / oscuro ----
const aplicarTema = t => {
    document.documentElement.setAttribute('data-bs-theme', t); localStorage.setItem('lce_tema', t);
    document.querySelectorAll('.js-tema i').forEach(i => { i.className = t === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill'; });
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'dark' ? '#4a2047' : '#9a4f93';
};
const temaActual = () => document.documentElement.getAttribute('data-bs-theme') || 'light';

function shell(u) {
    const grupos = MENU.map(([t, subs]) => [t, subs.filter(([, r]) => permitido(r.split('/')[0], u.rol))]).filter(([, s]) => s.length);
    const escritorio = grupos.map(([titulo, subs]) => `<div class="dropdown d-inline-block"><span class="nt dropdown-toggle ${titulo === 'Más' ? 'con-caret' : ''}" data-rutas="${subs.map(s => s[1]).join(',')}" data-bs-toggle="dropdown">${titulo}</span>
      <ul class="dropdown-menu">${subs.map(([t, r]) => `<li><a class="dropdown-item" href="#/${r}">${t}</a></li>`).join('')}</ul></div>`).join('');
    const acordeon = grupos.map(([t, subs], i) => `<div class="accordion-item border-0"><h2 class="accordion-header"><button class="accordion-button collapsed fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#ac${i}">${t}</button></h2>
      <div id="ac${i}" class="accordion-collapse collapse" data-bs-parent="#acMenu"><div class="list-group list-group-flush">${subs.map(([n, r]) => `<a href="#/${r}" class="list-group-item list-group-item-action py-3" data-bs-dismiss="offcanvas">${n}</a>`).join('')}</div></div></div>`).join('');
    const nav = (u.rol === 'BODEGA' ? NAV.BODEGA : NAV.OTROS).map(([r, i, t]) => `<a href="#/${r}" data-ruta="${r}"><i class="bi ${i}"></i>${t}</a>`).join('');
    const nombre = V.e(u.nombre);
    return `<div class="franja"></div>
    <nav class="topbar d-none d-lg-flex align-items-center"><a href="#/inicio" class="marca" title="Inicio"><i class="bi bi-house-door-fill"></i></a>${escritorio}
      <div class="ms-auto d-flex align-items-center gap-1 pe-2">
        <button class="nt js-buscar" title="Buscar (Ctrl+K)"><i class="bi bi-search"></i></button>
        <button class="nt js-tema" title="Cambiar tema"><i class="bi bi-moon-stars-fill"></i></button>
        <a href="#/mensajeria" class="alerta" title="Avisos"><i class="bi bi-exclamation-triangle-fill"></i> <span data-nalertas>0</span></a>
        <i class="bi bi-chat-fill mx-2"></i>
        <div class="dropdown"><span class="nt dropdown-toggle con-caret" data-bs-toggle="dropdown"><i class="bi bi-person-square"></i> ${nombre}</span>
        <ul class="dropdown-menu dropdown-menu-end"><li><a class="dropdown-item js-salir" href="#"><i class="bi bi-box-arrow-right"></i> Cerrar sesión</a></li></ul></div>
      </div></nav>
    <header class="movil-head d-lg-none">
      <a href="#/inicio" class="text-white text-decoration-none fw-bold flex-grow-1 text-truncate"><i class="bi bi-shop"></i> Las Casas del Escuintleco</a>
      <button class="icon-btn js-buscar" aria-label="Buscar"><i class="bi bi-search"></i></button>
      <button class="icon-btn js-tema" aria-label="Tema"><i class="bi bi-moon-stars-fill"></i></button>
      <a href="#/mensajeria" class="icon-btn" aria-label="Avisos"><i class="bi bi-bell-fill"></i><span class="pt" data-nalertas>0</span></a>
    </header>
    <main class="container-fluid py-3 px-3 px-lg-4" id="contenido"></main>
    <nav class="nav-inf d-lg-none">${nav}<button data-bs-toggle="offcanvas" data-bs-target="#menuMovil"><i class="bi bi-list"></i>Menú</button></nav>
    <div class="offcanvas offcanvas-start" tabindex="-1" id="menuMovil">
      <div class="offcanvas-header menu-head"><div><div class="fw-bold fs-5"><i class="bi bi-person-circle"></i> ${nombre}</div><div class="small opacity-75">${u.rol}</div></div><button class="btn-close btn-close-white" data-bs-dismiss="offcanvas"></button></div>
      <div class="offcanvas-body p-0 d-flex flex-column"><div class="accordion accordion-flush flex-grow-1" id="acMenu">${acordeon}</div>
        <div class="p-3 border-top"><button class="btn btn-outline-danger w-100 js-salir" data-bs-dismiss="offcanvas"><i class="bi bi-box-arrow-right"></i> Cerrar sesión</button></div></div></div>`;
}

function pintar() {
    const app = document.getElementById('app'), u = AuthService.usuario();
    if (!u) { delete app.dataset.user; V.login(app, () => { location.hash = '#/inicio'; pintar(); }); return; }
    const [, ruta = 'inicio', param] = location.hash.split('/');
    if (ruta === 'reiniciar') {
        V.confirmar('Se borrarán todos los datos del sistema y volverán los de ejemplo.', 'Reiniciar datos').then(ok => { if (ok) DB.reiniciar(); else location.hash = '#/inicio'; });
        return;
    }
    if (app.dataset.user != u.id || !app.querySelector('#contenido')) { // el encabezado se dibuja una sola vez
        app.innerHTML = shell(u); app.dataset.user = u.id;
        app.querySelectorAll('.js-salir').forEach(b => b.onclick = ev => { ev.preventDefault(); AuthService.salir(); location.hash = ''; pintar(); });
        app.querySelectorAll('.js-tema').forEach(b => b.onclick = () => aplicarTema(temaActual() === 'dark' ? 'light' : 'dark'));
        app.querySelectorAll('.js-buscar').forEach(b => b.onclick = () => V.abrirBuscador());
        aplicarTema(temaActual());
    }
    const activa = ruta === 'rep' ? `rep/${param}` : ruta;
    app.querySelectorAll('.nt[data-rutas]').forEach(n => n.classList.toggle('activo', n.dataset.rutas.split(',').includes(activa)));
    app.querySelectorAll('.nav-inf [data-ruta]').forEach(n => n.classList.toggle('activo', n.dataset.ruta === ruta));
    const nAl = AlertaService.lista().length;
    app.querySelectorAll('[data-nalertas]').forEach(n => { n.textContent = nAl; });

    const cont = document.getElementById('contenido'); cont.innerHTML = '';
    if (!RUTAS[ruta] || !permitido(ruta, u.rol)) {
        cont.innerHTML = '<div class="text-center py-5"><i class="bi bi-lock display-1 text-muted"></i><h4 class="mt-3">No tiene acceso a esta opción</h4><a class="btn btn-lce" href="#/inicio">Volver al inicio</a></div>';
        return;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    (['factura', 'rep'].includes(ruta) ? RUTAS[ruta](param) : RUTAS[ruta])(cont);
}

// Atajo global: Ctrl + K abre el buscador
document.addEventListener('keydown', ev => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k' && AuthService.usuario()) { ev.preventDefault(); V.abrirBuscador(); }
});

iniciarImagenes(); // completa las fotos reales de los productos cuando aparecen en pantalla
await iniciarDB();
window.addEventListener('hashchange', pintar);
pintar();