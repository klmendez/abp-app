import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  writeBatch,
  getDocFromServer,
  where,
} from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import * as XLSX from "xlsx-js-style";
import { auth, db } from "./firebase";
import InsuredUploadModal from "./modules/policies/components/InsuredUploadModal";

const FIREBASE_API_KEY = "AIzaSyBVgl3sIuHlEgioYPWJnHnhU69_lnMz3Lw";

function TextField({ label, value, onChange, placeholder, type = "text", disabled = false }) {
  return (
    <label className="userFormField">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options, hint = "" }) {
  return (
    <label className="userFormField">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="userCheckboxField">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function formatExcelDate(value) {
  if (!value) return "";
  if (typeof value === "string") return value;

  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : null;
  if (!date || Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function policyTypeFromData(data) {
  for (const key of ["policyType", "assignedPolicyType", "tipoPoliza", "tipoDePoliza", "ramo", "branch"]) {
    if (typeof data?.[key] === "string" && data[key].trim()) return data[key].trim().toUpperCase().replace(/\s+/g, "_");
  }
  return "";
}

function policyLabel(type) {
  return {
    VIDA_GRUPO: "Vida grupo",
    VIDA_INDIVIDUAL: "Vida individual",
    SALUD: "Salud",
    GENERALES: "Seguros generales",
    ARL: "Riesgos laborales",
    AUTOS: "Autos",
    CUMPLIMIENTO: "Cumplimiento",
    RESPONSABILIDAD_CIVIL: "Responsabilidad civil",
    HOGAR: "Hogar",
    PENSIONES: "Pensiones",
    OTRA: "Otra póliza",
  }[type] || type || "Póliza";
}

function isActivePolicy(policy) {
  const status = String(policy?.status || policy?.estado || "ACTIVE").trim().toUpperCase();
  return !["INACTIVE", "INACTIVA", "CANCELADA", "CANCELLED", "VOID"].includes(status);
}

const today = new Date();
const CURRENT_PERIOD = {
  monthKey: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`,
  label: new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(today),
  start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
  end: new Date(today.getFullYear(), today.getMonth(), 1),
  enabledUntil: new Date(today.getFullYear(), today.getMonth() + 1, 0),
};

const longDate = (date) => new Intl.DateTimeFormat("es-CO", {
  day: "numeric", month: "long", year: "numeric",
}).format(date);

const formatCurrency = (value) => new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 0,
}).format(Number(value) || 0);

function calculatedAge(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "";
  const [year, month, day] = value.split("-").map(Number);
  const birthDate = new Date(year, month - 1, day);
  const now = new Date();
  if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day || birthDate > now) return "";
  return now.getFullYear() - year - (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day) ? 1 : 0);
}

function orderedPeople(people) {
  return [...(people || [])].sort((a, b) => {
    const statusOrder = Number(a.estado === "DESVINCULADO") - Number(b.estado === "DESVINCULADO");
    if (statusOrder) return statusOrder;
    return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
  });
}

function parseExcelDate(value) {
  const formatted = formatExcelDate(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(formatted)) return null;
  const [year, month, day] = formatted.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getNoveltyType(person) {
  return person.tipoNovedad || person.tipoNovedadAnterior || (person.estado === "DESVINCULADO" ? "RETIRO" : "");
}

function getNoveltyDate(person) {
  const noveltyType = getNoveltyType(person);
  if (noveltyType === "RETIRO") return parseExcelDate(person.fechaDesvinculacion);
  if (noveltyType === "INGRESO") return parseExcelDate(person.fechaVinculacion);
  return null;
}

function dateInRange(date, start, end) {
  return !!date && date >= start && date < end;
}

function isCurrentPeriodNovelty(person) {
  return dateInRange(getNoveltyDate(person), CURRENT_PERIOD.start, CURRENT_PERIOD.end);
}

function isPreviousPeriodNovelty(person) {
  const previousStart = new Date(CURRENT_PERIOD.start.getFullYear(), CURRENT_PERIOD.start.getMonth() - 1, 1);
  return dateInRange(getNoveltyDate(person), previousStart, CURRENT_PERIOD.start);
}

function excelNoveltyGroup(person) {
  if (isPreviousPeriodNovelty(person)) return 1;
  if (isCurrentPeriodNovelty(person)) return 2;
  if (person.estado === "DESVINCULADO") return 4;
  if (getNoveltyType(person)) return 3;
  return 0;
}

function orderedPeopleForExcel(people) {
  return [...(people || [])].sort((a, b) => {
    const groupOrder = excelNoveltyGroup(a) - excelNoveltyGroup(b);
    if (groupOrder) return groupOrder;
    return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
  });
}

export default function UsersAdmin({ companyId, currentUserId }) {
  const [searchText, setSearchText] = useState("");
  const [membershipRows, setMembershipRows] = useState([]);
  const [profileRows, setProfileRows] = useState([]);
  const [portalPolicies, setPortalPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isPlatformSuperAdmin, setIsPlatformSuperAdmin] = useState(false);
  const [userStatus, setUserStatus] = useState("ACTIVE");
  const [generatedUid, setGeneratedUid] = useState("");

  const [role, setRole] = useState("USUARIO");
  const [membershipStatus, setMembershipStatus] = useState("ACTIVE");
  const [policyType, setPolicyType] = useState("NINGUNA");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [userPolicies, setUserPolicies] = useState([]);
  const [userPoliciesLoading, setUserPoliciesLoading] = useState(false);
  const [userConfirmations, setUserConfirmations] = useState([]);
  const [userConfirmationsLoading, setUserConfirmationsLoading] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    const q = query(collection(db, "companies", companyId, "memberships"));
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const memberships = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const hydratedRows = await Promise.all(
          memberships.map(async (membership) => {
            try {
              const userSnap = await getDoc(doc(db, "users", membership.id));
              const profile = userSnap.exists() ? userSnap.data() : {};
              return {
                ...membership,
                profileExists: userSnap.exists(),
                email: profile.email || membership.email || "",
                displayName: profile.displayName || profile.name || membership.displayName || "",
                userStatus: profile.status || "",
                policyType: profile.policyType || "",
              };
            } catch (error) {
              console.error(error);
              return {
                ...membership,
                profileExists: false,
                email: membership.email || "",
                displayName: membership.displayName || "",
                userStatus: "",
              };
            }
          })
        );
        setMembershipRows(hydratedRows);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [companyId]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => setProfileRows(snap.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (err) => console.error(err)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "clientPolicies"),
      (snap) => setPortalPolicies(snap.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (err) => console.error(err)
    );
    return () => unsub();
  }, []);

  const rowsWithPortalPolicies = useMemo(() => {
    const knownIds = new Set(membershipRows.map((row) => row.id));
    const profileOnlyRows = profileRows
      .filter((profile) => !knownIds.has(profile.id))
      .map((profile) => ({ ...profile, profileExists: true, userStatus: profile.status || "ACTIVE", isProfileOnly: true }));
    profileOnlyRows.forEach((row) => knownIds.add(row.id));
    const portalOnlyRows = portalPolicies
      .filter((policy) => policy.clientUid && !knownIds.has(policy.clientUid))
      .reduce((rows, policy) => {
        if (!rows.some((row) => row.id === policy.clientUid)) {
          rows.push({ id: policy.clientUid, profileExists: false, email: policy.clientEmail || policy.email || "", displayName: policy.clientName || policy.nombreCliente || "", userStatus: "ACTIVE", status: "ACTIVE", role: "USUARIO", isPortalOnly: true });
        }
        return rows;
      }, []);
    return [...membershipRows, ...profileOnlyRows, ...portalOnlyRows].map((row) => {
    const userPolicies = portalPolicies.filter((policy) => policy.clientUid === row.id && isActivePolicy(policy));
    const branches = [...new Set(
      userPolicies
        .map(policyTypeFromData)
        .filter(Boolean)
    )];
    return {
      ...row,
      activeBranches: branches.map(policyLabel),
    };
    });
  }, [membershipRows, portalPolicies, profileRows]);

  useEffect(() => {
    if (!isEditorOpen) return;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !saving && !deleting) setIsEditorOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isEditorOpen, saving, deleting]);

  // Cargar la información que el cliente registró desde el portal de clientes.
  useEffect(() => {
    const tUid = normalizeUid(uid);
    if (!tUid) {
      setUserPolicies([]);
      setUserConfirmations([]);
      return;
    }
    setUserPoliciesLoading(true);
    const q = query(collection(db, "clientPolicies"), where("clientUid", "==", tUid));
    let policyDocs = [];
    const peopleByPolicy = new Map();
    const peopleUnsubscribers = new Map();
    const publish = () => setUserPolicies(policyDocs.map((policy) => {
      const insuredPeople = peopleByPolicy.get(policy.id) || [];
      return { ...policy, insuredCount: insuredPeople.length, insuredPeople };
    }));
    const unsub = onSnapshot(
      q,
      (snap) => {
        policyDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        peopleUnsubscribers.forEach((unsubscribe) => unsubscribe());
        peopleUnsubscribers.clear();
        peopleByPolicy.clear();
        policyDocs.forEach((policy) => {
          const unsubscribePeople = onSnapshot(
            collection(db, "clientPolicies", policy.id, "insuredPeople"),
            (peopleSnap) => {
              peopleByPolicy.set(policy.id, peopleSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
              publish();
              setUserPoliciesLoading(false);
            },
            (err) => console.error(err)
          );
          peopleUnsubscribers.set(policy.id, unsubscribePeople);
        });
        publish();
        if (policyDocs.length === 0) setUserPoliciesLoading(false);
      },
      (err) => {
        console.error(err);
        setUserPoliciesLoading(false);
      }
    );
    return () => {
      unsub();
      peopleUnsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [uid, policyType]);

  useEffect(() => {
    const tUid = normalizeUid(uid);
    if (!tUid) return;
    setUserConfirmationsLoading(true);
    const unsubscribe = onSnapshot(
      query(collection(db, "clientChangeNotifications"), where("clientUid", "==", tUid)),
      (snap) => {
        setUserConfirmations(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
        setUserConfirmationsLoading(false);
      },
      (err) => {
        console.error(err);
        setUserConfirmations([]);
        setUserConfirmationsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [uid]);

  const filteredMembershipRows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return rowsWithPortalPolicies;
    return rowsWithPortalPolicies.filter((r) => {
      const id = (r.id || "").toLowerCase();
      const role = (r.role || "").toLowerCase();
      const status = (r.status || "").toLowerCase();
      const name = (r.displayName || "").toLowerCase();
      const email = (r.email || "").toLowerCase();
      const userStatus = (r.userStatus || "").toLowerCase();
      const branches = (r.activeBranches || []).join(" ").toLowerCase();
      return id.includes(q) || name.includes(q) || email.includes(q) || role.includes(q) || status.includes(q) || userStatus.includes(q) || branches.includes(q);
    });
  }, [rowsWithPortalPolicies, searchText]);

  const loadForEdit = async (targetUid) => {
    const tUid = normalizeUid(targetUid);
    setError("");
    setInfo("");
    setGeneratedUid("");
    setPassword("");
    if (!tUid) return;

    setUid(tUid);
    setIsEditorOpen(true);
    try {
      const userRef = doc(db, "users", tUid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const u = userSnap.data();
        setEmail(u.email || "");
        setDisplayName(u.displayName || "");
        setIsPlatformSuperAdmin(!!u.isPlatformSuperAdmin);
        setUserStatus(u.status || "ACTIVE");
        setPolicyType(u.policyType || "NINGUNA");
      } else {
        setEmail("");
        setDisplayName("");
        setIsPlatformSuperAdmin(false);
        setUserStatus("ACTIVE");
        setPolicyType("NINGUNA");
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

  const startNewUser = () => {
    setUid("");
    setEmail("");
    setPassword("");
    setDisplayName("");
    setIsPlatformSuperAdmin(false);
    setUserStatus("ACTIVE");
    setRole("USUARIO");
    setMembershipStatus("ACTIVE");
    setPolicyType("NINGUNA");
    setGeneratedUid("");
    setError("");
    setInfo("");
    setIsEditorOpen(true);
  };

  const resetPassword = async () => {
    if (!email.trim()) {
      setError("El usuario no tiene un correo registrado para restablecer la contraseña.");
      return;
    }
    setError("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo(`Enviamos el enlace de restablecimiento a ${email.trim()}.`);
    } catch (err) {
      console.error(err);
      setError(err?.message || "No se pudo enviar el enlace de restablecimiento.");
    }
  };

  const deleteUser = async () => {
    const tUid = normalizeUid(uid);
    if (!tUid) return;
    if (tUid === currentUserId) {
      setError("No puedes eliminar tu propio acceso.");
      return;
    }
    const label = displayName || email || tUid;
    if (!window.confirm(`¿Eliminar el acceso de ${label}? Las pólizas y los datos registrados por el cliente se conservarán.`)) return;

    setDeleting(true);
    setError("");
    try {
      await Promise.all([
        deleteDoc(doc(db, "users", tUid)),
        deleteDoc(doc(db, "companies", companyId, "memberships", tUid)),
      ]);
      setInfo("Usuario eliminado de ABP-gestión. Sus datos del portal de clientes se conservaron.");
      setIsEditorOpen(false);
    } catch (err) {
      console.error(err);
      setError(err?.message || "No se pudo eliminar el usuario.");
    } finally {
      setDeleting(false);
    }
  };

  const downloadInsuredExcel = (policy) => {
    const currentPeriodRowNumbers = [];
    const rows = orderedPeopleForExcel(policy.insuredPeople).map((person, index) => {
      const novedad = getNoveltyType(person);
      const fechaIngreso = formatExcelDate(person.fechaVinculacion);
      const fechaRetiro = formatExcelDate(person.fechaDesvinculacion);
      const fechaNovedad = formatExcelDate(getNoveltyDate(person));

      if (isCurrentPeriodNovelty(person)) currentPeriodRowNumbers.push(index + 2);

      return {
        "REG.": index + 1,
        Nombre: person.nombre || "",
        "Cédula": person.cedula || "",
        Sexo: person.sexo || "",
        "Fecha de Nacimiento": formatExcelDate(person.fechaNacimiento),
        EDAD: calculatedAge(person.fechaNacimiento),
        EXTRAPRIMA: person.extraprima ?? "",
        "Valor Mensual Por Asegurado": person.valorMensual ?? "",
        Observaciones: person.observaciones || "",
        novedad,
        "Fecha novedad": fechaNovedad,
        "Fecha ingreso": fechaIngreso,
        "Fecha retiro": fechaRetiro,
      };
    });
    const sheet = XLSX.utils.json_to_sheet(rows, {
      header: [
        "REG.",
        "Nombre",
        "Cédula",
        "Sexo",
        "Fecha de Nacimiento",
        "EDAD",
        "EXTRAPRIMA",
        "Valor Mensual Por Asegurado",
        "Observaciones",
        "novedad",
        "Fecha novedad",
        "Fecha ingreso",
        "Fecha retiro",
      ],
    });
    currentPeriodRowNumbers.forEach((rowNumber) => {
      for (let colIndex = 0; colIndex < 13; colIndex += 1) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowNumber - 1, c: colIndex });
        if (!sheet[cellAddress]) continue;
        sheet[cellAddress].s = {
          fill: { patternType: "solid", fgColor: { rgb: "FFF2CC" } },
        };
      }
    });
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Asegurados");
    const policyNumber = policy.policyNumber || policy.numeroPoliza || policy.number || policy.id;
    XLSX.writeFile(book, `asegurados_${String(policyNumber).replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx`);
  };

  async function createUserInAuth(email, password) {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || "Error creando usuario en Firebase Auth";
      throw new Error(msg);
    }
    return { uid: data.localId, idToken: data.idToken };
  }

  const save = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!companyId) {
      setError("companyId es obligatorio");
      return;
    }

    const isNew = !normalizeUid(uid);
    let tUid = normalizeUid(uid);
    let createdAccount = null;

    if (isNew) {
      if (!email.trim() || !password.trim()) {
        setError("Para crear un usuario nuevo, email y contraseña son obligatorios.");
        return;
      }
      if (password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres.");
        return;
      }
    } else {
      if (!tUid) {
        setError("UID es obligatorio");
        return;
      }
    }

    setSaving(true);
    try {
      if (isNew) {
        createdAccount = await createUserInAuth(email.trim(), password.trim());
        tUid = createdAccount.uid;
        setGeneratedUid(tUid);
        setUid(tUid);
      }

      const userRef = doc(db, "users", tUid);
      const userSnap = await getDoc(userRef);
      const userPayload = {
        email: (email || "").trim(),
        displayName: (displayName || "").trim(),
        isPlatformSuperAdmin: !!isPlatformSuperAdmin,
        status: userStatus,
        policyType,
        updatedAt: serverTimestamp(),
        updatedBy: currentUserId || null,
      };

      const batch = writeBatch(db);
      if (!userSnap.exists()) {
        batch.set(userRef, {
          ...userPayload,
          createdAt: serverTimestamp(),
          createdBy: currentUserId || null,
        });
      } else {
        batch.update(userRef, userPayload);
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
        batch.set(memRef, {
          ...memPayload,
          createdAt: serverTimestamp(),
          createdBy: currentUserId || null,
        });
      } else {
        batch.update(memRef, memPayload);
      }

      await batch.commit();
      setInfo(isNew ? `Usuario creado. UID: ${tUid}` : "Guardado.");
      setIsEditorOpen(false);
    } catch (err) {
      console.error(err);
      let rollbackMessage = "";
      if (createdAccount) {
        try {
          // A failed response can follow a successful commit. Never delete Auth
          // unless server reads confirm both documents are absent.
          const [profile, membership] = await Promise.all([
            getDocFromServer(doc(db, "users", tUid)),
            getDocFromServer(doc(db, "companies", companyId, "memberships", tUid)),
          ]);
          if (!profile.exists() && !membership.exists()) {
            const response = await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${FIREBASE_API_KEY}`,
              { method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken: createdAccount.idToken }) },
            );
            if (!response.ok) throw new Error("No se pudo revertir la cuenta");
            setUid("");
            setGeneratedUid("");
            rollbackMessage = " La cuenta temporal se revirtió; puedes volver a intentarlo.";
          } else {
            rollbackMessage = " La cuenta se conserva. Revisa el usuario y vuelve a guardar si es necesario.";
          }
        } catch {
          rollbackMessage = " No se pudo confirmar la reversión. Se conserva el UID para recuperar el usuario sin crear otra cuenta.";
        }
      }
      setError((err?.message || "Error guardando") + rollbackMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="usersAdminLayout" style={{ display: "grid", gap: 16 }}>
      <h2 style={{ margin: 0 }}>{isEditorOpen ? (uid ? "Información del usuario" : "Crear usuario") : "Usuarios"}</h2>

      {!isEditorOpen ? <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Buscar por nombre, correo, rol o estado..."
          aria-label="Buscar usuarios"
          style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10, minWidth: 260 }}
        />
        <button type="button" className="btn btnPrimary addButton" onClick={startNewUser} aria-label="Crear usuario" title="Crear usuario">
          +
        </button>
      </div> : null}

      {info && !isEditorOpen ? <div role="status" className="userSuccessMessage">{info}</div> : null}

      {!isEditorOpen && (loading ? (
        <p>Cargando usuarios...</p>
      ) : filteredMembershipRows.length === 0 ? (
        <p>No hay usuarios que coincidan con la búsqueda.</p>
      ) : (
        <div className="tableWrap" role="region" aria-label="Tabla de usuarios" tabIndex={0}>
          <table className="table usersTable">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Ramos actuales · {CURRENT_PERIOD.label}</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembershipRows.map((r) => {
                const isActive = r.userStatus !== "INACTIVE" && r.status !== "INACTIVE";
                const userLabel = r.displayName || r.email?.split("@")[0] || r.id;
                const statusLabel = r.isPortalOnly ? "Activo (portal)" : r.isProfileOnly ? "Sin empresa" : !r.profileExists ? "Sin perfil" : isActive ? "Activo" : "Inactivo";
                return (
                  <tr key={r.id}>
                    <td title={r.id}>{userLabel}</td>
                    <td>{r.email || "Sin correo registrado"}</td>
                    <td title={r.activeBranches?.join(", ") || "No hay ramos activos registrados en el portal de clientes"}>
                      {r.activeBranches?.length ? r.activeBranches.join(", ") : "Sin ramos activos"}
                    </td>
                    <td>{roleLabel(r.role) || "Sin rol"}</td>
                    <td><span className={`statusBadge status-${isActive ? "ACTIVE" : "INACTIVE"}`}>{statusLabel}</span></td>
                    <td>
                      <button type="button" onClick={() => loadForEdit(r.id)} aria-label={`Editar a ${r.displayName || r.email || r.id}`}>
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {isEditorOpen ? (
        <section className="userEditorPage" aria-labelledby="users-editor-title">
        <button type="button" className="backToUsers" onClick={() => setIsEditorOpen(false)} disabled={saving || deleting}>← Volver a usuarios</button>
        <div className="usersModal" aria-labelledby="users-editor-title">
          <div className="usersModalHeader">
            <h3 id="users-editor-title" style={{ margin: 0 }}>{uid ? "Editar usuario" : "Crear usuario"}</h3>
            <button type="button" className="btn" onClick={() => setIsEditorOpen(false)} disabled={saving || deleting} aria-label="Cerrar ventana">×</button>
          </div>
          <p className="userEditorIntro">
            Administra el acceso de la cuenta y consulta sus pólizas registradas en el portal de clientes.
          </p>

          {error ? <div style={{ marginTop: 8, color: "#b00020" }}>{error}</div> : null}
          {info ? <div style={{ marginTop: 8, color: "#1b5e20" }}>{info}</div> : null}
          {generatedUid ? (
            <div style={{ marginTop: 8, color: "#0066cc", fontSize: 12, fontWeight: 600 }}>
              UID generado: {generatedUid}
            </div>
          ) : null}

          <form className="userEditForm" onSubmit={save}>
            {uid ? <TextField label="UID" value={uid} onChange={setUid} placeholder="uid (Firebase Auth)" disabled /> : null}
            <TextField label="Correo" value={email} onChange={setEmail} placeholder="correo@dominio.com" type="email" />
            {!uid ? <TextField label="Contraseña" value={password} onChange={setPassword} placeholder="Mínimo 6 caracteres" type="password" /> : null}
            {uid ? (
              <div className="passwordResetPanel">
                <span>La contraseña no se puede ver ni recuperar desde Firebase.</span>
                <button type="button" className="userSecondaryButton" onClick={resetPassword}>Enviar enlace para restablecer</button>
              </div>
            ) : null}
            <TextField label="Nombre" value={displayName} onChange={setDisplayName} placeholder="Nombre" />

            <SelectField
              label="Estado de la cuenta"
              value={userStatus}
              onChange={setUserStatus}
              options={[
                { value: "ACTIVE", label: "ACTIVE" },
                { value: "INACTIVE", label: "INACTIVE" },
              ]}
            />

            <SelectField
              label="Ramo principal de acceso"
              value={policyType}
              onChange={setPolicyType}
              hint="Es una referencia de acceso; el cliente puede tener varias pólizas en el portal."
              options={[
                { value: "NINGUNA", label: "Ninguna / General" },
                { value: "VIDA_INDIVIDUAL", label: "Vida Individual" },
                { value: "VIDA_GRUPO", label: "Vida Grupo" },
                { value: "SALUD", label: "Salud" },
                { value: "GENERALES", label: "Generales (Auto/Hogar)" },
                { value: "ARL", label: "ARL" },
                { value: "AUTOS", label: "Autos" },
                { value: "CUMPLIMIENTO", label: "Cumplimiento" },
                { value: "RESPONSABILIDAD_CIVIL", label: "Responsabilidad civil" },
                { value: "HOGAR", label: "Hogar" },
                { value: "PENSIONES", label: "Pensiones" },
                { value: "OTRA", label: "Otra póliza" },
              ]}
            />

            <CheckboxField
              label="Platform Superadmin"
              checked={isPlatformSuperAdmin}
              onChange={(v) => setIsPlatformSuperAdmin(v)}
            />

            <div className="userFormDivider" />

            <SelectField
              label="Rol en empresa"
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
              label="Estado de acceso en empresa"
              value={membershipStatus}
              onChange={setMembershipStatus}
              options={[
                { value: "ACTIVE", label: "ACTIVE" },
                { value: "INACTIVE", label: "INACTIVE" },
              ]}
            />

            {policyType !== "NINGUNA" && normalizeUid(uid) && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="userSecondaryButton"
                >
                  + Crear póliza y cargar asegurados
                </button>
              </div>
            )}

            <div className="userEditorActions">
              {uid ? <button type="button" className="dangerButton" onClick={deleteUser} disabled={saving || deleting}>{deleting ? "Eliminando..." : "Eliminar usuario"}</button> : <span />}
              <button type="submit" disabled={saving || deleting}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>

          {normalizeUid(uid) && (
            <section className="userPortalData" aria-labelledby="user-portal-data-title">
              <div>
                <h4 id="user-portal-data-title" style={{ margin: "0 0 4px", fontSize: 14 }}>Pólizas del cliente ({userPolicies.length})</h4>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                  Datos registrados por este cliente en abp-insurance.
                </p>
              </div>
              {userPoliciesLoading ? (
                <p style={{ fontSize: 12, color: "#666" }}>Cargando información del cliente...</p>
              ) : userPolicies.length === 0 ? (
                <p style={{ fontSize: 12, color: "#666" }}>Este cliente aún no ha registrado pólizas desde el portal.</p>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {userPolicies.map((p) => (
                    <article key={p.id} className="userPortalPolicy">
                      {(() => {
                        const people = orderedPeople(p.insuredPeople);
                        const activePeople = people.filter((person) => person.estado !== "DESVINCULADO");
                        const totalMonthly = activePeople.reduce((sum, person) => sum + (Number(person.valorMensual) || 0), 0);
                        const confirmation = userConfirmations.find((item) =>
                          item.policyId === p.id && item.action === "confirm_month" && item.monthKey === CURRENT_PERIOD.monthKey
                        );
                        const confirmationText = userConfirmationsLoading
                          ? "Consultando…"
                          : confirmation
                            ? confirmation.status === "PENDING" ? "Enviada · pendiente" : "Confirmada"
                            : "Por confirmar";
                        return (
                          <>
                      <div className="userPortalPolicyHeader">
                        <div>
                          <div style={{ fontSize: 13 }}>{policyLabel(policyTypeFromData(p))}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>
                            {p.policyNumber || p.numeroPoliza || p.number ? `Póliza ${p.policyNumber || p.numeroPoliza || p.number}` : `ID: ${p.id}`}
                          </div>
                        </div>
                        <span className={`statusBadge status-${isActivePolicy(p) ? "ACTIVE" : "INACTIVE"}`}>
                          {isActivePolicy(p) ? "Activa" : "Inactiva"}
                        </span>
                      </div>
                      <dl className="userPortalPolicyMeta">
                        <div><dt>Período habilitado</dt><dd>{longDate(CURRENT_PERIOD.start)} al {longDate(CURRENT_PERIOD.end)}</dd></div>
                        <div><dt>Disponible hasta</dt><dd>{longDate(CURRENT_PERIOD.enabledUntil)}</dd></div>
                        <div><dt>Aseguradora</dt><dd>{p.insurer || p.aseguradora || "No registrada"}</dd></div>
                      </dl>
                      <div className="userPortalSummary" aria-label={`Resumen de ${policyLabel(policyTypeFromData(p))}`}>
                        <div><span>Asegurados activos</span><strong>{activePeople.length}</strong></div>
                        <div><span>Total mensual de activos</span><strong>{formatCurrency(totalMonthly)}</strong></div>
                        <div><span>Confirmación del mes</span><strong>{confirmationText}</strong></div>
                      </div>
                      {p.insuredPeople && p.insuredPeople.length > 0 && (
                        <>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                          <button type="button" className="userExcelButton" onClick={() => downloadInsuredExcel(p)}>Descargar Excel</button>
                        </div>
                        <div className="tableWrap" style={{ marginTop: 8 }} role="region" aria-label={`Asegurados de la póliza ${p.id}`} tabIndex={0}>
                          <table
                            className="table tableCompact"
                          >
                            <thead>
                              <tr>
                                <th>REG</th>
                                <th>Nombre</th>
                                <th>Cédula</th>
                                <th>Sexo</th>
                                <th>Fecha Nac.</th>
                                <th>Edad</th>
                                <th>Estado</th>
                                <th>Vinculación</th>
                                <th>Retiro</th>
                                <th>Valor Mensual</th>
                              </tr>
                            </thead>
                            <tbody>
                              {people.map((ip, index) => (
                                <tr key={ip.id}>
                                  <td>{index + 1}</td>
                                  <td>{ip.nombre}</td>
                                  <td>{ip.cedula}</td>
                                  <td>{ip.sexo}</td>
                                  <td>{ip.fechaNacimiento}</td>
                                  <td>{calculatedAge(ip.fechaNacimiento) || "-"}</td>
                                  <td>{ip.estado || "ACTIVO"}</td>
                                  <td>{ip.fechaVinculacion || "-"}</td>
                                  <td>{ip.fechaDesvinculacion || "-"}</td>
                                  <td>{ip.valorMensual}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        </>
                      )}
                          </>
                        );
                      })()}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
        </section>
      ) : null}

      {showUploadModal && (
        <InsuredUploadModal
          clientUid={normalizeUid(uid)}
          clientName={displayName || email}
          policyType={policyType}
          onClose={() => {
            setShowUploadModal(false);
            // Al cerrar el modal, recargar las pólizas del usuario
            const tUid = normalizeUid(uid);
            if (tUid && policyType === "VIDA_GRUPO") {
              setUserPoliciesLoading(true);
              const q = query(collection(db, "clientPolicies"), where("clientUid", "==", tUid));
              getDocs(q).then(async (snap) => {
                const policies = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                const policiesWithInsured = await Promise.all(
                  policies.map(async (pol) => {
                    try {
                      const insuredSnap = await getDocs(collection(db, "clientPolicies", pol.id, "insuredPeople"));
                      return {
                        ...pol,
                        insuredCount: insuredSnap.size,
                        insuredPeople: insuredSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
                      };
                    } catch (e) {
                      console.error(e);
                      return { ...pol, insuredCount: 0, insuredPeople: [] };
                    }
                  })
                );
                setUserPolicies(policiesWithInsured);
                setUserPoliciesLoading(false);
              }).catch((err) => {
                console.error(err);
                setUserPoliciesLoading(false);
              });
            }
          }}
        />
      )}
    </div>
  );
}
