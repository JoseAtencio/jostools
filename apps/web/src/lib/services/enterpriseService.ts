import { collection, doc, getDoc, getDocs, addDoc, setDoc, query, where, Timestamp } from "@firebase/firestore";
import { db } from "@jostools/firebase-config";
import type { Enterprise, EnterpriseInput } from "@/types/enterprise";

const enterprisesRef = collection(db, "jostools", "config", "enterprises");

export async function createEnterprise(data: EnterpriseInput): Promise<string> {
  const docRef = await addDoc(enterprisesRef, {
    ...data,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function getEnterprise(id: string): Promise<Enterprise | null> {
  const docRef = doc(enterprisesRef, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
  } as Enterprise;
}

export async function getEnterpriseByOwner(ownerId: string): Promise<Enterprise | null> {
  const q = query(enterprisesRef, where("ownerId", "==", ownerId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
  } as Enterprise;
}

export async function getEnterprisesByOwner(ownerId: string): Promise<Enterprise[]> {
  const q = query(enterprisesRef, where("ownerId", "==", ownerId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    } as Enterprise;
  });
}

export async function updateEnterprise(id: string, data: Partial<EnterpriseInput>): Promise<void> {
  const docRef = doc(enterprisesRef, id);
  await setDoc(docRef, data, { merge: true });
}
