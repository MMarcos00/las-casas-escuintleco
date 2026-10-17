-- ======================================================================
-- Las Casas del Escuintleco · Esquema relacional (SQLite)
-- 12 tablas, llaves foráneas, restricciones, índices y 2 vistas
-- ======================================================================
PRAGMA foreign_keys = ON;

-- ---------- Seguridad ----------
CREATE TABLE usuarios (
                          id      INTEGER PRIMARY KEY AUTOINCREMENT,
                          usuario TEXT NOT NULL UNIQUE,
                          nombre  TEXT NOT NULL,
                          rol     TEXT NOT NULL CHECK (rol IN ('ADMIN','CAJERO','BODEGA')),
                          hash    TEXT NOT NULL                      -- contraseña cifrada con SHA-256
);

-- ---------- Catálogos ----------
CREATE TABLE categorias (
                            id     INTEGER PRIMARY KEY AUTOINCREMENT,
                            nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE proveedores (
                             id       INTEGER PRIMARY KEY AUTOINCREMENT,
                             nombre   TEXT NOT NULL,
                             nit      TEXT,
                             telefono TEXT
);

CREATE TABLE clientes (
                          id     INTEGER PRIMARY KEY AUTOINCREMENT,
                          nombre TEXT NOT NULL,
                          nit    TEXT NOT NULL UNIQUE,
                          puntos INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE productos (
                           id           INTEGER PRIMARY KEY AUTOINCREMENT,
                           codigo       TEXT NOT NULL UNIQUE,
                           nombre       TEXT NOT NULL,
                           categoria_id INTEGER NOT NULL REFERENCES categorias(id),
                           proveedor_id INTEGER REFERENCES proveedores(id),
                           precio       REAL NOT NULL CHECK (precio >= 0),
                           mayoreo      REAL NOT NULL CHECK (mayoreo >= 0),
                           stock        INTEGER NOT NULL DEFAULT 0,
                           stock_min    INTEGER NOT NULL DEFAULT 0,
                           vence        TEXT,
                           foto         TEXT
);

CREATE TABLE promociones (
                             id           INTEGER PRIMARY KEY AUTOINCREMENT,
                             nombre       TEXT NOT NULL,
                             tipo         TEXT NOT NULL CHECK (tipo IN ('GRATIS','VALE','2DO_MITAD','MAYOREO','PUNTOS')),
                             categoria_id INTEGER REFERENCES categorias(id),
                             producto_id  INTEGER REFERENCES productos(id),
                             monto        REAL,
                             puntos       INTEGER
);

-- ---------- Caja ----------
CREATE TABLE cajas (
                       id            INTEGER PRIMARY KEY AUTOINCREMENT,
                       usuario_id    INTEGER NOT NULL REFERENCES usuarios(id),
                       apertura      TEXT NOT NULL,
                       cierre        TEXT,
                       monto_inicial REAL NOT NULL CHECK (monto_inicial >= 0),
                       monto_final   REAL,
                       esperado      REAL,
                       diferencia    REAL,
                       estado        TEXT NOT NULL CHECK (estado IN ('ABIERTA','CERRADA'))
);

-- ---------- Ventas y facturación ----------
CREATE TABLE ventas (
                        id         INTEGER PRIMARY KEY AUTOINCREMENT,
                        fecha      TEXT NOT NULL,
                        caja_id    INTEGER NOT NULL REFERENCES cajas(id),
                        cliente_id INTEGER REFERENCES clientes(id),        -- NULL = Consumidor Final
                        promo_id   INTEGER REFERENCES promociones(id),
                        subtotal   REAL NOT NULL,
                        descuento  REAL NOT NULL DEFAULT 0,
                        total      REAL NOT NULL CHECK (total >= 0),
                        pago_tipo  TEXT NOT NULL CHECK (pago_tipo IN ('EFECTIVO','DEBITO','CREDITO')),
                        recibido   REAL,
                        referencia TEXT
);

CREATE TABLE detalle_venta (
                               id              INTEGER PRIMARY KEY AUTOINCREMENT,
                               venta_id        INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
                               producto_id     INTEGER NOT NULL REFERENCES productos(id),
                               categoria_id    INTEGER REFERENCES categorias(id),
                               nombre          TEXT NOT NULL,                      -- nombre del producto al momento de la venta
                               cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
                               precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
                               subtotal        REAL NOT NULL,
                               descuento       REAL NOT NULL DEFAULT 0,
                               nota            TEXT NOT NULL DEFAULT '',
                               gratis          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE facturas (
                          id             INTEGER PRIMARY KEY AUTOINCREMENT,
                          numero         TEXT UNIQUE,                         -- se asigna justo después de crear la factura
                          venta_id       INTEGER NOT NULL UNIQUE REFERENCES ventas(id),
                          fecha          TEXT NOT NULL,
                          nit            TEXT NOT NULL,
                          cliente        TEXT NOT NULL,
                          autorizacion   TEXT NOT NULL,
                          total_letras   TEXT NOT NULL,
                          codigo_control TEXT NOT NULL,
                          fecha_limite   TEXT NOT NULL,
                          promo_id       INTEGER REFERENCES promociones(id),
                          vence_qr       TEXT,
                          qr_usado       INTEGER NOT NULL DEFAULT 0,
                          qr             TEXT
);

CREATE TABLE devoluciones (
                              id          INTEGER PRIMARY KEY AUTOINCREMENT,
                              fecha       TEXT NOT NULL,
                              factura_id  INTEGER NOT NULL REFERENCES facturas(id),
                              producto_id INTEGER NOT NULL REFERENCES productos(id),
                              usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
                              cantidad    INTEGER NOT NULL CHECK (cantidad > 0),
                              motivo      TEXT NOT NULL CHECK (motivo IN ('DAÑO','VENCIMIENTO')),
                              monto       REAL NOT NULL
);

-- ---------- Compras ----------
CREATE TABLE compras (
                         id           INTEGER PRIMARY KEY AUTOINCREMENT,
                         fecha        TEXT NOT NULL,
                         proveedor_id INTEGER NOT NULL REFERENCES proveedores(id),
                         producto_id  INTEGER NOT NULL REFERENCES productos(id),
                         cantidad     INTEGER NOT NULL CHECK (cantidad > 0),
                         costo        REAL NOT NULL CHECK (costo >= 0),
                         total        REAL NOT NULL
);

-- ---------- Índices ----------
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_ventas_fecha        ON ventas(fecha);
CREATE INDEX idx_ventas_caja         ON ventas(caja_id);
CREATE INDEX idx_detalle_venta       ON detalle_venta(venta_id);
CREATE INDEX idx_facturas_venta      ON facturas(venta_id);

-- ---------- Vistas (consultas guardadas) ----------
CREATE VIEW v_ventas_por_producto AS
SELECT p.codigo, p.nombre AS producto, SUM(d.cantidad) AS unidades,
       ROUND(SUM(d.subtotal - d.descuento), 2) AS ingresos
FROM detalle_venta d
         JOIN productos p ON p.id = d.producto_id
WHERE d.gratis = 0
GROUP BY p.id
ORDER BY unidades DESC;

CREATE VIEW v_stock_bajo AS
SELECT p.codigo, p.nombre AS producto, c.nombre AS familia, p.stock, p.stock_min
FROM productos p
         JOIN categorias c ON c.id = p.categoria_id
WHERE p.stock <= p.stock_min
ORDER BY p.stock;