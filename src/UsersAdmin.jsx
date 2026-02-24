import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

function TextField({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#333" }}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10 }}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#333" }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10 }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function normalizeUid(uid) {
  return (uid || "").trim();
}

function roleLabel(role) {
  if (role === "SUPERADMIN") return "SUPERADMIN";
  if (role === "ADMIN_EMPRESA") return "ADMIN_EMPRESA";
  if (role === "COORDINADOR") return "COORDINADOR";
  if (role === "ASESOR") return "ASESOR";
  if (role === "USUARIO") return "USUARIO";
  return role || "";
}

export default function UsersAdmin({ companyId, currentUserId }) {
  const [searchText, setSearchText] = useState("");
  const [membershipRows, setMembershipRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isPlatformSuperAdmin, setIsPlatformSuperAdmin] = useState(false);
  const [userStatus, setUserStatus] = useState("ACTIVE");

  const [role, setRole] = useState("USUARIO");
  const [membershipStatus, setMembershipStatus] = useState("ACTIVE");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    const q = query(collection(db, "companies", companyId, "memberships"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMembershipRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [companyId]);

  const filteredMembershipRows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return membershipRows;
    return membershipRows.filter((r) => {
      const id = (r.id || "").toLowerCase();
      const role = (r.role || "").toLowerCase();
      const status = (r.status || "").toLowerCase();
      return id.includes(q) || role.includes(q) || status.includes(q);
    });
  }, [membershipRows, searchText]);

  const loadForEdit = async (targetUid) => {
    const tUid = normalizeUid(targetUid);
    setError("");
    setInfo("");
    if (!tUid) return;

    setUid(tUid);
    try {
      const userRef = doc(db, "users", tUid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const u = userSnap.data();
        setEmail(u.email || "");
        setDisplayName(u.displayName || "");
        setIsPlatformSuperAdmin(!!u.isPlatformSuperAdmin);
        setUserStatus(u.status || "ACTIVE");
      } else {
        setEmail("");
        setDisplayName("");
        setIsPlatformSuperAdmin(false);
        setUserStatus("ACTIVE");
      }

      const memRef = doc(db, "companies", companyId, "memberships", tUid);
      const memSnap = await getDoc(memRef);
      if (memSnap.exists()) {
        const m = memSnap.data();
        setRole(m.role || "USUARIO");
        setMembershipStatus(m.status || "ACTIVE");
      } else {
        setRole("USUARIO");
        setMembershipStatus("ACTIVE");
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || "Error cargando usuario");
    }
  };

  const save = async (e) => {
    e.preventDefault();
    const tUid = normalizeUid(uid);
    setError("");
    setInfo("");

    if (!companyId) {
      setError("companyId es obligatorio");
      return;
    }
    if (!tUid) {
      setError("UID es obligatorio");
      return;
    }

    setSaving(true);
    try {
      const userRef = doc(db, "users", tUid);
      const userSnap = await getDoc(userRef);
      const userPayload = {
        email: (email || "").trim(),
        displayName: (displayName || "").trim(),
        isPlatformSuperAdmin: !!isPlatformSuperAdmin,
        status: userStatus,
        updatedAt: serverTimestamp(),
        updatedBy: currentUserId || null,
      };

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          ...userPayload,
          createdAt: serverTimestamp(),
          createdBy: currentUserId || null,
        });
      } else {
        await updateDoc(userRef, userPayload);
      }

      const memRef = doc(db, "companies", companyId, "memberships", tUid);
      const memSnap = await getDoc(memRef);
      const memPayload = {
        role,
        status: membershipStatus,
        updatedAt: serverTimestamp(),
        updatedBy: currentUserId || null,
      };

      if (!memSnap.exists()) {
        await setDoc(memRef, {
          ...memPayload,
          createdAt: serverTimestamp(),
          createdBy: currentUserId || null,
        });
      } else {
        await updateDoc(memRef, memPayload);
      }

      setInfo("Guardado.");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Error guardando");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2 style={{ margin: 0 }}>Usuarios</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Buscar por uid/rol/estado..."
          style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10, minWidth: 260 }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 16 }}>
        <div>
          {loading ? (
            <p>Cargando...</p>
          ) : filteredMembershipRows.length === 0 ? (
            <p>No hay memberships en esta empresa.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th>UID</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembershipRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{roleLabel(r.role)}</td>
                      <td>{r.status}</td>
                      <td>
                        <button type="button" onClick={() => loadForEdit(r.id)}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 14 }}>
          <h3 style={{ margin: 0 }}>Crear / editar</h3>
          <p style={{ marginTop: 8, color: "#666", fontSize: 12 }}>
            V1 manual: necesitas el UID. Esto no crea usuarios en Firebase Auth.
          </p>

          {error ? <div style={{ marginTop: 8, color: "#b00020" }}>{error}</div> : null}
          {info ? <div style={{ marginTop: 8, color: "#1b5e20" }}>{info}</div> : null}

          <form onSubmit={save} style={{ marginTop: 12, display: "grid", gap: 12 }}>
            <TextField label="UID" value={uid} onChange={setUid} placeholder="uid (Firebase Auth)" />
            <TextField label="Email" value={email} onChange={setEmail} placeholder="correo@dominio.com" type="email" />
            <TextField label="Nombre" value={displayName} onChange={setDisplayName} placeholder="Nombre" />

            <SelectField
              label="Estado usuario (users/{uid})"
              value={userStatus}
              onChange={setUserStatus}
              options={[
                { value: "ACTIVE", label: "ACTIVE" },
                { value: "INACTIVE", label: "INACTIVE" },
              ]}
            />

            <CheckboxField
              label="Platform Superadmin"
              checked={isPlatformSuperAdmin}
              onChange={(v) => setIsPlatformSuperAdmin(v)}
            />

            <div style={{ height: 1, background: "#eee" }} />

            <SelectField
              label={`Rol en empresa (companies/${companyId}/memberships/{uid})`}
              value={role}
              onChange={setRole}
              options={[
                { value: "SUPERADMIN", label: "SUPERADMIN" },
                { value: "ADMIN_EMPRESA", label: "ADMIN_EMPRESA" },
                { value: "COORDINADOR", label: "COORDINADOR" },
                { value: "ASESOR", label: "ASESOR" },
                { value: "USUARIO", label: "USUARIO" },
              ]}
            />

            <SelectField
              label="Estado membership"
              value={membershipStatus}
              onChange={setMembershipStatus}
              options={[
                { value: "ACTIVE", label: "ACTIVE" },
                { value: "INACTIVE", label: "INACTIVE" },
              ]}
            />

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
