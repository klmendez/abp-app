export default function ActivityBoard({
  loading,
  filteredRows,
  statuses,
  dueDateSortKey,
  isOverdueActivity,
  onSelectActivity,
  clientNameForRow,
  responsibleText,
  assignerText,
}) {
  if (loading) {
    return (
      <div className="smallMuted" style={{ padding: 18 }}>
        Cargando actividades...
      </div>
    );
  }

  if (filteredRows.length === 0) {
    return <div className="tableEmpty">No hay actividades que coincidan con los filtros.</div>;
  }

  return (
    <div className="activityBoard">
      {statuses.map((status) => {
        const columnItems = filteredRows
          .filter((row) => (row.status || "PENDIENTE") === status)
          .slice()
          .sort((a, b) => {
            const ak = dueDateSortKey(a?.dueDate);
            const bk = dueDateSortKey(b?.dueDate);
            if (ak === null && bk === null) return 0;
            if (ak === null) return 1;
            if (bk === null) return -1;
            return ak - bk;
          });

        const laneClass = `activityLane activityLane--${status.toLowerCase()}`;

        return (
          <section key={status} className={laneClass} aria-label={`Columna ${status}`}>
            <header className="activityLaneHeader">
              <div className="activityLaneTitle">{status}</div>
              <div className="activityLaneCount">{columnItems.length}</div>
            </header>

            <div className="activityLaneBody">
              {columnItems.map((row) => {
                const overdue = isOverdueActivity(row);
                const title = row.title || row.activity || "(Sin título)";
                const due = row.dueDate || "Sin fecha";
                const client = clientNameForRow(row);
                const resp = responsibleText(row.responsibleUid);
                const progress = typeof row.progress === "number" ? row.progress : null;
                const desc = String(row.description || row.notes || "").trim() ? row.description || row.notes : "-";
                const assigner = assignerText(row.createdBy || row.updatedBy || row.assignerUid);

                return (
                  <button
                    key={row.id}
                    type="button"
                    className={`activityRow ${overdue ? "isOverdue" : ""}`}
                    onClick={() => onSelectActivity(row)}
                  >
                    <div className="activityRowMain">
                      <div className="activityRowTitle" title={title}>
                        {title}
                      </div>
                      <div className="activityRowMeta">
                        <div className="activityMetaItem isDue">
                          <span className="activityMetaLabel">Fecha límite</span>
                          <span className="activityMetaValue">{due}</span>
                        </div>

                        {client ? (
                          <div className="activityMetaItem">
                            <span className="activityMetaLabel">Cliente</span>
                            <span className="activityMetaValue" title={client}>
                              {client}
                            </span>
                          </div>
                        ) : null}

                        <div className="activityMetaItem isResp">
                          <span className="activityMetaLabel">Responsable</span>
                          <span className="activityMetaValue" title={resp}>
                            {resp}
                          </span>
                        </div>

                        <div className="activityMetaItem isAssigner">
                          <span className="activityMetaLabel">Asignada por</span>
                          <span className="activityMetaValue" title={assigner}>
                            {assigner}
                          </span>
                        </div>
                      </div>

                      <div className="activityRowDesc" title={typeof desc === "string" ? desc : ""}>
                        {desc}
                      </div>
                    </div>

                    <div className="activityRowStatusBar">
                      <div className="activityRowStatus">
                        <span className={`statusBadge status-${row.status}`}>{row.status || "-"}</span>
                      </div>

                      <div className="activityRowProgress" aria-label={`Avance ${progress ?? 0}%`}>
                        <div className="activityRowProgressBar">
                          <div className="activityRowProgressFill" style={{ width: `${progress ?? 0}%` }} />
                        </div>
                        <div className="activityRowProgressPct">{progress !== null ? `${progress}%` : "-"}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}