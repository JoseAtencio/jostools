import {
  collection, doc, getDoc, setDoc, runTransaction, query, where, getDocs, Timestamp,
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
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}

function toInvite(id: string, data: Record<string, any>): Invite {
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

export async function getActiveInvite(enterpriseId: string, uid: string): Promise<Invite | null> {
  const q = query(
    invitesRef,
    where("enterpriseId", "==", enterpriseId),
    where("createdBy", "==", uid),
    where("used", "==", false)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docs = snap.docs.map((d) => toInvite(d.id, d.data()));
  docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return docs[0];
}

export async function consumeInvite(code: string, uid: string): Promise<string> {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(normalized)) throw new Error("Codigo no valido");
  const ref = doc(invitesRef, normalized);
  return runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) throw new Error("Codigo no valido");
    const data = snap.data();
    if (data.used) throw new Error("Este codigo ya fue usado");
    if (!data.enterpriseId) throw new Error("Codigo no valido");
    t.update(ref, { used: true, usedBy: uid, usedAt: Timestamp.now() });
    const userRef = doc(usersRef, uid);
    t.set(userRef, { enterpriseId: data.enterpriseId, role: "member", joiningCode: normalized }, { merge: true });
    return data.enterpriseId as string;
  });
}
