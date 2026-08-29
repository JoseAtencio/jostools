declare module "firebase/firestore" {
  import { Firestore } from "@firebase/firestore";
  import { FirebaseApp } from "firebase/app";
  export function getFirestore(app?: FirebaseApp): Firestore;
  export { Firestore };
}
