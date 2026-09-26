import { collection, doc, getDoc, setDoc, Timestamp } from "@firebase/firestore";
import { db } from "@jostools/firebase-config";

export type UserRole = "owner" | "member";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  enterpriseId: string | null;
  role: UserRole;
  lastLogin: string;
  createdAt: string;
}

const usersRef = collection(db, "jostools", "config", "users");

export async function saveUser(userData: {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}): Promise<AppUser | null> {
  const userRef = doc(usersRef, userData.uid);
  const existing = await getDoc(userRef);

  if (existing.exists()) {
    const data = existing.data();
    await setDoc(userRef, {
      ...userData,
      lastLogin: Timestamp.now(),
    }, { merge: true });
    return {
      uid: userData.uid,
      email: userData.email,
      displayName: userData.displayName,
      photoURL: userData.photoURL,
      enterpriseId: data.enterpriseId || null,
      role: data.role || "member",
      lastLogin: new Date().toISOString(),
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };
  } else {
    await setDoc(userRef, {
      ...userData,
      enterpriseId: null,
      role: "member",
      lastLogin: Timestamp.now(),
      createdAt: Timestamp.now(),
    });
    return {
      uid: userData.uid,
      email: userData.email,
      displayName: userData.displayName,
      photoURL: userData.photoURL,
      enterpriseId: null,
      role: "member",
      lastLogin: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }
}

export async function getUser(uid: string): Promise<AppUser | null> {
  const userRef = doc(usersRef, uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    uid: snap.id,
    email: data.email,
    displayName: data.displayName,
    photoURL: data.photoURL,
    enterpriseId: data.enterpriseId || null,
    role: data.role || "member",
    lastLogin: data.lastLogin?.toDate?.()?.toISOString() || new Date().toISOString(),
    createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
  };
}

export async function updateUserEnterprise(uid: string, enterpriseId: string, role: "owner" | "member"): Promise<void> {
  const userRef = doc(usersRef, uid);
  await setDoc(userRef, { enterpriseId, role }, { merge: true });
}

export async function clearUserEnterprise(uid: string): Promise<void> {
  const userRef = doc(usersRef, uid);
  await setDoc(userRef, { enterpriseId: null, role: "member" }, { merge: true });
}

export async function getUsersByEnterprise(enterpriseId: string): Promise<AppUser[]> {
  const { getDocs, query, where } = await import("@firebase/firestore");
  const q = query(usersRef, where("enterpriseId", "==", enterpriseId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL,
      enterpriseId: data.enterpriseId || null,
      role: data.role || "member",
      lastLogin: data.lastLogin?.toDate?.()?.toISOString() || new Date().toISOString(),
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };
  });
}
