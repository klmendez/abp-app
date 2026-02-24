import { useMemo, useState, useEffect } from "react";
import { doc, updateDoc, addDoc, collection, serverTimestamp, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "../../../firebase";

export default function ClientFormModal({ isOpen, onClose, client, companyId, userId, onSaved }) {
  const [memberships, setMemberships] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [draft, setDraft] = useState({
    basic: {
      name: "",
      legalRep: "",
      nit: "",
      city: "",
      contacts: [{ name: "", role: "", email: "", phone: "" }],
    },
    commercial: {
      commercialStatus: "",
      accompanied: "",
      responsibleUid: "",
      notes: "",
    },
    seguros: {
      vida: { tienePoliza: false, aseguradora: "", inicio: "", fin: "" },
      salud: { tienePoliza: false, aseguradora: "", inicio: "", fin: "" },
      generales: { tienePoliza: false, aseguradora: "", inicio: "", fin: "" },
      arl: { tienePoliza: false, aseguradora: "", inicio: "", fin: "" },
    },
    intermediacion: {
      apta: "",
    },
    status: "ACTIVE",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (client) {
      setDraft({
        basic: {
          name: client.basic?.name || client.name || "",
          legalRep: client.basic?.legalRep || "",
          nit: client.basic?.nit || client.nit || "",
          city: client.basic?.city || client.city || "",
          contacts:
            Array.isArray(client.basic?.contacts) && client.basic.contacts.length
              ? client.basic.contacts
              : [{ name: "", role: "", email: client.basic?.email || "", phone: client.basic?.phone || "" }],
        },
        commercial: {
          commercialStatus: client.commercial?.commercialStatus ?? "",
          accompanied: client.commercial?.accompanied ?? "",
          responsibleUid: client.commercial?.responsibleUid || "",
          notes: client.commercial?.notes || "",
        },
        seguros: {
          vida: client.seguros?.vida || { tienePoliza: false, aseguradora: "", inicio: "", fin: "" },
          salud: client.seguros?.salud || { tienePoliza: false, aseguradora: "", inicio: "", fin: "" },
          generales: client.seguros?.generales || { tienePoliza: false, aseguradora: "", inicio: "", fin: "" },
          arl: client.seguros?.arl || { tienePoliza: false, aseguradora: "", inicio: "", fin: "" },
        },
        intermediacion: {
          apta: client.intermediacion?.apta ?? "",
        },
        status: client.status || "ACTIVE",
      });
      setError("");
    } else {
      setError("");
    }
  }, [client]);

  useEffect(() => {
    if (!companyId) return;
    const q = collection(db, "companies", companyId, "memberships");
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMemberships(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error(err);
      }
    );
    return () => unsub();
  }, [companyId]);

  useEffect(() => {
    let cancelled = false;
    const ids = memberships.map((m) => m.id).filter(Boolean);
    if (!ids.length) {
      setUsersById({});
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const pairs = await Promise.all(
          ids.map(async (uid) => {
            try {
              const snap = await getDoc(doc(db, "users", uid));
              return [uid, snap.exists() ? { id: snap.id, ...snap.data() } : null];
            } catch (e) {
              console.error(e);
              return [uid, null];
            }
          })
        );
        if (cancelled) return;
        const next = {};
        for (const [uid, u] of pairs) next[uid] = u;
        setUsersById(next);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memberships]);

  const memberLabel = useMemo(() => {
    return (uid) => {
      const u = usersById?.[uid];
      const name = (u?.displayName || u?.name || "").trim();
      const email = (u?.email || "").trim();
      if (name && email) return `${name} (${email})`;
      if (name) return name;
      if (email) return email;
      return uid;
    };
  }, [usersById]);

  const validate = () => {
    const errors = [];
    const name = (draft.basic?.name || "").trim();
    const city = (draft.basic?.city || "").trim();
    const commercialStatus = String(draft.commercial?.commercialStatus || "").trim();
    const accompanied = String(draft.commercial?.accompanied || "").trim();
    const responsibleUid = String(draft.commercial?.responsibleUid || "").trim();

    const contacts = Array.isArray(draft.basic?.contacts) ? draft.basic.contacts : [];
    const hasContact = contacts.some((c) => (c?.email || "").trim() || (c?.phone || "").trim());

    if (!name) errors.push("Nombre de empresa es obligatorio");
    if (!city) errors.push("Ciudad es obligatoria");
    if (!commercialStatus) errors.push("Estado comercial es obligatorio");
    if (!accompanied) errors.push("Acompañamiento comercial es obligatorio");
    if (!responsibleUid) errors.push("Gestor Comercial es obligatorio");
    if (!hasContact) errors.push("Contacto: debes ingresar al menos teléfono o email");

    const checkPolicy = (lineKey, label) => {
      const p = draft?.seguros?.[lineKey];
      if (!p?.tienePoliza) return;
      if (!(p.inicio || "").trim() || !(p.fin || "").trim()) {
        errors.push(`${label}: si tiene póliza debes ingresar Inicio y Fin`);
      }
    };

    checkPolicy("vida", "Vida");
    checkPolicy("salud", "Salud");
    checkPolicy("generales", "Generales");

    return errors;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    const errors = validate();
    if (errors.length) {
      setError(errors.join(". "));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...draft,
        companyId,
        updatedAt: serverTimestamp(),
        updatedBy: userId
      };

      if (client?.id) {
        await updateDoc(doc(db, "clients", client.id), payload);

        try {
          const snap = await getDoc(doc(db, "clients", client.id));
          if (snap.exists()) onSaved?.({ id: snap.id, ...snap.data() });
        } catch (e) {
          console.error(e);
        }
      } else {
        const createdRef = await addDoc(collection(db, "clients"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: userId
        });

        try {
          const snap = await getDoc(doc(db, "clients", createdRef.id));
          if (snap.exists()) onSaved?.({ id: snap.id, ...snap.data() });
        } catch (e) {
          console.error(e);
        }
      }
      onClose();
    } catch (err) {
      console.error(err);
      setError(err?.message || "Error guardando cliente");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modalOverlay">
      <div className="modal" style={{ maxWidth: 600 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>{client ? "Editar Cliente" : "Nuevo Cliente"}</h3>
          <button className="btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSave} style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div className="sectionTitle" style={{ marginBottom: 0 }}>Datos de empresa</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="smallMuted">Nombre / Razón Social</span>
              <input
                className="input"
                required
                value={draft.basic.name}
                onChange={(e) => setDraft({ ...draft, basic: { ...draft.basic, name: e.target.value } })}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="smallMuted">Rep Legal</span>
              <input
                className="input"
                value={draft.basic.legalRep}
                onChange={(e) => setDraft({ ...draft, basic: { ...draft.basic, legalRep: e.target.value } })}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="smallMuted">NIT</span>
              <input
                className="input"
                value={draft.basic.nit}
                onChange={(e) => setDraft({ ...draft, basic: { ...draft.basic, nit: e.target.value } })}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="smallMuted">Ciudad</span>
              <input
                className="input"
                required
                value={draft.basic.city}
                onChange={(e) => setDraft({ ...draft, basic: { ...draft.basic, city: e.target.value } })}
              />
            </label>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div className="sectionTitle" style={{ marginBottom: 0 }}>Gestión comercial</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="smallMuted">Estado comercial</span>
              <select
                className="select"
                value={draft.commercial.commercialStatus}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    commercial: { ...draft.commercial, commercialStatus: e.target.value },
                  })
                }
              >
                <option value="">Selecciona...</option>
                <option value="PROSPECTO">PROSPECTO</option>
                <option value="EN_GESTION">EN_GESTIÓN</option>
                <option value="GANADO">GANADO</option>
                <option value="PERDIDO">PERDIDO</option>
              </select>
            </label>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div className="sectionTitle" style={{ marginBottom: 0 }}>Contacto de comunicación</div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {(draft.basic.contacts || []).map((c, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "grid", gap: 4 }}>
                  <span className="smallMuted">Nombre</span>
                  <input
                    className="input"
                    value={c.name || ""}
                    onChange={(e) => {
                      const next = structuredClone(draft);
                      next.basic.contacts[idx].name = e.target.value;
                      setDraft(next);
                    }}
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span className="smallMuted">Cargo</span>
                  <input
                    className="input"
                    value={c.role || ""}
                    onChange={(e) => {
                      const next = structuredClone(draft);
                      next.basic.contacts[idx].role = e.target.value;
                      setDraft(next);
                    }}
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span className="smallMuted">Email</span>
                  <input
                    className="input"
                    type="email"
                    value={c.email || ""}
                    onChange={(e) => {
                      const next = structuredClone(draft);
                      next.basic.contacts[idx].email = e.target.value;
                      setDraft(next);
                    }}
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span className="smallMuted">Teléfono</span>
                  <input
                    className="input"
                    value={c.phone || ""}
                    onChange={(e) => {
                      const next = structuredClone(draft);
                      next.basic.contacts[idx].phone = e.target.value;
                      setDraft(next);
                    }}
                  />
                </label>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const next = structuredClone(draft);
                  next.basic.contacts = [...(next.basic.contacts || []), { name: "", role: "", email: "", phone: "" }];
                  setDraft(next);
                }}
              >
                + Agregar contacto
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div className="sectionTitle" style={{ marginBottom: 0 }}>Gestión comercial</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="smallMuted">Acompañamiento comercial</span>
              <select
                className="select"
                value={String(draft.commercial.accompanied || "")}
                onChange={(e) => setDraft({ ...draft, commercial: { ...draft.commercial, accompanied: e.target.value } })}
              >
                <option value="">Seleccionar</option>
                <option value="SI">SI</option>
                <option value="NO">NO</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="smallMuted">Gestor Comercial</span>
              <select
                className="select"
                value={draft.commercial.responsibleUid || ""}
                onChange={(e) => setDraft({ ...draft, commercial: { ...draft.commercial, responsibleUid: e.target.value } })}
              >
                <option value="">Seleccionar</option>
                {memberships
                  .slice()
                  .sort((a, b) => memberLabel(a.id).localeCompare(memberLabel(b.id)))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {memberLabel(m.id)}{m.role ? ` · ${m.role}` : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, gridColumn: "1 / -1" }}>
              <span className="smallMuted">Comentario</span>
              <textarea
                className="textarea"
                rows={3}
                value={draft.commercial.notes}
                onChange={(e) => setDraft({ ...draft, commercial: { ...draft.commercial, notes: e.target.value } })}
              />
            </label>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div className="sectionTitle" style={{ marginBottom: 0 }}>Estado de pólizas</div>
          </div>

          {([
            { key: "vida", title: "Vida" },
            { key: "salud", title: "Salud" },
            { key: "generales", title: "Generales" },
            { key: "arl", title: "ARL" },
          ]).map((line) => {
            const value = draft.seguros?.[line.key] || { tienePoliza: false, aseguradora: "", inicio: "", fin: "" };
            return (
              <div key={line.key} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "#fafafa" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800 }}>{line.title}</div>
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={!!value.tienePoliza}
                      onChange={(e) => {
                        const next = structuredClone(draft);
                        next.seguros[line.key].tienePoliza = e.target.checked;
                        if (!e.target.checked) {
                          next.seguros[line.key].inicio = "";
                          next.seguros[line.key].fin = "";
                        }
                        setDraft(next);
                      }}
                    />
                    <span className="smallMuted">Tiene póliza</span>
                  </label>
                </div>

                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span className="smallMuted">Aseguradora actual</span>
                    <input
                      className="input"
                      value={value.aseguradora || ""}
                      placeholder={line.key === "arl" ? "POSITIVA / No tiene" : ""}
                      onChange={(e) => {
                        const next = structuredClone(draft);
                        next.seguros[line.key].aseguradora = e.target.value;
                        setDraft(next);
                      }}
                    />
                  </label>
                  <div />
                  <label style={{ display: "grid", gap: 4 }}>
                    <span className="smallMuted">Inicio póliza</span>
                    <input
                      className="input"
                      type="date"
                      value={value.inicio || ""}
                      onChange={(e) => {
                        const next = structuredClone(draft);
                        next.seguros[line.key].inicio = e.target.value;
                        setDraft(next);
                      }}
                      disabled={!value.tienePoliza}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span className="smallMuted">Fin póliza</span>
                    <input
                      className="input"
                      type="date"
                      value={value.fin || ""}
                      onChange={(e) => {
                        const next = structuredClone(draft);
                        next.seguros[line.key].fin = e.target.value;
                        setDraft(next);
                      }}
                      disabled={!value.tienePoliza}
                    />
                  </label>
                </div>
              </div>
            );
          })}

          <div style={{ display: "grid", gap: 8 }}>
            <div className="sectionTitle" style={{ marginBottom: 0 }}>Intermediación</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="smallMuted">Apta para intermediación</span>
              <select
                className="select"
                value={String(draft.intermediacion.apta || "")}
                onChange={(e) => setDraft({ ...draft, intermediacion: { ...draft.intermediacion, apta: e.target.value } })}
              >
                <option value="">Seleccionar</option>
                <option value="SI">SI</option>
                <option value="NO">NO</option>
              </select>
            </label>
            <div />
          </div>

          {error ? (
            <div className="error">{error}</div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btnPrimary" disabled={saving}>
              {saving ? "Guardando..." : "Guardar Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
