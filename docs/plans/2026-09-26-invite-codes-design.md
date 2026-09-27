# Diseño: Códigos de invitación de un solo uso

**Fecha:** 2026-09-26
**Estado:** Aprobado
**Contexto:** Tras el aislamiento multi-tenant (ver `PLAN.md`), los usuarios necesitan poder
unirse a una empresa creada por otro usuario mediante un código. El creador es `owner`;
los invitados se unen como `member`. Solo el owner puede generar invitaciones.
Restricción: sin Cloud Functions (plan Spark de Firebase).

## Decisiones del usuario

- El código se ve en el **menú del Navbar** (dropdown, sección "Mis empresas").
- **Un solo uso:** al usarse se marca `used: true` y no sirve más; el owner genera uno nuevo
  cuando lo necesite.
- Un usuario **con empresa** puede usar un código: reemplaza su empresa activa
  (un usuario = una empresa activa a la vez; la empresa anterior sigue existiendo y
  puede volver por el switcher del Navbar).
- **Solo el owner** puede generar y ver códigos (restricción doble capa: UI + reglas).

## Datos

Colección nueva: `jostools/config/invites`

- **Doc ID = el código**: 8 caracteres, A-Z + 0-9 sin `0/O/1/I` (~1 billón de combinaciones;
  el ID del doc es la "clave secreta").
- Campos:
  ```ts
  {
    enterpriseId: string;   // empresa a la que da acceso
    createdBy: string;      // uid del owner que lo generó
    used: boolean;          // false = activo, true = consumido
    usedBy: string | null;  // uid de quien lo usó
    usedAt: Timestamp | null;
    createdAt: Timestamp;
  }
  ```

## Reglas de Firestore (agregar a `firestore.rules`)

```rego
match /jostools/config/invites/{code} {
  allow get: if isSignedIn();                    // conocer el codigo es la clave (joiner)
  allow list: if isSignedIn()                    // solo el CREADOR lista sus codigos
    && resource.data.enterpriseId == myEnterpriseId()
    && resource.data.createdBy == request.auth.uid;
  allow create: if isSignedIn()
    && request.resource.data.used == false
    && request.resource.data.createdBy == request.auth.uid
    && request.resource.data.enterpriseId == myEnterpriseId()
    && get(/databases/$(database)/documents/jostools/config/enterprises/
           $(request.resource.data.enterpriseId)).data.ownerId == request.auth.uid;
  allow update: if isSignedIn()
    && resource.data.used == false                // solo activo -> usado
    && request.resource.data.used == true
    && request.resource.data.enterpriseId == resource.data.enterpriseId
    && request.resource.data.createdBy == resource.data.createdBy
    && request.resource.data.usedBy == request.auth.uid;
  allow delete: if false;
}
```

Doble capa: aunque la UI oculta la sección a los miembros, la BD rechaza la creación
si `enterprises.ownerId != uid`.

## Flujo de unión (transacción atómica)

```
Usuario pega código en /setup -> unirse:
  1. Leer invites/{codigo}
     - no existe          -> error "Código no válido"
     - used == true       -> error "Este código ya fue usado"
  2. runTransaction:
     a. t.update(invites/{codigo}, { used: true, usedBy: uid, usedAt: now })
     b. t.set(users/{uid}, { enterpriseId, role: "member" }, merge)
  3. dispatch(setUser({ enterpriseId, role: "member" })) -> router.push("/")
```

Si dos personas usan el mismo código a la vez, Firestore deja pasar solo a una
(la segunda actualización falla porque `used` ya es `true`).

## UI

### `/setup` — dos pestañas (segmented control, activo en dorado)

- `[Crear mi empresa]` `[Unirse con código]`
- Default: sin empresa → "Crear" (formulario actual intacto); con empresa → "Unirse".
- Pestaña "Unirse":
  - Input de código (maxlength 8, mayúsculas automáticas) + botón **Unirse**.
  - Estados: `Validando...` (disabled), errores inline (`Código no válido`,
    `Este código ya fue usado`, error de red), éxito → dashboard.

### Navbar — dropdown, sección "Invitar miembros" (solo owner)

Debajo de "Mis empresas", solo si `enterprise.ownerId === user.uid`:

| Estado | Muestra |
|---|---|
| Sin código activo | Botón **Generar código** |
| Con código activo | Código (monoespaciado) + **Copiar** + **Generar nuevo** |
| Siempre | Texto "Código de un solo uso" |

- Consulta: `where(enterpriseId == empresaActiva) && where(used == false)` — dos igualdades,
  no requieren índice compuesto.
- Miembros: la sección no se renderiza.

## Errores y edge cases

- Código inexistente / usado / mal formateado → mensajes inline en `/setup`.
- Owner que se une con su propio código → su `role` de usuario pasa a `member`, pero
  `enterprises.ownerId` sigue siendo suyo → las reglas y la UI (ownerId) lo siguen
  tratando como owner; puede seguir generando códigos.
- Empresa anterior del usuario que se une a otra → queda "huérfana" pero sigue siendo suya
  (switcher del Navbar la lista por `ownerId`).
- Colisión de código al generar (1 en ~1 billón) → reintentar generación hasta 3 veces.

## Fuera de alcance (YAGNI)

- Códigos múltiples simultáneos con UI de lista (se muestra solo el activo más reciente).
- Revocar manualmente un código (el owner puede simplemente no compartirlo / usar uno nuevo;
  los códigos sin usar de su empresa no son visibles para otros).
- Membresías múltiples simultáneas (`memberships[]`) — fase futura.
