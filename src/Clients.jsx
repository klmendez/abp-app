export { default } from "./ClientsFixed";

/*

    setActivitiesLoading(true);
    const q = query(
      collection(db, "clients", selectedId, "activities"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setActivityRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setActivitiesLoading(false);
      },
      (err) => {
        console.error(err);
        setActivitiesLoading(false);
      }
    );

    return () => unsub();
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setInterRows([]);
      setEditingInterId(null);
      return;
    }

    setInterLoading(true);
    const q = query(collection(db, "clients", selectedId, "intermediations"), orderBy("endDate", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setInterRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setInterLoading(false);
      },
      (err) => {
        console.error(err);
        setInterLoading(false);
      }
    );

    return () => unsub();
  }, [selectedId]);

  const availableCities = useMemo(() => {
    const set = new Set();
    for (const r of rows) {
      const city = (r.basic?.city || r.city || "").trim();
      if (city) set.add(city);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = rows.filter((r) => {
    const statusOk = statusFilter === "ALL" ? true : r.status === statusFilter;
    if (!statusOk) return false;

    const city = (r.basic?.city || r.city || "").trim();
    const cityOk = cityFilter === "ALL" ? true : city === cityFilter;
    if (!cityOk) return false;

    const resp = (r.commercial?.responsibleUid || "").trim();
    const respFilter = responsibleFilter.trim();
    const respOk = !respFilter ? true : resp === respFilter;
    if (!respOk) return false;

    const hasLine = (line) => {
      const x = r?.seguros?.[line];
      return !!x?.tienePoliza;
    };
    if (lineFilter !== "ALL") {
      if (!hasLine(lineFilter)) return false;
    }

    const q = search.trim().toLowerCase();
    if (!q) return true;

    const name = (r.basic?.name || r.name || "").toLowerCase();
    const nit = (r.basic?.nit || r.nit || "").toLowerCase();
    const citySearch = (r.basic?.city || r.city || "").toLowerCase();
    const responsible = (r.commercial?.responsibleUid || "").toLowerCase();
    return name.includes(q) || nit.includes(q) || citySearch.includes(q) || responsible.includes(q);
  });

  const startCreate = () => {
    setFormError("");
    setSelectedId(null);
    setDraft(createEmptyClient(companyId));
    setActiveTab("basic");
    setActivityRows([]);
    setEditingActivityId(null);
    setInterRows([]);
    setEditingInterId(null);
  };

  const startEdit = (row) => {
    setFormError("");
    setSelectedId(row.id);

    const legacyBasic = {
      name: row.basic?.name ?? row.name ?? "",
      nit: row.basic?.nit ?? row.nit ?? "",
      city: row.basic?.city ?? row.city ?? "",
    };

    setDraft({
      ...createEmptyClient(companyId),
      ...row,
      basic: { ...createEmptyClient(companyId).basic, ...legacyBasic, ...(row.basic || {}) },
      commercial: { ...createEmptyClient(companyId).commercial, ...(row.commercial || {}) },
      seguros: { ...createEmptyClient(companyId).seguros, ...(row.seguros || {}) },
      intermediacion: { ...createEmptyClient(companyId).intermediacion, ...(row.intermediacion || {}) },
      evidencias: { ...createEmptyClient(companyId).evidencias, ...(row.evidencias || {}) },
    });
    setActiveTab("basic");
  };

  const save = async (e) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const normalized = normalizeClientBeforeSave(draft);
      const errors = validateClient(normalized);
      if (errors.length) {
        setFormError(errors.join(". "));
        return;
      }

      if (!selectedId) {
        await addDoc(collection(db, "clients"), {
          ...normalized,
          createdAt: serverTimestamp(),
          createdBy: userId || null,
          updatedAt: serverTimestamp(),
          updatedBy: userId || null,
        });
        startCreate();
      } else {
        const ref = doc(db, "clients", selectedId);
        await updateDoc(ref, {
          ...normalized,
          updatedAt: serverTimestamp(),
          updatedBy: userId || null,
        });
      }
    } catch (err) {
      console.error(err);
      setFormError(err?.message || "Error guardando cliente");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, display: "grid", gap: 18 }}>
      <h2>Clientes</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={startCreate}>
          Nuevo cliente
        </button>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={search}
            placeholder="Buscar por nombre, NIT o ciudad..."
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, minWidth: 260 }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          >
            <option value="ALL">Todos</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>

          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          >
            <option value="ALL">Ciudad (todas)</option>
            {availableCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <input
            value={responsibleFilter}
            placeholder="Gestor (uid)"
            onChange={(e) => setResponsibleFilter(e.target.value)}
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, minWidth: 160 }}
          />

          <select
            value={lineFilter}
            onChange={(e) => setLineFilter(e.target.value)}
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          >
            <option value="ALL">Línea (todas)</option>
            <option value="vida">Vida</option>
            <option value="salud">Salud</option>
            <option value="generales">Generales</option>
            <option value="arl">ARL</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 18 }}>
        <div>
          {loading ? (
            <p>Cargando...</p>
          ) : filteredRows.length === 0 ? (
            <p>No hay clientes todavía.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>NIT</th>
                    <th>Ciudad</th>
                    <th>Estado comercial</th>
                    <th>Gestor</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr key={r.id} style={{ background: r.id === selectedId ? "#f6f6f6" : "transparent" }}>
                      <td>{r.basic?.name || r.name}</td>
                      <td>{r.basic?.nit || r.nit}</td>
                      <td>{r.basic?.city || r.city}</td>
                      <td>{r.commercial?.commercialStatus || ""}</td>
                      <td>{r.commercial?.responsibleUid || ""}</td>
                      <td>{r.status}</td>
                      <td>
                        <button type="button" onClick={() => startEdit(r)}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <h3 style={{ margin: 0 }}>{selectedId ? "Editar cliente" : "Nuevo cliente"}</h3>
            {selectedId ? (
              <button type="button" onClick={startCreate}>
                Crear nuevo
              </button>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <TabButton id="basic" activeTab={activeTab} setActiveTab={setActiveTab}>
              Básico
            </TabButton>
            <TabButton id="commercial" activeTab={activeTab} setActiveTab={setActiveTab}>
              Comercial
            </TabButton>
            <TabButton id="activities" activeTab={activeTab} setActiveTab={setActiveTab}>
              Actividades
            </TabButton>
            <TabButton id="seguros" activeTab={activeTab} setActiveTab={setActiveTab}>
              Seguros
            </TabButton>
            <TabButton id="intermediaciones" activeTab={activeTab} setActiveTab={setActiveTab}>
              Intermediaciones
            </TabButton>
            <TabButton id="evidencias" activeTab={activeTab} setActiveTab={setActiveTab}>
              Evidencias Drive
            </TabButton>
          </div>

          {formError ? <div style={{ marginTop: 12, color: "#b00020" }}>{formError}</div> : null}

          <form onSubmit={save} style={{ marginTop: 12, display: "grid", gap: 12 }}>
            {activeTab === "basic" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <TextField
                  label="Nombre / Razón social"
                  value={draft.basic.name}
                  onChange={(v) => setDraft((d) => ({ ...d, basic: { ...d.basic, name: v } }))}
                  placeholder="Cliente"
                />
                <TextField
                  label="NIT"
                  value={draft.basic.nit}
                  onChange={(v) => setDraft((d) => ({ ...d, basic: { ...d.basic, nit: v } }))}
                  placeholder="NIT"
                />
                <TextField
                  label="Ciudad"
                  value={draft.basic.city}
                  onChange={(v) => setDraft((d) => ({ ...d, basic: { ...d.basic, city: v } }))}
                  placeholder="Ciudad"
                />
                <SelectField
                  label="Estado"
                  value={draft.status}
                  onChange={(v) => setDraft((d) => ({ ...d, status: v }))}
                  options={[
                    { value: "ACTIVE", label: "ACTIVE" },
                    { value: "INACTIVE", label: "INACTIVE" },
                  ]}
                />
                <TextField
                  label="Email"
                  value={draft.basic.email}
                  onChange={(v) => setDraft((d) => ({ ...d, basic: { ...d.basic, email: v } }))}
                  placeholder="correo@cliente.com"
                />
                <TextField
                  label="Teléfono"
                  value={draft.basic.phone}
                  onChange={(v) => setDraft((d) => ({ ...d, basic: { ...d.basic, phone: v } }))}
                  placeholder="+57..."
                />
                <div style={{ gridColumn: "1 / -1" }}>
                  <TextField
                    label="Dirección"
                    value={draft.basic.address}
                    onChange={(v) => setDraft((d) => ({ ...d, basic: { ...d.basic, address: v } }))}
                    placeholder="Dirección"
                  />
                </div>

                <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Contactos</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {(draft.basic.contacts || []).map((c, idx) => (
                      <div
                        key={idx}
                        style={{ border: "1px solid #eee", borderRadius: 10, padding: 10, display: "grid", gap: 10 }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontWeight: 600 }}>Contacto #{idx + 1}</div>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((d) => ({
                                ...d,
                                basic: {
                                  ...d.basic,
                                  contacts: (d.basic.contacts || []).filter((_, i) => i !== idx),
                                },
                              }))
                            }
                            disabled={(draft.basic.contacts || []).length <= 1}
                          >
                            Eliminar
                          </button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                          <TextField
                            label="Nombre"
                            value={c.name}
                            onChange={(v) =>
                              setDraft((d) => {
                                const next = structuredClone(d);
                                next.basic.contacts[idx].name = v;
                                return next;
                              })
                            }
                            placeholder="Nombre contacto"
                          />
                          <SelectField
                            label="Tipo"
                            value={c.role}
                            onChange={(v) =>
                              setDraft((d) => {
                                const next = structuredClone(d);
                                next.basic.contacts[idx].role = v;
                                return next;
                              })
                            }
                            options={[
                              { value: "PRINCIPAL", label: "PRINCIPAL" },
                              { value: "ALTERNO", label: "ALTERNO" },
                            ]}
                          />
                          <TextField
                            label="Email"
                            value={c.email}
                            onChange={(v) =>
                              setDraft((d) => {
                                const next = structuredClone(d);
                                next.basic.contacts[idx].email = v;
                                return next;
                              })
                            }
                            placeholder="correo@..."
                          />
                          <TextField
                            label="Teléfono"
                            value={c.phone}
                            onChange={(v) =>
                              setDraft((d) => {
                                const next = structuredClone(d);
                                next.basic.contacts[idx].phone = v;
                                return next;
                              })
                            }
                            placeholder="+57..."
                          />
                        </div>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ fontSize: 12, color: "#333" }}>Notas</span>
                          <textarea
                            value={c.notes}
                            onChange={(e) =>
                              setDraft((d) => {
                                const next = structuredClone(d);
                                next.basic.contacts[idx].notes = e.target.value;
                                return next;
                              })
                            }
                            rows={3}
                            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                          />
                        </label>
                      </div>
                    ))}
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            basic: {
                              ...d.basic,
                              contacts: [
                                ...(d.basic.contacts || []),
                                { name: "", role: "ALTERNO", email: "", phone: "", notes: "" },
                              ],
                            },
                          }))
                        }
                      >
                        + Agregar contacto
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "activities" ? (
              <div style={{ display: "grid", gap: 12 }}>
                {!selectedId ? (
                  <div style={{ color: "#666" }}>Guarda el cliente primero para poder registrar actividades.</div>
                ) : null}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <button type="button" onClick={startNewActivity} disabled={!selectedId}>
                    Nueva actividad
                  </button>
                  <select
                    value={activityStatusFilter}
                    onChange={(e) => setActivityStatusFilter(e.target.value)}
                    style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                  >
                    <option value="ALL">Estado (todos)</option>
                    <option value="EN_PROCESO">EN_PROCESO</option>
                    <option value="FINALIZADO">FINALIZADO</option>
                  </select>
                  <input
                    value={activityResponsibleFilter}
                    placeholder="Responsable (uid)"
                    onChange={(e) => setActivityResponsibleFilter(e.target.value)}
                    style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, minWidth: 180 }}
                    disabled={!selectedId}
                  />
                </div>

                <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                  {activitiesLoading ? (
                    <div>Cargando actividades...</div>
                  ) : activityRows.length === 0 ? (
                    <div style={{ color: "#666" }}>No hay actividades.</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", width: "100%" }}>
                        <thead>
                          <tr>
                            <th>Actividad</th>
                            <th>Responsable</th>
                            <th>Estado</th>
                            <th>Vence</th>
                            <th>%</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {activityRows
                            .filter((a) => {
                              const statusOk = activityStatusFilter === "ALL" ? true : a.status === activityStatusFilter;
                              if (!statusOk) return false;
                              const rf = activityResponsibleFilter.trim();
                              if (!rf) return true;
                              return (a.responsibleUid || "").trim() === rf;
                            })
                            .map((a) => (
                              <tr key={a.id} style={{ background: a.id === editingActivityId ? "#f6f6f6" : "transparent" }}>
                                <td>{a.activity}</td>
                                <td>{a.responsibleUid || ""}</td>
                                <td>{a.status}</td>
                                <td>{a.dueDate || ""}</td>
                                <td>{typeof a.progress === "number" ? a.progress : ""}</td>
                                <td>
                                  <button type="button" onClick={() => startEditActivity(a)}>
                                    Editar
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>
                    {editingActivityId ? "Editar actividad" : "Nueva actividad"}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                    <TextField
                      label="Actividad"
                      value={activityDraft.activity}
                      onChange={(v) => setActivityDraft((d) => ({ ...d, activity: v }))}
                      placeholder="Llamada / Visita / Cotización..."
                    />
                    <TextField
                      label="Compromiso"
                      value={activityDraft.commitment}
                      onChange={(v) => setActivityDraft((d) => ({ ...d, commitment: v }))}
                      placeholder="Enviar propuesta..."
                    />
                    <TextField
                      label="Responsable (uid)"
                      value={activityDraft.responsibleUid}
                      onChange={(v) => setActivityDraft((d) => ({ ...d, responsibleUid: v }))}
                      placeholder="uid"
                    />
                    <SelectField
                      label="Estado"
                      value={activityDraft.status}
                      onChange={(v) => setActivityDraft((d) => ({ ...d, status: v }))}
                      options={[
                        { value: "EN_PROCESO", label: "EN_PROCESO" },
                        { value: "FINALIZADO", label: "FINALIZADO" },
                      ]}
                    />
                    <TextField
                      label="Fecha límite"
                      type="date"
                      value={activityDraft.dueDate}
                      onChange={(v) => setActivityDraft((d) => ({ ...d, dueDate: v }))}
                    />
                    <TextField
                      label="% avance"
                      type="number"
                      value={activityDraft.progress}
                      onChange={(v) => setActivityDraft((d) => ({ ...d, progress: v }))}
                      placeholder="0"
                    />
                    <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                      <span style={{ fontSize: 12, color: "#333" }}>Notas</span>
                      <textarea
                        value={activityDraft.notes}
                        onChange={(e) => setActivityDraft((d) => ({ ...d, notes: e.target.value }))}
                        rows={4}
                        style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                      />
                    </label>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                    <button type="button" onClick={saveActivity} disabled={saving || !selectedId}>
                      {saving ? "Guardando..." : "Guardar actividad"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "commercial" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <SelectField
                  label="Estado comercial"
                  value={draft.commercial.commercialStatus}
                  onChange={(v) => setDraft((d) => ({ ...d, commercial: { ...d.commercial, commercialStatus: v } }))}
                  options={[
                    { value: "PROSPECTO", label: "Prospecto" },
                    { value: "EN_GESTION", label: "En gestión" },
                    { value: "ACTIVO", label: "Activo" },
                    { value: "INACTIVO", label: "Inactivo" },
                  ]}
                />
                <TextField
                  label="Gestor responsable (uid)"
                  value={draft.commercial.responsibleUid}
                  onChange={(v) => setDraft((d) => ({ ...d, commercial: { ...d.commercial, responsibleUid: v } }))}
                  placeholder="uid del usuario"
                />
                <TextField
                  label="Prioridad"
                  value={draft.commercial.priority}
                  onChange={(v) => setDraft((d) => ({ ...d, commercial: { ...d.commercial, priority: v } }))}
                  placeholder="Alta / Media / Baja"
                />
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#333" }}>Observaciones</span>
                  <textarea
                    value={draft.commercial.notes}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, commercial: { ...d.commercial, notes: e.target.value } }))
                    }
                    rows={5}
                    style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                  />
                </label>
              </div>
            ) : null}

            {activeTab === "seguros" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <PolicyBlock
                  title="Vida"
                  value={draft.seguros.vida}
                  onChange={(v) => setDraft((d) => ({ ...d, seguros: { ...d.seguros, vida: v } }))}
                />
                <PolicyBlock
                  title="Salud"
                  value={draft.seguros.salud}
                  onChange={(v) => setDraft((d) => ({ ...d, seguros: { ...d.seguros, salud: v } }))}
                />
                <PolicyBlock
                  title="Generales"
                  value={draft.seguros.generales}
                  onChange={(v) => setDraft((d) => ({ ...d, seguros: { ...d.seguros, generales: v } }))}
                />
                <PolicyBlock
                  title="ARL"
                  value={draft.seguros.arl}
                  onChange={(v) => setDraft((d) => ({ ...d, seguros: { ...d.seguros, arl: v } }))}
                />
              </div>
            ) : null}

            {activeTab === "intermediaciones" ? (
              <div style={{ display: "grid", gap: 12 }}>
                {!selectedId ? (
                  <div style={{ color: "#666" }}>Guarda el cliente primero para poder registrar intermediaciones.</div>
                ) : null}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <button type="button" onClick={startNewInter} disabled={!selectedId}>
                    Nueva intermediación
                  </button>

                  <select
                    value={interLineFilter}
                    onChange={(e) => setInterLineFilter(e.target.value)}
                    style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                    disabled={!selectedId}
                  >
                    <option value="ALL">Línea (todas)</option>
                    <option value="vida">Vida</option>
                    <option value="salud">Salud</option>
                    <option value="generales">Generales</option>
                    <option value="arl">ARL</option>
                  </select>

                  <select
                    value={interStatusFilter}
                    onChange={(e) => setInterStatusFilter(e.target.value)}
                    style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                    disabled={!selectedId}
                  >
                    <option value="ALL">Estado (todos)</option>
                    <option value="VIGENTE">VIGENTE</option>
                    <option value="VENCIDA">VENCIDA</option>
                    <option value="CANCELADA">CANCELADA</option>
                  </select>
                </div>

                <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                  {interLoading ? (
                    <div>Cargando intermediaciones...</div>
                  ) : interRows.length === 0 ? (
                    <div style={{ color: "#666" }}>No hay intermediaciones.</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", width: "100%" }}>
                        <thead>
                          <tr>
                            <th>Línea</th>
                            <th>Aseguradora</th>
                            <th>Póliza</th>
                            <th>Inicio</th>
                            <th>Fin</th>
                            <th>Estado</th>
                            <th>Renovación</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {interRows
                            .filter((x) => {
                              const lineOk = interLineFilter === "ALL" ? true : x.line === interLineFilter;
                              if (!lineOk) return false;
                              const statusOk = interStatusFilter === "ALL" ? true : x.status === interStatusFilter;
                              return statusOk;
                            })
                            .map((x) => (
                              <tr key={x.id} style={{ background: x.id === editingInterId ? "#f6f6f6" : "transparent" }}>
                                <td>{x.line}</td>
                                <td>{x.insurer || ""}</td>
                                <td>{x.policyNumber || ""}</td>
                                <td>{x.startDate || ""}</td>
                                <td>{x.endDate || ""}</td>
                                <td>{x.status || ""}</td>
                                <td>{x.renewalStatus || ""}</td>
                                <td>
                                  <button type="button" onClick={() => startEditInter(x)}>
                                    Editar
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>
                    {editingInterId ? "Editar intermediación" : "Nueva intermediación"}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                    <SelectField
                      label="Línea"
                      value={interDraft.line}
                      onChange={(v) => setInterDraft((d) => ({ ...d, line: v }))}
                      options={[
                        { value: "", label: "Selecciona..." },
                        { value: "vida", label: "Vida" },
                        { value: "salud", label: "Salud" },
                        { value: "generales", label: "Generales" },
                        { value: "arl", label: "ARL" },
                      ]}
                    />
                    <SelectField
                      label="Estado"
                      value={interDraft.status}
                      onChange={(v) => setInterDraft((d) => ({ ...d, status: v }))}
                      options={[
                        { value: "VIGENTE", label: "VIGENTE" },
                        { value: "VENCIDA", label: "VENCIDA" },
                        { value: "CANCELADA", label: "CANCELADA" },
                      ]}
                    />

                    <TextField
                      label="Aseguradora"
                      value={interDraft.insurer}
                      onChange={(v) => setInterDraft((d) => ({ ...d, insurer: v }))}
                      placeholder="Aseguradora"
                    />
                    <TextField
                      label="Póliza / Contrato"
                      value={interDraft.policyNumber}
                      onChange={(v) => setInterDraft((d) => ({ ...d, policyNumber: v }))}
                      placeholder="Número"
                    />

                    <TextField
                      label="Inicio"
                      type="date"
                      value={interDraft.startDate}
                      onChange={(v) => setInterDraft((d) => ({ ...d, startDate: v }))}
                    />
                    <TextField
                      label="Fin"
                      type="date"
                      value={interDraft.endDate}
                      onChange={(v) => setInterDraft((d) => ({ ...d, endDate: v }))}
                    />

                    <TextField
                      label="Prima"
                      value={interDraft.premium}
                      onChange={(v) => setInterDraft((d) => ({ ...d, premium: v }))}
                      placeholder="0"
                    />
                    <TextField
                      label="Comisión"
                      value={interDraft.commission}
                      onChange={(v) => setInterDraft((d) => ({ ...d, commission: v }))}
                      placeholder="0"
                    />

                    <SelectField
                      label="Renovación"
                      value={interDraft.renewalStatus}
                      onChange={(v) => setInterDraft((d) => ({ ...d, renewalStatus: v }))}
                      options={[
                        { value: "NORMAL", label: "NORMAL" },
                        { value: "EN_RENOVACION", label: "EN_RENOVACION" },
                      ]}
                    />
                    <TextField
                      label="Link Drive"
                      value={interDraft.driveUrl}
                      onChange={(v) => setInterDraft((d) => ({ ...d, driveUrl: v }))}
                      placeholder="https://drive.google.com/..."
                    />

                    <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                      <span style={{ fontSize: 12, color: "#333" }}>Notas</span>
                      <textarea
                        value={interDraft.notes}
                        onChange={(e) => setInterDraft((d) => ({ ...d, notes: e.target.value }))}
                        rows={4}
                        style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                      />
                    </label>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      <div>Requiere línea activa (tiene póliza) en Seguros.</div>
                      <div>Próximo vencimiento: {draft?.nextExpiryDate || ""}</div>
                    </div>
                    <button type="button" onClick={saveInter} disabled={saving || !selectedId}>
                      {saving ? "Guardando..." : "Guardar intermediación"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "evidencias" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <TextField
                  label="Link Drive (carpeta/archivo)"
                  value={draft.evidencias.driveUrl}
                  onChange={(v) => setDraft((d) => ({ ...d, evidencias: { ...d.evidencias, driveUrl: v } }))}
                  placeholder="https://drive.google.com/..."
                />
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#333" }}>Notas</span>
                  <textarea
                    value={draft.evidencias.notes}
                    onChange={(e) => setDraft((d) => ({ ...d, evidencias: { ...d.evidencias, notes: e.target.value } }))}
                    rows={5}
                    style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
                  />
                </label>
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <div style={{ fontSize: 12, color: "#666" }}>
                <div>companyId: {companyId}</div>
                <div>id: {selectedId || "(nuevo)"}</div>
              </div>
              <button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

*/
