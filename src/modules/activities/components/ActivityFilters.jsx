export default function ActivityFilters({
  view,
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  statuses,
  responsibleFilter,
  onResponsibleChange,
  assignees,
  onlyWithoutClient,
  onToggleOnlyWithoutClient,
}) {
  const disabled = view !== "board";

  return (
    <div className={`activityFiltersBar ${disabled ? "isDisabled" : ""}`}>
      <div className="afItem afGrow">
        <div className="afLabel">Buscar</div>
        <input
          className="afInput"
          value={search}
          placeholder="Título, cliente o descripción..."
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="afDivider" aria-hidden />

      <div className="afItem">
        <div className="afLabel">Estado</div>
        <select className="afSelect" value={statusFilter} onChange={(e) => onStatusChange(e.target.value)} disabled={disabled}>
          <option value="ALL">TODOS</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="afDivider" aria-hidden />

      <div className="afItem">
        <div className="afLabel">Responsable</div>
        <select className="afSelect" value={responsibleFilter} onChange={(e) => onResponsibleChange(e.target.value)} disabled={disabled}>
          <option value="">TODOS</option>
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.id}>
              {assignee.label}
              {assignee.role ? ` · ${assignee.role}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="afDivider" aria-hidden />

      <label className="afToggle">
        <input
          className="afToggleInput"
          type="checkbox"
          checked={onlyWithoutClient}
          onChange={(e) => onToggleOnlyWithoutClient(e.target.checked)}
          disabled={disabled}
        />
        <span className="afToggleBox" aria-hidden />
        <span className="afToggleText">Solo sin cliente</span>
      </label>
    </div>
  );
}