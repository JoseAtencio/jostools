# Invite Codes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agregar códigos de invitación de un solo uso para unirse a la empresa de otro usuario (owner genera, miembro se une).

**Architecture:** Colección `jostools/config/invites` donde el ID del doc es el código (8 chars). El owner los genera desde el dropdown del Navbar; el invitado los consume en `/setup` con una transacción de Firestore que marca el código como usado y escribe `enterpriseId + role: "member"` en el usuario. Sin Cloud Functions (plan Spark).

**Tech Stack:** Next.js 16, Firebase Web SDK v9 modular, Firestore rules, Redux Toolkit.

**Verificación:** No hay framework de tests en el repo → cada task se verifica con `npm run build` (TypeScript) + prueba manual indicada. Design doc: `docs/plans/2026-09-26-invite-codes-design.md`.

---

### Task 1: Servicio de invites

**Files:**
- Create: `apps/web/src/lib/services/inviteService.ts`

**Step 1: Crear el servicio completo**

```ts
import {
  collection, doc, getDoc, setDoc, runTransaction, query, where, getDocs, limit, Timestamp,
} from "@firebase/firestore";
import { db } from "@jostools/firebase-config";

const invitesRef = collection(db, "jostools", "config", "invites");
const usersRef = collection(db, "jostools", "config", "users");

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0 O 1 I
const CODE_LENGTH = 8;

export interface Invite {
  code: string;
  enterpriseId: string;
  createdBy: string;
  used: boolean;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
}

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function toInvite(id: string, data: FirebaseFirestore.DocumentData): Invite {
  return {
    code: id,
    enterpriseId: data.enterpriseId,
    createdBy: data.createdBy,
    used: data.used,
    usedBy: data.usedBy ?? null,
    usedAt: data.usedAt?.toDate?.()?.toISOString() ?? null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  };
}

export async function createInvite(enterpriseId: string, uid: string): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = randomCode();
    const ref = doc(invitesRef, code);
    try {
      const existing = await getDoc(ref);
      if (existing.exists()) continue;
      await setDoc(ref, {
        enterpriseId,
        createdBy: uid,
        used: false,
        usedBy: null,
        usedAt: null,
        createdAt: Timestamp.now(),
      });
      return code;
    } catch (e) {
      lastError = e;
      break; // permission-denied no se resuelve reintentando
    }
  }
  throw new Error(
    lastError instanceof Error ? lastError.message : "No se pudo generar el codigo"
  );
}

export async function getActiveInvite(enterpriseId: string): Promise<Invite | null> {
  const q = query(
    invitesRef,
    where("enterpriseId", "==", enterpriseId),
    where("used", "==", false),
    limit(10)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docs = snap.docs.map((d) => toInvite(d.id, d.data()));
  docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return docs[0];
}

export async function consumeInvite(code: string, uid: string): Promise<string> {
  const normalized = code.trim().toUpperCase();
  const ref = doc(invitesRef, normalized);
  return runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) throw new Error("Codigo no valido");
    const data = snap.data();
    if (data.used) throw new Error("Este codigo ya fue usado");
    t.update(ref, { used: true, usedBy: uid, usedAt: Timestamp.now() });
    const userRef = doc(usersRef, uid);
    t.set(userRef, { enterpriseId: data.enterpriseId, role: "member" }, { merge: true });
    return data.enterpriseId as string;
  });
}
```

**Step 2: Verificar build**

Run: `npm run build`
Expected: ✓ Compiled successfully (en la raíz del workspace)

---

### Task 2: Reglas de Firestore + deploy

**Files:**
- Modify: `firestore.rules` (agregar el bloque `invites` antes del catch-all)

**Step 1: Agregar reglas**

```rego
    match /jostools/config/invites/{code} {
      allow read: if isSignedIn();
      allow create: if isSignedIn()
        && request.resource.data.used == false
        && request.resource.data.createdBy == request.auth.uid
        && request.resource.data.enterpriseId == myEnterpriseId()
        && get(/databases/$(database)/documents/jostools/config/enterprises/$(request.resource.data.enterpriseId)).data.ownerId == request.auth.uid;
      allow update: if isSignedIn()
        && resource.data.used == false
        && request.resource.data.used == true
        && request.resource.data.enterpriseId == resource.data.enterpriseId
        && request.resource.data.usedBy == request.auth.uid;
      allow delete: if false;
    }
```

**Step 2: Deploy de rules**

Run: `firebase deploy --only firestore:rules --project inventi-e1724`
Expected: `+ cloud.firestore: rules file firestore.rules compiled successfully` y `released rules`

---

### Task 3: `/setup` con pestañas Crear / Unirse

**Files:**
- Modify: `apps/web/src/app/setup/page.tsx`

**Step 1: Imports y estado de pestaña**

Agregar imports: `useEffect` de react, `consumeInvite` de `@/lib/services/inviteService`.
Estado nuevo:

```ts
const [tab, setTab] = useState<"create" | "join">("create");
const [code, setCode] = useState("");
const [joining, setJoining] = useState(false);
const [joinError, setJoinError] = useState<string | null>(null);

useEffect(() => {
  setTab(user?.enterpriseId ? "join" : "create");
}, [user?.enterpriseId]);
```

**Step 2: Handler de unión**

```ts
const handleJoin = async (e: React.FormEvent) => {
  e.preventDefault();
  setJoinError(null);
  if (code.length !== 8) {
    setJoinError("El codigo tiene 8 caracteres");
    return;
  }
  if (!user) {
    setJoinError("Debes iniciar sesion");
    return;
  }
  setJoining(true);
  try {
    const enterpriseId = await consumeInvite(code, user.uid);
    dispatch(setUser({ ...user, enterpriseId, role: "member" }));
    router.push("/");
  } catch (err) {
    setJoinError(err instanceof Error ? err.message : "Error al unirse");
  } finally {
    setJoining(false);
  }
};
```

**Step 3: Segmented control + pestaña Join**

Encima del `<h2>Datos de la Empresa</h2>`, agregar selector (estilo consistente con quick
filters: activo `backgroundColor: var(--tuscan-sun-500)`, texto `var(--graphite-950)`):

```tsx
<div className="flex gap-2 mb-6">
  <button type="button" onClick={() => setTab("create")} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{
    backgroundColor: tab === "create" ? "var(--tuscan-sun-500)" : "var(--graphite-800)",
    color: tab === "create" ? "var(--graphite-950)" : "var(--graphite-400)",
  }}>Crear mi empresa</button>
  <button type="button" onClick={() => setTab("join")} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{
    backgroundColor: tab === "join" ? "var(--tuscan-sun-500)" : "var(--graphite-800)",
    color: tab === "join" ? "var(--graphite-950)" : "var(--graphite-400)",
  }}>Unirse con codigo</button>
</div>
```

Cuando `tab === "join"`, renderizar en lugar del form de creación:

```tsx
<form onSubmit={handleJoin} className="rounded-2xl border p-8" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
  <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--graphite-100)" }}>Unirse a una empresa</h2>
  <p className="text-sm mb-6" style={{ color: "var(--graphite-500)" }}>
    Pide el codigo de invitacion a tu jefe (solo puede generarlos el propietario de la empresa).
  </p>
  {joinError && (
    <div className="mb-6 p-4 rounded-xl text-sm" style={{ color: "var(--raspberry-red-400)", backgroundColor: "rgba(224, 31, 95, 0.1)", border: "1px solid rgba(224, 31, 95, 0.2)" }}>
      {joinError}
    </div>
  )}
  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>Codigo de invitacion</label>
  <input
    type="text"
    value={code}
    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
    placeholder="Ej: A2B3C4D5"
    maxLength={8}
    className="w-full px-4 py-3 rounded-xl text-sm text-center font-mono tracking-[0.3em] outline-none mb-6"
    style={inputStyle}
    autoFocus
  />
  <button type="submit" disabled={joining || code.length !== 8} className="w-full py-3 px-6 rounded-xl font-medium transition-all disabled:opacity-50 cursor-pointer" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>
    {joining ? "Validando..." : "Unirse"}
  </button>
</form>
```

Envolver el form de creación existente en `{tab === "create" && (...)}`.

**Step 4: Verificar build**

Run: `npm run build`
Expected: ✓ sin errores de TypeScript

**Step 5: Prueba manual**

1. Generar código con el owner (requiere Task 4 hecho) o pedir a otro usuario.
2. Con otra cuenta (o tras "Olvidar mi empresa" en `/test-firebase`): `/setup` → pestaña
   "Unirse con código" → pegar código → verificar que entra al dashboard de la empresa.
3. Intentar reusar el mismo código → error "Este codigo ya fue usado".

---

### Task 4: Navbar — sección "Invitar miembros" (solo owner)

**Files:**
- Modify: `apps/web/src/components/Navbar.tsx`

**Step 1: Imports y estado**

```ts
import { createInvite, getActiveInvite, type Invite } from "@/lib/services/inviteService";
```

Dentro del componente:

```ts
const [activeInvite, setActiveInvite] = useState<Invite | null>(null);
const [generating, setGenerating] = useState(false);
const [copied, setCopied] = useState(false);
const isOwner = !!enterprise && enterprise.ownerId === user?.uid;

useEffect(() => {
  if (!isOwner || !enterprise) { setActiveInvite(null); return; }
  getActiveInvite(enterprise.id).then(setActiveInvite);
}, [isOwner, enterprise?.id]);
```

**Step 2: Handlers**

```ts
const handleGenerateInvite = async () => {
  if (!enterprise || !user) return;
  setGenerating(true);
  try {
    await createInvite(enterprise.id, user.uid);
    setActiveInvite(await getActiveInvite(enterprise.id));
  } catch (err) {
    alert(err instanceof Error ? err.message : "No se pudo generar el codigo");
  } finally {
    setGenerating(false);
  }
};

const handleCopyInvite = async () => {
  if (!activeInvite) return;
  try {
    await navigator.clipboard.writeText(activeInvite.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    alert("No se pudo copiar. Codigo: " + activeInvite.code);
  }
};
```

**Step 3: JSX de la sección (después del bloque "Mis empresas", dentro del dropdown)**

```tsx
{isOwner && (
  <div className="p-2" style={{ borderTop: "1px solid var(--graphite-700)" }}>
    <p className="text-[10px] font-bold uppercase tracking-wider px-2 py-1" style={{ color: "var(--graphite-500)" }}>Invitar miembros</p>
    {activeInvite ? (
      <div className="px-2 py-1">
        <p className="font-mono text-sm font-bold mb-2 text-center" style={{ backgroundColor: "var(--graphite-900)", color: "var(--tuscan-sun-400)", border: "1px solid var(--graphite-700)", borderRadius: "0.5rem", padding: "0.5rem" }}>
          {activeInvite.code}
        </p>
        <div className="flex gap-2">
          <button onClick={handleCopyInvite} className="flex-1 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: copied ? "rgba(247,183,8,0.15)" : "var(--graphite-700)", color: copied ? "var(--tuscan-sun-400)" : "var(--graphite-200)" }}>
            {copied ? "Copiado!" : "Copiar"}
          </button>
          <button onClick={handleGenerateInvite} disabled={generating} className="flex-1 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: "var(--graphite-700)", color: "var(--graphite-200)" }}>
            {generating ? "..." : "Generar nuevo"}
          </button>
        </div>
      </div>
    ) : (
      <button onClick={handleGenerateInvite} disabled={generating} className="w-full py-2 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: "var(--graphite-700)", color: "var(--graphite-200)" }}>
        {generating ? "Generando..." : "Generar codigo"}
      </button>
    )}
    <p className="text-[10px] px-2 py-1" style={{ color: "var(--graphite-600)" }}>Codigo de un solo uso</p>
  </div>
)}
```

**Step 4: Verificar build**

Run: `npm run build`
Expected: ✓

**Step 5: Prueba manual**

1. Como owner: Navbar → dropdown → "Invitar miembros" → Generar código → aparece + Copiar.
2. Como miembro (unirse con ese código): el dropdown NO muestra la sección.
3. Regla: con sesión de miembro, llamar `createInvite` directo → permission-denied (verificar
   que el alert muestre el error).

---

### Task 5: Limpieza de logs de depuración + commit

**Files:**
- Modify: `apps/web/src/components/AuthListener.tsx` (quitar `console.log("[AuthListener] ...")`)
- Modify: `apps/web/src/components/AuthGuard.tsx` (quitar `console.log("[AuthGuard] ...")`)

**Step 1:** Eliminar ambos console.log.

**Step 2:** `npm run build` → ✓

**Step 3:** Commit (solo si el usuario lo aprueba):

```bash
git add -A
git commit -m "Codigos de invitacion de un solo uso para unirse a empresas"
```
