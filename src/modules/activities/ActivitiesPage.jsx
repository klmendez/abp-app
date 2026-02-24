import { useEffect, useMemo, useState } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import ActivityHeader from "./components/ActivityHeader";
import ActivityFilters from "./components/ActivityFilters";
import ActivityBoard from "./components/ActivityBoard";
import ActivityForm from "./components/ActivityForm";
import ActivityDetail from "./components/ActivityDetail";

const STATUS_COLUMNS = ["PENDIENTE", "EN_PROCESO", "COMPLETADA"];

export default function ActivitiesPage({
  companyId = "abp",
  userId,
  initialClient,
  onInitialClientConsumed,
  initialEditActivity,
  onInitialEditActivityConsumed,
  onEditClientFromActivity,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [responsibleFilter, setResponsibleFilter] = useState("");
  const [onlyWithoutClient, setOnlyWithoutClient] = useState(false);
  const [search, setSearch] = useState("");

  const [view, setView] = useState("board"); // board | form | detail

  const [clients, setClients] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [users, setUsers] = useState([]);

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    responsibleUid: "",
    status: "PENDIENTE",
    dueDate: "",
    progress: 0,
    clientId: "",
    clientName: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedForView, setSelectedForView] = useState(null);

  useEffect(() => {
    const col = collection(db, "activities");
    const q = query(col, where("companyId", "==", companyId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
    const q = query(collection(db, "clients"), where("companyId", "==", companyId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setClients(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      },
      (err) => {
        console.error(err);
      }
    );
    return () => unsub();
  }, [companyId]);

  useEffect(() => {
    const q = collection(db, "companies", companyId, "memberships");
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMemberships(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error(err);
      }
    );
    return () => unsub();
  }, [companyId]);

  useEffect(() => {
    const q = collection(db, "users");
    const unsub = onSnapshot(
      q,
      (snap) => {
        setUsers(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      },
      (err) => {
        console.error(err);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!initialClient?.id) return;

    setEditingId(null);
    setDraft((prev) => ({
      ...prev,
      title: "",
      description: "",
      responsibleUid: "",
      status: "PENDIENTE",
      dueDate: "",
      progress: 0,
      clientId: initialClient.id,
      clientName: initialClient.basic?.name || initialClient.name || "",
    }));
    setError("");
    setSelectedForView(null);
    setView("form");
    onInitialClientConsumed?.();
  }, [initialClient?.id]);

  useEffect(() => {
    if (!initialEditActivity?.id) return;

    startEdit(initialEditActivity);
    onInitialEditActivityConsumed?.();
  }, [initialEditActivity?.id]);

  const startNew = () => {
    setEditingId(null);
    setDraft({
      title: "",
      description: "",
      responsibleUid: "",
      status: "PENDIENTE",
      dueDate: "",
      progress: 0,
      clientId: "",
      clientName: "",
    });
    setError("");
    setSelectedForView(null);
    setView("form");
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setDraft({
      title: row.title || row.activity || "",
      description: row.description || row.notes || "",
      responsibleUid: row.responsibleUid || "",
      status: row.status || "PENDIENTE",
      dueDate: row.dueDate || "",
      progress: typeof row.progress === "number" ? row.progress : 0,
      clientId: row.clientId || "",
      clientName: row.clientName || "",
    });
    setError("");
    setSelectedForView(row);
    setView("form");
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");
    const title = (draft.title || "").trim();
    if (!title) {
      setError("Título es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const base = {
        companyId,
        title,
        description: (draft.description || "").trim(),
        responsibleUid: (draft.responsibleUid || "").trim(),
        status: draft.status,
        dueDate: draft.dueDate || "",
        progress: Number(draft.progress) || 0,
        clientId: (draft.clientId || "").trim() || null,
        clientName: (draft.clientName || "").trim() || null,
        updatedAt: serverTimestamp(),
        updatedBy: userId || null,
      };

      let payloadWithHistory = base;

      if (!editingId) {
        const historyEntry = {
          at: Date.now(),
          by: userId || null,
          type: "CREADA",
          changes: {
            status: { from: null, to: base.status },
            responsibleUid: { from: null, to: base.responsibleUid },
            dueDate: { from: null, to: base.dueDate },
            progress: { from: null, to: base.progress },
          },
        };
        payloadWithHistory = {
          ...base,
          history: [historyEntry],
        };
        await addDoc(collection(db, "activities"), {
          ...payloadWithHistory,
          createdAt: serverTimestamp(),
          createdBy: userId || null,
        });
      } else {
        const original = rows.find((r) => r.id === editingId) || {};
        const history = Array.isArray(original.history) ? original.history.slice() : [];
        const changes = {};
        if ((original.status || "") !== base.status) changes.status = { from: original.status || null, to: base.status };
        if ((original.responsibleUid || "") !== base.responsibleUid)
          changes.responsibleUid = { from: original.responsibleUid || null, to: base.responsibleUid };
        if ((original.dueDate || "") !== base.dueDate) changes.dueDate = { from: original.dueDate || null, to: base.dueDate };
        if ((typeof original.progress === "number" ? original.progress : 0) !== base.progress)
          changes.progress = { from: typeof original.progress === "number" ? original.progress : null, to: base.progress };

        if (Object.keys(changes).length) {
          history.push({
            at: Date.now(),
            by: userId || null,
            type: "ACTUALIZADA",
            changes,
          });
        }

        payloadWithHistory = {
          ...base,
          history,
        };

        await updateDoc(doc(db, "activities", editingId), payloadWithHistory);
      }

      setView("board");
      setSelectedForView(null);
      setEditingId(null);
      setDraft({
        title: "",
        description: "",
        responsibleUid: "",
        status: "PENDIENTE",
        dueDate: "",
        progress: 0,
        clientId: "",
        clientName: "",
      });
    } catch (err) {
      console.error(err);
      setError(err?.message || "Error guardando actividad");
    } finally {
      setSaving(false);
    }
  };

  const fieldLabel = (field) =>
    (
      {
        status: "Estado",
        responsibleUid: "Responsable",
        dueDate: "Fecha límite",
        progress: "% avance",
        clientId: "Cliente (id)",
        clientName: "Cliente (nombre)",
        title: "Título",
        description: "Descripción",
      }[field] || field
    );

  const formatChangeValue = (field, value) => {
    if (value === null || value === undefined || value === "") return "-";
    if (field === "progress") return `${value}%`;
    if (field === "dueDate") return String(value) || "-";
    return String(value);
  };

  const clientLabel = (c) => {
    if (!c) return "";
    return String(c.basic?.name || c.name || c.fullName || c.clientName || c.nombre || c.razonSocial || c.id || "");
  };

  const clientNameForRow = (r) => {
    const direct = String(r?.clientName || "").trim();
    if (direct) return direct;
    const id = String(r?.clientId || "").trim();
    if (!id) return "";
    const c = clients.find((x) => String(x?.id || "").trim() === id);
    return clientLabel(c);
  };

  const assignees = useMemo(() => {
    const map = new Map();

    const pushEntry = (id, label, role = "") => {
      const cleanId = String(id || "").trim();
      if (!cleanId) return;
      const existing = map.get(cleanId);
      if (existing) {
        if (role && !existing.role) existing.role = role;
        return;
      }
      map.set(cleanId, {
        id: cleanId,
        label: (label || cleanId).trim() || cleanId,
        role: role || "",
      });
    };

    for (const user of users) {
      const label = (user.displayName || user.name || user.email || user.id || user.uid || "").trim();
      pushEntry(user.id || user.uid, label, user.role || "");
    }

    for (const membership of memberships) {
      const keys = [membership.id, membership.uid, membership.userId, membership.authUid]
        .map((k) => String(k || "").trim())
        .filter(Boolean);
      const label = (membership.displayName || membership.name || membership.email || membership.id || "").trim();
      keys.forEach((key) => pushEntry(key, label || key, membership.role || ""));
    }

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [users, memberships]);

  const assigneeLabelById = useMemo(() => {
    const map = new Map();
    assignees.forEach((entry) => {
      map.set(entry.id, entry.label);
    });
    return map;
  }, [assignees]);

  const userLabelText = (uid, emptyLabel = "Sin dato") => {
    const id = String(uid || "").trim();
    if (!id) return emptyLabel;
    return assigneeLabelById.get(id) || id;
  };

  const responsibleText = (uid) => userLabelText(uid, "Sin asignar");
  const assignerText = (uid) => userLabelText(uid, "No registrado");

  const dueDateSortKey = (value) => {
    const s = String(value || "").trim();
    if (!s) return null;
    const t = Date.parse(s);
    if (Number.isFinite(t)) return t;
    const digits = s.replace(/[^0-9]/g, "");
    if (digits.length >= 8) {
      const yyyy = digits.slice(0, 4);
      const mm = digits.slice(4, 6);
      const dd = digits.slice(6, 8);
      const t2 = Date.parse(`${yyyy}-${mm}-${dd}`);
      if (Number.isFinite(t2)) return t2;
    }
    return null;
  };

  const isOverdueActivity = (r) => {
    const status = String(r?.status || "PENDIENTE");
    if (status === "COMPLETADA") return false;
    const key = dueDateSortKey(r?.dueDate);
    if (!key) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return key < today.getTime();
  };

  const filtered = useMemo(() => {
    const s = (search || "").trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "ALL" && (r.status || "PENDIENTE") !== statusFilter) return false;
      const rf = responsibleFilter.trim();
      if (rf && (r.responsibleUid || "").trim() !== rf) return false;
      if (onlyWithoutClient && r.clientId) return false;
      if (!s) return true;
      const title = String(r.title || r.activity || "").toLowerCase();
      const client = String(r.clientName || "").toLowerCase();
      const desc = String(r.description || r.notes || "").toLowerCase();
      return title.includes(s) || client.includes(s) || desc.includes(s);
    });
  }, [rows, statusFilter, responsibleFilter, onlyWithoutClient, search]);

  const summaryLabel = useMemo(() => {
    if (loading) return "";
    const total = rows.length;
    const curr = filtered.length;
    if (total === curr) return `Total de actividades: ${String(total).padStart(2, "0")}`;
    return `Mostrando ${curr} de ${total} actividades`;
  }, [loading, rows.length, filtered.length]);

  const handleBackToBoard = () => {
    setView("board");
    setSelectedForView(null);
    setEditingId(null);
    setError("");
  };

  const handleSelectActivity = (activity) => {
    setSelectedForView(activity);
    setView("detail");
  };

  const handleDraftChange = (field, value) => {
    setDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCancelEdit = () => {
    setView("detail");
    setError("");
  };

  return (
    <div className="homeShell">
      <section className="homeQuick">
        <ActivityHeader
          view={view}
          selectedActivity={selectedForView}
          onCreate={startNew}
          onBackToBoard={handleBackToBoard}
          onEditSelected={() => startEdit(selectedForView)}
        />

        <ActivityFilters
          view={view}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          statuses={STATUS_COLUMNS}
          responsibleFilter={responsibleFilter}
          onResponsibleChange={setResponsibleFilter}
          assignees={assignees}
          onlyWithoutClient={onlyWithoutClient}
          onToggleOnlyWithoutClient={setOnlyWithoutClient}
        />

        {view === "board" ? (
          <ActivityBoard
            loading={loading}
            filteredRows={filtered}
            statuses={STATUS_COLUMNS}
            dueDateSortKey={dueDateSortKey}
            isOverdueActivity={isOverdueActivity}
            onSelectActivity={handleSelectActivity}
            clientNameForRow={clientNameForRow}
            responsibleText={responsibleText}
            assignerText={assignerText}
          />
        ) : null}

        {view === "form" ? (
          <ActivityForm
            editingId={editingId}
            draft={draft}
            statuses={STATUS_COLUMNS}
            assignees={assignees}
            clients={clients}
            clientLabel={clientLabel}
            error={error}
            saving={saving}
            onFieldChange={handleDraftChange}
            onSubmit={save}
            onCancel={handleCancelEdit}
          />
        ) : null}

        {view === "detail" && selectedForView ? (
          <ActivityDetail
            activity={selectedForView}
            clients={clients}
            onEditClient={onEditClientFromActivity}
            onEditActivity={() => startEdit(selectedForView)}
            responsibleText={responsibleText}
            assignerText={assignerText}
            clientLabel={clientLabel}
            fieldLabel={fieldLabel}
            formatChangeValue={formatChangeValue}
          />
        ) : null}

        {summaryLabel ? (
          <div className="tableFooter">
            <span>{summaryLabel}</span>
            <span>
              Última actualización: <strong>{new Date().toLocaleDateString()}</strong>
            </span>
          </div>
        ) : null}
      </section>
    </div>
  );
}