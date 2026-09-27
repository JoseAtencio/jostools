import { collection, getDocs, query, where, addDoc, doc, setDoc, Timestamp } from "@firebase/firestore";
import { db } from "@jostools/firebase-config";
import type { Category, CategoryGroup } from "@/types/categories";
import { DEFAULT_CATEGORIES } from "@/types/categories";

const categoriesRef = collection(db, "jostools", "config", "categories");

function dedupeByName(cats: Category[]): Category[] {
  const seen = new Set<string>();
  return cats.filter((cat) => {
    if (seen.has(cat.name)) return false;
    seen.add(cat.name);
    return true;
  });
}

async function writeDefault(cat: Omit<Category, "id" | "created_at">): Promise<void> {
  await setDoc(
    doc(categoriesRef, `${cat.group}_${cat.name}`),
    { ...cat, created_at: Timestamp.now() },
    { merge: true }
  );
}

export async function getCategoriesByGroup(group: CategoryGroup): Promise<Category[]> {
  const q = query(
    categoriesRef,
    where("group", "==", group),
    where("active", "==", true)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    await seedDefaultCategories();
    return getCategoriesByGroup(group);
  }

  const cats = snapshot.docs.map((doc: any) => ({
    id: doc.id,
    ...doc.data(),
  })) as Category[];
  const deduped = dedupeByName(cats);

  const names = new Set(deduped.map((c) => c.name));
  const missing = DEFAULT_CATEGORIES.filter((c) => c.group === group && !names.has(c.name));
  if (missing.length > 0) {
    await Promise.all(missing.map(writeDefault));
    return getCategoriesByGroup(group);
  }

  return deduped;
}

export async function getAllCategories(): Promise<Category[]> {
  const q = query(categoriesRef, where("active", "==", true));
  const snapshot = await getDocs(q);
  const cats = snapshot.docs.map((doc: any) => ({
    id: doc.id,
    ...doc.data(),
  })) as Category[];
  return dedupeByName(cats);
}

let seedPromise: Promise<void> | null = null;

export async function seedDefaultCategories(): Promise<void> {
  if (!seedPromise) {
    seedPromise = Promise.all(DEFAULT_CATEGORIES.map(writeDefault))
      .then(() => undefined)
      .catch((err) => {
        seedPromise = null;
        throw err;
      });
  }
  return seedPromise;
}

export async function addCategory(category: Omit<Category, "id" | "created_at">): Promise<string> {
  const docRef = await addDoc(categoriesRef, {
    ...category,
    created_at: Timestamp.now(),
  });
  return docRef.id;
}
