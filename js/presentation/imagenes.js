// Imágenes reales de productos.
// Prioridad: foto subida en el catálogo > foto local (opcional) > foto de Wikipedia (API gratuita, sin clave)

// Ponga true si guarda fotos en img/productos/<codigo>.jpg (ej. img/productos/1001.jpg)
const FOTOS_LOCALES = false;

const CLAVE = 'lce_imgs_v1';
let cache = {}; // término de búsqueda -> URL de la foto ('' = no se encontró)
try { cache = JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch { }
const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(cache)); } catch { } };

// Qué buscar en Wikipedia según el nombre del producto (se revisan en orden)
const BUSQUEDAS = [
    [/corbat/i, 'Farfalle'], [/spag|espag/i, 'Espagueti'], [/fideo|pasta|macarr/i, 'Pasta'],
    [/pechuga|pollo/i, 'Pechuga de pollo'], [/costilla/i, 'Costilla de cerdo'], [/cerdo|carne/i, 'Carne de cerdo'],
    [/jam[oó]n/i, 'Jamón cocido'], [/longaniza/i, 'Longaniza'], [/salchicha|chorizo/i, 'Salchicha'],
    [/crema/i, 'Crema de leche'], [/leche|yogur/i, 'Leche'], [/queso/i, 'Queso fresco'],
    [/chocolate/i, 'Chocolate'], [/dulce|golosina|caramelo|gomita/i, 'Caramelo'],
    [/gatorade|isot|revive|energ/i, 'Bebida isotónica'],
    [/gaseosa|soda|refresco|cola/i, 'Bebida gaseosa'], [/agua/i, 'Agua carbonatada']
];
const FONDOS = ['#fff3d6,#ffe0a3', '#ffe1dc,#ffb8ad', '#ffe3ec,#ffbcd1', '#e8f4ff,#bfdcff', '#f3e6ff,#d8b8ff', '#e0f7fa,#a6e9f0', '#e7f8e8,#b5e8b8'];
const termino = p => p.imgQ || (BUSQUEDAS.find(([r]) => r.test(p.nombre)) || [])[1] || p.nombre;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Búsqueda en Wikipedia (una sola petición por término, aunque lo pidan varios productos a la vez)
const pendientes = new Map();
const buscar = q => {
    if (q in cache) return Promise.resolve(cache[q]);
    if (pendientes.has(q)) return pendientes.get(q);
    const url = 'https://es.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search'
        + `&gsrsearch=${encodeURIComponent(q)}&gsrlimit=6&prop=pageimages&piprop=thumbnail&pithumbsize=400`;
    const pr = fetch(url).then(r => { if (!r.ok) throw new Error('HTTP'); return r.json(); }).then(j => {
        const pags = Object.values(j.query?.pages || {})
            .filter(x => x.thumbnail && !/\.svg/i.test(x.thumbnail.source)) // se descartan diagramas
            .sort((a, b) => a.index - b.index);
        cache[q] = pags[0]?.thumbnail.source || '';
        guardar(); return cache[q];
    }).catch(() => null) // sin internet: no se guarda, se reintenta después
        .finally(() => pendientes.delete(q));
    pendientes.set(q, pr); return pr;
};

// tam: 'sm' (tablas) · 'md' (listas) · 'lg' (tarjetas del punto de venta)
export const imgProd = (p, tam = 'md') => {
    if (!p) return '';
    const fondo = FONDOS[(p.categoriaId - 1) % FONDOS.length] || FONDOS[0], q = termino(p);
    const src = p.foto || (FOTOS_LOCALES ? `img/productos/${encodeURIComponent(p.codigo)}.jpg` : '') || cache[q] || '';
    const busca = !p.foto && !(q in cache) ? ` data-q="${esc(q)}"` : ''; // el observador completa la foto
    return `<span class="pimg pimg-${tam}" style="background:linear-gradient(135deg,${fondo})"${busca}><i class="bi bi-image pimg-i"></i>${src ? `<img src="${esc(src)}" alt="${esc(p.nombre)}" loading="lazy" onerror="this.remove()">` : ''}</span>`;
};

// Completa las fotos que faltan cuando aparecen en pantalla
const hidratar = el => {
    if (el.dataset.ok) return; el.dataset.ok = '1';
    if (el.querySelector('img')) return;
    buscar(el.dataset.q).then(url => {
        if (!url || !el.isConnected) return;
        const im = new Image(); im.alt = ''; im.style.opacity = 0;
        im.onload = () => { im.style.opacity = 1; };
        im.onerror = () => im.remove();
        im.src = url; el.appendChild(im);
    });
};
export function iniciarImagenes() {
    const barrer = n => {
        if (n.nodeType !== 1) return;
        if (n.matches('.pimg[data-q]')) hidratar(n);
        n.querySelectorAll('.pimg[data-q]').forEach(hidratar);
    };
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(barrer))).observe(document.body, { childList: true, subtree: true });
    barrer(document.body);
}

// Reduce la foto subida a 320 px para que quepa en el almacenamiento del navegador
export const comprimirFoto = file => new Promise((ok, mal) => {
    if (!file.type.startsWith('image/')) return mal(new Error('El archivo debe ser una imagen (JPG, PNG o WEBP)'));
    const r = new FileReader();
    r.onerror = () => mal(new Error('No se pudo leer la imagen'));
    r.onload = () => {
        const im = new Image();
        im.onerror = () => mal(new Error('La imagen no es válida'));
        im.onload = () => {
            const k = Math.min(1, 320 / Math.max(im.width, im.height)), c = document.createElement('canvas');
            c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
            c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
            ok(c.toDataURL('image/jpeg', .75));
        };
        im.src = r.result;
    };
    r.readAsDataURL(file);
});