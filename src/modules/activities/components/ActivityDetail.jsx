export default function ActivityDetail({
  activity,
  clients,
  onEditClient,
  onEditActivity,
  responsibleText,
  assignerText,
  clientLabel,
  fieldLabel,
  formatChangeValue,
}) {
  if (!activity) return null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="sectionTitle">Detalle de actividad</div>

      <div className="homeQuickCard" style={{ textAlign: "left", cursor: "default" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{activity.title || activity.activity}</div>
            <div className="smallMuted">ID: {activity.id}</div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {activity.clientId ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const found = clients.find((client) => client.id === activity.clientId);
                  if (!found) return;
                  onEditClient?.(found);
                }}
              >
                Editar cliente
              </button>
            ) : null}
            <button type="button" className="btn" onClick={() => onEditActivity?.(activity)}>
              Editar
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <div>
            <div className="smallMuted">Estado</div>
            <div>{activity.status || "-"}</div>
          </div>
          <div>
            <div className="smallMuted">Responsable</div>
            <div>{responsibleText(activity.responsibleUid)}</div>
          </div>
          <div>
            <div className="smallMuted">Asignada por</div>
            <div>{assignerText(activity.createdBy || activity.updatedBy || activity.assignerUid)}</div>
          </div>
          <div>
            <div className="smallMuted">Fecha límite</div>
            <div>{activity.dueDate || "Sin fecha"}</div>
          </div>
          <div>
            <div className="smallMuted">% avance</div>
            <div>{typeof activity.progress === "number" ? `${activity.progress}%` : "-"}</div>
          </div>
          <div>
            <div className="smallMuted">Cliente</div>
            <div>{activity.clientName || activity.clientId || "-"}</div>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="smallMuted">Descripción</div>
          <div>{activity.description || activity.notes || "-"}</div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="sectionTitle">Historial</div>

          {Array.isArray(activity.history) && activity.history.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {activity.history
                .slice()
                .sort((a, b) => (b.at || 0) - (a.at || 0))
                .map((entry, idx) => (
                  <div key={`${entry.type}-${entry.at}-${idx}`} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "#fafafa" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800 }}>{entry.type || "CAMBIO"}</div>
                      <div className="smallMuted">
                        {typeof entry.at === "number" ? new Date(entry.at).toLocaleString() : String(entry.at)}
                        {entry.by ? ` · por ${entry.by}` : ""}
                      </div>
                    </div>

                    {entry.changes && Object.keys(entry.changes).length ? (
                      <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
                        {Object.entries(entry.changes).map(([field, val]) => (
                          <div key={field} style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10 }}>
                            <div className="smallMuted" style={{ fontWeight: 700 }}>
                              {fieldLabel(field)}
                            </div>
                            <div>
                              <span style={{ fontWeight: 700 }}>{formatChangeValue(field, val?.from)}</span>
                              {" → "}
                              <span style={{ fontWeight: 700 }}>{formatChangeValue(field, val?.to)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="smallMuted" style={{ marginTop: 8 }}>
                        Sin detalles de cambios.
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <div className="smallMuted">Sin historial registrado.</div>
          )}
        </div>
      </div>
    </div>
  );
}
