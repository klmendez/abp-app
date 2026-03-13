export default function ActivityNoveltyModal({
  open,
  activity,
  draft,
  error,
  saving,
  onFieldChange,
  onSubmit,
  onClose,
  isEditing = false,
}) {
  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit?.();
  };

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h3 style={{ margin: 0 }}>{isEditing ? "Editar novedad" : "Agregar novedad"}</h3>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cerrar
          </button>
        </div>

        <div className="smallMuted" style={{ marginTop: 6 }}>
          Actividad: <strong>{activity?.title || activity?.activity || activity?.id}</strong>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="smallMuted">Fecha</span>
            <input
              type="date"
              className="input"
              value={draft?.date || ""}
              onChange={(e) => onFieldChange?.("date", e.target.value)}
              disabled={saving}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="smallMuted">Título</span>
            <input
              className="input"
              value={draft?.title || ""}
              onChange={(e) => onFieldChange?.("title", e.target.value)}
              disabled={saving}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="smallMuted">Descripción</span>
            <textarea
              className="textarea"
              rows={3}
              value={draft?.description || ""}
              onChange={(e) => onFieldChange?.("description", e.target.value)}
              disabled={saving}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="smallMuted">Paso a seguir</span>
            <textarea
              className="textarea"
              rows={2}
              value={draft?.nextStep || ""}
              onChange={(e) => onFieldChange?.("nextStep", e.target.value)}
              disabled={saving}
            />
          </label>

          {error ? (
            <div className="error" role="alert">
              {error}
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btnPrimary" disabled={saving}>
              {saving ? "Guardando..." : isEditing ? "Actualizar novedad" : "Guardar novedad"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
