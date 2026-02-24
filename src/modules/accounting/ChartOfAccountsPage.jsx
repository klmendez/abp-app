import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

/**
 * Empresa 6621 (Agencias/corredores de seguros) – Grupo 3 (microempresa).
 * Catálogo base inspirado en PUC Colombia + auxiliares prácticos para ABP:
 * - Bancos / GMF / IVA bancario / cuota de manejo / servicios bancarios
 * - Comisiones por seguros (diferente a ingresos financieros)
 *
 * Nota: En Colombia el PUC es una referencia común; en NIIF (Grupo 3) puedes
 * definir auxiliares (códigos más largos) para mejor control sin problema,
 * mientras mantengas consistencia de reportes.
 */
const baseAccounts = [
  // =========================
  // CLASE 1 - ACTIVOS
  // =========================
  { code: "1105", name: "Caja", class: "ACTIVO", nature: "DEBITO", report: "BALANCE", isCash: true },
  { code: "1110", name: "Bancos", class: "ACTIVO", nature: "DEBITO", report: "BALANCE", isCash: true },

  // Cuentas por cobrar
  { code: "1305", name: "Clientes (Cuentas por cobrar)", class: "ACTIVO", nature: "DEBITO", report: "BALANCE", isCash: false },
  { code: "1380", name: "Deudores varios", class: "ACTIVO", nature: "DEBITO", report: "BALANCE", isCash: false },

  // Anticipos
  { code: "1330", name: "Anticipos a proveedores", class: "ACTIVO", nature: "DEBITO", report: "BALANCE", isCash: false },

  // Impuestos a favor / IVA descontable
  { code: "1355", name: "Anticipo de impuestos y contribuciones", class: "ACTIVO", nature: "DEBITO", report: "BALANCE", isCash: false },
  { code: "135515", name: "IVA descontable", class: "ACTIVO", nature: "DEBITO", report: "BALANCE", isCash: false },

  // Propiedad, planta y equipo
  { code: "1504", name: "Equipos de cómputo", class: "ACTIVO", nature: "DEBITO", report: "BALANCE", isCash: false },
  { code: "1592", name: "Depreciación acumulada", class: "ACTIVO", nature: "CREDITO", report: "BALANCE", isCash: false },

  // =========================
  // CLASE 2 - PASIVOS
  // =========================
  { code: "2205", name: "Proveedores nacionales", class: "PASIVO", nature: "CREDITO", report: "BALANCE", isCash: false },
  { code: "2335", name: "Costos y gastos por pagar", class: "PASIVO", nature: "CREDITO", report: "BALANCE", isCash: false },

  // Obligaciones laborales / aportes
  { code: "2370", name: "Aportes por pagar (Seg. social/parafiscales)", class: "PASIVO", nature: "CREDITO", report: "BALANCE", isCash: false },

  // Impuestos por pagar
  { code: "2365", name: "Retenciones por pagar", class: "PASIVO", nature: "CREDITO", report: "BALANCE", isCash: false },
  { code: "2408", name: "IVA por pagar", class: "PASIVO", nature: "CREDITO", report: "BALANCE", isCash: false },
  { code: "2424", name: "ICA por pagar", class: "PASIVO", nature: "CREDITO", report: "BALANCE", isCash: false },
  { code: "2436", name: "Retención en la fuente por pagar", class: "PASIVO", nature: "CREDITO", report: "BALANCE", isCash: false },

  // =========================
  // CLASE 3 - PATRIMONIO
  // =========================
  { code: "3105", name: "Capital social", class: "PATRIMONIO", nature: "CREDITO", report: "BALANCE", isCash: false },
  { code: "3605", name: "Utilidad del ejercicio", class: "PATRIMONIO", nature: "CREDITO", report: "BALANCE", isCash: false },
  { code: "3705", name: "Utilidades / resultados acumulados", class: "PATRIMONIO", nature: "CREDITO", report: "BALANCE", isCash: false },

  // =========================
  // CLASE 4 - INGRESOS
  // =========================
  { code: "4225", name: "Comisiones (ingresos)", class: "INGRESO", nature: "CREDITO", report: "RESULTADO", isCash: false },
  { code: "422525", name: "Comisiones por venta de seguros", class: "INGRESO", nature: "CREDITO", report: "RESULTADO", isCash: false },

  { code: "4210", name: "Ingresos financieros", class: "INGRESO", nature: "CREDITO", report: "RESULTADO", isCash: false },
  { code: "421005", name: "Intereses (ingresos financieros)", class: "INGRESO", nature: "CREDITO", report: "RESULTADO", isCash: false },

  { code: "4295", name: "Otros ingresos / diversos", class: "INGRESO", nature: "CREDITO", report: "RESULTADO", isCash: false },

  // =========================
  // CLASE 5 - GASTOS
  // =========================
  { code: "5105", name: "Gastos administrativos", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },
  { code: "510510", name: "Papelería y útiles", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },
  { code: "510515", name: "Mensajería", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },
  { code: "510520", name: "Arrendamientos", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },
  { code: "510525", name: "Aseo y vigilancia", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },
  { code: "510530", name: "Mantenimiento y reparaciones", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },
  { code: "510535", name: "Internet / comunicaciones", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },

  { code: "510505", name: "Capacitación", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },
  { code: "5135", name: "Servicios públicos", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },
  { code: "5205", name: "Nómina", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },

  { code: "5305", name: "Gastos financieros", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },
  { code: "530505", name: "Gastos bancarios", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },
  { code: "530515", name: "Comisiones bancarias", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },
  { code: "530520", name: "Intereses (gasto financiero)", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },

  { code: "53050501", name: "GMF / 4x1000 (Gravamen movimientos financieros)", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },
  { code: "53050502", name: "IVA bancario (IVA sobre servicios bancarios)", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },
  { code: "53050503", name: "Servicios bancarios", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },
  { code: "53050504", name: "Cuota de manejo", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },

  { code: "53050510", name: "Honorarios (servicios profesionales)", class: "GASTO", nature: "DEBITO", report: "RESULTADO", isCash: false },
];

// --- helpers ---
function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function formatMaybeTimestamp(value) {
  try {
    if (!value) return "";
    if (typeof value?.toDate === "function") return value.toDate().toLocaleString();
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  } catch {
    return "";
  }
}

export default function ChartOfAccountsPage({ companyId, userId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("TODOS");
  const [natureFilter, setNatureFilter] = useState("TODOS");
  const [reportFilter, setReportFilter] = useState("TODOS");

  const [sortKey, setSortKey] = useState("code");
  const [sortDirection, setSortDirection] = useState("asc");

  const [savingBase, setSavingBase] = useState(false);

  useEffect(() => {
    if (!companyId) return;

    const q = query(collection(db, "chartOfAccounts"), where("companyId", "==", companyId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
        setError("");
      },
      (err) => {
        console.error(err);
        setLoading(false);
        setError(err?.message || "Error leyendo plan de cuentas");
      }
    );

    return () => unsub();
  }, [companyId]);

  const classOptions = useMemo(() => {
    const values = new Set(
      rows
        .map((r) => (r.class || "").trim())
        .filter(Boolean)
        .map((v) => v.toUpperCase())
    );
    const fallback = ["ACTIVO", "PASIVO", "PATRIMONIO", "INGRESO", "GASTO"];
    for (const v of fallback) values.add(v);
    return ["TODOS", ...Array.from(values).sort()];
  }, [rows]);

  const natureOptions = useMemo(() => {
    const values = new Set(
      rows
        .map((r) => (r.nature || "").trim())
        .filter(Boolean)
        .map((v) => v.toUpperCase())
    );
    values.add("DEBITO");
    values.add("CREDITO");
    return ["TODOS", ...Array.from(values).sort()];
  }, [rows]);

  const reportOptions = useMemo(() => {
    const values = new Set(
      rows
        .map((r) => (r.report || "").trim())
        .filter(Boolean)
        .map((v) => v.toUpperCase())
    );
    values.add("BALANCE");
    values.add("RESULTADO");
    return ["TODOS", ...Array.from(values).sort()];
  }, [rows]);

  const processedRows = useMemo(() => {
    const s = (search || "").toLowerCase().trim();

    const next = rows
      .filter((r) => {
        const code = String(r.code || "").toLowerCase();
        const name = String(r.name || "").toLowerCase();
        const matchesSearch = !s || code.includes(s) || name.includes(s);

        const matchesClass = classFilter === "TODOS" || String(r.class || "").toUpperCase() === classFilter;
        const matchesNature = natureFilter === "TODOS" || String(r.nature || "").toUpperCase() === natureFilter;
        const matchesReport = reportFilter === "TODOS" || String(r.report || "").toUpperCase() === reportFilter;

        return matchesSearch && matchesClass && matchesNature && matchesReport;
      })
      .slice();

    const getValue = (row) => {
      switch (sortKey) {
        case "name":
          return String(row.name || "").toLowerCase();
        case "class":
          return String(row.class || "").toLowerCase();
        case "nature":
          return String(row.nature || "").toLowerCase();
        case "report":
          return String(row.report || "").toLowerCase();
        case "cash":
          return row.isCash === true ? 1 : 0;
        case "active":
          return row.active === false ? 0 : 1;
        case "code_numeric": {
          const n = Number(row.code);
          return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
        }
        default: {
          const n = Number(row.code);
          if (Number.isFinite(n)) return n;
          return String(row.code || "").toLowerCase();
        }
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
  }, [rows, search, classFilter, natureFilter, reportFilter, sortKey, sortDirection]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const tableFooterLabel = useMemo(() => {
    if (loading) return "";
    const total = rows.length;
    const filtered = processedRows.length;
    if (filtered === total) return `Total de registros: ${String(total).padStart(2, "0")}`;
    return `Mostrando ${filtered} de ${total} registros`;
  }, [processedRows.length, rows.length, loading]);

  const lastUpdatedAt = useMemo(() => {
    const source = rows;
    let best = null;
    for (const r of source) {
      const t = r?.updatedAt;
      if (!t) continue;
      const d = typeof t?.toDate === "function" ? t.toDate() : new Date(t);
      if (Number.isNaN(d.getTime())) continue;
      if (!best || d > best) best = d;
    }
    return best ? best.toLocaleString() : "";
  }, [rows]);

  const loadBase = async () => {
    if (!companyId) return;
    setSavingBase(true);
    setError("");

    try {
      const chunks = chunkArray(baseAccounts, 450);

      for (const group of chunks) {
        const batch = writeBatch(db);

        for (const a of group) {
          const ref = doc(db, "chartOfAccounts", `${companyId}_${a.code}`);
          batch.set(
            ref,
            {
              companyId,
              code: a.code,
              name: a.name,
              class: a.class,
              nature: a.nature,
              report: a.report,
              isCash: !!a.isCash,
              active: true,
              updatedAt: serverTimestamp(),
              updatedBy: userId || null,
            },
            { merge: true }
          );
        }

        await batch.commit();
      }
    } catch (e) {
      console.error(e);
      setError(e?.message || "Error cargando plan base");
    } finally {
      setSavingBase(false);
    }
  };

  // ===== APLICACIÓN DEL ESTILO "HomePage quickLinks" =====
  return (
    <div className="homeShell">
      <section className="homeQuick">
        <div className="homeQuickHeader">
          <div>
            <h2>Plan de cuentas</h2>
            <p>Filtra, reordena y mantén el catálogo contable actualizado (Grupo 3 · 6621).</p>
          </div>

          <div className="homeQuickHeaderActions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn" onClick={loadBase} disabled={savingBase || !companyId}>
              {savingBase ? "Cargando..." : "Cargar plan base (PUC+ABP)"}
            </button>
          </div>
        </div>

        <div className="homeQuickGrid" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
          {/* Filtros */}
          <div className="homeQuickCard" style={{ gridColumn: "span 12", textAlign: "left", cursor: "default" }}>
            <div className="tableFilters" style={{ padding: 0 }}>
              <div className="filterGroup" style={{ flex: "1 1 260px" }}>
                <span className="filterLabel">Buscar</span>
                <input
                  className="input inputDense"
                  value={search}
                  placeholder="Código o nombre..."
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="filterGroup">
                <span className="filterLabel">Clase</span>
                <select className="select selectDense" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                  {classOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filterGroup">
                <span className="filterLabel">Naturaleza</span>
                <select className="select selectDense" value={natureFilter} onChange={(e) => setNatureFilter(e.target.value)}>
                  {natureOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filterGroup">
                <span className="filterLabel">Reporte</span>
                <select className="select selectDense" value={reportFilter} onChange={(e) => setReportFilter(e.target.value)}>
                  {reportOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error ? <div className="error" style={{ marginTop: 10 }}>{error}</div> : null}
            {!companyId ? <div className="smallMuted" style={{ marginTop: 10 }}>Selecciona una compañía para ver el plan de cuentas.</div> : null}
          </div>

          {/* Tabla */}
          <div className="homeQuickCard" style={{ gridColumn: "span 12", textAlign: "left", cursor: "default", padding: 0 }}>
            {loading ? (
              <div className="tableEmpty" style={{ padding: 18 }}>
                Cargando plan de cuentas...
              </div>
            ) : processedRows.length === 0 ? (
              <div className="tableEmpty" style={{ padding: 18 }}>
                No hay cuentas que coincidan con los filtros seleccionados.
              </div>
            ) : (
              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>
                        <button
                          type="button"
                          className={`thSort${sortKey === "code" ? ` sort-${sortDirection}` : ""}`}
                          onClick={() => toggleSort("code")}
                        >
                          Código
                          <span className="sortIcon" aria-hidden="true" />
                        </button>
                      </th>

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
                          className={`thSort${sortKey === "class" ? ` sort-${sortDirection}` : ""}`}
                          onClick={() => toggleSort("class")}
                        >
                          Clase
                          <span className="sortIcon" aria-hidden="true" />
                        </button>
                      </th>

                      <th>
                        <button
                          type="button"
                          className={`thSort${sortKey === "nature" ? ` sort-${sortDirection}` : ""}`}
                          onClick={() => toggleSort("nature")}
                        >
                          Naturaleza
                          <span className="sortIcon" aria-hidden="true" />
                        </button>
                      </th>

                      <th>
                        <button
                          type="button"
                          className={`thSort${sortKey === "report" ? ` sort-${sortDirection}` : ""}`}
                          onClick={() => toggleSort("report")}
                        >
                          Reporte
                          <span className="sortIcon" aria-hidden="true" />
                        </button>
                      </th>

                      <th>
                        <button
                          type="button"
                          className={`thSort${sortKey === "cash" ? ` sort-${sortDirection}` : ""}`}
                          onClick={() => toggleSort("cash")}
                        >
                          Efectivo
                          <span className="sortIcon" aria-hidden="true" />
                        </button>
                      </th>

                      <th>
                        <button
                          type="button"
                          className={`thSort${sortKey === "active" ? ` sort-${sortDirection}` : ""}`}
                          onClick={() => toggleSort("active")}
                        >
                          Activa
                          <span className="sortIcon" aria-hidden="true" />
                        </button>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {processedRows.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 800 }}>{r.code || "-"}</td>
                        <td>{r.name || "-"}</td>
                        <td>{r.class || "-"}</td>
                        <td>{r.nature || "-"}</td>
                        <td>{r.report || "-"}</td>
                        <td>{r.isCash === true ? "SI" : "NO"}</td>
                        <td>{r.active === false ? "NO" : "SI"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && tableFooterLabel ? (
              <div className="tableFooter">
                <span>{tableFooterLabel}</span>
                <span>
                  Última actualización real: <strong>{lastUpdatedAt || "—"}</strong>
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}