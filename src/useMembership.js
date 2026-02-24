import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function loadMembership(companyId, uid) {
  const ref = doc(db, "companies", companyId, "memberships", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
