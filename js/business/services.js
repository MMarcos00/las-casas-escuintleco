// CAPA DE NEGOCIO: reglas del sistema (sin HTML).
import { DB, sha256 } from '../data/db.js';

export const EMPRESA = { nombre: 'Las Casas del Escuintleco', nit: '1002827029', autorizacion: '114401600001334' };
export const q = n => 'Q ' + Number(n || 0).toFixed(2);
export const fecha = i => new Date(i).toLocaleString('es-GT');
export const suma = (a, f) => a.reduce((s, x) => s + f(x), 0);
const ahora = () => new Date().toISOString();

// Dirección pública del sitio (cámbiela por la suya). En GitHub Pages se detecta sola.
export const URL_PUBLICA = 'https://mmarcos00.github.io/las-casas-escuintleco/';
const base = () => location.hostname.endsWith('github.io') ? new URL('.', location.href).href : URL_PUBLICA;

// ---- Total en letras ----
const U = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DE = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CE = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
const menor1000 = n => {
    if (n === 100) return 'CIEN';
    let s = CE[Math.floor(n / 100)]; const r = n % 100;
    if (r) s += (s ? ' ' : '') + (r < 30 ? U[r] : DE[Math.floor(r / 10)] + (r % 10 ? ' Y ' + U[r % 10] : ''));
    return s;
};
const entero = n => {
    if (n === 0) return 'CERO';
    const m = Math.floor(n / 1e6), k = Math.floor(n % 1e6 / 1000), r = n % 1000; let s = '';
    if (m) s += (m === 1 ? 'UN MILLÓN' : menor1000(m) + ' MILLONES') + ' ';
    if (k) s += (k === 1 ? 'MIL' : menor1000(k) + ' MIL') + ' ';
    if (r) s += menor1000(r);
    return s.trim();
};
export const numeroALetras = t => {
    const e = Math.floor(t), c = Math.round((t - e) * 100);
    return `${entero(e)} CON ${String(c).padStart(2, '0')}/100 QUETZALES`;
};

// ---- Acceso ----
export class AuthError extends Error {
    constructor(m, campo) { super(m); this.campo = campo; }
}

export class AuthService {
    static async login(u, c) {
        const us = DB.todos('usuarios').find(x => x.usuario.toLowerCase() === u.toLowerCase());
        if (!us) throw new AuthError(`El usuario «${u}» no existe`, 'u');
        if (us.hash !== await sha256(c)) throw new AuthError(`La contraseña del usuario «${us.usuario}» es incorrecta`, 'c');
        sessionStorage.setItem('lce_user', us.id);
        return us;
    }
    static usuario() { const id = sessionStorage.getItem('lce_user'); return id ? DB.buscar('usuarios', id) : null; }
    static salir() { sessionStorage.removeItem('lce_user'); }
}

// ---- Promociones / QR ----
export class PromocionService {
    static describir(p) {
        const prod = DB.buscar('productos', p.productoId)?.nombre, cat = DB.buscar('categorias', p.categoriaId)?.nombre;
        return {
            GRATIS: `Producto gratuito: ${prod}`,
            VALE: `Vale de regalo de ${q(p.monto)}`,
            '2DO_MITAD': `Segundo producto a mitad de precio: ${prod}`,
            MAYOREO: `Compra por mayoreo: 3 o más de «${cat}» a precio de mayoreo`,
            PUNTOS: `${p.puntos} puntos por cada producto de «${cat}» para su próxima compra`
        }[p.tipo];
    }
    static asignar(venta) { // promoción impresa en el QR de la factura
        const cats = new Set(venta.lineas.map(l => l.cat)), ps = DB.todos('promociones');
        return (ps.find(p => cats.has(p.categoriaId)) || ps[Math.floor(Math.random() * ps.length)])?.id ?? null;
    }
    static leerQR(txt) {
        txt = String(txt).trim(); let num;
        if (/^https?:\/\//i.test(txt)) { try { num = new URL(txt).searchParams.get('f'); } catch { } }
        else if (txt.startsWith('LCE|')) num = txt.split('|')[1];
        if (!num) throw new Error('Este código QR no pertenece a Las Casas del Escuintleco');
        const f = DB.todos('facturas').find(x => x.numero === num);
        if (!f) throw new Error(`La factura ${num} no existe en esta caja (el QR debe haberse emitido en este sistema)`);
        if (f.qrUsado) throw new Error(`El código de la factura ${num} ya fue canjeado`);
        if (f.venceQR && new Date(f.venceQR + 'T23:59:59') < new Date()) throw new Error(`La promoción de la factura ${num} ya venció`);
        const p = DB.buscar('promociones', f.promoId);
        if (!p) throw new Error('La promoción de este código ya no está disponible');
        return { factura: f, promo: p };
    }
}

// ---- Caja ----
export class CajaService {
    static abierta() { const u = AuthService.usuario(); return DB.todos('cajas').find(c => c.estado === 'ABIERTA' && c.usuarioId == u.id); }
    static abrir(monto) {
        if (this.abierta()) throw new Error('Ya tiene una caja abierta');
        return DB.insertar('cajas', { usuarioId: AuthService.usuario().id, apertura: ahora(), montoInicial: monto, estado: 'ABIERTA' });
    }
    static resumen(c) {
        const v = DB.todos('ventas').filter(x => x.cajaId == c.id);
        const efectivo = suma(v.filter(x => x.pago.tipo === 'EFECTIVO'), x => x.total);
        const totalVentas = suma(v, x => x.total);
        return { cantidad: v.length, totalVentas, efectivo, tarjetas: totalVentas - efectivo, esperado: c.montoInicial + efectivo };
    }
    static cerrar(montoFinal) {
        const c = this.abierta(); if (!c) throw new Error('No hay caja abierta');
        const r = this.resumen(c);
        Object.assign(c, { estado: 'CERRADA', cierre: ahora(), montoFinal, esperado: r.esperado, diferencia: montoFinal - r.esperado });
        DB.guardar(); return c;
    }
}

// ---- Facturación ----
export class FacturacionService {
    static emitir(venta, cliente) {
        const hex = () => Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0');
        const promoId = PromocionService.asignar(venta), promo = DB.buscar('promociones', promoId);
        const venceQR = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
        const f = DB.insertar('facturas', {
            ventaId: venta.id, fecha: venta.fecha, nit: cliente?.nit || 'CF', cliente: cliente?.nombre || 'Consumidor Final',
            autorizacion: EMPRESA.autorizacion, letras: numeroALetras(venta.total), codigoControl: [1, 2, 3, 4].map(hex).join('-'),
            fechaLimite: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), promoId, venceQR, qrUsado: false
        });
        f.numero = String(f.id).padStart(6, '0');
        // El QR es una dirección web: al escanearlo se abre promo.html con los datos de la promoción
        const u = new URL('promo.html', base());
        u.search = new URLSearchParams({
            f: f.numero, t: promo?.tipo || '', n: promo?.nombre || '',
            d: promo ? PromocionService.describir(promo) : '', e: venceQR
        }).toString();
        f.qr = u.href;
        DB.guardar(); return f;
    }
}

// ---- Despacho (carrito) y cobro ----
export class VentaService {
    static lineas = []; static cliente = null; static promo = null; static qrFactura = null; static usarPuntos = false;

    static reset() { Object.assign(this, { lineas: [], cliente: null, promo: null, qrFactura: null, usarPuntos: false }); }
    static agregar(codigo, cant = 1) {
        const p = DB.todos('productos').find(x => x.codigo === String(codigo).trim());
        if (!p) throw new Error('Producto no encontrado');
        const l = this.lineas.find(x => x.productoId === p.id), nueva = (l ? l.cant : 0) + cant;
        if (nueva > p.stock) throw new Error(`Stock insuficiente de ${p.nombre} (disponible: ${p.stock})`);
        l ? l.cant = nueva : this.lineas.push({ productoId: p.id, cant });
    }
    static quitar(i) { this.lineas.splice(i, 1); }
    static cambiar(i, delta) { // botones − y + del carrito
        const l = this.lineas[i], p = DB.buscar('productos', l.productoId), n = l.cant + delta;
        if (n < 1) return this.quitar(i);
        if (n > p.stock) throw new Error(`Solo hay ${p.stock} unidades de ${p.nombre}`);
        l.cant = n;
    }

    // Subtotales por línea, descuentos de la promoción del QR y total
    static detalle() {
        const filas = this.lineas.map(l => {
            const p = DB.buscar('productos', l.productoId);
            return { productoId: p.id, nombre: p.nombre, cat: p.categoriaId, cant: l.cant, precio: p.precio, mayoreo: p.mayoreo, sub: l.cant * p.precio, desc: 0, nota: '' };
        });
        const pr = this.promo; let vale = 0;
        if (pr) {
            if (pr.tipo === 'VALE') vale = Math.min(pr.monto, suma(filas, f => f.sub));
            if (pr.tipo === '2DO_MITAD') { const f = filas.find(f => f.productoId == pr.productoId && f.cant >= 2); if (f) { f.desc = Math.floor(f.cant / 2) * f.precio * 0.5; f.nota = '2.º a mitad'; } }
            if (pr.tipo === 'MAYOREO') { const fs = filas.filter(f => f.cat == pr.categoriaId); if (suma(fs, f => f.cant) >= 3) fs.forEach(f => { f.desc = f.cant * (f.precio - f.mayoreo); f.nota = 'Mayoreo'; }); }
            if (pr.tipo === 'GRATIS') { const p = DB.buscar('productos', pr.productoId); filas.push({ productoId: p.id, nombre: p.nombre + ' (GRATIS)', cat: p.categoriaId, cant: 1, precio: 0, mayoreo: 0, sub: 0, desc: 0, nota: 'Gratis', gratis: true }); }
        }
        const subtotal = suma(filas, f => f.sub);
        let descuento = vale + suma(filas, f => f.desc), puntosUsados = 0;
        if (this.usarPuntos && this.cliente) { puntosUsados = Math.min(this.cliente.puntos, subtotal - descuento); descuento += puntosUsados; } // 1 punto = Q1
        return { filas, subtotal, descuento, total: subtotal - descuento, puntosUsados };
    }

    static cobrar({ tipo, recibido, ref }) {
        const caja = CajaService.abierta();
        if (!caja) throw new Error('Debe abrir la caja primero');
        if (!this.lineas.length) throw new Error('No hay productos en la venta');
        const d = this.detalle();
        if (tipo === 'EFECTIVO' && recibido < d.total) throw new Error('El monto recibido es insuficiente');
        d.filas.forEach(f => { DB.buscar('productos', f.productoId).stock -= f.cant; });
        const cli = this.cliente;
        const venta = DB.insertar('ventas', {
            fecha: ahora(), cajaId: caja.id, clienteId: cli?.id ?? null, lineas: d.filas, subtotal: d.subtotal,
            descuento: d.descuento, total: d.total, pago: { tipo, recibido, ref }, promoId: this.promo?.id ?? null
        });
        if (cli) {
            cli.puntos -= d.puntosUsados;
            if (this.promo?.tipo === 'PUNTOS') cli.puntos += suma(d.filas.filter(f => f.cat == this.promo.categoriaId), f => f.cant) * this.promo.puntos;
        }
        if (this.qrFactura) this.qrFactura.qrUsado = true;
        const factura = FacturacionService.emitir(venta, cli);
        DB.guardar(); this.reset();
        return { venta, factura, cambio: tipo === 'EFECTIVO' ? recibido - d.total : 0 };
    }
}

// ---- Devoluciones (daño o vencimiento) ----
export class DevolucionService {
    static registrar({ numero, productoId, cant, motivo }) {
        const f = DB.todos('facturas').find(x => x.numero === numero);
        if (!f) throw new Error('Factura no encontrada');
        const v = DB.buscar('ventas', f.ventaId), l = v.lineas.find(x => x.productoId == productoId);
        if (!l) throw new Error('El producto no pertenece a la factura');
        const previas = suma(DB.todos('devoluciones').filter(d => d.facturaId == f.id && d.productoId == productoId), d => d.cant);
        if (cant < 1 || cant > l.cant - previas) throw new Error(`Cantidad inválida (máximo ${l.cant - previas})`);
        // Daño o vencimiento = baja: el producto NO regresa al inventario
        return DB.insertar('devoluciones', {
            fecha: ahora(), facturaId: f.id, numero, productoId: l.productoId, nombre: l.nombre, cant, motivo,
            monto: cant * (l.sub - l.desc) / l.cant, usuarioId: AuthService.usuario().id
        });
    }
}

// ---- Compras (ingreso de existencias) ----
export class CompraService {
    static registrar({ proveedorId, productoId, cant, costo }) {
        const p = DB.buscar('productos', productoId); p.stock += cant;
        return DB.insertar('compras', { fecha: ahora(), proveedorId, productoId, nombre: p.nombre, cant, costo, total: cant * costo });
    }
}

// ---- Avisos ----
export class AlertaService {
    static lista() {
        const out = [];
        DB.todos('productos').forEach(p => {
            if (p.stock <= p.stockMin) out.push({ t: 'warning', m: `Stock bajo: ${p.nombre} (${p.stock})` });
            if (p.vence && (new Date(p.vence) - Date.now()) / 864e5 <= 30) out.push({ t: 'danger', m: `Por vencer: ${p.nombre} (${p.vence})` });
        });
        return out;
    }
}