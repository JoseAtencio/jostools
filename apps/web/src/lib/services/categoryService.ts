import { collection, getDocs, query, where, addDoc, Timestamp } from "@firebase/firestore";
import { db } from "@jostools/firebase-config";
import type { Category, CategoryGroup } from "@/types/categories";
import { DEFAULT_CATEGORIES } from "@/types/categories";

const categoriesRef = collection(db, "jostools", "config", "categories");

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

  return snapshot.docs.map((doc: any) => ({
    id: doc.id,
    ...doc.data(),
  })) as Category[];
}

export async function getAllCategories(): Promise<Category[]> {
  const q = query(categoriesRef, where("active", "==", true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc: any) => ({
    id: doc.id,
    ...doc.data(),
  })) as Category[];
}

export async function seedDefaultCategories(): Promise<void> {
  const batch = DEFAULT_CATEGORIES.map((cat) =>
    addDoc(categoriesRef, {
      ...cat,
      created_at: Timestamp.now(),
    })
  );
  await Promise.all(batch);
}

export async function addCategory(category: Omit<Category, "id" | "created_at">): Promise<string> {
  const docRef = await addDoc(categoriesRef, {
    ...category,
    created_at: Timestamp.now(),
  });
  return docRef.id;
}
