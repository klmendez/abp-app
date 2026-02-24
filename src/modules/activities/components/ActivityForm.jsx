export default function ActivityForm({
  editingId,
  draft,
  statuses,
  assignees,
  clients,
  clientLabel,
  error,
  saving,
  onFieldChange,
  onSubmit,
  onCancel,
}) {
  const handleClientChange = (nextId) => {
    if (!nextId) {
      onFieldChange("clientId", "");
      onFieldChange("clientName", "");
      return;
    }
    const found = clients.find((client) => client.id === nextId);
    const name = clientLabel(found);
    onFieldChange("clientId", nextId);
    onFieldChange("clientName", name);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="sectionTitle">{editingId ? "Editar actividad" : "Nueva actividad"}</div>

      <form onSubmit={onSubmit} className="homeQuickCard" style={{ textAlign: "left", cursor: "default" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
          <div className="smallMuted">Completa los datos y guarda</div>
          {editingId ? <div className="smallMuted">ID: {editingId}</div> : null}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="smallMuted">Título</span>
            <input className="input" value={draft.title} onChange={(e) => onFieldChange("title", e.target.value)} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="smallMuted">Responsable (opcional)</span>
            <select className="select" value={draft.responsibleUid || ""} onChange={(e) => onFieldChange("responsibleUid", e.target.value)}>
              <option value="">Sin asignar</option>
              {assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.label}
                  {assignee.role ? ` · ${assignee.role}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="smallMuted">Estado</span>
            <select className="select" value={draft.status} onChange={(e) => onFieldChange("status", e.target.value)}>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="smallMuted">Fecha límite</span>
            <input type="date" className="input" value={draft.dueDate} onChange={(e) => onFieldChange("dueDate", e.target.value)} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="smallMuted">% avance</span>
            <input type="number" className="input" value={draft.progress} onChange={(e) => onFieldChange("progress", e.target.value)} />
          </label>

          <div />

          <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
            <span className="smallMuted">Descripción</span>
            <textarea className="textarea" rows={4} value={draft.description} onChange={(e) => onFieldChange("description", e.target.value)} />
          </label>

          <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
            <span className="smallMuted">Cliente (opcional)</span>
            <select className="select" value={draft.clientId || ""} onChange={(e) => handleClientChange(e.target.value)}>
              <option value="">Sin cliente</option>
              {clients
                .slice()
                .sort((a, b) => clientLabel(a).localeCompare(clientLabel(b)))
                .map((client) => (
                  <option key={client.id} value={client.id}>
                    {clientLabel(client)}
                  </option>
                ))}
            </select>
            {draft.clientId ? <div className="smallMuted">Seleccionado: {draft.clientName || draft.clientId}</div> : null}
          </label>
        </div>

        {error ? (
          <div className="error" style={{ marginTop: 8 }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14, gap: 8 }}>
          {editingId ? (
            <button type="button" className="btn" onClick={onCancel} disabled={saving}>
              Cancelar
            </button>
          ) : null}
          <button type="submit" className="btn btnPrimary" disabled={saving}>
            {saving ? "Guardando..." : "Guardar actividad"}
          </button>
        </div>
      </form>
    </div>
  );
}
