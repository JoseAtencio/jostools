# Diseño: Historial de membresías + rediseño del dropdown de empresas

**Fecha:** 2026-09-26
**Estado:** Aprobado
**Contexto:** Tras la feature de códigos de invitación (ver
`2026-09-26-invite-codes-design.md`), el usuario pide:
1. Dropdown del Navbar dividido en **"Mis empresas"** (dueño) y **"Donde participo"**
   (miembro) con **historial completo** (no solo la activa) → requiere `memberships[]`.
2. Botones de acción: **Crear otra empresa** y **Unirme con código**.
3. Sección de invitaciones rediseñada: botón **Generar código** que abre un **modal**
   (spinner → código + copiar), **lista** de códigos activos con icono ✅, los códigos
   **usados desaparecen** de la lista, y ya **no se auto-muestra** un código al abrir.

## Datos

### `users/{uid}.memberships: string[]`
- Ids de TODAS las empresas a las que el usuario pertenece (dueño o miembro), en orden
  de incorporación. Se **agrega** (append si no existe) en:
  - `updateUserEnterprise` → creación de empresa y cambio desde el dropdown
  - `consumeInvite` → unirse con código (misma transacción)
  - `saveUser` → nuevo usuario: `[]`; usuarios viejos: se normaliza a `[]` en el primer
    login post-deploy (merge que completa el campo)
- El **rol por empresa NO se almacena**: se deriva (`enterprise.ownerId == uid` → dueño).

### `inviteService.getMyActiveInvites(enterpriseId, uid): Invite[]`
- Reemplaza a `getActiveInvite`: misma query (enterpriseId + createdBy + used==false)
  pero devuelve **todos** los códigos activos propios (orden createdAt desc).
- La query `used == false` hace que los códigos usados **desaparezcan solos** de la
  lista al reabrir el dropdown (requisito del usuario).

## Reglas de Firestore

1. Helper: `isEnterpriseMember(entId)` =
   `entId == myEnterpriseId() || ('memberships' in myUser() && entId in myUser().memberships)`
2. `enterprises` read: `ownerId == uid || isEnterpriseMember(entId)`
   → historial legible (datos básicos: nombre/dirección); **eventos NO** (siguen
   atados a la empresa activa).
3. `users` create: además exige `memberships == []` (o campo ausente tolerado).
4. `users` update — pinning de `memberships`:
   - Rama enterpriseId sin cambio / poner en null: `memberships` debe quedar **igual**
     (tolerando doc legado sin el campo — verificar con `get('memberships', [])` o
     condición `!('memberships' in resource.data)`; se valida en el emulador).
   - Rama owner / join: solo puede **agregarse** el id de la empresa destino:
     `memberships.hasAll([enterpriseId])` y
     `memberships.removeAll(resource.data.memberships).hasOnly([enterpriseId])`.
5. Reglas de `invites` sin cambios (list ya es `createdBy == uid`).

**Validación:** tests con Firestore emulator + rules-unit-testing cubriendo: login de
doc legado, saveUser, clearUserEnterprise, cambio de empresa, unión con código,
inyección de memberships falsos (DENY), lectura de empresa pasada (ALLOW), lectura
de empresa ajena sin membresía (DENY).

## UI — Dropdown del Navbar

```
┌─ Mis empresas ──────────────┐
│ ✓ Transportes ABC            │   ← getEnterprisesByOwner (dueño)
└──────────────────────────────┘
┌─ Donde participo ───────────┐
│   Logística XYZ              │   ← memberships − ids propios; getEnterprise c/u
└──────────────────────────────┘
┌─ Acciones ──────────────────┐
│  [ + Crear otra empresa ]   → /setup?tab=create
│  [ Unirme con codigo ]      → /setup?tab=join
└──────────────────────────────┘
┌─ Invitar miembros (solo dueño) ─┐
│  [ Generar codigo ]              │  → abre MODAL
│  ✅ A2B3C4D5        [copiar]     │  ← getMyActiveInvites
│  ✅ X7K9M2P4        [copiar]     │
│  Codigo de un solo uso           │
└──────────────────────────────┘
```

### Modal de generación
- Overlay oscuro + tarjeta centrada (estilo CloseEventModal del codebase).
- Fase 1 (cargando): spinner + "Generando codigo..."
- Fase 2 (éxito): código en monoespaciado grande + **[Copiar]** + **[Listo]** (cierra)
- Errores: mensaje dentro del modal + [Reintentar] / [Cerrar]
- Al cerrarse: la lista del dropdown recarga (`getMyActiveInvites`)

### `/setup?tab=create|join`
- En mount, leer `window.location.search` → si `tab=create|join` esa pestaña gana
  sobre el default por `enterpriseId` (evitar `useSearchParams` para no requerir
  Suspense).

## Sin cambios (YAGNI)
- No se listan códigos usados (desecho por diseño).
- No hay revocación manual de códigos ni expiración.
- No se muestran eventos del historial de empresas pasadas.
