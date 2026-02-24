import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../../../firebase";

const STATUS_COLUMNS = ["PENDIENTE", "EN_PROCESO", "COMPLETADA"];

export default function ClientLanding({
  client,
  onBack,
  onEditClient,
  onNewActivity,
  onEditActivity,
  companyId,
  userId,
}) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [responsibleUser, setResponsibleUser] = useState(null);

  const clientName = client.basic?.name || client.name || "Cliente";
  const contacts = Array.isArray(client.basic?.contacts) ? client.basic.contacts : [];
  const hasContacts = contacts.some((c) => (c?.email || "").trim() || (c?.phone || "").trim() || (c?.name || "").trim());
  const fallbackContactEmail = (client.basic?.email || "").trim();
  const fallbackContactPhone = (client.basic?.phone || "").trim();

  useEffect(() => {
    const q = query(
      collection(db, "activities"),
      where("companyId", "==", companyId),
      where("clientId", "==", client.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      setActivities(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [companyId, client.id]);

  useEffect(() => {
    let cancelled = false;
    const uid = (client.commercial?.responsibleUid || "").trim();
    if (!uid) {
      setResponsibleUser(null);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (cancelled) return;
        setResponsibleUser(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } catch (e) {
        console.error(e);
        if (cancelled) return;
        setResponsibleUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client.commercial?.responsibleUid]);

  const responsibleLabel = () => {
    const uid = (client.commercial?.responsibleUid || "").trim();
    if (!uid) return "-";
    const name = (responsibleUser?.displayName || responsibleUser?.name || "").trim();
    const email = (responsibleUser?.email || "").trim();
    if (name && email) return `${name} (${email})`;
    if (name) return name;
    if (email) return email;
    return uid;
  };

  const policy = (key) => client.seguros?.[key] || { tienePoliza: false, aseguradora: "", inicio: "", fin: "" };
  const yesNo = (v) => (v === true ? "SI" : v === false ? "NO" : v || "-");

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="toolbar" style={{ background: "white" }}>
        <button type="button" className="btn" onClick={onBack}>
          ← Volver
        </button>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{clientName}</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button type="button" className="btn" onClick={() => onNewActivity?.()}>
            Nueva actividad
          </button>
          <button type="button" className="btn btnPrimary" onClick={() => onEditClient?.()}>
            Editar cliente
          </button>
        </div>
      </div>

      <div style={{ background: "white", padding: 16, borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <div className="sectionTitle">Resumen del Cliente</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div>
            <div className="smallMuted">Rep Legal</div>
            <div>{client.basic?.legalRep || "-"}</div>
          </div>
          <div>
            <div className="smallMuted">NIT</div>
            <div>{client.basic?.nit || client.nit || "-"}</div>
          </div>
          <div>
            <div className="smallMuted">Ciudad</div>
            <div>{client.basic?.city || client.city || "-"}</div>
          </div>
          <div>
            <div className="smallMuted">Estado comercial</div>
            <div>{client.commercial?.commercialStatus || "-"}</div>
          </div>
          <div>
            <div className="smallMuted">Acompañamiento comercial</div>
            <div>{client.commercial?.accompanied || "-"}</div>
          </div>
          <div>
            <div className="smallMuted">Gestor comercial</div>
            <div>{responsibleLabel()}</div>
          </div>
          <div>
            <div className="smallMuted">Comentario</div>
            <div>{client.commercial?.notes || "-"}</div>
          </div>
        </div>
      </div>

      <div style={{ background: "white", padding: 16, borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <div className="sectionTitle">Contacto de comunicación</div>
        {hasContacts ? (
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Cargo</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                </tr>
              </thead>
              <tbody>
                {contacts
                  .filter((c) => (c?.email || "").trim() || (c?.phone || "").trim() || (c?.name || "").trim())
                  .map((c, idx) => (
                    <tr key={idx}>
                      <td>{c?.name || "-"}</td>
                      <td>{c?.role || "-"}</td>
                      <td>{c?.email || "-"}</td>
                      <td>{c?.phone || "-"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div>
              <div className="smallMuted">Email</div>
              <div>{fallbackContactEmail || "-"}</div>
            </div>
            <div>
              <div className="smallMuted">Teléfono</div>
              <div>{fallbackContactPhone || "-"}</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ background: "white", padding: 16, borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <div className="sectionTitle">Estado de pólizas</div>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Línea</th>
                <th>Tiene póliza</th>
                <th>Aseguradora actual</th>
                <th>Inicio</th>
                <th>Fin</th>
              </tr>
            </thead>
            <tbody>
              {[
                { key: "vida", label: "Vida" },
                { key: "salud", label: "Salud" },
                { key: "generales", label: "Generales" },
                { key: "arl", label: "ARL" },
              ].map((line) => {
                const p = policy(line.key);
                return (
                  <tr key={line.key}>
                    <td>{line.label}</td>
                    <td>{yesNo(!!p.tienePoliza)}</td>
                    <td>{(p.aseguradora || "").trim() || "-"}</td>
                    <td>{(p.inicio || "").trim() || "-"}</td>
                    <td>{(p.fin || "").trim() || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: "white", padding: 16, borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <div className="sectionTitle">Intermediación</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div>
            <div className="smallMuted">Apta para intermediación</div>
            <div>{client.intermediacion?.apta || "-"}</div>
          </div>
        </div>
      </div>

      <div>
        <div className="sectionTitle">Tablero de Actividades</div>
        {loading ? (
          <div className="smallMuted">Cargando actividades...</div>
        ) : (
          <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 }}>
            {STATUS_COLUMNS.map((col) => (
              <div key={col} style={{ minWidth: 280, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "#374151" }}>{col}</div>
                <div style={{ background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb", minHeight: 100 }}>
                  {activities
                    .filter((a) => (a.status || "PENDIENTE") === col)
                    .map((a) => (
                      <div
                        key={a.id}
                        style={{
                          padding: 12,
                          borderBottom: "1px solid #e5e7eb",
                          cursor: "pointer",
                          background: selectedActivity?.id === a.id ? "#eef2ff" : "white",
                          margin: 4,
                          borderRadius: 6,
                          border: selectedActivity?.id === a.id ? "1px solid #bfdbfe" : "1px solid transparent"
                        }}
                        onClick={() => setSelectedActivity(a)}
                      >
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{a.title || a.activity}</div>
                        <div className="smallMuted" style={{ marginTop: 4 }}>{a.dueDate || "Sin fecha"}</div>
                        <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div className="smallMuted" style={{ fontSize: 11 }}>{a.responsibleUid || "Sin asignar"}</div>
                          {typeof a.progress === "number" && (
                            <div style={{ width: 40, background: "#e5e7eb", height: 4, borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ width: `${a.progress}%`, background: "#10b981", height: "100%" }}></div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedActivity && (
        <div style={{ background: "white", padding: 16, borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
            <div className="sectionTitle" style={{ margin: 0 }}>Seguimiento de Actividad</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn" onClick={() => onEditActivity?.(selectedActivity)}>
                Editar actividad
              </button>
              <button className="btn" onClick={() => setSelectedActivity(null)}>Cerrar</button>
            </div>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
            <div>
              <div className="smallMuted">Descripción</div>
              <div>{selectedActivity.description || selectedActivity.notes || "-"}</div>
            </div>
            <div>
              <div className="sectionTitle">Historial</div>
              <div style={{ display: "grid", gap: 12 }}>
                {selectedActivity.history?.slice().reverse().map((h, i) => (
                  <div key={i} style={{ fontSize: 13, borderLeft: "2px solid #e5e7eb", paddingLeft: 12 }}>
                    <div style={{ fontWeight: 600 }}>{h.type}</div>
                    <div className="smallMuted">
                      {new Date(h.at).toLocaleString()} {h.by ? `· ${h.by}` : ""}
                    </div>
                    {h.changes && Object.entries(h.changes).map(([f, v]) => (
                      <div key={f} style={{ fontSize: 12 }}>
                        {f}: {String(v.from || "-")} → {String(v.to || "-")}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
