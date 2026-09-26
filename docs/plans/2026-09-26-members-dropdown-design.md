# Diseño: Sección "Miembros" en el dropdown del Navbar

**Fecha:** 2026-09-26
**Estado:** Aprobado
**Contexto:** Tras `2026-09-26-memberships-dropdown-design.md`, el dropdown ya tiene
secciones de empresas y códigos. Se agrega una sección de miembros.

## Requisito
En el dropdown, mostrar **avatar + nombre** de:
- **Dueño**: todos los miembros de la empresa activa (él primero, con badge "Dueño";
  badge "Tú" si coincide con el usuario).
- **Miembro/invitado**: solo el owner de la empresa activa (badge "Dueño").

## Datos
- `getUsersByEnterprise(enterprise.id)` (ya existe en `userService`): query
  `where("enterpriseId", "==", activa)` — reglas ya la permiten (rama `resource.data.enterpriseId == myEnterpriseId()`); **sin cambios de reglas ni de datos**.
- Orden (dueño): primero el `ownerId`, luego el resto alfabético por `displayName`.
- Miembro: filtra `uid === enterprise.ownerId`.
- Avatar: `photoURL` → `<img>`; null → div circular con la inicial del
  `displayName` (fondo graphite-700, color tuscan-sun-400).

## UI
Nueva sección **"Miembros"** entre *Donde participo* y *Acciones*:
```
header: Miembros (mismo estilo de headers existentes)
fila:   [avatar 24px] nombre (truncate) + badge "Dueño" / "Tú"
```
- No se muestra la sección si la lista queda vacía.
- Una sola petición por apertura del dropdown (fetch en effect con `showDropdown` en
  deps, igual que `activeInvites`); `console.error` silencioso en fallo.
- Strings sin acentos (repo convention): "Miembros", "Dueño", "Tu".

## Sin cambios (YAGNI)
- Sin email, cargo extra, acciones sobre miembros, tiempo real, ni paginación.
