import { useEffect, useMemo, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";

export default function ClientsTable({ companyId, onSelect }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [commercialFilter, setCommercialFilter] = useState("TODOS");
  const [cityFilter, setCityFilter] = useState("TODAS");
  const [sortKey, setSortKey] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");

  const contactValue = (r, key) => {
    const contacts = Array.isArray(r.basic?.contacts) ? r.basic.contacts : [];
    for (const c of contacts) {
      const v = String(c?.[key] || "").trim();
      if (v) return v;
    }
    const fallback = String(r.basic?.[key] || "").trim();
    return fallback;
  };

  useEffect(() => {
    const q = query(collection(db, "clients"), where("companyId", "==", companyId));
    const unsub = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [companyId]);

  const statusOptions = useMemo(() => {
    const values = new Set(
      rows
        .map((r) => (r.status || "").trim())
        .filter(Boolean)
        .map((v) => v.toUpperCase())
    );
    return ["TODOS", ...Array.from(values).sort()];
  }, [rows]);

  const commercialOptions = useMemo(() => {
    const values = new Set(
      rows
        .map((r) => (r.commercial?.commercialStatus || "").trim())
        .filter(Boolean)
        .map((v) => v.toUpperCase())
    );
    return ["TODOS", ...Array.from(values).sort()];
  }, [rows]);

  const cityOptions = useMemo(() => {
    const values = new Set(
      rows
        .map((r) => (r.basic?.city || r.city || "").trim())
        .filter(Boolean)
        .map((v) => v.toUpperCase())
    );
    return ["TODAS", ...Array.from(values).sort()];
  }, [rows]);

  const processedRows = useMemo(() => {
    const s = (search || "").toLowerCase().trim();
    const next = rows
      .filter((r) => {
        const name = (r.basic?.name || r.name || "").toLowerCase();
        const nit = (r.basic?.nit || r.nit || "").toLowerCase();
        const city = (r.basic?.city || r.city || "").toLowerCase();
        const matchesSearch = !s || name.includes(s) || nit.includes(s) || city.includes(s);
        const matchesStatus = statusFilter === "TODOS" || String(r.status || "").toUpperCase() === statusFilter;
        const matchesCommercial =
          commercialFilter === "TODOS" || String(r.commercial?.commercialStatus || "").toUpperCase() === commercialFilter;
        const matchesCity = cityFilter === "TODAS" || String(r.basic?.city || r.city || "").toUpperCase() === cityFilter;
        return matchesSearch && matchesStatus && matchesCommercial && matchesCity;
      })
      .slice();

    const getValue = (row) => {
      switch (sortKey) {
        case "nit":
          return String(row.basic?.nit || row.nit || "").toLowerCase();
        case "city":
          return String(row.basic?.city || row.city || "").toLowerCase();
        case "status":
          return String(row.status || "").toLowerCase();
        case "commercial":
          return String(row.commercial?.commercialStatus || "").toLowerCase();
        default:
          return String(row.basic?.name || row.name || "").toLowerCase();
      }
    };

    next.sort((a, b) => {
      const aVal = getValue(a);
      const bVal = getValue(b);
      if (aVal === bVal) return 0;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return sortDirection === "asc" ? -1 : 1;
    });

    return next;
  }, [rows, search, statusFilter, commercialFilter, cityFilter, sortKey, sortDirection]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const summaryLabel = useMemo(() => {
    if (loading) return "";
    const total = rows.length;
    const filtered = processedRows.length;
    if (filtered === total) return `Total de clientes: ${total.toString().padStart(2, "0")}`;
    return `Mostrando ${filtered} de ${total} clientes`;
  }, [rows.length, processedRows.length, loading]);

  if (loading) return <div className="smallMuted">Cargando clientes...</div>;

  return (
    <div className="tableShell">
     

      <div className="tableFilters">
        <div className="filterGroup" style={{ flex: "1 1 280px" }}>
          <span className="filterLabel">Buscar</span>
          <input
            className="input inputDense"
            value={search}
            placeholder="Nombre, NIT o ciudad..."
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filterGroup">
          <span className="filterLabel">Ciudad</span>
          <select className="select selectDense" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
            {cityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="filterGroup">
          <span className="filterLabel">Estado comercial</span>
          <select
            className="select selectDense"
            value={commercialFilter}
            onChange={(e) => setCommercialFilter(e.target.value)}
          >
            {commercialOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="filterGroup">
          <span className="filterLabel">Estado</span>
          <select className="select selectDense" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {processedRows.length === 0 ? (
        <div className="tableEmpty">No hay clientes que coincidan con los filtros seleccionados.</div>
      ) : (
        <div className="tableWrap">
          <table className="table tableStackable">
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    className={`thSort${sortKey === "name" ? ` sort-${sortDirection}` : ""}`}
                    onClick={() => toggleSort("name")}
                  >
                    Nombre
                    <span className="sortIcon" aria-hidden="true" />
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className={`thSort${sortKey === "nit" ? ` sort-${sortDirection}` : ""}`}
                    onClick={() => toggleSort("nit")}
                  >
                    NIT
                    <span className="sortIcon" aria-hidden="true" />
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className={`thSort${sortKey === "city" ? ` sort-${sortDirection}` : ""}`}
                    onClick={() => toggleSort("city")}
                  >
                    Ciudad
                    <span className="sortIcon" aria-hidden="true" />
                  </button>
                </th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>
                  <button
                    type="button"
                    className={`thSort${sortKey === "commercial" ? ` sort-${sortDirection}` : ""}`}
                    onClick={() => toggleSort("commercial")}
                  >
                    Estado comercial
                    <span className="sortIcon" aria-hidden="true" />
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className={`thSort${sortKey === "status" ? ` sort-${sortDirection}` : ""}`}
                    onClick={() => toggleSort("status")}
                  >
                    Estado
                    <span className="sortIcon" aria-hidden="true" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {processedRows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => onSelect?.(r)}
                  style={{ cursor: onSelect ? "pointer" : "default" }}
                >
                  <td style={{ fontWeight: 600 }}>{r.basic?.name || r.name || "-"}</td>
                  <td>{r.basic?.nit || r.nit || "-"}</td>
                  <td>{r.basic?.city || r.city || "-"}</td>
                  <td>{contactValue(r, "email") || "-"}</td>
                  <td>{contactValue(r, "phone") || "-"}</td>
                  <td>
                    <span className={`statusBadge status-${r.commercial?.commercialStatus}`}>
                      {r.commercial?.commercialStatus || "-"}
                    </span>
                  </td>
                  <td>
                    <span className={`statusBadge status-${r.status}`}>{r.status || "-"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {summaryLabel ? (
        <div className="tableFooter">
          <span>{summaryLabel}</span>
          <span>
            Última actualización: <strong>{new Date().toLocaleDateString()}</strong>
          </span>
        </div>
      ) : null}
    </div>
  );
}
