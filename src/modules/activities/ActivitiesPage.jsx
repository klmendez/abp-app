import { useEffect, useMemo, useState } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import ActivityHeader from "./components/ActivityHeader";
import ActivityFilters from "./components/ActivityFilters";
import ActivityBoard from "./components/ActivityBoard";
import ActivityForm from "./components/ActivityForm";
import ActivityDetail from "./components/ActivityDetail";
import ActivityNoveltyModal from "./components/ActivityNoveltyModal";

const STATUS_COLUMNS = ["PENDIENTE", "EN_PROCESO", "COMPLETADA"];

const createEmptyNoveltyDraft = () => ({
  date: "",
  title: "",
  description: "",
  nextStep: "",
});

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
  const [addingNovelty, setAddingNovelty] = useState(false);
  const [noveltyError, setNoveltyError] = useState("");
  const [noveltyModalOpen, setNoveltyModalOpen] = useState(false);
  const [noveltyDraft, setNoveltyDraft] = useState(() => createEmptyNoveltyDraft());
  const [editingNoveltyId, setEditingNoveltyId] = useState(null);
  const [editingNoveltyCreatedAt, setEditingNoveltyCreatedAt] = useState(null);

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
    setNoveltyError("");
    setNoveltyModalOpen(false);
    setNoveltyDraft(createEmptyNoveltyDraft());
    setEditingNoveltyId(null);
    setEditingNoveltyCreatedAt(null);
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
    setNoveltyError("");
    setNoveltyModalOpen(false);
    setNoveltyDraft(createEmptyNoveltyDraft());
    setEditingNoveltyId(null);
    setEditingNoveltyCreatedAt(null);
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
    setNoveltyError("");
    setNoveltyModalOpen(false);
    setNoveltyDraft(createEmptyNoveltyDraft());
    setEditingNoveltyId(null);
    setEditingNoveltyCreatedAt(null);
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
    setNoveltyError("");
    setNoveltyModalOpen(false);
    setNoveltyDraft(createEmptyNoveltyDraft());
    setEditingNoveltyId(null);
    setEditingNoveltyCreatedAt(null);
  };

  const handleSelectActivity = (activity) => {
    setSelectedForView(activity);
    setView("detail");
    setNoveltyModalOpen(false);
    setNoveltyDraft(createEmptyNoveltyDraft());
    setNoveltyError("");
    setEditingNoveltyId(null);
    setEditingNoveltyCreatedAt(null);
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

  const handleNoveltyFieldChange = (field, value) => {
    setNoveltyDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleOpenNoveltyModal = (novelty = null) => {
    if (!selectedForView?.id) return;
    if (novelty) {
      setNoveltyDraft({
        date: novelty.date || "",
        title: novelty.title || "",
        description: novelty.description || "",
        nextStep: novelty.nextStep || "",
      });
      setEditingNoveltyId(novelty.id || null);
      setEditingNoveltyCreatedAt(Number.isFinite(novelty.createdAt) ? novelty.createdAt : null);
    } else {
      setNoveltyDraft(createEmptyNoveltyDraft());
      setEditingNoveltyId(null);
      setEditingNoveltyCreatedAt(null);
    }
    setNoveltyModalOpen(true);
    setNoveltyError("");
  };

  const handleCloseNoveltyModal = () => {
    if (addingNovelty) return;
    setNoveltyModalOpen(false);
    setNoveltyDraft(createEmptyNoveltyDraft());
    setNoveltyError("");
    setEditingNoveltyId(null);
    setEditingNoveltyCreatedAt(null);
  };

  const handleAddNovelty = async ({ date, title, description, nextStep }) => {
    if (!selectedForView?.id) return false;
    const cleanDate = String(date || "").trim();
    const cleanTitle = (title || "").trim();
    const cleanDescription = (description || "").trim();
    const cleanNextStep = (nextStep || "").trim();

    if (!cleanDate || !cleanTitle || !cleanDescription || !cleanNextStep) {
      setNoveltyError("Completa fecha, título, descripción y paso a seguir");
      return false;
    }

    setNoveltyError("");
    setAddingNovelty(true);

    const targetId = selectedForView.id;
    const original = rows.find((r) => r.id === targetId) || selectedForView;
    const prevNovelties = Array.isArray(original.novelties) ? original.novelties.slice() : [];

    const randomId = () => {
      if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return Math.random().toString(36).slice(2);
    };

    const now = Date.now();
    const updatingExisting = Boolean(editingNoveltyId || editingNoveltyCreatedAt);

    const buildUpdatedEntry = (entry) => ({
      ...entry,
      date: cleanDate,
      title: cleanTitle,
      description: cleanDescription,
      nextStep: cleanNextStep,
      updatedAt: now,
      updatedBy: userId || null,
    });

    let nextNovelties = prevNovelties;

    if (updatingExisting) {
      let replaced = false;
      nextNovelties = prevNovelties.map((entry) => {
        const sameId = editingNoveltyId && entry.id === editingNoveltyId;
        const sameCreatedAt = !editingNoveltyId && editingNoveltyCreatedAt && entry.createdAt === editingNoveltyCreatedAt;
        if (sameId || sameCreatedAt) {
          replaced = true;
          return buildUpdatedEntry(entry);
        }
        return entry;
      });

      if (!replaced) {
        const fallbackEntry = {
          id: editingNoveltyId || randomId(),
          date: cleanDate,
          title: cleanTitle,
          description: cleanDescription,
          nextStep: cleanNextStep,
          createdAt: editingNoveltyCreatedAt || now,
          createdBy: userId || null,
          updatedAt: now,
          updatedBy: userId || null,
        };
        nextNovelties = [...prevNovelties, fallbackEntry];
      }
    } else {
      const noveltyEntry = {
        id: randomId(),
        date: cleanDate,
        title: cleanTitle,
        description: cleanDescription,
        nextStep: cleanNextStep,
        createdAt: now,
        createdBy: userId || null,
      };
      nextNovelties = [...prevNovelties, noveltyEntry];
    }

    try {
      await updateDoc(doc(db, "activities", targetId), {
        novelties: nextNovelties,
        updatedAt: serverTimestamp(),
        updatedBy: userId || null,
      });

      setSelectedForView((prev) => (prev?.id === targetId ? { ...prev, novelties: nextNovelties } : prev));
      setRows((prev) => prev.map((row) => (row.id === targetId ? { ...row, novelties: nextNovelties } : row)));
      setNoveltyDraft(createEmptyNoveltyDraft());
      setNoveltyModalOpen(false);
      setEditingNoveltyId(null);
      setEditingNoveltyCreatedAt(null);
      return true;
    } catch (err) {
      console.error(err);
      setNoveltyError(err?.message || "Error guardando novedad");
      return false;
    } finally {
      setAddingNovelty(false);
    }
  };

  return (
    <div className="homeShell activitiesShell">
      <section className="homeQuick activitiesLayout">

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
            onOpenNoveltyModal={handleOpenNoveltyModal}
          />
        ) : null}

        <ActivityNoveltyModal
          open={noveltyModalOpen && !!selectedForView}
          activity={selectedForView}
          draft={noveltyDraft}
          error={noveltyError}
          saving={addingNovelty}
          isEditing={Boolean(editingNoveltyId || editingNoveltyCreatedAt)}
          onFieldChange={handleNoveltyFieldChange}
          onSubmit={() => handleAddNovelty(noveltyDraft)}
          onClose={handleCloseNoveltyModal}
        />

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