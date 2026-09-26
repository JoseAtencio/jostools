# Diseño: Modal de miembro + eliminación de miembros (solo dueño)

**Fecha:** 2026-09-26
**Estado:** Aprobado
**Contexto:** Seguimiento de `2026-09-26-members-dropdown-design.md`. Al hacer click en
una fila de "Miembros" del dropdown se abre un modal con la info del miembro; el
dueño puede eliminarlo, el miembro solo mira.

## UI — `MemberModal.tsx` (componente nuevo, estilo CloseEventModal)

- Props: `member: AppUser`, `enterpriseId: string`, `isOwnerViewer: boolean`
  (el dueño viendo), `canRemove: boolean` (dueño && `member.uid !== enterprise.ownerId`
  — la fila del propio dueño no ofrece eliminar), `onRemoved: () => void`, `onClose: () => void`
- Contenido: avatar grande (48px, img o inicial), `displayName`, `email`, badge de
  rol (**Dueño** si `member.uid === enterprise.ownerId`, si no **Miembro**).
- **Dueño (y no es su fila)**: botón rojo "Eliminar de la empresa" (raspberry-red) →
  segundo paso dentro del mismo modal: "Esto quita a <nombre> de la empresa y de su
  historial. Podra unirse de nuevo con un codigo nuevo." + botón "Si, eliminar"
  (confirmación, loading) + "Cancelar".
- **Miembro que ve / fila del dueño**: sin acciones, solo info + botón Cerrar.
- Errores del delete dentro del modal (raspberry-red, estilo existente).

## Datos / servicio (userService)

`removeMemberFromEnterprise(targetUid: string, enterpriseId: string)`:
1. `getDoc(target)` — lectura permitida (la empresa activa del objetivo es la del dueño).
2. `memberships` del doc (o `[]`), filtrando `id !== enterpriseId`.
3. `setDoc(targetRef, { enterpriseId: null, memberships }, { merge: true })`.
   No toca `role` ni ningún otro campo.

## Reglas (`firestore.rules`, rama nueva en `users` update)

Rama de expulsión, hermana de la condición `request.auth.uid == uid` (o sea:
`allow update: if isSignedIn() && ( (uid propio y las 5 ramas actuales) || (expulsión) )`):

```
(request.auth.uid != uid
 && resource.data.enterpriseId is string
 && get(/databases/.../enterprises/$(resource.data.enterpriseId)).data.ownerId == request.auth.uid
 && request.resource.data.enterpriseId == null
 && request.resource.data.memberships == resource.data.get('memberships', []).removeAll([resource.data.enterpriseId])
 && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["enterpriseId", "memberships"]))
```

Garantías: solo el dueño de la empresa activa del objetivo; solo cambian
`enterpriseId` (→ null) y `memberships` (exactamente sin ese id); doc legado sin
`memberships` tolerado con `.get(..., [])`.

## Tests emulador (agregar a la suite existente en Temp)

| # | Escenario | Esperado |
|---|---|---|
| 1 | Dueño elimina miembro (enterpriseId→null, memberships sin el id) | ALLOW |
| 2 | No-dueño intenta lo mismo | DENY |
| 3 | Dueño pero tocando un campo extra (ej. email) | DENY |
| 4 | Dueño pone null pero NO quita el id de memberships | DENY |
| 5 | Doc legado sin memberships: enterpriseId→null con memberships [] | ALLOW |
| 6 | Dueño intenta cambiar enterpriseId a OTRA empresa (no null) | DENY |
| 7 | Regresión: el dueño sigue sin poder editar otros campos de miembros (rama previa) | DENY |
| 8 | Regresión: usuario sigue sin poder editar su propio doc fuera de las ramas | igual que antes |

Luego: `firebase deploy --only firestore:rules --project inventi-e1724`.

## Efectos / límites conocidos
- El dueño ve la lista al instante (refetch tras eliminar; miembro desaparece de la query).
- El expulsado en sesión abierta verá errores hasta recargar; al recargar,
  AuthListener + AuthGuard lo llevan a `/setup` (enterpriseId null).
- Puede re-unirse con un código nuevo (invite sin cambios).
- Sin cambios en códigos, dashboard, ni otras colecciones.

## YAGNI
- Sin "expulsar con motivo", sin notificaciones, sin historial de expulsiones,
  sin prohibir re-uniéndose.
