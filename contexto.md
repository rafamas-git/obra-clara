# ObraClara — Contexto del Proyecto

## Descripción general

ObraClara es una PWA (Progressive Web App) para el control de gastos en obras de construcción. Permite registrar, aprobar y analizar los gastos de una obra, con control de anticipos de caja y seguimiento presupuestario por partidas.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| IA | Claude API (`claude-sonnet-4-6`) vía Edge Function `parse-partidas` |
| PWA | Service Worker con estrategia network-first (cache `obra-clara-v2`) |
| Excel | XLSX.js (lectura multi-hoja con cellStyles) |
| Deploy | (pendiente definir — Vercel / Netlify recomendado) |

---

## Roles de usuario

| Rol | Descripción |
|---|---|
| `director` | Acceso total. Registra anticipos, aprueba/rechaza/anula gastos, gestiona usuarios, partidas y configuración. |
| `constructor` | Registra gastos, ve su historial, accede a Control de Caja (su estado de cuenta). |
| `colaborador` | Igual que constructor: registra gastos y accede a Control de Caja. |
| `observador` | Solo lectura. Ve dashboard y listado de todos los gastos. |

---

## Páginas implementadas

### `/` — Dashboard
- Resumen de presupuesto por partidas: monto presupuestado vs. gastado (aprobado).
- Cada partida es expandible y muestra: **cubicación estimada** (items de presupuesto) y **gastos aprobados** asociados a esa partida.
- Acceso controlable por el director para cada rol (constructor, colaborador, observador) desde Configuración.
- Si el director no ha cargado partidas, muestra pantalla de onboarding con enlace a Configuración.

### `/nuevo-gasto` — Nuevo Gasto
- Formulario completo: descripción, unidad de medida (UMCombobox con catálogo dinámico), cantidad, precio unitario, total, partida y fecha.
- Si UM = **GL** (global), oculta cantidad y precio unitario.
- Si `cantidad × precio_unitario ≠ total` (diferencia > $1), muestra aviso en amber (no bloquea).
- Foto adjunta (captura o galería) subida a Supabase Storage bucket `recibos` (privado).
- Al enviar: director va a `/gastos`, constructor/colaborador van a `/mis-gastos`.

### `/mis-gastos` — Mis Gastos *(constructor)*
- Lista los propios gastos del constructor con filtros de estado y partida.

### `/gastos` — Todos los Gastos *(director, colaborador, observador)*
- Lista todos los gastos del proyecto.
- Filtros superiores rediseñados: **Estado** como pills checkbox multi-selectable (pendiente / aprobado / rechazado / anulado), **Partida** y **Usuario** como selects.
- Botón "Limpiar filtros" aparece cuando hay filtros activos.

### `/aprobaciones` — Aprobaciones *(director)*
- Lista gastos pendientes de aprobación.
- Al revisar cada gasto: muestra comprobante de pago en modal, todos los datos (UM, cantidad, precio unitario), alerta si hay inconsistencia entre cantidad × P.U. y total.
- Flujo de rechazo: textarea inline para motivo antes de confirmar.

### `/gasto/:id` — Detalle de Gasto
- Vista completa del gasto: monto, descripción, partida, fecha, usuario, UM, cantidad, precio unitario, foto adjunta.
- **Director puede editar**: descripción, monto, partida, fecha (campos editables inline).
- **Director puede anular**: cambia `estado = 'anulado'`, excluye del cálculo pero mantiene registro.
- Badge de estado con variante `anulado` (texto tachado en gris).

### `/caja` — Control de Caja *(director, constructor, colaborador)*
- **Director**: ve anticipos entregados a constructores y colaboradores, saldo por usuario (anticipado vs. rendido), progreso visual en barra, balance total de caja. Puede registrar nuevos anticipos.
- **Constructor / Colaborador**: ve su propio estado de cuenta (anticipos recibidos, gastos rendidos, saldo).
- "Rendido" solo contabiliza gastos de constructores y colaboradores (excluye gastos del director).
- Filtro por usuario receptor con indicador de rol entre paréntesis.

### `/admin` — Usuarios *(director)*
- Gestión de usuarios: crear, activar/desactivar, cambiar rol.

### `/perfil` — Mi Perfil *(todos)*
- Edición de nombre y contraseña.

### `/configuracion` — Configuración *(director)*
- **Partidas del presupuesto**: listado con edición inline y archivado. Importación masiva desde Excel con procesamiento por IA (Edge Function `parse-partidas`). Preview editable antes de confirmar importación.
- **Permisos de acceso**: toggle por rol (constructor, colaborador, observador) para habilitar/deshabilitar el Dashboard.
- **Zona de reinicio**: elimina todos los gastos o resetea toda la data con modal de confirmación doble.

---

## Base de datos — Migraciones aplicadas

| Archivo | Contenido |
|---|---|
| `schema.sql` | Esquema base: tablas `profiles`, `gastos`, `partidas`, `items_partida`, `anticipos`, `configuracion`. RLS habilitado. |
| `migration_v2.sql` | Mejoras iniciales de RLS y políticas. |
| `migration_v3.sql` | Tabla `anticipos` y políticas asociadas. |
| `migration_v4.sql` | Ajustes de permisos para director en aprobaciones. |
| `migration_v5.sql` | Ajustes menores de políticas. |
| `migration_v6.sql` | Políticas UPDATE e INSERT para director en tabla `gastos`. |
| `migration_v7.sql` | Nuevas columnas en `gastos`: `cantidad`, `unidad_medida`, `precio_unitario`. Tabla `unidades_medida` con catálogo semilla. |
| `migration_v8.sql` | Columnas de permisos en `configuracion`: `dash_constructor`, `dash_colaborador`, `dash_observador`. |
| `migration_v9.sql` | Permite `'anulado'` en CHECK constraint de `gastos.estado`. Recrea política UPDATE del director con `WITH CHECK (TRUE)`. |

---

## Componentes UI reutilizables

| Componente | Descripción |
|---|---|
| `Button` | Con variantes y estado `loading`. |
| `Input`, `Select`, `Textarea` | Inputs con label integrado. |
| `Modal` | Modal genérico con overlay. |
| `Badge` | Estado de gasto con variantes: pendiente, aprobado, rechazado, anulado. |
| `Toast` | Notificaciones flotantes. `useToast()` retorna la función directamente. |
| `LoadingSpinner` | Spinner con opción `fullScreen`. |
| `UMCombobox` | Combobox con filtro y opción "Agregar X" para persistir nuevas unidades al catálogo. |
| `ProgressBar` | Barra de progreso reutilizable. |
| `PhotoCapture` | Captura o selección de foto para adjuntar a gasto. |
| `ExpenseCard` | Tarjeta de gasto en listados. |

---

## Decisiones de arquitectura relevantes

- **Budget eliminado**: la página de Presupuesto fue consolidada. El Dashboard es la única vista de monitoreo; la gestión de partidas vive en Configuración.
- **`useToast()` retorna función**: `const toast = useToast()` — no desestructurar como objeto.
- **`gastosConstr` en Control de Caja**: el monto "rendido" filtra por `receptorIds` (constructores + colaboradores) para excluir gastos del director.
- **UMCombobox**: usa `onMouseDown` con `preventDefault` para evitar blur antes de selección.
- **Permisos dinámicos**: `canAccess(seccion)` en AuthContext consulta `configuracion` en BD. Director siempre tiene acceso total.

---

## Tag de referencia

- `v1.0-con-presupuesto` — Checkpoint anterior a la eliminación de la página Presupuesto. Incluye Budget.jsx funcional con todas las features.

---

## Pendientes

- [ ] **Definir plataforma de deploy** (Vercel / Netlify) y configurar variables de entorno de producción.
- [ ] **Confirmar nombre de la obra** en `configuracion.nombre_obra` — actualmente no se usa en la UI (está disponible en AuthContext como `nombreObra`).
- [ ] **Anulado en `mis-gastos`**: el filtro de estado en `/mis-gastos` puede no incluir aún la opción "Anulado" si fue copiado antes de agregar esa variante.
- [ ] **Reportes / exportación**: no existe aún exportación a Excel ni PDF de gastos o resumen de caja.
- [ ] **Notificaciones push**: el Service Worker está configurado pero no hay lógica de push notifications (ej. avisar al director cuando llega un gasto pendiente).
- [ ] **Edge Function `parse-partidas`**: validar comportamiento cuando el Excel tiene formatos no estándar o columnas en otro orden.
- [ ] **Foto en edición de gasto**: el director puede editar descripción/monto/partida/fecha pero no puede cambiar la foto adjunta desde ExpenseDetail.
- [ ] **Paginación**: las listas de gastos, anticipos y usuarios no tienen paginación — puede volverse lento con muchos registros.
