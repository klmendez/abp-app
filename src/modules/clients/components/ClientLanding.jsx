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
    <div className="clientLandingLayout">
      <div className="clientLandingToolbar toolbar">
        <button type="button" className="btn clientLandingBackBtn" onClick={onBack}>
          ← Volver
        </button>
        <div className="clientLandingTitle">{clientName}</div>
        <div className="clientLandingToolbarActions">
          <button type="button" className="btn" onClick={() => onNewActivity?.()}>
            Nueva actividad
          </button>
          <button type="button" className="btn btnPrimary" onClick={() => onEditClient?.()}>
            Editar cliente
          </button>
        </div>
      </div>

      <div className="clientLandingCard">
        <div className="sectionTitle">Resumen del Cliente</div>
        <div className="clientLandingGrid">
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

      <div className="clientLandingCard">
        <div className="sectionTitle">Contacto de comunicación</div>
        {hasContacts ? (
          <div className="tableWrap">
            <table className="table tableStackable">
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
                      <td data-label="Nombre">{c?.name || "-"}</td>
                      <td data-label="Cargo">{c?.role || "-"}</td>
                      <td data-label="Email">{c?.email || "-"}</td>
                      <td data-label="Teléfono">{c?.phone || "-"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="clientLandingGrid">
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

      <div className="clientLandingCard">
        <div className="sectionTitle">Estado de pólizas</div>
        <div className="tableWrap">
          <table className="table tableStackable">
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
                    <td data-label="Línea">{line.label}</td>
                    <td data-label="Tiene póliza">{yesNo(!!p.tienePoliza)}</td>
                    <td data-label="Aseguradora">{(p.aseguradora || "").trim() || "-"}</td>
                    <td data-label="Inicio">{(p.inicio || "").trim() || "-"}</td>
                    <td data-label="Fin">{(p.fin || "").trim() || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="clientLandingCard">
        <div className="sectionTitle">Intermediación</div>
        <div className="clientLandingGrid">
          <div>
            <div className="smallMuted">Apta para intermediación</div>
            <div>{client.intermediacion?.apta || "-"}</div>
          </div>
        </div>
      </div>

      <div className="clientLandingCard">
        <div className="sectionTitle">Tablero de Actividades</div>
        {loading ? (
          <div className="smallMuted">Cargando actividades...</div>
        ) : (
          <div className="clientActivitiesBoard">
            {STATUS_COLUMNS.map((col) => (
              <div key={col} className="clientActivitiesBoardLane">
                <div className="clientActivitiesBoardLaneHeader">{col}</div>
                <div className="clientActivitiesBoardLaneBody">
                  {activities
                    .filter((a) => (a.status || "PENDIENTE") === col)
                    .map((a) => (
                      <div
                        key={a.id}
                        className={`clientActivityCard${selectedActivity?.id === a.id ? " is-active" : ""}`}
                        onClick={() => setSelectedActivity(a)}
                      >
                        <div className="clientActivityCardTitle">{a.title || a.activity}</div>
                        <div className="clientActivityCardMeta">
                          <span>{a.dueDate || "Sin fecha"}</span>
                          <span>{a.responsibleUid || "Sin asignar"}</span>
                        </div>
                        {typeof a.progress === "number" && (
                          <div className="clientActivityCardProgress" aria-label="Progreso">
                            <div style={{ width: `${a.progress}%` }} />
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedActivity && (
        <div className="clientLandingCard">
          <div className="clientActivityDetailHeader">
            <div className="sectionTitle" style={{ margin: 0 }}>Seguimiento de Actividad</div>
            <div className="clientActivityDetailActions">
              <button type="button" className="btn" onClick={() => onEditActivity?.(selectedActivity)}>
                Editar actividad
              </button>
              <button className="btn" onClick={() => setSelectedActivity(null)}>Cerrar</button>
            </div>
          </div>

          <div className="clientLandingGrid clientLandingGrid--wide">
            <div>
              <div className="smallMuted">Descripción</div>
              <div>{selectedActivity.description || selectedActivity.notes || "-"}</div>
            </div>
            <div>
              <div className="sectionTitle">Historial</div>
              <div className="clientActivityHistory">
                {selectedActivity.history?.slice().reverse().map((h, i) => (
                  <div key={i} className="clientActivityHistoryItem">
                    <div className="clientActivityHistoryType">{h.type}</div>
                    <div className="smallMuted">
                      {new Date(h.at).toLocaleString()} {h.by ? `· ${h.by}` : ""}
                    </div>
                    {h.changes &&
                      Object.entries(h.changes).map(([f, v]) => (
                        <div key={f} className="clientActivityHistoryChange">
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
