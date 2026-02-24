import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";

const VOUCHER_TYPES = [
  { id: "INGRESO", label: "Ingreso" },
  { id: "EGRESO", label: "Egreso" },
  { id: "DIARIO", label: "Diario" },
  { id: "TRANSFERENCIA", label: "Transferencia" },
];

const periodFromDateInput = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const money = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(n || 0);

const emptyLine = () => ({
  accountId: "",
  accountCode: "",
  accountName: "",
  debit: "",
  credit: "",
});

export default function VouchersPage({ companyId, userId }) {
  const [view, setView] = useState("list"); // list | form
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const listPrintRef = useRef(null);

  const [accounts, setAccounts] = useState([]);
  const [accountSearch, setAccountSearch] = useState("");

  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingStatus, setEditingStatus] = useState(null);
  const [draft, setDraft] = useState({
    type: "DIARIO",
    date: "",
    period: "",
    concept: "",
    thirdPartyName: "",
    driveLink: "",
    lines: [emptyLine(), emptyLine()],
  });

  const [listSearch, setListSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("TODOS");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [periodFilter, setPeriodFilter] = useState("TODOS");
  const [sortKey, setSortKey] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");

  useEffect(() => {
    if (!companyId) return;
    const q = query(collection(db, "vouchers"), where("companyId", "==", companyId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [companyId]);

  const toDateInputValue = (ms) => {
    if (!ms || typeof ms !== "number") return "";
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const openPrintWindow = ({ title, html }) => {
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    w.document.open();
    w.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${String(title || "Export")}</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans", "Liberation Sans"; margin: 24px; color: #0f172a; }
      h1 { font-size: 18px; margin: 0 0 12px; }
      .small { color: #475569; font-size: 12px; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; vertical-align: top; }
      th { background: #f1f5f9; text-align: left; }
      a { color: #1d4ed8; text-decoration: none; }
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
    const q = query(collection(db, "chartOfAccounts"), where("companyId", "==", companyId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        next.sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));
        setAccounts(next);
      },
      (err) => {
        console.error(err);
      }
    );
    return () => unsub();
  }, [companyId]);

  const resetDraft = () => {
    setDraft({
      type: "DIARIO",
      date: "",
      period: "",
      concept: "",
      thirdPartyName: "",
      driveLink: "",
      lines: [emptyLine(), emptyLine()],
    });
    setAccountSearch("");
    setError("");
    setEditingId(null);
    setEditingStatus(null);
  };

  const startNew = () => {
    resetDraft();
    setView("form");
  };

  const startEdit = async (row) => {
    if (!row?.id) return;
    setError("");
    setLoadingEdit(true);
    try {
      const linesSnap = await getDocs(collection(db, "vouchers", row.id, "lines"));
      const lines = linesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")))
        .filter((l) => !l.voided)
        .map((l) => ({
          accountId: l.accountId || "",
          accountCode: l.accountCode || "",
          accountName: l.accountName || "",
          debit: l.debit != null ? String(l.debit) : "",
          credit: l.credit != null ? String(l.credit) : "",
        }));

      const safeLines = lines.length ? lines : [emptyLine(), emptyLine()];
      while (safeLines.length < 2) safeLines.push(emptyLine());

      setDraft({
        type: row.type || "DIARIO",
        date: toDateInputValue(row.date),
        period: row.period || periodFromDateInput(toDateInputValue(row.date)),
        concept: row.concept || "",
        thirdPartyName: row.thirdPartyName || "",
        driveLink: row.driveLink || "",
        lines: safeLines,
      });
      setEditingId(row.id);
      setEditingStatus(row.status || null);
      setView("form");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Error cargando comprobante");
    } finally {
      setLoadingEdit(false);
    }
  };

  const filteredAccounts = useMemo(() => {
    const s = (accountSearch || "").toLowerCase().trim();
    if (!s) return accounts;
    return accounts.filter((a) => {
      const code = String(a.code || "").toLowerCase();
      const name = String(a.name || "").toLowerCase();
      return code.includes(s) || name.includes(s);
    });
  }, [accounts, accountSearch]);

  const totals = useMemo(() => {
    const debit = (draft.lines || []).reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
    const credit = (draft.lines || []).reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
    return { debit, credit, diff: debit - credit };
  }, [draft.lines]);

  const typeOptions = useMemo(() => {
    const values = new Set(
      rows
        .map((r) => (r.type || "").trim())
        .filter(Boolean)
        .map((v) => v.toUpperCase())
    );
    return ["TODOS", ...Array.from(values).sort()];
  }, [rows]);

  const statusOptions = useMemo(() => {
    const values = new Set(
      rows
        .map((r) => (r.status || "").trim())
        .filter(Boolean)
        .map((v) => v.toUpperCase())
    );
    return ["TODOS", ...Array.from(values).sort()];
  }, [rows]);

  const periodOptions = useMemo(() => {
    const values = new Set(
      rows
        .map((r) => (r.period || "").trim())
        .filter(Boolean)
    );
    return ["TODOS", ...Array.from(values).sort()];
  }, [rows]);

  const processedRows = useMemo(() => {
    const s = (listSearch || "").toLowerCase().trim();
    const next = rows
      .filter((r) => {
        const concept = String(r.concept || "").toLowerCase();
        const type = String(r.type || "").toLowerCase();
        const status = String(r.status || "").toLowerCase();
        const third = String(r.thirdPartyName || "").toLowerCase();
        const matchesSearch = !s || concept.includes(s) || type.includes(s) || status.includes(s) || third.includes(s);
        const matchesType = typeFilter === "TODOS" || String(r.type || "").toUpperCase() === typeFilter;
        const matchesStatus = statusFilter === "TODOS" || String(r.status || "").toUpperCase() === statusFilter;
        const matchesPeriod = periodFilter === "TODOS" || String(r.period || "") === periodFilter;
        return matchesSearch && matchesType && matchesStatus && matchesPeriod;
      })
      .slice();

    const getValue = (row) => {
      switch (sortKey) {
        case "type":
          return String(row.type || "").toLowerCase();
        case "period":
          return String(row.period || "").toLowerCase();
        case "concept":
          return String(row.concept || "").toLowerCase();
        case "status":
          return String(row.status || "").toLowerCase();
        case "debit":
          return Number(row.totals?.debit || 0);
        case "credit":
          return Number(row.totals?.credit || 0);
        default:
          return Number(row.date || 0);
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
  }, [rows, listSearch, typeFilter, statusFilter, periodFilter, sortKey, sortDirection]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(key === "date" ? "desc" : "asc");
    }
  };

  const summaryLabel = useMemo(() => {
    if (loading) return "";
    const total = rows.length;
    const filteredCount = processedRows.length;
    if (filteredCount === total) return `Total de comprobantes: ${total.toString().padStart(2, "0")}`;
    return `Mostrando ${filteredCount} de ${total} comprobantes`;
  }, [rows.length, processedRows.length, loading]);

  const validate = () => {
    const errs = [];
    const concept = (draft.concept || "").trim();
    const date = (draft.date || "").trim();
    const period = (draft.period || "").trim();

    if (!draft.type) errs.push("Tipo de comprobante es obligatorio");
    if (!date) errs.push("Fecha contable es obligatoria");
    if (!period) errs.push("Periodo no válido");
    if (!concept) errs.push("Concepto general es obligatorio");

    const lines = Array.isArray(draft.lines) ? draft.lines : [];
    if (lines.length < 2) errs.push("Debes ingresar al menos 2 líneas");

    const hasAnyValue = lines.some((l) => (Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0);
    if (!hasAnyValue) errs.push("Debes ingresar valores en las líneas");

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      if (!l.accountId) errs.push(`Línea ${i + 1}: cuenta es obligatoria`);
      if (d > 0 && c > 0) errs.push(`Línea ${i + 1}: no puede tener débito y crédito a la vez`);
      if (d === 0 && c === 0) errs.push(`Línea ${i + 1}: debes ingresar débito o crédito`);
    }

    if (totals.debit !== totals.credit) errs.push("La partida no cuadra: Débitos deben ser iguales a Créditos");
    if (totals.debit <= 0) errs.push("El total debe ser mayor a 0");

    return errs;
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");

    const isEditing = !!editingId;
    const errors = validate();
    if (errors.length) {
      setError(errors.join(". "));
      return;
    }

    setSaving(true);
    try {
      const header = {
        companyId,
        type: draft.type,
        date: new Date(draft.date).getTime(),
        period: draft.period,
        concept: draft.concept.trim(),
        thirdPartyName: (draft.thirdPartyName || "").trim(),
        driveLink: (draft.driveLink || "").trim(),
        status: isEditing ? editingStatus || "POSTED" : "DRAFT",
        totals: {
          debit: totals.debit,
          credit: totals.credit,
        },
        updatedAt: serverTimestamp(),
        updatedBy: userId || null,
      };

      let voucherId = editingId;
      let beforeVoucher = null;
      let beforeLines = [];

      if (isEditing) {
        try {
          const voucherSnap = await getDoc(doc(db, "vouchers", voucherId));
          beforeVoucher = voucherSnap.exists() ? voucherSnap.data() : null;
        } catch (err) {
          throw new Error(`Permisos al leer encabezado actual. ${err?.message || ""}`.trim());
        }

        try {
          const existingLinesSnap = await getDocs(collection(db, "vouchers", voucherId, "lines"));
          beforeLines = existingLinesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (err) {
          throw new Error(`Permisos al leer líneas actuales. ${err?.message || ""}`.trim());
        }
      }

      if (!voucherId) {
        const voucherRef = await addDoc(collection(db, "vouchers"), {
          ...header,
          createdAt: serverTimestamp(),
          createdBy: userId || null,
          postedAt: serverTimestamp(),
          postedBy: userId || null,
        });
        voucherId = voucherRef.id;
      } else {
        try {
          await updateDoc(doc(db, "vouchers", voucherId), header);
        } catch (err) {
          throw new Error(`Permisos al actualizar encabezado del comprobante. ${err?.message || ""}`.trim());
        }
      }

      if (isEditing) {
        try {
          await addDoc(collection(db, "vouchers", voucherId, "edits"), {
            companyId,
            voucherId,
            editedAt: serverTimestamp(),
            editedBy: userId || null,
            before: {
              header: beforeVoucher,
              lines: beforeLines,
            },
            after: {
              header: {
                ...header,
                updatedAt: null,
              },
              lines: (draft.lines || []).map((l) => ({
                accountId: l.accountId || "",
                accountCode: l.accountCode || "",
                accountName: l.accountName || "",
                debit: Number(l.debit) || 0,
                credit: Number(l.credit) || 0,
              })),
            },
          });
        } catch (err) {
          throw new Error(`Permisos al registrar auditoría de edición. ${err?.message || ""}`.trim());
        }
      }

      const batch = writeBatch(db);

      let existingLineIds = [];
      if (isEditing) {
        try {
          const existingLines = await getDocs(collection(db, "vouchers", voucherId, "lines"));
          existingLineIds = existingLines.docs.map((d) => d.id);
        } catch (err) {
          throw new Error(`Permisos al leer líneas existentes. ${err?.message || ""}`.trim());
        }
      }

      const lines = draft.lines.map((l) => {
        const debit = Number(l.debit) || 0;
        const credit = Number(l.credit) || 0;
        return {
          companyId,
          accountId: l.accountId,
          accountCode: l.accountCode,
          accountName: l.accountName,
          debit,
          credit,
          date: header.date,
          period: header.period,
          type: header.type,
          concept: header.concept,
          thirdPartyName: header.thirdPartyName,
          createdAt: serverTimestamp(),
        };
      });

      lines.forEach((l, idx) => {
        const lineId = String(idx + 1).padStart(3, "0");
        batch.set(doc(db, "vouchers", voucherId, "lines", lineId), {
          ...l,
          voided: false,
          updatedAt: serverTimestamp(),
          updatedBy: userId || null,
        });
      });

      if (editingId && existingLineIds.length) {
        const keepIds = new Set(lines.map((_, idx) => String(idx + 1).padStart(3, "0")));
        existingLineIds
          .filter((id) => !keepIds.has(id))
          .forEach((id) => {
            batch.set(
              doc(db, "vouchers", voucherId, "lines", id),
              { voided: true, updatedAt: serverTimestamp(), updatedBy: userId || null },
              { merge: true }
            );
          });
      }

      try {
        await batch.commit();
      } catch (err) {
        throw new Error(`Permisos al guardar líneas del comprobante. ${err?.message || ""}`.trim());
      }

      if (!isEditing) {
        try {
          await updateDoc(doc(db, "vouchers", voucherId), {
            status: "POSTED",
            updatedAt: serverTimestamp(),
            updatedBy: userId || null,
            postedAt: serverTimestamp(),
            postedBy: userId || null,
          });
        } catch (err) {
          throw new Error(`Permisos al contabilizar (cambiar estado). ${err?.message || ""}`.trim());
        }
      }

      setView("list");
      resetDraft();
    } catch (err) {
      console.error(err);
      setError(err?.message || "Error guardando comprobante");
    } finally {
      setSaving(false);
    }
  };

  // ===== FORM (mismo patrón visual HomePage) =====
  if (view === "form") {
    return (
      <div className="homeShell">
        <section className="homeQuick">
          <div className="homeQuickHeader">
            <div>
              <h2>{loadingEdit ? "Cargando..." : editingId ? "Editar comprobante" : "Nuevo comprobante"}</h2>
              <p>Registra el encabezado y las líneas contables del comprobante.</p>
            </div>

            <div className="homeQuickHeaderActions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn" onClick={() => setView("list")} disabled={saving}>
                ← Volver
              </button>
            </div>
          </div>

          <form onSubmit={save} className="homeQuickGrid" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
            {/* Encabezado */}
            <div className="homeQuickCard" style={{ gridColumn: "span 12", textAlign: "left", cursor: "default" }}>
              <div className="sectionTitle" style={{ marginTop: 0 }}>
                Encabezado
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="smallMuted">Tipo de comprobante</span>
                  <select className="select" value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}>
                    {VOUCHER_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span className="smallMuted">Fecha contable</span>
                  <input
                    type="date"
                    className="input"
                    value={draft.date}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      setDraft((d) => ({ ...d, date: nextDate, period: periodFromDateInput(nextDate) }));
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span className="smallMuted">Periodo</span>
                  <input className="input" value={draft.period} readOnly />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span className="smallMuted">Tercero principal (opcional)</span>
                  <input className="input" value={draft.thirdPartyName} onChange={(e) => setDraft((d) => ({ ...d, thirdPartyName: e.target.value }))} />
                </label>

                <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                  <span className="smallMuted">Concepto general</span>
                  <input className="input" value={draft.concept} onChange={(e) => setDraft((d) => ({ ...d, concept: e.target.value }))} />
                </label>

                <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                  <span className="smallMuted">Enlace de soporte (Drive)</span>
                  <input
                    className="input"
                    placeholder="https://drive.google.com/..."
                    value={draft.driveLink}
                    onChange={(e) => setDraft((d) => ({ ...d, driveLink: e.target.value }))}
                  />
                </label>
              </div>
            </div>

            {/* Líneas contables */}
            <div className="homeQuickCard" style={{ gridColumn: "span 12", textAlign: "left", cursor: "default" }}>
              <div className="sectionTitle" style={{ marginTop: 0 }}>
                Líneas contables
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 12 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="smallMuted">Buscar cuenta</span>
                  <input className="input" value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} />
                </label>
                <button type="button" className="btn" onClick={() => setDraft((d) => ({ ...d, lines: [...d.lines, emptyLine()] }))} disabled={saving}>
                  + Agregar línea
                </button>
              </div>

              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 340 }}>Cuenta</th>
                      <th>Débito</th>
                      <th>Crédito</th>
                      <th style={{ width: 110 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {(draft.lines || []).map((l, idx) => (
                      <tr key={idx}>
                        <td>
                          <select
                            className="select"
                            style={{ width: "100%" }}
                            value={l.accountId}
                            onChange={(e) => {
                              const nextId = e.target.value;
                              const found = accounts.find((a) => a.id === nextId);
                              setDraft((d) => {
                                const next = d.lines.slice();
                                next[idx] = {
                                  ...next[idx],
                                  accountId: nextId,
                                  accountCode: found?.code || "",
                                  accountName: found?.name || "",
                                };
                                return { ...d, lines: next };
                              });
                            }}
                          >
                            <option value="">Selecciona...</option>
                            {filteredAccounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code} - {a.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input"
                            value={l.debit}
                            onChange={(e) => {
                              const v = e.target.value;
                              setDraft((d) => {
                                const next = d.lines.slice();
                                next[idx] = { ...next[idx], debit: v };
                                return { ...d, lines: next };
                              });
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input"
                            value={l.credit}
                            onChange={(e) => {
                              const v = e.target.value;
                              setDraft((d) => {
                                const next = d.lines.slice();
                                next[idx] = { ...next[idx], credit: v };
                                return { ...d, lines: next };
                              });
                            }}
                          />
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => setDraft((d) => ({ ...d, lines: d.lines.filter((_, i) => i !== idx) }))}
                            disabled={saving || draft.lines.length <= 2}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                <div className="smallMuted">
                  Total débito: <b>{money(totals.debit)}</b> · Total crédito: <b>{money(totals.credit)}</b>
                </div>
                {totals.diff !== 0 ? <div className="error">La partida no cuadra (diferencia: {money(totals.diff)})</div> : null}
              </div>
            </div>

            {/* Error */}
            {error ? (
              <div style={{ gridColumn: "span 12" }}>
                <div className="error">{error}</div>
              </div>
            ) : null}

            {/* Acciones */}
            <div style={{ gridColumn: "span 12", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="submit" className="btn btnPrimary" disabled={saving}>
                {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Contabilizar"}
              </button>
            </div>
          </form>
        </section>
      </div>
    );
  }

  // ===== LIST (mismo patrón visual HomePage) =====
  return (
    <div className="homeShell" ref={listPrintRef}>
      <section className="homeQuick">
        <div className="homeQuickHeader">
          <div>
            <h2>Libro de comprobantes</h2>
            <p>Filtra movimientos, revisa soportes y controla el flujo contable.</p>
          </div>

          <div className="homeQuickHeaderActions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                const node = listPrintRef.current;
                if (!node) return;
                openPrintWindow({
                  title: "Libro de comprobantes",
                  html: `<h1>Libro de comprobantes</h1><div class="small">Generado: ${new Date().toLocaleString()}</div>${node.innerHTML}`,
                });
              }}
            >
              Exportar PDF
            </button>
            <button type="button" className="btn btnPrimary" onClick={startNew}>
              Nuevo comprobante
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
                  value={listSearch}
                  placeholder="Concepto, tipo o tercero..."
                  onChange={(e) => setListSearch(e.target.value)}
                />
              </div>

              <div className="filterGroup">
                <span className="filterLabel">Tipo</span>
                <select className="select selectDense" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  {typeOptions.map((option) => (
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

              <div className="filterGroup">
                <span className="filterLabel">Periodo</span>
                <select className="select selectDense" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}>
                  {periodOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className="homeQuickCard" style={{ gridColumn: "span 12", textAlign: "left", cursor: "default", padding: 0 }}>
            {loading ? (
              <div className="tableEmpty" style={{ padding: 18 }}>
                Cargando comprobantes...
              </div>
            ) : processedRows.length === 0 ? (
              <div className="tableEmpty" style={{ padding: 18 }}>
                No hay comprobantes que coincidan con los filtros seleccionados.
              </div>
            ) : (
              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>
                        <button
                          type="button"
                          className={`thSort${sortKey === "date" ? ` sort-${sortDirection}` : ""}`}
                          onClick={() => toggleSort("date")}
                        >
                          Fecha
                          <span className="sortIcon" aria-hidden="true" />
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          className={`thSort${sortKey === "type" ? ` sort-${sortDirection}` : ""}`}
                          onClick={() => toggleSort("type")}
                        >
                          Tipo
                          <span className="sortIcon" aria-hidden="true" />
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          className={`thSort${sortKey === "period" ? ` sort-${sortDirection}` : ""}`}
                          onClick={() => toggleSort("period")}
                        >
                          Periodo
                          <span className="sortIcon" aria-hidden="true" />
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          className={`thSort${sortKey === "concept" ? ` sort-${sortDirection}` : ""}`}
                          onClick={() => toggleSort("concept")}
                        >
                          Concepto
                          <span className="sortIcon" aria-hidden="true" />
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          className={`thSort${sortKey === "debit" ? ` sort-${sortDirection}` : ""}`}
                          onClick={() => toggleSort("debit")}
                        >
                          Débito
                          <span className="sortIcon" aria-hidden="true" />
                        </button>
                      </th>
                      <th>
                        <button
                          type="button"
                          className={`thSort${sortKey === "credit" ? ` sort-${sortDirection}` : ""}`}
                          onClick={() => toggleSort("credit")}
                        >
                          Crédito
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
                      <th>Soporte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedRows.map((r) => (
                      <tr key={r.id} onClick={() => startEdit(r)} style={{ cursor: "pointer" }} title="Clic para editar">
                        <td>{typeof r.date === "number" ? new Date(r.date).toLocaleDateString() : "-"}</td>
                        <td>{r.type || "-"}</td>
                        <td>{r.period || "-"}</td>
                        <td>{r.concept || "-"}</td>
                        <td style={{ fontWeight: 700 }}>{money(r.totals?.debit || 0)}</td>
                        <td style={{ fontWeight: 700 }}>{money(r.totals?.credit || 0)}</td>
                        <td>
                          <span className={`statusBadge status-${r.status}`}>{r.status || "-"}</span>
                        </td>
                        <td>
                          {r.driveLink ? (
                            <a className="tableLink" href={r.driveLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                              Abrir enlace
                            </a>
                          ) : (
                            <span className="smallMuted">Sin enlace</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          {summaryLabel ? (
            <div style={{ gridColumn: "span 12" }}>
              <div className="tableFooter">
                <span>{summaryLabel}</span>
                <span>
                  Última actualización: <strong>{new Date().toLocaleDateString()}</strong>
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}