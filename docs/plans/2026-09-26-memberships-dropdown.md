# Plan: Historial de membresías + rediseño del dropdown

**Fecha:** 2026-09-26
**Design doc:** `2026-09-26-memberships-dropdown-design.md` (aprobado)
**Modo:** subagent-driven (implementador + revisión spec + revisión calidad por tarea)

Ejecución en orden; cada tarea se commita solo al final (consultar al usuario).

---

## Tarea A — `userService`: `memberships[]`

**Archivos:** `apps/web/src/lib/services/userService.ts`, `apps/web/src/lib/redux/slices/authSlice.ts`

1. `AppUser` gana `memberships: string[]`.
2. `saveUser`:
   - rama existente: en el merge escribe `memberships: Array.isArray(data.memberships) ? data.memberships : []` (normaliza docs legados) y lo incluye en el return;
   - rama nueva: escribe `memberships: []` y lo incluye en el return.
3. `getUser` y `getUsersByEnterprise`: `memberships: data.memberships || []`.
4. `updateUserEnterprise(uid, enterpriseId, role)`:
   ```ts
   const snap = await getDoc(userRef);
   const existing: string[] = Array.isArray(snap.data()?.memberships) ? snap.data()!.memberships : [];
   const memberships = existing.includes(enterpriseId) ? existing : [...existing, enterpriseId];
   await setDoc(userRef, { enterpriseId, role, memberships }, { merge: true });
   ```
   (append sin duplicar; satisface el pinning de reglas rama owner/join/cambio-por-membresía).
5. `clearUserEnterprise` sin cambios (no toca `memberships`).
6. `authSlice.ts`: tipo del user gana `memberships?: string[]` (opcional para no romper otros `setUser`; el spread en setup/Navbar lo preserva). Verificar que `AuthListener` despacha el `AppUser` completo (incluye memberships tras Tarea A).

**Verificación:** `npx tsc --noEmit` en `apps/web` (o build).

---

## Tarea B — `inviteService`: lista de códigos + membresía en transacción

**Archivos:** `apps/web/src/lib/services/inviteService.ts`

1. Nueva función (NO borrar `getActiveInvite` aún — lo elimina la Tarea D):
   ```ts
   export async function getMyActiveInvites(enterpriseId: string, uid: string): Promise<Invite[]> {
     const q = query(invitesRef,
       where("enterpriseId", "==", enterpriseId),
       where("createdBy", "==", uid),
       where("used", "==", false));
     const snap = await getDocs(q);
     const docs = snap.docs.map((d) => toInvite(d.id, d.data()));
     docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
     return docs;
   }
   ```
2. `consumeInvite`: en la transacción, además leer el doc del usuario y agregar la membresía:
   ```ts
   const userSnap = await t.get(userRef);
   const prev: string[] = Array.isArray(userSnap.data()?.memberships) ? userSnap.data()!.memberships : [];
   const memberships = prev.includes(data.enterpriseId) ? prev : [...prev, data.enterpriseId];
   t.set(userRef, { enterpriseId: data.enterpriseId, role: "member",
     joiningCode: normalized, memberships }, { merge: true });
   ```
   (lecturas antes de escrituras ✓; `t.get(userRef)` es legible — doc propio).

**Verificación:** `npx tsc --noEmit`.

---

## Tarea C — Reglas + tests emulador + deploy

**Archivos:** `firestore.rules` (+ tests temporales en `C:\Users\Usuario\AppData\Local\Temp\opencode\`)

### Cambios en reglas

1. Helper (junto a `myEnterpriseId`):
   ```
   function isEnterpriseMember(entId) {
     return entId == myEnterpriseId()
       || ('memberships' in myUser() && entId in myUser().memberships);
   }
   ```
2. `enterprises` read:
   ```
   allow read: if isSignedIn()
     && (resource.data.ownerId == request.auth.uid || isEnterpriseMember(entId));
   ```
   (lista `where(ownerId==uid)` sigue probada por la 1ª disyuntiva; get de empresa
   pasada/activa por la 2ª.)
3. `users` create: añadir `&& request.resource.data.get('memberships', []) == []`.
   → Si `.get()` no compila en reglas, fallback: `&& request.resource.data.memberships == []`
   (saveUser siempre escribe el campo en create — validado en emulador).
4. `users` update — pinning de `memberships` en CADA rama:
   - **rama sin cambio de enterpriseId**: `&& request.resource.data.get('memberships', []) == resource.data.get('memberships', [])`
   - **rama enterpriseId == null**: misma igualdad.
   - **rama owner (get enterprises ownerId == uid)**:
     `&& request.resource.data.memberships.hasAll([request.resource.data.enterpriseId])`
     `&& request.resource.data.memberships.removeAll(resource.data.memberships).hasOnly([request.resource.data.enterpriseId])`
   - **rama join (invites getAfter)**: mismas dos condiciones.
   - **rama NUEVA — cambio por membresía** (para cambiar a una empresa donde ya eres miembro):
     ```
     || (
       request.resource.data.enterpriseId != null
       && resource.data.get('memberships', []) is list
       && request.resource.data.enterpriseId in resource.data.get('memberships', [])
       && request.resource.data.memberships.hasAll([request.resource.data.enterpriseId])
       && request.resource.data.memberships.removeAll(resource.data.memberships)
            .hasOnly([request.resource.data.enterpriseId])
     )
     ```
     (cuando el id ya estaba, removeAll da `[]` → hasOnly ✓.)
   Nota: docs legados sin `memberships` en resource → `.get(..., [])` devuelve `[]`;
   con igualdad `[] == []` el merge de normalización de `saveUser` pasa.
5. `invites` sin cambios.

### Tests emulador (Firestore emulator + @firebase/rules-unit-testing)

Reutilizar el patrón de los 41 checks de la feature anterior (buscar el archivo de tests
previo en Temp; si no existe, recrear). Casos nuevos/obligatorios:

| # | Escenario | Esperado |
|---|---|---|
| 1 | update tipo saveUser sobre doc legado sin `memberships` (agrega `[]`) | ALLOW |
| 2 | create de usuario con `memberships: []` | ALLOW |
| 3 | create con memberships distinto de [] | DENY |
| 4 | cambiar enterpriseId a empresa propia (append memberships con el id) | ALLOW |
| 5 | cambiar a empresa ajena no presente en memberships | DENY |
| 6 | cambiar a empresa presente en memberships (role member) | ALLOW |
| 7 | enterpriseId unchanged + intentar meter ids falsos en memberships | DENY |
| 8 | clearUserEnterprise (null, memberships intacto) | ALLOW |
| 9 | clearUserEnterprise intentando agregar ids falsos | DENY |
| 10 | join con código válido (transacción real con invite pre/post) — memberships solo agrega el id destino | ALLOW |
| 11 | join intentando agregar ids extra en memberships | DENY |
| 12 | leer empresa pasada (en memberships, no activa) como no-dueño | ALLOW |
| 13 | leer empresa ajena sin membresía | DENY |
| 14 | leer eventos de empresa pasada (no activa) | DENY |
| 15 | lista invites `where(enterpriseId, createdBy, used)` — solo creador propio | ALLOW |
| 16 | regresiones de la feature anterior (owner create invite, miembro no-list, etc.) | igual |

Si el test 1/10 falla por sintaxis `.get()`, aplicar fallback declarado arriba.

### Deploy
`firebase deploy --only firestore:rules --project inventi-e1724` → verificar "compiled" + "released".

---

## Tarea D — Navbar: dropdown + modal de generación

**Archivos:** `apps/web/src/components/Navbar.tsx` (mayor), `inviteService.ts` (borrar `getActiveInvite`)

### Estado nuevo
- `memberEnterprises: Enterprise[]` — memberships − ids propios, fetch con `getEnterprise` (saltar nulls)
- `activeInvites: Invite[]` — `getMyActiveInvites(enterprise.id, user.uid)` cuando `isOwner`
- `inviteModal: { open: boolean; phase: "loading" | "done" | "error"; code?: string; error?: string }`
- `copiedCode: string | null` (por fila)
- Eliminar: `activeInvite`, `generating` (se sustituyen por modal), import de `getActiveInvite`

### Efectos
- memberships → `memberEnterprises`: leer de `user.memberships` (redux; `|| []`), filtrar `id !== enterprise.id` y `!myEnterprises.some(o => o.id === id)`, luego `Promise.all(ids.map(getEnterprise))` y filtrar null. Dependencias: `[user?.memberships (join(",")), myEnterprises, enterprise?.id]` o refetch al abrir dropdown.
- `activeInvites`: cuando `isOwner`, al montar/al cambiar de empresa y **al cerrar el modal** (refresh post-generación).

### Estructura del dropdown (reemplaza el bloque actual)
```
Sección "Mis empresas"       → myEnterprises (actual, con ✓ si activa)
Sección "Donde participo"    → memberEnterprises (badge "Miembro", ✓ si activa;
                                click → handleSwitchEnterprise)
Sección "Acciones"           → botones [ + Crear otra empresa ] y [ Unirme con codigo ]
                                → router.push("/setup?tab=create" | "/setup?tab=join"),
                                  cerrar dropdown
Sección "Invitar miembros"   → solo isOwner:
                                [ Generar codigo ] (abre modal en phase loading)
                                lista de activeInvites: ✅ (icono check svg, verde
                                tipo ash-grey/tuscan) + codigo font-mono + botón copiar
                                (estado copiedCode) ; si lista vacía: texto
                                "No hay codigos activos"
                                pie: "Codigo de un solo uso"
```
- `handleSwitchEnterprise`: calcular `role = ent.ownerId === user.uid ? "owner" : "member"`
  (el resto igual: persistir en redux + reload).

### Modal de generación (estilo CloseEventModal: overlay `fixed inset-0 z-50`,
tarjeta `rounded-2xl border` graphite-900/graphite-700, `stopPropagation`)
- `handleOpenGenerate`: `{open:true, phase:"loading"}` → `createInvite`:
  - éxito → `{open:true, phase:"done", code}`
  - error → `{open:true, phase:"error", error}`
- Fase loading: spinner (svg animate-spin) + "Generando codigo..."
- Fase done: codigo grande font-mono tracking-widest en caja graphite-950 +
  botón [Copiar] (clipboard, feedback "Copiado!") + [Listo] (cierra + refetch lista)
- Fase error: mensaje + [Reintentar] (re-abre loading) + [Cerrar]
- Cerrar (X, overlay, Cancelar) → `refreshActiveInvites()`

**No olvidar:** actualizar header copy si hace falta, y que el botón del dropdown siga
visible igual. Prohibido auto-mostrar un código grande sin lista.

---

## Tarea E — `/setup?tab=` + build final + revisión final

**Archivos:** `apps/web/src/app/setup/page.tsx`

1. En mount (useEffect, sin `useSearchParams`):
   ```ts
   const params = new URLSearchParams(window.location.search);
   const t = params.get("tab");
   if (t === "create" || t === "join") setTab(t);
   ```
2. El efecto actual `if (user?.enterpriseId) setTab("join")` solo aplica cuando
   NO vino `?tab=` (usar un `useRef<boolean>` guard con la prioridad del query param).
3. Build completo: `npm run build` en la raíz del monorepo.
4. Revisión final de feature completa (subagente) → corregir hallazgos.
5. Reportar al usuario; **pedir permiso antes de commit**.
