# Diseño: Cache Redux del dropdown (miembros + códigos) con TTL y loading

**Fecha:** 2026-09-26
**Estado:** Aprobado (+ "cuando cargue muestra un loading")

## Problema
Cada apertura del dropdown hacía 1-2 lecturas de Firestore (miembros y, si eres
dueño, códigos). Con el menú abierto varias veces al día =lecturas innecesarias.

## Enfoque (aprobado)
Slice `dropdownDataSlice` con cache en memoria por `enterpriseId` + **TTL 60s** +
**indicador de carga cuando no hay datos aún**.

## Slice `apps/web/src/lib/redux/slices/dropdownDataSlice.ts`

```ts
interface DropdownDataState {
  members: Record<string, { items: AppUser[]; fetchedAt: number }>;
  invites: Record<string, { items: Invite[]; fetchedAt: number }>;
}
```
- Acciones: `setMembers({ enterpriseId, items, fetchedAt })`,
  `setInvites({ enterpriseId, items, fetchedAt })`, `resetDropdownData()`
- `extraReducer`: `logout.fulfilled` (importado de `authSlice` — authSlice no importa
  este slice, no hay ciclo) → limpia todo (los datos son por sesión)
- Registrado en el store existente (`redux/store.ts` o como se llame — verificar)

## Fetch con TTL (Navbar, reemplaza los efectos actuales de `enterpriseMembers` y `activeInvites`)

```
effect [showDropdown, enterprise?.id, ...]:
  if (!showDropdown || !enterprise) return;
  entry = store[enterprise.id]
  if (entry && Date.now() - entry.fetchedAt < 60_000) return;   // 0 lecturas
  set<X>Loading(true)
  fetch(...) → dispatch(setX({enterpriseId, items, fetchedAt: Date.now()}))
  finally set<X>Loading(false)
  guard cancelled
```

### Loading (requisito nuevo)
- Estado local `membersLoading` / `invitesLoading`
- **Sin cache** y fetch en vuelo → sección muestra spinner (`animate-spin` svg, estilo
  del modal de invitaciones) + "Cargando..." en texto graphite-500, filas 0
- **Con cache** → se muestra el cache al instante aunque haya refresh en vuelo
  (sin loading; el dato tiene <60s)
- Secciones siguen ocultas si el resultado final queda vacío

## Invalidación inmediata por acciones propias (sin esperar TTL)
- **Expulsar miembro** (`onRemoved` del MemberModal): refetch ya mismo →
  `dispatch(setMembers(...))` — la víctima desaparece al instante.
- **Generar código / cerrar el modal de invitaciones**: refetch de códigos →
  `dispatch(setInvites(...))`.
- Se **eliminan** los estados `membersVersion` e `invitesVersion` de Navbar
  (reemplazados por el refetch+dispatch directo).

## Sin cambios
- Empresas (activas, propias, membresía): ya no refetchean por apertura; fuera del slice
- Reglas, servicios, MemberModal, setup
- Sin persistencia (redux en memoria, igual que auth)

## Verificación
- `npx tsc --noEmit` + `npm run build`
- Manual: abrir menú 2 veces seguidas sin lecturas (sección no dispara fetch);
  expulsar → desaparece al instante; logout → cache limpio.
