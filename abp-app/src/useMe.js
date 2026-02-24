import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function loadMe(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
