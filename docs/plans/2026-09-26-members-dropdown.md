# Plan: Sección "Miembros" en el dropdown

**Fecha:** 2026-09-26
**Design doc:** `2026-09-26-members-dropdown-design.md` (aprobado)

## Tarea única — Navbar: sección Miembros

**Archivo:** `apps/web/src/components/Navbar.tsx`

1. Estado nuevo: `const [enterpriseMembers, setEnterpriseMembers] = useState<AppUser[]>([])`
   (importar `AppUser` type desde `@/lib/services/userService` — ya se importa
   `updateUserEnterprise` de ahí).
2. Efecto (junto a los demás, mismo patrón que `activeInvites`):
   - deps: `[showDropdown, enterprise?.id, isOwner]`
   - si `!showDropdown || !enterprise` → return (no limpiar; se re-fetch al abrir)
   - `getUsersByEnterprise(enterprise.id)` →:
     - si `isOwner`: ordenar — primero el doc cuyo `uid === enterprise.ownerId`,
       luego resto por `displayName.localeCompare`
     - si no (miembro): filtrar `uid === enterprise.ownerId`
   - guard `cancelled`; errores con `console.error("No se pudieron cargar los miembros", err)`
3. JSX — nueva sección **entre "Donde participo" y "Acciones"**, solo si
   `enterpriseMembers.length > 0`:
   - header `Miembros` (mismo markup/padding de los headers existentes)
   - filas: avatar 24px (`photoURL` → `<img className="w-6 h-6 rounded-full object-cover">`;
     si no → `<div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: "var(--graphite-700)", color: "var(--tuscan-sun-400)" }}>` con la inicial)
   - nombre `text-sm` truncate (color graphite-200)
   - badges a la derecha: `Dueño` (si `uid === enterprise.ownerId`) y `Tú`
     (si `uid === user?.uid`) — `text-[10px]` en pill; "Tú" en tuscan-sun,
     "Dueño" en graphite-500 (o viceversa según estilo existente de badge "Miembro")
   - las filas NO son clicables (div, no button)
4. Strings sin acentos: "Miembros", "Dueño", "Tu" — ojo: el repo usa "Dueño" con ñ
   en textos visibles existentes (setup usa "Propietario"... verificar: en español
   visible se permite ñ; lo que se evita son tildes en ASCII — usar "Dueño" y "Tu"
   sin tilde).

**Verificación:** `npx tsc --noEmit` (apps/web) + `npm run build` (raíz).

**Riesgo a revisar:** la query de `getUsersByEnterprise` debe pasar reglas en list
(misma condición que ya usa el repo — si `list` exige igualdad exacta al enterpriseId
activo está probada; confirmar que `where("enterpriseId","==",X)` con X == activa
es provable — lo es, es la condición literal de la regla).
