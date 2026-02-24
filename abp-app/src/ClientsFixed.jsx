import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

function createEmptyClient(companyId) {
  return {
    companyId,
    status: "ACTIVE",
    basic: {
      name: "",
      nit: "",
      city: "",
      email: "",
      phone: "",
      address: "",
      contacts: [
        {
          name: "",
          role: "PRINCIPAL",
          email: "",
          phone: "",
          notes: "",
        },
      ],
    },
    commercial: {
      commercialStatus: "PROSPECTO",
      responsibleUid: "",
      priority: "",
      notes: "",
    },
    seguros: {
      vida: { tienePoliza: false, poliza: "", aseguradora: "", inicio: "", fin: "" },
      salud: { tienePoliza: false, poliza: "", aseguradora: "", inicio: "", fin: "" },
      generales: { tienePoliza: false, poliza: "", aseguradora: "", inicio: "", fin: "" },
      arl: { tienePoliza: false, poliza: "", aseguradora: "", inicio: "", fin: "" },
    },
    evidencias: {
      driveUrl: "",
      notes: "",
    },
    nextExpiryDate: "",
    lastActivityAt: null,
  };
}

function normalizeClientBeforeSave(client) {
  const next = structuredClone(client);

  const cleanPolicy = (x) => {
    if (!x?.tienePoliza) {
      return { tienePoliza: false, poliza: "", aseguradora: "", inicio: "", fin: "" };
    }
    return {
      tienePoliza: true,
      poliza: (x.poliza || "").trim(),
      aseguradora: (x.aseguradora || "").trim(),
      inicio: x.inicio || "",
      fin: x.fin || "",
    };
  };

  next.basic = next.basic || {};
  next.commercial = next.commercial || {};
  next.seguros = next.seguros || {};
  next.evidencias = next.evidencias || {};

  next.basic.name = (next.basic.name || "").trim();
  next.basic.nit = (next.basic.nit || "").trim();
  next.basic.city = (next.basic.city || "").trim();
  next.basic.email = (next.basic.email || "").trim();
  next.basic.phone = (next.basic.phone || "").trim();
  next.basic.address = (next.basic.address || "").trim();

  next.basic.contacts = Array.isArray(next.basic.contacts) ? next.basic.contacts : [];
  next.basic.contacts = next.basic.contacts
    .map((c) => ({
      name: (c?.name || "").trim(),
      role: (c?.role || "").trim(),
      email: (c?.email || "").trim(),
      phone: (c?.phone || "").trim(),
      notes: (c?.notes || "").trim(),
    }))
    .filter((c) => c.name || c.email || c.phone);

  next.commercial.commercialStatus = (next.commercial.commercialStatus || "").trim();
  next.commercial.responsibleUid = (next.commercial.responsibleUid || "").trim();
  next.commercial.priority = (next.commercial.priority || "").trim();
  next.commercial.notes = (next.commercial.notes || "").trim();

  next.seguros.vida = cleanPolicy(next.seguros.vida);
  next.seguros.salud = cleanPolicy(next.seguros.salud);
  next.seguros.generales = cleanPolicy(next.seguros.generales);
  next.seguros.arl = cleanPolicy(next.seguros.arl);

  next.evidencias.driveUrl = (next.evidencias.driveUrl || "").trim();
  next.evidencias.notes = (next.evidencias.notes || "").trim();

  next.nextExpiryDate = (next.nextExpiryDate || "").trim();

  return next;
}

function validateClient(client) {
  const errors = [];
  if (!client?.companyId) errors.push("companyId es obligatorio");
  if (!client?.basic?.name?.trim()) errors.push("Nombre es obligatorio");
  if (!client?.commercial?.commercialStatus?.trim()) errors.push("Estado comercial es obligatorio");
  return errors;
}

function TabButton({ id, activeTab, setActiveTab, children }) {
  const active = activeTab === id;
  return (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      style={{
        padding: "8px 10px",
        border: "1px solid #ccc",
        background: active ? "#111" : "#fff",
        color: active ? "#fff" : "#111",
        cursor: "pointer",
        borderRadius: 10,
      }}
    >
      {children}
    </button>
  );
}

function TextField({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#333" }}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="input"
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
        className="select"
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

function PolicyBlock({ title, value, onChange }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <CheckboxField
          label="Tiene póliza"
          checked={!!value.tienePoliza}
          onChange={(v) => onChange({ ...value, tienePoliza: v })}
        />
      </div>
      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <TextField label="Póliza" value={value.poliza} onChange={(v) => onChange({ ...value, poliza: v })} />
        <TextField
          label="Aseguradora"
          value={value.aseguradora}
          onChange={(v) => onChange({ ...value, aseguradora: v })}
        />
        <TextField label="Inicio" type="date" value={value.inicio} onChange={(v) => onChange({ ...value, inicio: v })} />
        <TextField label="Fin" type="date" value={value.fin} onChange={(v) => onChange({ ...value, fin: v })} />
      </div>
    </div>
  );
}

function computeNextExpiryDate(list) {
  const endDates = (list || [])
    .map((x) => (x?.endDate || "").trim())
    .filter(Boolean)
    .sort();
  return endDates.length ? endDates[0] : "";
}

export default function ClientsFixed({ companyId = "abp", userId = null }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [responsibleFilter, setResponsibleFilter] = useState("");
  const [lineFilter, setLineFilter] = useState("ALL");

  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(() => createEmptyClient(companyId));
  const [activeTab, setActiveTab] = useState("basic");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientLandingOpen, setClientLandingOpen] = useState(false);

  const [activityRows, setActivityRows] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activityStatusFilter, setActivityStatusFilter] = useState("ALL");
  const [activityResponsibleFilter, setActivityResponsibleFilter] = useState("");
  const [activityDraft, setActivityDraft] = useState({
    activity: "",
    commitment: "",
    responsibleUid: "",
    status: "EN_PROCESO",
    dueDate: "",
    progress: 0,
    notes: "",
  });
  const [editingActivityId, setEditingActivityId] = useState(null);
  const [selectedActivityForView, setSelectedActivityForView] = useState(null);

  const [interRows, setInterRows] = useState([]);
  const [interLoading, setInterLoading] = useState(false);
  const [interLineFilter, setInterLineFilter] = useState("ALL");
  const [interStatusFilter, setInterStatusFilter] = useState("ALL");
  const [editingInterId, setEditingInterId] = useState(null);
  const [interDraft, setInterDraft] = useState({
    line: "",
    insurer: "",
    policyNumber: "",
    startDate: "",
    endDate: "",
    premium: "",
    commission: "",
    status: "VIGENTE",
    renewalStatus: "NORMAL",
    driveUrl: "",
    notes: "",
  });

  useEffect(() => {
    setDraft(createEmptyClient(companyId));
    setSelectedId(null);
    setActiveTab("basic");
  }, [companyId]);

  useEffect(() => {
    let unsub = null;
    setLoading(true);

    const baseCol = collection(db, "clients");
    const qWithOrder = query(baseCol, where("companyId", "==", companyId), orderBy("createdAt", "desc"));
    const qNoOrder = query(baseCol, where("companyId", "==", companyId));

    const attach = (qRef, { sortClientSide } = { sortClientSide: false }) =>
      onSnapshot(
        qRef,
        (snap) => {
          let next = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          if (sortClientSide) {
            next = next.sort((a, b) => {
              const at = a?.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
              const bt = b?.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
              return bt - at;
            });
          }
          setRows(next);
          setLoading(false);
        },
        (err) => {
          const needsIndex =
            err?.code === "failed-precondition" || String(err?.message || "").toLowerCase().includes("requires an index");
          console.error(err);
          if (needsIndex) {
            if (unsub) unsub();
            unsub = attach(qNoOrder, { sortClientSide: true });
            return;
          }
          setLoading(false);
        }
      );

    unsub = attach(qWithOrder);
    return () => {
      if (unsub) unsub();
    };
  }, [companyId]);

  useEffect(() => {
    if (!selectedId) {
      setActivityRows([]);
      setEditingActivityId(null);
      setInterRows([]);
      setEditingInterId(null);
      return;
    }

    setActivitiesLoading(true);
    const qAct = query(
      collection(db, "activities"),
      where("companyId", "==", companyId),
      where("clientId", "==", selectedId)
    );
    const unsubAct = onSnapshot(
      qAct,
      (snap) => {
        setActivityRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setActivitiesLoading(false);
      },
      (err) => {
        console.error(err);
        setActivitiesLoading(false);
      }
    );

    setInterLoading(true);
    const qInter = query(collection(db, "clients", selectedId, "intermediations"), orderBy("endDate", "asc"));
    const unsubInter = onSnapshot(
      qInter,
      (snap) => {
        setInterRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setInterLoading(false);
      },
      (err) => {
        console.error(err);
        setInterLoading(false);
      }
    );

    return () => {
      unsubAct();
      unsubInter();
    };
  }, [selectedId]);

  const availableCities = useMemo(() => {
    const set = new Set();
    for (const r of rows) {
      const city = (r.basic?.city || r.city || "").trim();
      if (city) set.add(city);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = rows.filter((r) => {
    const statusOk = statusFilter === "ALL" ? true : r.status === statusFilter;
    if (!statusOk) return false;

    const city = (r.basic?.city || r.city || "").trim();
    const cityOk = cityFilter === "ALL" ? true : city === cityFilter;
    if (!cityOk) return false;

    const resp = (r.commercial?.responsibleUid || "").trim();
    const respFilter = responsibleFilter.trim();
    const respOk = !respFilter ? true : resp === respFilter;
    if (!respOk) return false;

    const hasLine = (line) => {
      const x = r?.seguros?.[line];
      return !!x?.tienePoliza;
    };
    if (lineFilter !== "ALL") {
      if (!hasLine(lineFilter)) return false;
    }

    const q = search.trim().toLowerCase();
    if (!q) return true;

    const name = (r.basic?.name || r.name || "").toLowerCase();
    const nit = (r.basic?.nit || r.nit || "").toLowerCase();
    const citySearch = (r.basic?.city || r.city || "").toLowerCase();
    const responsible = (r.commercial?.responsibleUid || "").toLowerCase();
    return name.includes(q) || nit.includes(q) || citySearch.includes(q) || responsible.includes(q);
  });

  const startCreate = () => {
    setFormError("");
    setSubmitAttempted(false);
    setSelectedId(null);
    setDraft(createEmptyClient(companyId));
    setActiveTab("basic");
    setEditingActivityId(null);
    setEditingInterId(null);
    setClientModalOpen(true);
  };

  const startEdit = (row) => {
    setFormError("");
    setSubmitAttempted(false);
    setSelectedId(row.id);

    const legacyBasic = {
      name: row.basic?.name ?? row.name ?? "",
      nit: row.basic?.nit ?? row.nit ?? "",
      city: row.basic?.city ?? row.city ?? "",
    };

    setDraft({
      ...createEmptyClient(companyId),
      ...row,
      basic: { ...createEmptyClient(companyId).basic, ...legacyBasic, ...(row.basic || {}) },
      commercial: { ...createEmptyClient(companyId).commercial, ...(row.commercial || {}) },
      seguros: { ...createEmptyClient(companyId).seguros, ...(row.seguros || {}) },
      evidencias: { ...createEmptyClient(companyId).evidencias, ...(row.evidencias || {}) },
    });
    setActiveTab("basic");
    setClientModalOpen(true);
  };

  const closeClientModal = () => {
    setClientModalOpen(false);
    setFormError("");
    setSubmitAttempted(false);
  };

  const openClientLanding = (row) => {
    setFormError("");
    setSubmitAttempted(false);
    setSelectedId(row.id);
    setClientModalOpen(false);
    setClientLandingOpen(true);
  };

  const closeClientLanding = () => {
    setClientLandingOpen(false);
    setFormError("");
    setSubmitAttempted(false);
  };

  const selectedClient = useMemo(() => {
    if (!selectedId) return null;
    return rows.find((r) => r.id === selectedId) || null;
  }, [rows, selectedId]);

  const fmtDateTime = (v) => {
    if (!v) return "";
    try {
      if (typeof v === "string") return v;
      if (typeof v?.toDate === "function") return v.toDate().toLocaleString();
      return String(v);
    } catch {
      return "";
    }
  };

  const getClientFieldErrors = (client) => {
    const errors = {};
    const normalized = normalizeClientBeforeSave(client);
    if (!normalized?.basic?.name?.trim()) errors.name = "Nombre es obligatorio";
    if (!normalized?.commercial?.commercialStatus?.trim()) errors.commercialStatus = "Estado comercial es obligatorio";
    return errors;
  };

  const saveClient = async ({ afterSave } = { afterSave: "stay" }) => {
    setSubmitAttempted(true);
    setFormError("");
    setSaving(true);
    try {
      const normalized = normalizeClientBeforeSave(draft);
      const errors = validateClient(normalized);
      if (errors.length) {
        setFormError(errors.join(". "));
        return;
      }

      if (!selectedId) {
        const createdRef = await addDoc(collection(db, "clients"), {
          ...normalized,
          createdAt: serverTimestamp(),
          createdBy: userId || null,
          updatedAt: serverTimestamp(),
          updatedBy: userId || null,
        });
        if (afterSave === "new") {
          setSelectedId(null);
          setDraft(createEmptyClient(companyId));
          setActiveTab("basic");
          setEditingActivityId(null);
          setEditingInterId(null);
          setSubmitAttempted(false);
        } else {
          setSelectedId(createdRef.id);
          setDraft((d) => ({ ...d, ...normalized }));
        }
      } else {
        try {
          await updateDoc(doc(db, "clients", selectedId), {
            ...normalized,
            updatedAt: serverTimestamp(),
            updatedBy: userId || null,
          });
        } catch (err) {
          if (err?.code === "not-found") {
            const createdRef = await addDoc(collection(db, "clients"), {
              ...normalized,
              createdAt: serverTimestamp(),
              createdBy: userId || null,
              updatedAt: serverTimestamp(),
              updatedBy: userId || null,
            });
            if (afterSave === "new") {
              setSelectedId(null);
              setDraft(createEmptyClient(companyId));
              setActiveTab("basic");
              setEditingActivityId(null);
              setEditingInterId(null);
              setSubmitAttempted(false);
            } else {
              setSelectedId(createdRef.id);
              setDraft((d) => ({ ...d, ...normalized }));
            }
          } else {
            throw err;
          }
        }

        if (afterSave === "new") {
          setSelectedId(null);
          setDraft(createEmptyClient(companyId));
          setActiveTab("basic");
          setEditingActivityId(null);
          setEditingInterId(null);
          setSubmitAttempted(false);
        }
      }
    } catch (err) {
      console.error(err);
      setFormError(err?.message || "Error guardando cliente");
    } finally {
      setSaving(false);
    }
  };

  const startNewActivity = () => {
    setEditingActivityId(null);
    setActivityDraft({
      activity: "",
      commitment: "",
      responsibleUid: "",
      status: "EN_PROCESO",
      dueDate: "",
      progress: 0,
      notes: "",
    });
  };

  const startEditActivity = (row) => {
    setEditingActivityId(row.id);
    setActivityDraft({
      activity: row.activity || "",
      commitment: row.commitment || "",
      responsibleUid: row.responsibleUid || "",
      status: row.status || "EN_PROCESO",
      dueDate: row.dueDate || "",
      progress: typeof row.progress === "number" ? row.progress : 0,
      notes: row.notes || "",
    });
  };

  const saveActivity = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!selectedId) {
      setFormError("Primero selecciona un cliente para agregar actividades");
      return;
    }

    const activity = (activityDraft.activity || "").trim();
    if (!activity) {
      setFormError("Actividad es obligatoria");
      return;
    }

    setSaving(true);
    try {
      const basePayload = {
        activity,
        clientId: selectedId,
        clientName: (draft.basic.name || "").trim(),
        companyId: companyId || "abp",
        commitment: (activityDraft.commitment || "").trim(),
        responsibleUid: (activityDraft.responsibleUid || "").trim(),
        status: activityDraft.status,
        dueDate: activityDraft.dueDate || "",
        progress: Number(activityDraft.progress) || 0,
        notes: (activityDraft.notes || "").trim(),
        updatedAt: serverTimestamp(),
        updatedBy: userId || null,
      };

      let payloadWithHistory = basePayload;

      if (!editingActivityId) {
        // Nueva actividad: crear historial con evento CREADA
        const historyEntry = {
          at: Date.now(),
          by: userId || null,
          type: "CREADA",
          changes: {
            status: { from: null, to: basePayload.status },
            commitment: { from: null, to: basePayload.commitment },
            responsibleUid: { from: null, to: basePayload.responsibleUid },
            dueDate: { from: null, to: basePayload.dueDate },
            progress: { from: null, to: basePayload.progress },
            notes: { from: null, to: basePayload.notes },
          },
        };
        payloadWithHistory = {
          ...basePayload,
          history: [historyEntry],
        };

        // Guardar en colección global 'activities' para que aparezca en el tablero global
        await addDoc(collection(db, "activities"), {
          ...payloadWithHistory,
          createdAt: serverTimestamp(),
          createdBy: userId || null,
        });
      } else {
        const original = activityRows.find((a) => a.id === editingActivityId) || {};
        const history = Array.isArray(original.history) ? original.history.slice() : [];

        const changes = {};
        if ((original.status || "") !== basePayload.status)
          changes.status = { from: original.status || null, to: basePayload.status };
        if ((original.commitment || "") !== basePayload.commitment)
          changes.commitment = { from: original.commitment || null, to: basePayload.commitment };
        if ((original.responsibleUid || "") !== basePayload.responsibleUid)
          changes.responsibleUid = { from: original.responsibleUid || null, to: basePayload.responsibleUid };
        if ((original.dueDate || "") !== basePayload.dueDate)
          changes.dueDate = { from: original.dueDate || null, to: basePayload.dueDate };
        if ((typeof original.progress === "number" ? original.progress : 0) !== basePayload.progress)
          changes.progress = { from: typeof original.progress === "number" ? original.progress : null, to: basePayload.progress };
        if ((original.notes || "") !== basePayload.notes)
          changes.notes = { from: original.notes || null, to: basePayload.notes };

        if (Object.keys(changes).length) {
          history.push({
            at: Date.now(),
            by: userId || null,
            type: "ACTUALIZADA",
            changes,
          });
        }

        payloadWithHistory = {
          ...basePayload,
          history,
        };

        await updateDoc(doc(db, "activities", editingActivityId), payloadWithHistory);
      }

      await updateDoc(doc(db, "clients", selectedId), {
        lastActivityAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: userId || null,
      });

      startNewActivity();
    } catch (err) {
      console.error(err);
      setFormError(err?.message || "Error guardando actividad");
    } finally {
      setSaving(false);
    }
  };

  const startNewInter = () => {
    setEditingInterId(null);
    setInterDraft({
      line: "",
      insurer: "",
      policyNumber: "",
      startDate: "",
      endDate: "",
      premium: "",
      commission: "",
      status: "VIGENTE",
      renewalStatus: "NORMAL",
      driveUrl: "",
      notes: "",
    });
  };

  const startEditInter = (row) => {
    setEditingInterId(row.id);
    setInterDraft({
      line: row.line || "",
      insurer: row.insurer || "",
      policyNumber: row.policyNumber || "",
      startDate: row.startDate || "",
      endDate: row.endDate || "",
      premium: row.premium ?? "",
      commission: row.commission ?? "",
      status: row.status || "VIGENTE",
      renewalStatus: row.renewalStatus || "NORMAL",
      driveUrl: row.driveUrl || "",
      notes: row.notes || "",
    });
  };

  const clientHasLineActive = (line) => {
    if (!line) return false;
    const x = draft?.seguros?.[line];
    return !!x?.tienePoliza;
  };

  const saveInter = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!selectedId) {
      setFormError("Primero selecciona un cliente para registrar intermediaciones");
      return;
    }

    const line = (interDraft.line || "").trim();
    const startDate = (interDraft.startDate || "").trim();
    const endDate = (interDraft.endDate || "").trim();

    if (!line) {
      setFormError("Intermediación: línea es obligatoria");
      return;
    }
    if (!startDate || !endDate) {
      setFormError("Intermediación: vigencias (inicio/fin) son obligatorias");
      return;
    }
    if (!clientHasLineActive(line)) {
      setFormError("Intermediación: activa la línea en Seguros (tiene póliza) antes de registrar intermediación");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        line,
        insurer: (interDraft.insurer || "").trim(),
        policyNumber: (interDraft.policyNumber || "").trim(),
        startDate,
        endDate,
        premium: (interDraft.premium || "").toString().trim(),
        commission: (interDraft.commission || "").toString().trim(),
        status: interDraft.status,
        renewalStatus: interDraft.renewalStatus,
        driveUrl: (interDraft.driveUrl || "").trim(),
        notes: (interDraft.notes || "").trim(),
        updatedAt: serverTimestamp(),
        updatedBy: userId || null,
      };

      if (!editingInterId) {
        await addDoc(collection(db, "clients", selectedId, "intermediations"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: userId || null,
        });
      } else {
        await updateDoc(doc(db, "clients", selectedId, "intermediations", editingInterId), payload);
      }

      const nextExpiryDate = computeNextExpiryDate([
        ...interRows.filter((x) => x.id !== editingInterId),
        { ...payload, id: editingInterId || "" },
      ]);

      await updateDoc(doc(db, "clients", selectedId), {
        nextExpiryDate,
        updatedAt: serverTimestamp(),
        updatedBy: userId || null,
      });

      startNewInter();
    } catch (err) {
      console.error(err);
      setFormError(err?.message || "Error guardando intermediación");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <h2 className="h2">Clientes</h2>

      <div className="toolbar">
        <button type="button" className="btn btnPrimary" onClick={startCreate}>
          Nuevo cliente
        </button>

        <input
          className="input"
          value={search}
          placeholder="Buscar por nombre, NIT o ciudad..."
          onChange={(e) => setSearch(e.target.value)}
        />

        <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">Todos</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>

        <select className="select" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
          <option value="ALL">Ciudad (todas)</option>
          {availableCities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <input
          className="input"
          value={responsibleFilter}
          placeholder="Gestor (uid)"
          onChange={(e) => setResponsibleFilter(e.target.value)}
        />

        <select className="select" value={lineFilter} onChange={(e) => setLineFilter(e.target.value)}>
          <option value="ALL">Línea (todas)</option>
          <option value="vida">Vida</option>
          <option value="salud">Salud</option>
          <option value="generales">Generales</option>
          <option value="arl">ARL</option>
        </select>
      </div>

      {!clientLandingOpen ? (
        <div>
          {loading ? (
            <p>Cargando...</p>
          ) : filteredRows.length === 0 ? (
            <p>No hay clientes todavía.</p>
          ) : (
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>NIT</th>
                    <th>Ciudad</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Estado comercial</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr key={r.id} className={r.id === selectedId ? "rowActive" : ""}>
                      <td>{r.basic?.name || r.name}</td>
                      <td>{r.basic?.nit || r.nit}</td>
                      <td>{r.basic?.city || r.city}</td>
                      <td>{r.basic?.email || ""}</td>
                      <td>{r.basic?.phone || ""}</td>
                      <td>
                        <span className={`statusBadge status-${r.commercial?.commercialStatus}`}>
                          {r.commercial?.commercialStatus || "-"}
                        </span>
                      </td>
                      <td>
                        <span className={`statusBadge status-${r.status}`}>
                          {r.status || "-"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button type="button" className="btn" onClick={() => openClientLanding(r)}>
                            Ver
                          </button>
                          <button type="button" className="btn" onClick={() => startEdit(r)}>
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <div className="toolbar" style={{ marginBottom: 0, borderBottom: "1px solid #e5e7eb", paddingBottom: 10 }}>
            <button type="button" className="btn" onClick={closeClientLanding}>
              ← Volver a clientes
            </button>
            <div style={{ fontWeight: 800 }}>{selectedClient?.basic?.name || selectedClient?.name || "Cliente"}</div>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="btn"
              onClick={() => {
                setActiveTab("activities");
                setClientModalOpen(true);
              }}
              disabled={!selectedId}
            >
              Nueva actividad
            </button>
            <button
              type="button"
              className="btn btnPrimary"
              onClick={() => {
                setActiveTab("basic");
                setClientModalOpen(true);
              }}
              disabled={!selectedId}
            >
              Editar ficha
            </button>
          </div>

          <div>
            <div className="sectionTitle">Resumen</div>
            <div className="tableWrap">
              <table className="table">
                <tbody>
                  <tr>
                    <th style={{ width: 220 }}>NIT</th>
                    <td>{selectedClient?.basic?.nit || selectedClient?.nit || ""}</td>
                    <th style={{ width: 220 }}>Ciudad</th>
                    <td>{selectedClient?.basic?.city || selectedClient?.city || ""}</td>
                  </tr>
                  <tr>
                    <th>Email</th>
                    <td>{selectedClient?.basic?.email || ""}</td>
                    <th>Teléfono</th>
                    <td>{selectedClient?.basic?.phone || ""}</td>
                  </tr>
                  <tr>
                    <th>Estado comercial</th>
                    <td>{selectedClient?.commercial?.commercialStatus || ""}</td>
                    <th>Gestor</th>
                    <td>{selectedClient?.commercial?.responsibleUid || ""}</td>
                  </tr>
                  <tr>
                    <th>Prioridad</th>
                    <td>{selectedClient?.commercial?.priority || ""}</td>
                    <th>Estado</th>
                    <td>{selectedClient?.status || ""}</td>
                  </tr>
                  <tr>
                    <th>Últ. actividad</th>
                    <td>{fmtDateTime(selectedClient?.lastActivityAt)}</td>
                    <th>Próx. venc.</th>
                    <td>{selectedClient?.nextExpiryDate || ""}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="sectionTitle">Actividades</div>
            {activitiesLoading ? (
              <div className="smallMuted">Cargando actividades...</div>
            ) : activityRows.length === 0 ? (
              <div className="smallMuted">Sin actividades registradas.</div>
            ) : (
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", overflowX: "auto" }}>
                {["PENDIENTE", "EN_PROCESO", "COMPLETADO"].map((col) => (
                  <div key={col} style={{ minWidth: 260, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{col}</div>
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 4, background: "#fafafa" }}>
                      {activityRows
                        .filter((a) => (a.status || "PENDIENTE") === col)
                        .slice(0, 40)
                        .map((a) => (
                            <div
                              key={a.id}
                              style={{
                                borderBottom: "1px solid #e5e7eb",
                                padding: "10px 12px",
                                cursor: "pointer",
                                background: selectedActivityForView?.id === a.id ? "#eef2ff" : "white",
                                transition: "background 0.2s",
                                margin: "4px",
                                borderRadius: "6px",
                                border: selectedActivityForView?.id === a.id ? "1px solid #bfdbfe" : "1px solid transparent"
                              }}
                              onClick={() => setSelectedActivityForView(a)}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                <div style={{ fontWeight: 700, fontSize: "14px", color: "#111827" }}>{a.activity}</div>
                                <span className={`statusBadge status-${a.status}`} style={{ fontSize: "10px", padding: "2px 6px" }}>
                                  {a.status}
                                </span>
                              </div>
                              <div style={{ marginTop: 4 }}>
                                <span className="smallMuted" style={{ fontSize: "12px" }}>{a.dueDate || "Sin fecha"}</span>
                              </div>
                              <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div className="smallMuted" style={{ fontSize: "11px" }}>
                                  {a.responsibleUid || "Sin asignar"}
                                </div>
                                {typeof a.progress === "number" && (
                                  <div style={{ width: "40px", background: "#e5e7eb", height: "4px", borderRadius: "2px", overflow: "hidden" }}>
                                    <div style={{ width: `${a.progress}%`, background: "#10b981", height: "100%" }}></div>
                                  </div>
                                )}
                              </div>
                            </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedActivityForView ? (
            <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 6, padding: 12, background: "#f9fafb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Detalle actividad</div>
                  <div className="smallMuted">ID: {selectedActivityForView.id}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btnPrimary"
                    onClick={() => {
                      startEditActivity(selectedActivityForView);
                      setActiveTab("activities");
                      setClientModalOpen(true);
                    }}
                  >
                    Editar actividad
                  </button>
                  <button type="button" className="btn" onClick={() => setSelectedActivityForView(null)}>
                    Cerrar detalle
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <div>
                  <div className="smallMuted">Actividad</div>
                  <div>{selectedActivityForView.activity}</div>
                </div>
                <div>
                  <div className="smallMuted">Compromiso</div>
                  <div>{selectedActivityForView.commitment || "-"}</div>
                </div>
                <div>
                  <div className="smallMuted">Responsable (uid)</div>
                  <div>{selectedActivityForView.responsibleUid || "-"}</div>
                </div>
                <div>
                  <div className="smallMuted">Estado</div>
                  <div>{selectedActivityForView.status || "-"}</div>
                </div>
                <div>
                  <div className="smallMuted">Fecha límite</div>
                  <div>{selectedActivityForView.dueDate || "-"}</div>
                </div>
                <div>
                  <div className="smallMuted">% avance</div>
                  <div>{typeof selectedActivityForView.progress === "number" ? selectedActivityForView.progress : "-"}</div>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <div className="smallMuted">Notas</div>
                <div>{selectedActivityForView.notes || "-"}</div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="sectionTitle">Historial de cambios</div>
                {Array.isArray(selectedActivityForView.history) && selectedActivityForView.history.length ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    {selectedActivityForView.history
                      .slice()
                      .sort((a, b) => (a.at || 0) - (b.at || 0))
                      .map((h, idx) => (
                        <div key={idx} className="smallMuted" style={{ padding: "4px 0" }}>
                          <div>
                            <strong>{h.type || "CAMBIO"}</strong>
                            {" · "}
                            <span>{typeof h.at === "number" ? fmtDateTime({ toMillis: () => h.at }) : fmtDateTime(h.at)}</span>
                            {h.by ? ` · por ${h.by}` : ""}
                          </div>
                          {h.changes ? (
                            <div style={{ marginLeft: 8 }}>
                              {Object.entries(h.changes).map(([field, val]) => (
                                <div key={field}>
                                  {field}: {val.from === null || val.from === undefined || val.from === "" ? "-" : String(val.from)}
                                  {" → "}
                                  {val.to === null || val.to === undefined || val.to === "" ? "-" : String(val.to)}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="smallMuted">Sin historial registrado.</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {clientModalOpen ? (
        <div className="modalOverlay" onMouseDown={closeClientModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h3 style={{ margin: 0 }}>{selectedId ? "Editar cliente" : "Nuevo cliente"}</h3>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {selectedId ? (
                  <button type="button" className="btn" onClick={startCreate}>
                    Crear nuevo
                  </button>
                ) : null}
                <button type="button" className="btn" onClick={closeClientModal}>
                  Cerrar
                </button>
              </div>
            </div>

          <div style={{ marginTop: 12 }}>
            <div className="sectionTitle">Datos mínimos</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#333" }}>Nombre / Razón social</span>
                <input
                  className="input"
                  value={draft.basic.name}
                  onChange={(e) => setDraft((d) => ({ ...d, basic: { ...d.basic, name: e.target.value } }))}
                />
                {submitAttempted && getClientFieldErrors(draft).name ? (
                  <div className="error" style={{ fontSize: 12 }}>
                    {getClientFieldErrors(draft).name}
                  </div>
                ) : null}
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#333" }}>Estado comercial</span>
                <select
                  className="select"
                  value={draft.commercial.commercialStatus}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, commercial: { ...d.commercial, commercialStatus: e.target.value } }))
                  }
                >
                  <option value="PROSPECTO">PROSPECTO</option>
                  <option value="EN_GESTION">EN_GESTION</option>
                  <option value="CLIENTE">CLIENTE</option>
                  <option value="PERDIDO">PERDIDO</option>
                </select>
                {submitAttempted && getClientFieldErrors(draft).commercialStatus ? (
                  <div className="error" style={{ fontSize: 12 }}>
                    {getClientFieldErrors(draft).commercialStatus}
                  </div>
                ) : null}
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#333" }}>Gestor responsable (uid)</span>
                <input
                  className="input"
                  value={draft.commercial.responsibleUid}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, commercial: { ...d.commercial, responsibleUid: e.target.value } }))
                  }
                  placeholder="Opcional"
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#333" }}>NIT</span>
                <input
                  className="input"
                  value={draft.basic.nit}
                  onChange={(e) => setDraft((d) => ({ ...d, basic: { ...d.basic, nit: e.target.value } }))}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#333" }}>Ciudad</span>
                <input
                  className="input"
                  value={draft.basic.city}
                  onChange={(e) => setDraft((d) => ({ ...d, basic: { ...d.basic, city: e.target.value } }))}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#333" }}>Estado</span>
                <select
                  className="select"
                  value={draft.status}
                  onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </label>
            </div>

            <div className="toolbar" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btnPrimary"
                disabled={saving}
                onClick={() => saveClient({ afterSave: "stay" })}
              >
                {saving ? "Guardando..." : "Guardar y seguir"}
              </button>
              <button type="button" className="btn" disabled={saving} onClick={() => saveClient({ afterSave: "new" })}>
                Guardar y nuevo
              </button>
              <button type="button" className="btn" disabled={saving} onClick={closeClientModal}>
                Cancelar
              </button>
            </div>
          </div>

          <div className="tabs">
            <button
              type="button"
              className={`tab ${activeTab === "basic" ? "tabActive" : ""}`}
              onClick={() => setActiveTab("basic")}
            >
              Básico
            </button>
            <button
              type="button"
              className={`tab ${activeTab === "commercial" ? "tabActive" : ""}`}
              onClick={() => setActiveTab("commercial")}
            >
              Comercial
            </button>
            <button
              type="button"
              className={`tab ${activeTab === "activities" ? "tabActive" : ""}`}
              onClick={() => setActiveTab("activities")}
            >
              Actividades
            </button>
            <button
              type="button"
              className={`tab ${activeTab === "seguros" ? "tabActive" : ""}`}
              onClick={() => setActiveTab("seguros")}
            >
              Seguros
            </button>
            <button
              type="button"
              className={`tab ${activeTab === "intermediaciones" ? "tabActive" : ""}`}
              onClick={() => setActiveTab("intermediaciones")}
            >
              Intermediaciones
            </button>
            <button
              type="button"
              className={`tab ${activeTab === "evidencias" ? "tabActive" : ""}`}
              onClick={() => setActiveTab("evidencias")}
            >
              Evidencias Drive
            </button>
          </div>

          {formError ? <div className="error" style={{ marginTop: 12 }}>{formError}</div> : null}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveClient({ afterSave: "stay" });
            }}
            style={{ marginTop: 12, display: "grid", gap: 12 }}
          >
            {activeTab === "basic" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <TextField
                  label="Nombre / Razón social"
                  value={draft.basic.name}
                  onChange={(v) => setDraft((d) => ({ ...d, basic: { ...d.basic, name: v } }))}
                />
                <TextField
                  label="NIT"
                  value={draft.basic.nit}
                  onChange={(v) => setDraft((d) => ({ ...d, basic: { ...d.basic, nit: v } }))}
                />
                <TextField
                  label="Ciudad"
                  value={draft.basic.city}
                  onChange={(v) => setDraft((d) => ({ ...d, basic: { ...d.basic, city: v } }))}
                />
                <SelectField
                  label="Estado"
                  value={draft.status}
                  onChange={(v) => setDraft((d) => ({ ...d, status: v }))}
                  options={[
                    { value: "ACTIVE", label: "ACTIVE" },
                    { value: "INACTIVE", label: "INACTIVE" },
                  ]}
                />
                <TextField
                  label="Email"
                  value={draft.basic.email}
                  onChange={(v) => setDraft((d) => ({ ...d, basic: { ...d.basic, email: v } }))}
                />
                <TextField
                  label="Teléfono"
                  value={draft.basic.phone}
                  onChange={(v) => setDraft((d) => ({ ...d, basic: { ...d.basic, phone: v } }))}
                />
                <div style={{ gridColumn: "1 / -1" }}>
                  <TextField
                    label="Dirección"
                    value={draft.basic.address}
                    onChange={(v) => setDraft((d) => ({ ...d, basic: { ...d.basic, address: v } }))}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Contactos</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {(draft.basic.contacts || []).map((c, idx) => (
                      <div
                        key={idx}
                        style={{ border: "1px solid #eee", borderRadius: 10, padding: 10, display: "grid", gap: 10 }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontWeight: 600 }}>Contacto #{idx + 1}</div>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((d) => ({
                                ...d,
                                basic: {
                                  ...d.basic,
                                  contacts: (d.basic.contacts || []).filter((_, i) => i !== idx),
                                },
                              }))
                            }
                            disabled={(draft.basic.contacts || []).length <= 1}
                          >
                            Eliminar
                          </button>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                          <TextField
                            label="Nombre"
                            value={c.name}
                            onChange={(v) =>
                              setDraft((d) => {
                                const next = structuredClone(d);
                                next.basic.contacts[idx].name = v;
                                return next;
                              })
                            }
                          />

                          <SelectField
                            label="Tipo"
                            value={c.role}
                            onChange={(v) =>
                              setDraft((d) => {
                                const next = structuredClone(d);
                                next.basic.contacts[idx].role = v;
                                return next;
                              })
                            }
                            options={[
                              { value: "PRINCIPAL", label: "PRINCIPAL" },
                              { value: "ALTERNO", label: "ALTERNO" },
                            ]}
                          />

                          <TextField
                            label="Email"
                            value={c.email}
                            onChange={(v) =>
                              setDraft((d) => {
                                const next = structuredClone(d);
                                next.basic.contacts[idx].email = v;
                                return next;
                              })
                            }
                          />

                          <TextField
                            label="Teléfono"
                            value={c.phone}
                            onChange={(v) =>
                              setDraft((d) => {
                                const next = structuredClone(d);
                                next.basic.contacts[idx].phone = v;
                                return next;
                              })
                            }
                          />
                        </div>

                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ fontSize: 12, color: "#333" }}>Notas</span>
                          <textarea
                            value={c.notes}
                            onChange={(e) =>
                              setDraft((d) => {
                                const next = structuredClone(d);
                                next.basic.contacts[idx].notes = e.target.value;
                                return next;
                              })
                            }
                            rows={3}
                            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                          />
                        </label>
                      </div>
                    ))}

                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            basic: {
                              ...d.basic,
                              contacts: [
                                ...(d.basic.contacts || []),
                                { name: "", role: "ALTERNO", email: "", phone: "", notes: "" },
                              ],
                            },
                          }))
                        }
                      >
                        + Agregar contacto
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "commercial" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <SelectField
                  label="Estado comercial"
                  value={draft.commercial.commercialStatus}
                  onChange={(v) => setDraft((d) => ({ ...d, commercial: { ...d.commercial, commercialStatus: v } }))}
                  options={[
                    { value: "PROSPECTO", label: "Prospecto" },
                    { value: "EN_GESTION", label: "En gestión" },
                    { value: "ACTIVO", label: "Activo" },
                    { value: "INACTIVO", label: "Inactivo" },
                  ]}
                />

                <TextField
                  label="Gestor responsable (uid)"
                  value={draft.commercial.responsibleUid}
                  onChange={(v) => setDraft((d) => ({ ...d, commercial: { ...d.commercial, responsibleUid: v } }))}
                />

                <TextField
                  label="Prioridad"
                  value={draft.commercial.priority}
                  onChange={(v) => setDraft((d) => ({ ...d, commercial: { ...d.commercial, priority: v } }))}
                />

                <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                  <span style={{ fontSize: 12, color: "#333" }}>Observaciones</span>
                  <textarea
                    value={draft.commercial.notes}
                    onChange={(e) => setDraft((d) => ({ ...d, commercial: { ...d.commercial, notes: e.target.value } }))}
                    rows={5}
                    style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                  />
                </label>
              </div>
            ) : null}

            {activeTab === "activities" ? (
              <div style={{ display: "grid", gap: 12 }}>
                {!selectedId ? <div style={{ color: "#666" }}>Guarda el cliente primero para registrar actividades.</div> : null}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <button type="button" onClick={startNewActivity} disabled={!selectedId}>
                    Nueva actividad
                  </button>

                  <select
                    value={activityStatusFilter}
                    onChange={(e) => setActivityStatusFilter(e.target.value)}
                    style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                  >
                    <option value="ALL">Estado (todos)</option>
                    <option value="EN_PROCESO">EN_PROCESO</option>
                    <option value="FINALIZADO">FINALIZADO</option>
                  </select>

                  <input
                    value={activityResponsibleFilter}
                    placeholder="Responsable (uid)"
                    onChange={(e) => setActivityResponsibleFilter(e.target.value)}
                    style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, minWidth: 180 }}
                    disabled={!selectedId}
                  />
                </div>

                <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                  {activitiesLoading ? (
                    <div>Cargando actividades...</div>
                  ) : activityRows.length === 0 ? (
                    <div style={{ color: "#666" }}>No hay actividades.</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", width: "100%" }}>
                        <thead>
                          <tr>
                            <th>Actividad</th>
                            <th>Responsable</th>
                            <th>Estado</th>
                            <th>Vence</th>
                            <th>%</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {activityRows
                            .filter((a) => {
                              const statusOk = activityStatusFilter === "ALL" ? true : a.status === activityStatusFilter;
                              if (!statusOk) return false;
                              const rf = activityResponsibleFilter.trim();
                              if (!rf) return true;
                              return (a.responsibleUid || "").trim() === rf;
                            })
                            .map((a) => (
                              <tr key={a.id} style={{ background: a.id === editingActivityId ? "#f6f6f6" : "transparent" }}>
                                <td>{a.activity}</td>
                                <td>{a.responsibleUid || ""}</td>
                                <td>{a.status}</td>
                                <td>{a.dueDate || ""}</td>
                                <td>{typeof a.progress === "number" ? a.progress : ""}</td>
                                <td>
                                  <button type="button" onClick={() => startEditActivity(a)}>
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

                <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{editingActivityId ? "Editar actividad" : "Nueva actividad"}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                    <TextField label="Actividad" value={activityDraft.activity} onChange={(v) => setActivityDraft((d) => ({ ...d, activity: v }))} />
                    <TextField label="Compromiso" value={activityDraft.commitment} onChange={(v) => setActivityDraft((d) => ({ ...d, commitment: v }))} />
                    <TextField
                      label="Responsable (uid)"
                      value={activityDraft.responsibleUid}
                      onChange={(v) => setActivityDraft((d) => ({ ...d, responsibleUid: v }))}
                    />
                    <SelectField
                      label="Estado"
                      value={activityDraft.status}
                      onChange={(v) => setActivityDraft((d) => ({ ...d, status: v }))}
                      options={[
                        { value: "EN_PROCESO", label: "EN_PROCESO" },
                        { value: "FINALIZADO", label: "FINALIZADO" },
                      ]}
                    />
                    <TextField label="Fecha límite" type="date" value={activityDraft.dueDate} onChange={(v) => setActivityDraft((d) => ({ ...d, dueDate: v }))} />
                    <TextField
                      label="% avance"
                      type="number"
                      value={activityDraft.progress}
                      onChange={(v) => setActivityDraft((d) => ({ ...d, progress: v }))}
                    />
                    <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                      <span style={{ fontSize: 12, color: "#333" }}>Notas</span>
                      <textarea
                        value={activityDraft.notes}
                        onChange={(e) => setActivityDraft((d) => ({ ...d, notes: e.target.value }))}
                        rows={4}
                        style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                      />
                    </label>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                    <button type="button" onClick={saveActivity} disabled={saving || !selectedId}>
                      {saving ? "Guardando..." : "Guardar actividad"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "seguros" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <PolicyBlock
                  title="Vida"
                  value={draft.seguros.vida}
                  onChange={(v) => setDraft((d) => ({ ...d, seguros: { ...d.seguros, vida: v } }))}
                />
                <PolicyBlock
                  title="Salud"
                  value={draft.seguros.salud}
                  onChange={(v) => setDraft((d) => ({ ...d, seguros: { ...d.seguros, salud: v } }))}
                />
                <PolicyBlock
                  title="Generales"
                  value={draft.seguros.generales}
                  onChange={(v) => setDraft((d) => ({ ...d, seguros: { ...d.seguros, generales: v } }))}
                />
                <PolicyBlock
                  title="ARL"
                  value={draft.seguros.arl}
                  onChange={(v) => setDraft((d) => ({ ...d, seguros: { ...d.seguros, arl: v } }))}
                />
              </div>
            ) : null}

            {activeTab === "intermediaciones" ? (
              <div style={{ display: "grid", gap: 12 }}>
                {!selectedId ? <div style={{ color: "#666" }}>Guarda el cliente primero para registrar intermediaciones.</div> : null}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <button type="button" onClick={startNewInter} disabled={!selectedId}>
                    Nueva intermediación
                  </button>

                  <select
                    value={interLineFilter}
                    onChange={(e) => setInterLineFilter(e.target.value)}
                    style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                    disabled={!selectedId}
                  >
                    <option value="ALL">Línea (todas)</option>
                    <option value="vida">Vida</option>
                    <option value="salud">Salud</option>
                    <option value="generales">Generales</option>
                    <option value="arl">ARL</option>
                  </select>

                  <select
                    value={interStatusFilter}
                    onChange={(e) => setInterStatusFilter(e.target.value)}
                    style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                    disabled={!selectedId}
                  >
                    <option value="ALL">Estado (todos)</option>
                    <option value="VIGENTE">VIGENTE</option>
                    <option value="VENCIDA">VENCIDA</option>
                    <option value="CANCELADA">CANCELADA</option>
                  </select>
                </div>

                <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                  {interLoading ? (
                    <div>Cargando intermediaciones...</div>
                  ) : interRows.length === 0 ? (
                    <div style={{ color: "#666" }}>No hay intermediaciones.</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", width: "100%" }}>
                        <thead>
                          <tr>
                            <th>Línea</th>
                            <th>Aseguradora</th>
                            <th>Póliza</th>
                            <th>Inicio</th>
                            <th>Fin</th>
                            <th>Estado</th>
                            <th>Renovación</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {interRows
                            .filter((x) => {
                              const lineOk = interLineFilter === "ALL" ? true : x.line === interLineFilter;
                              if (!lineOk) return false;
                              const statusOk = interStatusFilter === "ALL" ? true : x.status === interStatusFilter;
                              return statusOk;
                            })
                            .map((x) => (
                              <tr key={x.id} style={{ background: x.id === editingInterId ? "#f6f6f6" : "transparent" }}>
                                <td>{x.line}</td>
                                <td>{x.insurer || ""}</td>
                                <td>{x.policyNumber || ""}</td>
                                <td>{x.startDate || ""}</td>
                                <td>{x.endDate || ""}</td>
                                <td>{x.status || ""}</td>
                                <td>{x.renewalStatus || ""}</td>
                                <td>
                                  <button type="button" onClick={() => startEditInter(x)}>
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

                <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{editingInterId ? "Editar intermediación" : "Nueva intermediación"}</div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                    <SelectField
                      label="Línea"
                      value={interDraft.line}
                      onChange={(v) => setInterDraft((d) => ({ ...d, line: v }))}
                      options={[
                        { value: "", label: "Selecciona..." },
                        { value: "vida", label: "Vida" },
                        { value: "salud", label: "Salud" },
                        { value: "generales", label: "Generales" },
                        { value: "arl", label: "ARL" },
                      ]}
                    />
                    <SelectField
                      label="Estado"
                      value={interDraft.status}
                      onChange={(v) => setInterDraft((d) => ({ ...d, status: v }))}
                      options={[
                        { value: "VIGENTE", label: "VIGENTE" },
                        { value: "VENCIDA", label: "VENCIDA" },
                        { value: "CANCELADA", label: "CANCELADA" },
                      ]}
                    />

                    <TextField
                      label="Aseguradora"
                      value={interDraft.insurer}
                      onChange={(v) => setInterDraft((d) => ({ ...d, insurer: v }))}
                    />
                    <TextField
                      label="Póliza / Contrato"
                      value={interDraft.policyNumber}
                      onChange={(v) => setInterDraft((d) => ({ ...d, policyNumber: v }))}
                    />

                    <TextField
                      label="Inicio"
                      type="date"
                      value={interDraft.startDate}
                      onChange={(v) => setInterDraft((d) => ({ ...d, startDate: v }))}
                    />
                    <TextField
                      label="Fin"
                      type="date"
                      value={interDraft.endDate}
                      onChange={(v) => setInterDraft((d) => ({ ...d, endDate: v }))}
                    />

                    <TextField
                      label="Prima"
                      value={interDraft.premium}
                      onChange={(v) => setInterDraft((d) => ({ ...d, premium: v }))}
                    />
                    <TextField
                      label="Comisión"
                      value={interDraft.commission}
                      onChange={(v) => setInterDraft((d) => ({ ...d, commission: v }))}
                    />

                    <SelectField
                      label="Renovación"
                      value={interDraft.renewalStatus}
                      onChange={(v) => setInterDraft((d) => ({ ...d, renewalStatus: v }))}
                      options={[
                        { value: "NORMAL", label: "NORMAL" },
                        { value: "EN_RENOVACION", label: "EN_RENOVACION" },
                      ]}
                    />

                    <TextField
                      label="Link Drive"
                      value={interDraft.driveUrl}
                      onChange={(v) => setInterDraft((d) => ({ ...d, driveUrl: v }))}
                    />

                    <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                      <span style={{ fontSize: 12, color: "#333" }}>Notas</span>
                      <textarea
                        value={interDraft.notes}
                        onChange={(e) => setInterDraft((d) => ({ ...d, notes: e.target.value }))}
                        rows={4}
                        style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                      />
                    </label>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      <div>Requiere línea activa (tiene póliza) en Seguros.</div>
                      <div>Próximo vencimiento: {draft?.nextExpiryDate || ""}</div>
                    </div>

                    <button type="button" onClick={saveInter} disabled={saving || !selectedId}>
                      {saving ? "Guardando..." : "Guardar intermediación"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "evidencias" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <TextField
                  label="Link Drive (carpeta/archivo)"
                  value={draft.evidencias.driveUrl}
                  onChange={(v) => setDraft((d) => ({ ...d, evidencias: { ...d.evidencias, driveUrl: v } }))}
                  placeholder="https://drive.google.com/..."
                />
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#333" }}>Notas</span>
                  <textarea
                    value={draft.evidencias.notes}
                    onChange={(e) => setDraft((d) => ({ ...d, evidencias: { ...d.evidencias, notes: e.target.value } }))}
                    rows={5}
                    style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                  />
                </label>
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <div style={{ fontSize: 12, color: "#666" }}>
                <div>companyId: {companyId}</div>
                <div>id: {selectedId || "(nuevo)"}</div>
              </div>
              <button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
