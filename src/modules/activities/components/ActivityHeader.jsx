export default function ActivityHeader({ view, selectedActivity, onCreate, onBackToBoard, onEditSelected }) {
  return (
    <div className="homeQuickHeader">
      <div>
        <h2>Actividades</h2>
        <p>Planifica y da seguimiento a las tareas del equipo.</p>
      </div>

      <div className="homeQuickHeaderActions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {view === "board" ? (
          <button type="button" className="btn btnPrimary" onClick={onCreate}>
            Nueva actividad
          </button>
        ) : (
          <button type="button" className="btn" onClick={onBackToBoard}>
            Volver
          </button>
        )}

        {view === "detail" && selectedActivity ? (
          <button type="button" className="btn" onClick={onEditSelected}>
            Editar
          </button>
        ) : null}
      </div>
    </div>
  );
}
