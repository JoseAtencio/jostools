# Plan: Cache Redux del dropdown (miembros + códigos)

**Fecha:** 2026-09-26
**Design doc:** `2026-09-26-dropdown-cache-design.md` (aprobado; incluye loading)

## Tarea única — slice + refactor Navbar

**Archivos:** `apps/web/src/lib/redux/slices/dropdownDataSlice.ts` (nuevo),
`apps/web/src/lib/redux/store.ts`, `apps/web/src/components/Navbar.tsx`

### 1. `dropdownDataSlice.ts`
```ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { logout } from "./authSlice";
import type { AppUser } from "@/lib/services/userService";
import type { Invite } from "@/lib/services/inviteService";

interface Cached<T> { items: T[]; fetchedAt: number; }

interface DropdownDataState {
  members: Record<string, Cached<AppUser>>;
  invites: Record<string, Cached<Invite>>;
}

const initialState: DropdownDataState = { members: {}, invites: {} };

const slice = createSlice({
  name: "dropdownData",
  initialState,
  reducers: {
    setMembers(state, action: PayloadAction<{ enterpriseId: string; items: AppUser[]; fetchedAt: number }>) {
      state.members[action.payload.enterpriseId] = { items: action.payload.items, fetchedAt: action.payload.fetchedAt };
    },
    setInvites(state, action: PayloadAction<{ enterpriseId: string; items: Invite[]; fetchedAt: number }>) {
      state.invites[action.payload.enterpriseId] = { items: action.payload.items, fetchedAt: action.payload.fetchedAt };
    },
    resetDropdownData() { return initialState; },
  },
  extraReducers: (builder) => {
    builder.addCase(logout.fulfilled, () => initialState);
  },
});

export const { setMembers, setInvites, resetDropdownData } = slice.actions;
export default slice.reducer;
```
(Import circular: authSlice NO importa este archivo ✓.)

### 2. `store.ts`
```ts
import dropdownDataReducer from "./slices/dropdownDataSlice";
// en combineReducers: auth: authReducer, dropdownData: dropdownDataReducer
```

### 3. `Navbar.tsx` — refactor
- **Quitar**: estados `enterpriseMembers`, `activeInvites`, `membersVersion`,
  `invitesVersion` y sus efectos de fetch.
- **Agregar** (selectors):
  ```ts
  const dropdownData = useAppSelector((s) => s.dropdownData);
  const [membersLoading, setMembersLoading] = useState(false);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [membersFetched, setMembersFetched] = useState(false); // para el loading inicial
  ```
  Nota: en vez de estados extra, usar directamente:
  ```ts
  const cachedMembers = enterprise ? dropdownData.members[enterprise.id] : undefined;
  const cachedInvites = enterprise ? dropdownData.invites[enterprise.id] : undefined;
  ```
- **Efecto miembros** `[showDropdown, enterprise?.id, isOwner]` (y la key del cache
  para re-evaluar tras dispatch — usar `cachedMembers?.fetchedAt ?? 0` como dep):
  1. `if (!showDropdown || !enterprise) return;`
  2. `if (cached && Date.now() - cached.fetchedAt < 60_000) return;` (0 lecturas)
  3. `setMembersLoading(true)` → `getUsersByEnterprise(enterprise.id)` →
     ordena (dueño primero, resto `localeCompare("es")`), filtra owner si miembro
     (la lógica de orden/filtro ACTUAL del efecto se conserva) →
     `dispatch(setMembers({enterpriseId, items, fetchedAt: Date.now()}))`
  4. `.catch(console.error)` + `finally setMembersLoading(false)`; guard `cancelled`
- **Efecto códigos** igual, `getMyActiveInvites` solo si `isOwner`, → `setInvites`.
- **Renders**:
  - Miembros: `membersLoading && !cachedMembers` → fila de carga: spinner
    `animate-spin` svg (copiar el del modal de invitaciones) + "Cargando..." texto
    `text-[10px]` graphite-500. Si `cachedMembers` existe → usa
    `cachedMembers.items` (aunque haya refresh en vuelo). Si no hay cache ni loading
    → sección oculta.
  - Códigos: análogo con `invitesLoading`/`cachedInvites`; dueño: botón "Generar
    codigo" SIEMPRE visible (no depende del cache), lista = `cachedInvites?.items`.
- **Invalidación inmediata**:
  - `onRemoved` del MemberModal: en vez de `setMembersVersion`, hacer
    `refetchMembers()` — extraer una función `loadMembers(force?: boolean)` usada
    por el efecto y por las mutaciones (force = ignora TTL), dispatch directo.
  - `handleCloseInviteModal`: refetch `loadInvites()` (force) en vez de bump de versión.
  - `handleOpenGenerate` success: ya cierra con `handleCloseInviteModal`? (el código
    actual hace setInviteModal done y el cierre con Listo llama handleClose — verificar
    flujo: tras "Listo" → close → force refetch ✓; si no, forzar refetch al done).
- **Límite de concurrencia**: si un fetch ya está en vuelo no lanzar otro
  (ref booleano `membersInFlightRef` / `invitesInFlightRef`).

### Verificación
1. `npx tsc --noEmit` (workdir apps\web)
2. `npm run build` (workdir raíz)
3. Reportar ambos códigos de salida.

**No commit.**
