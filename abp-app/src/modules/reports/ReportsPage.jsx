import { useEffect, useMemo, useRef, useState } from "react";
import { collection, collectionGroup, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";

const REPORT_TABS = [
  { id: "BALANCE", label: "Estado de Situación Financiera" },
  { id: "RESULTADOS", label: "Estado de Resultados" },
  { id: "FLUJO", label: "Flujo de Efectivo" },
  { id: "PATRIMONIO", label: "Cambios en el Patrimonio" },
  { id: "MAYOR", label: "Libro Mayor" },
];

const money = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(n || 0);

const inferClassFromCode = (code) => {
  const first = String(code || "").trim().charAt(0);
  if (first === "1") return "ACTIVO";
  if (first === "2") return "PASIVO";
  if (first === "3") return "PATRIMONIO";
  if (first === "4") return "INGRESO";
  if (["5", "6", "7"].includes(first)) return "GASTO";
  return "OTRO";
};

const inferNatureFromClass = (className) => {
  if (["ACTIVO", "GASTO", "COSTO"].includes(className)) return "DEBITO";
  return "CREDITO";
};

const toDayRange = (from, to) => {
  const fromMs = from ? new Date(from).getTime() : null;
  const toMs = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
  return { fromMs, toMs };
};

const formatLongDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
};

export default function ReportsPage({ companyId }) {
  const [lines, setLines] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tab, setTab] = useState("BALANCE");

  const reportPrintRef = useRef(null);

  const reportDateLabel = useMemo(() => {
    if (to) return formatLongDate(`${to}T00:00:00`);
    if (from) return formatLongDate(`${from}T00:00:00`);
    return formatLongDate(Date.now());
  }, [from, to]);

  const openPrintWindow = ({ title, html }) => {
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    w.document.open();
    w.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${String(title || "Informe")}</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans", "Liberation Sans"; margin: 24px; color: #0f172a; }
      h1 { font-size: 18px; margin: 0 0 8px; }
      .small { color: #475569; font-size: 12px; margin: 0 0 12px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; vertical-align: top; }
      th { background: #f1f5f9; text-align: left; }
      @media print { body { margin: 0; } }
    </style>
  </head>
  <body>
    ${html || ""}
  </body>
</html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  useEffect(() => {
    if (!companyId) return;

    let linesReady = false;
    let accountsReady = false;

    const qLines = query(collectionGroup(db, "lines"), where("companyId", "==", companyId));
    const unsubLines = onSnapshot(
      qLines,
      (snap) => {
        setLines(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        linesReady = true;
        if (accountsReady) setLoading(false);
        setError("");
      },
      (err) => {
        console.error(err);
        linesReady = true;
        if (accountsReady) setLoading(false);
        setError(err?.message || "Error leyendo movimientos contables");
      }
    );

    const qAccounts = query(collection(db, "chartOfAccounts"), where("companyId", "==", companyId));
    const unsubAccounts = onSnapshot(
      qAccounts,
      (snap) => {
        setAccounts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        accountsReady = true;
        if (linesReady) setLoading(false);
      },
      (err) => {
        console.error(err);
        accountsReady = true;
        if (linesReady) setLoading(false);
        setError((prev) => prev || err?.message || "Error leyendo plan de cuentas");
      }
    );

    return () => {
      unsubLines();
      unsubAccounts();
    };
  }, [companyId]);

  const accountById = useMemo(() => {
    const map = new Map();
    for (const a of accounts) map.set(a.id, a);
    return map;
  }, [accounts]);

  const accountByCode = useMemo(() => {
    const map = new Map();
    for (const a of accounts) {
      const code = String(a.code || "").trim();
      if (code) map.set(code, a);
    }
    return map;
  }, [accounts]);

  const filtered = useMemo(() => {
    const { fromMs, toMs } = toDayRange(from, to);
    return lines
      .filter((l) => {
        if ((l.companyId || "") !== companyId) return false;
        if (l.voided) return false;
        const date = Number(l.date) || 0;
        if (!date) return false;
        if (fromMs != null && date < fromMs) return false;
        if (toMs != null && date > toMs) return false;
        return true;
      })
      .map((l) => {
        const acc = accountById.get(l.accountId) || accountByCode.get(String(l.accountCode || "").trim()) || null;
        const className = acc?.class || inferClassFromCode(l.accountCode);
        const nature = acc?.nature || inferNatureFromClass(className);
        const reportType = acc?.report || (["INGRESO", "GASTO", "COSTO"].includes(className) ? "RESULTADO" : "BALANCE");
        const normalizedAccountId = acc?.id || l.accountId || `code:${String(l.accountCode || "").trim()}`;
        return {
          ...l,
          normalizedAccountId,
          accountCode: acc?.code || l.accountCode || "",
          accountName: acc?.name || l.accountName || "",
          className,
          nature,
          reportType,
          isCash: !!acc?.isCash,
        };
      })
      .sort((a, b) => (b.date || 0) - (a.date || 0));
  }, [lines, accountById, accountByCode, from, to, companyId]);

  const byAccount = useMemo(() => {
    const map = new Map();
    for (const l of filtered) {
      const key = l.normalizedAccountId || `${l.accountCode || ""}|${l.accountName || ""}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          accountId: l.normalizedAccountId || "",
          accountCode: l.accountCode || "",
          accountName: l.accountName || "",
          className: l.className,
          nature: l.nature,
          reportType: l.reportType,
          isCash: !!l.isCash,
          debit: 0,
          credit: 0,
          balance: 0,
        });
      }
      const curr = map.get(key);
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      curr.debit += d;
      curr.credit += c;
    }

    const arr = Array.from(map.values()).map((x) => ({
      ...x,
      balance: x.nature === "DEBITO" ? x.debit - x.credit : x.credit - x.debit,
    }));

    arr.sort((a, b) => String(a.accountCode || "").localeCompare(String(b.accountCode || "")));
    return arr;
  }, [filtered]);

  const mayorTotales = useMemo(() => {
    return byAccount.reduce(
      (acc, row) => {
        acc.debit += row.debit;
        acc.credit += row.credit;
        acc.balance += row.balance;
        return acc;
      },
      { debit: 0, credit: 0, balance: 0 }
    );
  }, [byAccount]);

  const resultados = useMemo(() => {
    const ingresos = byAccount
      .filter((a) => a.reportType === "RESULTADO" && a.className === "INGRESO")
      .reduce((sum, a) => sum + a.balance, 0);
    const gastos = byAccount
      .filter((a) => a.reportType === "RESULTADO" && (a.className === "GASTO" || a.className === "COSTO"))
      .reduce((sum, a) => sum + a.balance, 0);
    return { ingresos, gastos, utilidad: ingresos - gastos };
  }, [byAccount]);

  const resultadosDetalle = useMemo(() => {
    const resultadoAccounts = byAccount.filter((a) => a.reportType === "RESULTADO");
    const ingresosAccounts = resultadoAccounts.filter((a) => a.className === "INGRESO");
    const costosVentasAccounts = resultadoAccounts.filter((a) => a.className === "COSTO" || String(a.accountCode || "").startsWith("6"));

    const gastosBase = resultadoAccounts.filter((a) => a.className === "GASTO" || a.className === "COSTO");
    const gastosFinancierosAccounts = gastosBase.filter((a) => {
      const text = `${a.accountCode || ""} ${a.accountName || ""}`.toLowerCase();
      return text.includes("interes") || text.includes("financier");
    });
    const impuestosAccounts = gastosBase.filter((a) => {
      const text = `${a.accountCode || ""} ${a.accountName || ""}`.toLowerCase();
      return text.includes("impuesto") || text.includes("renta") || text.includes("iva");
    });

    const gastosOperativosAccounts = gastosBase.filter(
      (a) =>
        !costosVentasAccounts.some((x) => x.key === a.key) &&
        !gastosFinancierosAccounts.some((x) => x.key === a.key) &&
        !impuestosAccounts.some((x) => x.key === a.key)
    );

    const sum = (arr) => arr.reduce((acc, a) => acc + a.balance, 0);

    const ingresoTotal = sum(ingresosAccounts);
    const costoVentas = sum(costosVentasAccounts);
    const beneficioBruto = ingresoTotal - costoVentas;
    const gastosOperativos = sum(gastosOperativosAccounts);
    const beneficioOperativo = beneficioBruto - gastosOperativos;
    const gastosFinancieros = sum(gastosFinancierosAccounts);
    const antesImpuestos = beneficioOperativo - gastosFinancieros;
    const impuestos = sum(impuestosAccounts);
    const utilidadNeta = antesImpuestos - impuestos;

    return {
      ingresoTotal,
      costoVentas,
      beneficioBruto,
      gastosOperativos,
      beneficioOperativo,
      gastosFinancieros,
      antesImpuestos,
      impuestos,
      utilidadNeta,
      gastosOperativosAccounts,
      coincideConResultadoSimple: Math.abs(utilidadNeta - resultados.utilidad) < 1,
    };
  }, [byAccount, resultados.utilidad]);

  const balance = useMemo(() => {
    const balanceAccounts = byAccount.filter((a) => a.reportType === "BALANCE");
    const activos = balanceAccounts.filter((a) => a.className === "ACTIVO");
    const pasivos = balanceAccounts.filter((a) => a.className === "PASIVO");
    const patrimonio = balanceAccounts.filter((a) => a.className === "PATRIMONIO");

    const totalActivos = activos.reduce((s, a) => s + a.balance, 0);
    const totalPasivos = pasivos.reduce((s, a) => s + a.balance, 0);
    const totalPatrimonio = patrimonio.reduce((s, a) => s + a.balance, 0);
    const totalPatrimonioConUtilidad = totalPatrimonio + resultados.utilidad;

    return {
      activos,
      pasivos,
      patrimonio,
      totalActivos,
      totalPasivos,
      totalPatrimonio,
      totalPatrimonioConUtilidad,
      ecuacion: totalPasivos + totalPatrimonioConUtilidad,
      diferencia: totalActivos - (totalPasivos + totalPatrimonioConUtilidad),
    };
  }, [byAccount, resultados.utilidad]);

  const balanceDetalle = useMemo(() => {
    const isActivoCorriente = (code) => ["11", "12", "13", "14"].some((p) => String(code || "").startsWith(p));
    const isPasivoCorriente = (code) => ["21", "22", "23", "24"].some((p) => String(code || "").startsWith(p));

    const activosCorrientes = balance.activos.filter((a) => isActivoCorriente(a.accountCode));
    const activosNoCorrientes = balance.activos.filter((a) => !isActivoCorriente(a.accountCode));
    const pasivosCorrientes = balance.pasivos.filter((a) => isPasivoCorriente(a.accountCode));
    const pasivosNoCorrientes = balance.pasivos.filter((a) => !isPasivoCorriente(a.accountCode));

    const totalActivosCorrientes = activosCorrientes.reduce((s, a) => s + a.balance, 0);
    const totalActivosNoCorrientes = activosNoCorrientes.reduce((s, a) => s + a.balance, 0);
    const totalPasivosCorrientes = pasivosCorrientes.reduce((s, a) => s + a.balance, 0);
    const totalPasivosNoCorrientes = pasivosNoCorrientes.reduce((s, a) => s + a.balance, 0);

    return {
      activosCorrientes,
      activosNoCorrientes,
      pasivosCorrientes,
      pasivosNoCorrientes,
      totalActivosCorrientes,
      totalActivosNoCorrientes,
      totalPasivosCorrientes,
      totalPasivosNoCorrientes,
      totalPasivos: totalPasivosCorrientes + totalPasivosNoCorrientes,
      totalPatrimonio: balance.totalPatrimonioConUtilidad,
      totalPasivoPatrimonio: balance.ecuacion,
      totalActivos: balance.totalActivos,
    };
  }, [balance]);

  const flujo = useMemo(() => {
    const cashLines = filtered.filter((l) => l.isCash);
    const entradas = cashLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const salidas = cashLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { entradas, salidas, neto: entradas - salidas };
  }, [filtered]);

  return (
    <div className="homeShell">
      <section className="homeQuick">
        <div className="homeQuickHeader">
          <div>
            <h2>Informes financieros</h2>
            <p>Consulta indicadores y reportes contables.</p>
          </div>

          <div className="homeQuickHeaderActions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                const node = reportPrintRef.current;
                if (!node) return;
                const tabLabel = REPORT_TABS.find((t) => t.id === tab)?.label || "Informe";
                openPrintWindow({
                  title: tabLabel,
                  html: `<h1>${tabLabel}</h1><div class="small">Periodo: ${from || "-"} a ${to || "-"} · Generado: ${new Date().toLocaleString()}</div>${node.innerHTML}`,
                });
              }}
            >
              Exportar PDF
            </button>
          </div>
        </div>

        <div className="homeQuickGrid" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
          {/* Filtro */}
          <div className="homeQuickCard" style={{ gridColumn: "span 12", textAlign: "left", cursor: "default" }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Filtro de periodo</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="smallMuted">Desde</span>
                <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="smallMuted">Hasta</span>
                <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
              >
                Limpiar
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="homeQuickCard" style={{ gridColumn: "span 12", textAlign: "left", cursor: "default" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {REPORT_TABS.map((t) => (
                <button key={t.id} type="button" className={tab === t.id ? "btn btnPrimary" : "btn"} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Estado */}
          <div style={{ gridColumn: "span 12" }}>
            {loading ? <div className="smallMuted">Cargando movimientos contables...</div> : null}
            {error ? <div className="error">{error}</div> : null}
          </div>

          {/* Report */}
          <div className="homeQuickCard" style={{ gridColumn: "span 12", textAlign: "left", cursor: "default", padding: 0 }}>
            <div ref={reportPrintRef} style={{ padding: 18 }}>
              {!loading && !error && tab === "BALANCE" ? (
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={{ textAlign: "center", display: "grid", gap: 2 }}>
                    <div style={{ fontWeight: 800 }}>ABP Gestión</div>
                    <div style={{ fontWeight: 900, fontSize: 20 }}>Estado de Situación Financiera</div>
                    <div className="smallMuted">Al {reportDateLabel}</div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ fontWeight: 900, fontSize: 20 }}>Activo</div>

                      <div style={{ fontWeight: 800 }}>Activos corrientes</div>
                      {balanceDetalle.activosCorrientes.map((row) => (
                        <div key={row.key} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                          <div>{row.accountName || row.accountCode}</div>
                          <div>{money(row.balance)}</div>
                        </div>
                      ))}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 10,
                          borderTop: "1px solid #d1d5db",
                          paddingTop: 4,
                          fontWeight: 800,
                        }}
                      >
                        <div>Total de activos corrientes</div>
                        <div>{money(balanceDetalle.totalActivosCorrientes)}</div>
                      </div>

                      <div style={{ fontWeight: 800, marginTop: 8 }}>Activos no corrientes</div>
                      {balanceDetalle.activosNoCorrientes.map((row) => (
                        <div key={row.key} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                          <div>{row.accountName || row.accountCode}</div>
                          <div>{money(row.balance)}</div>
                        </div>
                      ))}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 10,
                          borderTop: "1px solid #d1d5db",
                          paddingTop: 4,
                          fontWeight: 800,
                        }}
                      >
                        <div>Total de activos no corrientes</div>
                        <div>{money(balanceDetalle.totalActivosNoCorrientes)}</div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 10,
                          borderTop: "2px solid #111827",
                          borderBottom: "2px solid #111827",
                          padding: "6px 0",
                          fontWeight: 900,
                          marginTop: 8,
                        }}
                      >
                        <div>Total Activos</div>
                        <div>{money(balanceDetalle.totalActivos)}</div>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ fontWeight: 900, fontSize: 20 }}>Pasivo y Patrimonio</div>

                      <div style={{ fontWeight: 800 }}>Pasivos corrientes</div>
                      {balanceDetalle.pasivosCorrientes.map((row) => (
                        <div key={row.key} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                          <div>{row.accountName || row.accountCode}</div>
                          <div>{money(row.balance)}</div>
                        </div>
                      ))}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 10,
                          borderTop: "1px solid #d1d5db",
                          paddingTop: 4,
                          fontWeight: 800,
                        }}
                      >
                        <div>Total pasivos corrientes</div>
                        <div>{money(balanceDetalle.totalPasivosCorrientes)}</div>
                      </div>

                      <div style={{ fontWeight: 800, marginTop: 8 }}>Pasivos no corrientes</div>
                      {balanceDetalle.pasivosNoCorrientes.map((row) => (
                        <div key={row.key} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                          <div>{row.accountName || row.accountCode}</div>
                          <div>{money(row.balance)}</div>
                        </div>
                      ))}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 10,
                          borderTop: "1px solid #d1d5db",
                          paddingTop: 4,
                          fontWeight: 800,
                        }}
                      >
                        <div>Total pasivos no corrientes</div>
                        <div>{money(balanceDetalle.totalPasivosNoCorrientes)}</div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, fontWeight: 900 }}>
                        <div>Total pasivos</div>
                        <div>{money(balanceDetalle.totalPasivos)}</div>
                      </div>

                      <div style={{ fontWeight: 800, marginTop: 8 }}>Capital contable</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                        <div>Total capital contable (incluye utilidad del período)</div>
                        <div>{money(balanceDetalle.totalPatrimonio)}</div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 10,
                          borderTop: "2px solid #111827",
                          borderBottom: "2px solid #111827",
                          padding: "6px 0",
                          fontWeight: 900,
                          marginTop: 8,
                        }}
                      >
                        <div>Total pasivo y capital</div>
                        <div>{money(balanceDetalle.totalPasivoPatrimonio)}</div>
                      </div>
                    </div>
                  </div>

                  <div className={Math.abs(balance.diferencia) < 1 ? "smallMuted" : "error"} style={{ textAlign: "right" }}>
                    Diferencia de ecuación contable: {money(balance.diferencia)}
                  </div>
                </div>
              ) : null}

              {!loading && !error && tab === "RESULTADOS" ? (
                <div style={{ display: "grid", gap: 18 }}>
                  <div style={{ textAlign: "center", display: "grid", gap: 2 }}>
                    <div style={{ fontWeight: 800 }}>ABP Gestión</div>
                    <div style={{ fontWeight: 900, fontSize: 20 }}>Estado de Resultados</div>
                    <div className="smallMuted">Período hasta {reportDateLabel}</div>
                  </div>

                  <div className="reportSummaryGrid">
                    <div className="reportSummaryCard">
                      <span className="reportSummaryLabel">Ingresos totales</span>
                      <span className="reportSummaryValue">{money(resultadosDetalle.ingresoTotal)}</span>
                    </div>
                    <div className="reportSummaryCard">
                      <span className="reportSummaryLabel">Costos de ventas</span>
                      <span className="reportSummaryValue">{money(resultadosDetalle.costoVentas)}</span>
                    </div>
                    <div className="reportSummaryCard">
                      <span className="reportSummaryLabel">Beneficio bruto</span>
                      <span className="reportSummaryValue">{money(resultadosDetalle.beneficioBruto)}</span>
                    </div>
                    <div className="reportSummaryCard">
                      <span className="reportSummaryLabel">Utilidad neta</span>
                      <span className="reportSummaryValue">{money(resultadosDetalle.utilidadNeta)}</span>
                    </div>
                  </div>

                  <div>
                    <div className="reportSectionTitle">Detalle de costos operativos</div>
                    <div className="tableWrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Cuenta</th>
                            <th style={{ textAlign: "right" }}>Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultadosDetalle.gastosOperativosAccounts.length === 0 ? (
                            <tr>
                              <td colSpan="2" className="smallMuted" style={{ textAlign: "center" }}>
                                Sin gastos operativos clasificados en el periodo.
                              </td>
                            </tr>
                          ) : (
                            resultadosDetalle.gastosOperativosAccounts.map((a) => (
                              <tr key={a.key}>
                                <td>
                                  {a.accountCode} - {a.accountName}
                                </td>
                                <td style={{ textAlign: "right", fontWeight: 700 }}>{money(a.balance)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="reportSummaryGrid">
                    <div className="reportSummaryCard">
                      <span className="reportSummaryLabel">Gastos operativos</span>
                      <span className="reportSummaryValue">{money(resultadosDetalle.gastosOperativos)}</span>
                    </div>
                    <div className="reportSummaryCard">
                      <span className="reportSummaryLabel">Beneficio operativo</span>
                      <span className="reportSummaryValue">{money(resultadosDetalle.beneficioOperativo)}</span>
                    </div>
                    <div className="reportSummaryCard">
                      <span className="reportSummaryLabel">Gastos financieros</span>
                      <span className="reportSummaryValue">{money(resultadosDetalle.gastosFinancieros)}</span>
                    </div>
                    <div className="reportSummaryCard">
                      <span className="reportSummaryLabel">Antes de impuestos</span>
                      <span className="reportSummaryValue">{money(resultadosDetalle.antesImpuestos)}</span>
                    </div>
                  </div>

                  <div className="reportSummaryGrid">
                    <div className="reportSummaryCard">
                      <span className="reportSummaryLabel">Impuestos</span>
                      <span className="reportSummaryValue">{money(resultadosDetalle.impuestos)}</span>
                    </div>
                  </div>

                  {!resultadosDetalle.coincideConResultadoSimple ? (
                    <div className="reportSectionNote">Nota: la utilidad neta detallada difiere de la utilidad simple por clasificaciones de cuentas.</div>
                  ) : null}
                </div>
              ) : null}

              {!loading && !error && tab === "FLUJO" ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ textAlign: "center", display: "grid", gap: 2 }}>
                    <div style={{ fontWeight: 800 }}>ABP Gestión</div>
                    <div style={{ fontWeight: 900, fontSize: 20 }}>Estado de Flujo de Efectivo</div>
                    <div className="smallMuted">Al {reportDateLabel}</div>
                  </div>
                  <div className="tableWrap">
                    <table className="table">
                      <tbody>
                        <tr>
                          <td>Entradas de efectivo</td>
                          <td style={{ textAlign: "right", fontWeight: 800 }}>{money(flujo.entradas)}</td>
                        </tr>
                        <tr>
                          <td>Salidas de efectivo</td>
                          <td style={{ textAlign: "right", fontWeight: 800 }}>{money(flujo.salidas)}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 900 }}>Flujo neto del período</td>
                          <td style={{ textAlign: "right", fontWeight: 900 }}>{money(flujo.neto)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {!loading && !error && tab === "PATRIMONIO" ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ textAlign: "center", display: "grid", gap: 2 }}>
                    <div style={{ fontWeight: 800 }}>ABP Gestión</div>
                    <div style={{ fontWeight: 900, fontSize: 20 }}>Estado de Cambios en el Patrimonio</div>
                    <div className="smallMuted">Al {reportDateLabel}</div>
                  </div>
                  <div className="tableWrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Cuenta</th>
                          <th>Débito</th>
                          <th>Crédito</th>
                          <th>Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byAccount.filter((a) => a.className === "PATRIMONIO").length === 0 ? (
                          <tr>
                            <td colSpan="4" className="smallMuted" style={{ textAlign: "center" }}>
                              Sin movimientos de patrimonio.
                            </td>
                          </tr>
                        ) : (
                          byAccount
                            .filter((a) => a.className === "PATRIMONIO")
                            .map((a) => (
                              <tr key={a.key}>
                                <td>
                                  {a.accountCode} - {a.accountName}
                                </td>
                                <td>{money(a.debit)}</td>
                                <td>{money(a.credit)}</td>
                                <td>{money(a.balance)}</td>
                              </tr>
                            ))
                        )}
                        <tr>
                          <td style={{ fontWeight: 900 }}>Utilidad del periodo</td>
                          <td>-</td>
                          <td>-</td>
                          <td style={{ fontWeight: 900 }}>{money(resultados.utilidad)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {!loading && !error && tab === "MAYOR" ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ textAlign: "center", display: "grid", gap: 2 }}>
                    <div style={{ fontWeight: 800 }}>ABP Gestión</div>
                    <div style={{ fontWeight: 900, fontSize: 20 }}>Libro Mayor</div>
                    <div className="smallMuted">Al {reportDateLabel}</div>
                  </div>
                  <div className="tableWrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Cuenta</th>
                          <th>Clase</th>
                          <th>Naturaleza</th>
                          <th>Débito</th>
                          <th>Crédito</th>
                          <th>Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byAccount.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="smallMuted" style={{ textAlign: "center" }}>
                              No hay movimientos en el periodo.
                            </td>
                          </tr>
                        ) : (
                          byAccount.map((a) => (
                            <tr key={a.key}>
                              <td>{a.accountCode || "-"}</td>
                              <td>{a.accountName || "-"}</td>
                              <td>{a.className || "-"}</td>
                              <td>{a.nature || "-"}</td>
                              <td>{money(a.debit)}</td>
                              <td>{money(a.credit)}</td>
                              <td>{money(a.balance)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="4" style={{ fontWeight: 900 }}>
                            Totales
                          </td>
                          <td style={{ fontWeight: 900 }}>{money(mayorTotales.debit)}</td>
                          <td style={{ fontWeight: 900 }}>{money(mayorTotales.credit)}</td>
                          <td style={{ fontWeight: 900 }}>{money(mayorTotales.balance)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}