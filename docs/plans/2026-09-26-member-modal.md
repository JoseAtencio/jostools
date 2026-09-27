# Plan: Modal de miembro + eliminación

**Fecha:** 2026-09-26
**Design doc:** `2026-09-26-member-modal-design.md` (aprobado)

Ejecución: 2 tareas secuenciales (subagente implementador + revisión por tarea),
build final, pedir permiso de commit.

---

## Tarea 1 — Servicio + MemberModal + wiring Navbar (TypeScript)

**Archivos:** `apps/web/src/lib/services/userService.ts`,
`apps/web/src/components/MemberModal.tsx` (nuevo),
`apps/web/src/components/Navbar.tsx`

1. **userService**: exportar
   ```ts
   export async function removeMemberFromEnterprise(targetUid: string, enterpriseId: string): Promise<void> {
     const targetRef = doc(usersRef, targetUid);
     const snap = await getDoc(targetRef);
     const prev = snap.exists() && Array.isArray(snap.data()?.memberships)
       ? (snap.data()!.memberships as string[]) : [];
     const memberships = prev.filter((id) => id !== enterpriseId);
     await setDoc(targetRef, { enterpriseId: null, memberships }, { merge: true });
   }
   ```
2. **MemberModal.tsx** (nuevo; leer `CloseEventModal.tsx` y copiar su patrón de
   overlay/tarjeta/header con X):
   - Props: `member: AppUser`, `enterpriseId: string`, `memberIsOwner: boolean`,
     `canRemove: boolean`, `onRemoved: () => void`, `onClose: () => void`
   - Vista base: avatar 48px (`photoURL` → img rounded-full object-cover; si no div
     circular inicial, fondo graphite-700 texto tuscan-sun-400), `displayName`
     (text-lg bold), `email` (text-sm graphite-400), pill de rol: "Dueño"
     (tuscan) / "Miembro" (graphite) según `memberIsOwner`.
   - Si `canRemove`:
     - estado `confirm: boolean`, `loading: boolean`, `error: string | null`
     - botón "Eliminar de la empresa" (raspberry-red, estilo del repo: fondo
       `rgba(224,31,95,0.15)` o sólido según convenga, borde rojo) → `confirm=true`
     - en confirm: texto "Esto quita a <nombre> de la empresa y de su historial.
       Podra unirse de nuevo con un codigo nuevo." + botón "Si, eliminar"
       (rojo, disabled con loading → "Eliminando...") y "Cancelar" (vuelve a la vista)
     - `removeMemberFromEnterprise(member.uid, enterpriseId)` → éxito: `onRemoved()`;
       error: `setError(mensaje)`
   - Si `!canRemove`: solo botón "Cerrar".
   - Sin acciones para miembros (el prop lo controla desde Navbar).
3. **Navbar**:
   - estado `const [selectedMember, setSelectedMember] = useState<AppUser | null>(null)`
   - las filas de "Miembros" pasan de `div` a `button` con
     `onClick={() => setSelectedMember(m)}` (agregar `cursor-pointer` y hover
     `backgroundColor: var(--graphite-700)` consistente con otras filas)
   - render del modal al final del fragmento (junto al modal de invitaciones):
     ```tsx
     {selectedMember && enterprise && (
       <MemberModal
         member={selectedMember}
         enterpriseId={enterprise.id}
         memberIsOwner={selectedMember.uid === enterprise.ownerId}
         canRemove={isOwner && selectedMember.uid !== enterprise.ownerId}
         onRemoved={() => { setSelectedMember(null); setMembersVersion((v) => v + 1); }}
         onClose={() => setSelectedMember(null)}
       />
     )}
     ```
   - el efecto de `enterpriseMembers` debe refrescar tras eliminar: agrega estado
     `membersVersion` y ponlo en las deps del efecto (igual que `invitesVersion`).

**Verificación:** `npx tsc --noEmit` (apps/web).

---

## Tarea 2 — Reglas + tests emulador + deploy

**Archivos:** `firestore.rules` + suite de tests en `C:\Users\Usuario\AppData\Local\Temp\opencode\rules-tests\`

1. Reestructurar `users` update para que la condición de "doc propio" sea una rama
   dentro de un OR con la nueva rama de expulsión:
   ```
   allow update: if isSignedIn() && (
     (request.auth.uid == uid && (<5 ramas actuales intactas>))
     || (request.auth.uid != uid
         && resource.data.enterpriseId is string
         && get(/databases/$(database)/documents/jostools/config/enterprises/$(resource.data.enterpriseId)).data.ownerId == request.auth.uid
         && request.resource.data.enterpriseId == null
         && request.resource.data.memberships == resource.data.get('memberships', []).removeAll([resource.data.enterpriseId])
         && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["enterpriseId", "memberships"]))
   );
   ```
   El resto de reglas sin cambios.
2. Tests (8 casos del design doc, sección "Tests emulador") agregándolos a la suite
   existente (reutiliza su infra; lee las reglas desde el repo). **Todos deben pasar
   (los 48 previos + los nuevos).**
3. Deploy: `firebase deploy --only firestore:rules --project inventi-e1724`
   (solo si todos pasan) → reportar compiled + released.

**Límites:** no tocar TS; no commit.

---

## Tarea final — build + revisión global
- `npm run build` (raíz) + `npx tsc --noEmit`
- Revisión spec/calidad de la feature completa → corregir hallazgos
- Reportar y **pedir permiso antes de commit**
