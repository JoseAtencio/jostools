# PLAN: Aislamiento multi-tenant antes de Vercel

**Fecha:** 2026-08-31
**Objetivo:** Que cada usuario autenticado solo trabaje dentro de su empresa, con seguridad
real en Firestore (no solo filtrado visual en cliente), antes del deploy a producción.

**Decisiones del usuario:**
- `/setup` NO muestra lista de empresas existentes: solo formulario para crear la propia.
  (Invitaciones a miembros en una fase futura.)
- Categorías se mantienen GLOBALES (compartidas entre todas las empresas).
- Las reglas de seguridad se versionan en el repo (`firestore.rules` + `firebase.json`)
  y se despliegan con Firebase CLI.

---

## Estado actual (auditoría)

**Ya implementado:**
- `/setup` con formulario de empresa; `AuthGuard` redirige a `/setup` si el usuario no
  tiene `enterpriseId`.
- `maintenance_events` llevan `enterpriseId` y las queries filtran por empresa
  (`getMaintenanceEvents(enterpriseId)`).
- Usuario guardado en `jostools/config/users/{uid}` con `enterpriseId` y `role`.
- Navbar muestra la empresa actual y permite cambiar entre empresas propias (owner).
- `seedTestEvents` genera eventos solo para la empresa activa.

**Brechas detectadas:**
1. `/setup` mostraba lista de TODAS las empresas con botón "Unirse" → cualquier usuario
   podía entrar a cualquier empresa.
2. No existían reglas de Firestore en el repo → el aislamiento era solo cliente.
3. Un solo campo `enterpriseId` en el usuario (se sobreescribe al cambiar de empresa);
   la estructura futura de invitaciones usará `memberships[]` (fase posterior).

---

## Fase 1 — Eliminar el acceso libre a empresas

**Archivo:** `apps/web/src/app/setup/page.tsx`

- Eliminar la lista de empresas existentes (búsqueda, paginación, botón "Unirse").
- `/setup` queda SOLO con el formulario de creación de empresa.
- Texto: "Crea tu empresa para empezar. Las invitaciones a miembros llegaran pronto."
- Eliminar `handleJoin`, `search`, `page`, `joiningId`, vista "list".
- Eliminar `getAllEnterprises` de `enterpriseService.ts` si queda sin uso.

**Criterio de aceptación:** Usuario nuevo → login → solo ve formulario de su empresa.
No hay interfaz para unirse a otra empresa.

---

## Fase 2 — Seguridad real en Firestore

**Archivos nuevos (raíz del repo):** `firestore.rules`, `firebase.json`

| Colección | Lectura | Escritura |
|---|---|---|
| `jostools/config/users/{uid}` | Solo el propio uid | Solo el propio uid |
| `jostools/config/enterprises/{id}` | Owner o miembro | Solo owner |
| `jostools/config/maintenance_events/{id}` | `resource.data.enterpriseId == enterpriseId del usuario` (via `get(users/{uid})`) | Igual + en create `request.resource.enterpriseId` debe coincidir |
| `jostools/config/categories/*` | Autenticado | Autenticado (globales) |

**Deploy:** `firebase deploy --only firestore:rules` (Firebase CLI).
Antes de sobreescribir, verificar las reglas actuales en la consola de Firebase.

**Criterio de aceptación:** Lectura de `maintenance_events` sin sesión (o de otra empresa)
debe ser denegada.

---

## Fase 3 — Verificación de consistencia

- Todo lo creado lleva `enterpriseId`: eventos, seed, empresa.
- `AuthGuard` bloquea rutas sin `enterpriseId`.
- Prueba: crear empresa A + evento; cambiar a empresa B (Navbar) → B no ve eventos de A.
- `npm run build` sin errores.

---

## Fase 4 — Deploy a Vercel

1. Commit + push de todo el codigo al repo `JoseAtencio/jostools`.
2. Vercel → Import repo con Root Directory: `apps/web` (build `npm run build`, salida `.next`).
3. Agregar 6 env vars `NEXT_PUBLIC_FIREBASE_*` en el dashboard de Vercel.
4. Firebase → Authentication → Authorized domains: agregar `*.vercel.app`.
5. Deploy + smoke test (login, setup, evento, dashboard, Excel).

---

## Fase 5 (posterior, fuera de este plan)

- Invitaciones a miembros por email/código → estructura `memberships[]` en el usuario.
  La estructura actual lo permite agregar sin migración de datos.
