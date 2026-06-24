export default function ActivityHeader({ view, selectedActivity, onCreate, onBackToBoard, onEditSelected }) {
  return (
    <div className="pageActions">
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
  );
}
