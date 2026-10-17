-- ======================================================================
-- Las Casas del Escuintleco · Datos iniciales (ejecutar después de schema.sql)
-- ======================================================================
PRAGMA foreign_keys = ON;

-- Contraseñas guardadas como SHA-256: admin123 · cajero123 · bodega123
INSERT INTO usuarios (usuario, nombre, rol, hash) VALUES
                                                      ('admin',  'Administrador',       'ADMIN',  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'),
                                                      ('cajero', 'Cajero',              'CAJERO', '1ed4353e845e2e537e017c0fac3a0d402d231809b7989e90da15191c1148a93f'),
                                                      ('bodega', 'Encargado de bodega', 'BODEGA', '3e2388e8ceddc313076daab3e4eb98a3feb2c0da2464e9c632eff130483208eb');

INSERT INTO categorias (nombre) VALUES
                                    ('Pastas'), ('Cárnicos'), ('Embutidos'), ('Lácteos'), ('Golosinas'), ('Aguas Gaseosas'), ('Carbonatados');

INSERT INTO proveedores (nombre, nit, telefono) VALUES
                                                    ('Distribuidora Escuintla, S.A.', '9876543-2', '7888-0000'),
                                                    ('Cárnicos del Sur',              '1122334-5', '7777-1111');

INSERT INTO productos (codigo, nombre, categoria_id, proveedor_id, precio, mayoreo, stock, stock_min, vence) VALUES
                                                                                                                 ('1001', 'Fideos corbatitas 400 g', 1, 1,  4.50,  4.00, 50, 10, NULL),
                                                                                                                 ('1002', 'Spaghetti 400 g',         1, 1,  5.00,  4.50, 50, 10, NULL),
                                                                                                                 ('2001', 'Pechuga de pollo (lb)',   2, 2, 14.00, 13.00, 30, 10, date('now', '+5 day')),
                                                                                                                 ('2002', 'Costilla de cerdo (lb)',  2, 2, 16.00, 15.00, 30, 10, date('now', '+6 day')),
                                                                                                                 ('3001', 'Jamón de pavo 200 g',     3, 1, 18.00, 16.50, 25, 10, date('now', '+40 day')),
                                                                                                                 ('3002', 'Longaniza 400 g',         3, 1, 25.00, 23.00, 25, 10, date('now', '+40 day')),
                                                                                                                 ('4001', 'Crema 250 ml',            4, 1,  9.00,  8.00, 30, 10, date('now', '+20 day')),
                                                                                                                 ('4002', 'Queso fresco (lb)',       4, 1, 22.00, 20.00, 20, 10, date('now', '+15 day')),
                                                                                                                 ('5001', 'Chocolate en barra',      5, 1,  6.00,  5.50, 60, 10, date('now', '+200 day')),
                                                                                                                 ('5002', 'Bolsa de dulces',         5, 1, 10.00,  9.00, 40, 10, date('now', '+200 day')),
                                                                                                                 ('6001', 'Agua gaseosa 600 ml',     6, 1,  6.00,  5.50, 80, 10, date('now', '+180 day')),
                                                                                                                 ('6002', 'Agua gaseosa 2 L',        6, 1, 14.00, 13.00, 60, 10, date('now', '+180 day')),
                                                                                                                 ('7001', 'Gatorade 500 ml',         7, 1, 10.00,  9.00, 60, 10, date('now', '+180 day')),
                                                                                                                 ('7002', 'Revive 600 ml',           7, 1,  9.00,  8.00, 60, 10, date('now', '+180 day'));

INSERT INTO clientes (nombre, nit, puntos) VALUES
                                               ('Consumidor Final', 'CF',        0),
                                               ('María López',      '1234567-8', 20);

INSERT INTO promociones (nombre, tipo, categoria_id, producto_id, monto, puntos) VALUES
                                                                                     ('Chocolate gratis',                  'GRATIS',    4,  9,    NULL, NULL),
                                                                                     ('Vale de regalo Q15',                'VALE',      2,  NULL, 15,   NULL),
                                                                                     ('2.º gaseosa 2 L a mitad de precio', '2DO_MITAD', 6,  12,   NULL, NULL),
                                                                                     ('Pastas por mayoreo (3 o más)',      'MAYOREO',   1,  NULL, NULL, NULL),
                                                                                     ('Puntos en carbonatados',            'PUNTOS',    7,  NULL, NULL, 5);