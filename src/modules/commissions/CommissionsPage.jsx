import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { 
  validateColumns, 
  processExcelRows, 
  formatCurrency,
  REQUIRED_COLUMNS 
} from "./commissionsUtils";
import {
  getExistingRecordIds,
  saveCommissionRecords,
  getAllCommissionRecords,
  calculateMetrics,
  getUploadedFiles,
  deleteRecordsByFile
} from "./commissionsService";
import CommissionsSummary from "./CommissionsSummary";
import CommissionsReports from "./CommissionsReports";

export default function CommissionsPage({ companyId, userId }) {
  const [activeTab, setActiveTab] = useState("cargar");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  
  // Estado de carga de archivos
  const [files, setFiles] = useState([]);
  const [processedData, setProcessedData] = useState(null);
  const [uploadStats, setUploadStats] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Filtros
  const [filters, setFilters] = useState({
    mes: "",
    anio: "",
    intermediario: "",
    ramo: "",
    busqueda: ""
  });
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (activeTab === "datos" || activeTab === "resumen" || activeTab === "informes") {
      loadData();
    }
    if (activeTab === "archivos") {
      loadUploadedFiles();
    }
  }, [activeTab, companyId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAllCommissionRecords(companyId);
      setRecords(data);
      setMetrics(calculateMetrics(data));
    } catch (error) {
      console.error("Error cargando datos:", error);
    }
    setLoading(false);
  };

  const loadUploadedFiles = async () => {
    setLoading(true);
    try {
      const files = await getUploadedFiles(companyId);
      setUploadedFiles(files);
    } catch (error) {
      console.error("Error cargando archivos:", error);
    }
    setLoading(false);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setProcessedData(null);
    setUploadStats(null);
  };

  const handleProcessFiles = async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    const allResults = {
      valid: [],
      duplicates: [],
      errors: [],
      fileStats: []
    };

    for (const file of files) {
      try {
        const data = await readExcelFile(file);
        
        if (data.length < 2) {
          allResults.fileStats.push({
            name: file.name,
            status: "error",
            message: "Archivo vacío o sin datos"
          });
          continue;
        }

        // Buscar la fila de headers (puede no ser la primera si hay títulos)
        let headerRowIndex = 0;
        let headers = null;
        let validation = null;
        
        for (let i = 0; i < Math.min(data.length, 10); i++) {
          const row = data[i];
          if (!row || row.length < 5) continue;
          
          const testValidation = validateColumns(row);
          if (testValidation.isValid || testValidation.found.length >= 5) {
            headerRowIndex = i;
            headers = row;
            validation = testValidation;
            break;
          }
        }
        
        if (!headers) {
          // Usar la primera fila como fallback
          headers = data[0];
          validation = validateColumns(headers);
        }
        
        const rows = data.slice(headerRowIndex + 1);
        
        // Validar columnas
        if (!validation.isValid) {
          allResults.fileStats.push({
            name: file.name,
            status: "error",
            message: `Columnas faltantes: ${validation.missing.join(", ")}. Headers encontrados: ${headers.slice(0, 5).join(", ")}...`
          });
          continue;
        }

        // Procesar filas
        const processed = processExcelRows(rows, headers, file.name, userId);
        
        allResults.valid.push(...processed.valid);
        allResults.duplicates.push(...processed.duplicates);
        allResults.errors.push(...processed.errors);
        allResults.fileStats.push({
          name: file.name,
          status: "success",
          valid: processed.valid.length,
          duplicates: processed.duplicates.length,
          errors: processed.errors.length
        });

      } catch (error) {
        console.error("Error procesando archivo:", file.name, error);
        allResults.fileStats.push({
          name: file.name,
          status: "error",
          message: error.message
        });
      }
    }

    setProcessedData(allResults);
    setIsProcessing(false);
  };

  const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const bstr = e.target.result;
          const wb = XLSX.read(bstr, { type: "binary" });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });
  };

  const handleConfirmUpload = async () => {
    if (!processedData || processedData.valid.length === 0) return;
    
    setIsProcessing(true);
    try {
      // Obtener IDs existentes para deduplicación
      const existingIds = await getExistingRecordIds(companyId);
      
      // Guardar registros
      const stats = await saveCommissionRecords(companyId, processedData.valid, existingIds);
      
      setUploadStats({
        ...stats,
        totalProcesados: processedData.valid.length,
        duplicadosInternos: processedData.duplicates.length,
        erroresProcesamiento: processedData.errors.length
      });
      
      // Limpiar estado
      setFiles([]);
      setProcessedData(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
    } catch (error) {
      console.error("Error guardando:", error);
      alert("Error al guardar los datos: " + error.message);
    }
    setIsProcessing(false);
  };

  const handleDeleteFile = async (fileName) => {
    if (!confirm(`¿Eliminar todos los registros del archivo "${fileName}"?`)) return;
    
    setLoading(true);
    try {
      const count = await deleteRecordsByFile(companyId, fileName);
      alert(`Se eliminaron ${count} registros`);
      loadUploadedFiles();
    } catch (error) {
      console.error("Error eliminando:", error);
      alert("Error al eliminar: " + error.message);
    }
    setLoading(false);
  };

  const handleExportExcel = () => {
    if (records.length === 0) {
      alert("No hay datos para exportar");
      return;
    }

    const wb = XLSX.utils.book_new();
    
    // Hoja de datos completos
    const wsData = XLSX.utils.json_to_sheet(records.map(r => ({
      Clave: r.clave,
      Intermediario: r.intermediario,
      Departamento: r.departamento,
      Municipio: r.municipio,
      NIT: r.nit,
      Ramo: r.ramo,
      "Sucursal Póliza": r.sucursalPoliza,
      Póliza: r.poliza,
      Endoso: r.endoso,
      Asegurado: r.asegurado,
      Producto: r.producto,
      Recaudo: r.recaudo,
      "% Comisión": r.porcentajeComision,
      Comisión: r.comision,
      "Rte Fte": r.rteFte,
      "Rte ICA": r.rteICA,
      CREE: r.cree,
      Neto: r.neto,
      Mes: r.mes,
      Año: r.anio,
      Estado: r.estado,
      "Fecha Vigencia": r.fechaVigencia,
      "Fecha Recaudo": r.fechaRecaudo,
      "Fecha RUI": r.fechaRUI,
      "Autorización RUI": r.autorizacionPagoRUI,
      SARLAFT: r.sarlaft,
      "Contrato ARL": r.contratoARL,
      Quincena: r.quincena,
      "Archivo Origen": r.archivoOrigen,
      "Fecha Carga": r.fechaCarga
    })));
    XLSX.utils.book_append_sheet(wb, wsData, "Datos Completos");

    // Hoja de resumen general
    if (metrics) {
      const wsResumen = XLSX.utils.json_to_sheet([{
        "Total Registros": metrics.totalRegistros,
        "Total Recaudo": metrics.totalRecaudo,
        "Total Comisión": metrics.totalComision,
        "Total Neto": metrics.totalNeto,
        "Total Rte Fte": metrics.totalRteFte,
        "Total Rte ICA": metrics.totalRteICA,
        "Total CREE": metrics.totalCREE,
        "Pólizas Únicas": metrics.polizasUnicas,
        "Asegurados Únicos": metrics.aseguradosUnicos,
        "Intermediarios": metrics.intermediariosUnicos,
        "Ramos": metrics.ramosUnicos
      }]);
      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen General");

      // Hoja por intermediario
      const dataInter = Object.entries(metrics.porIntermediario).map(([name, data]) => ({
        Intermediario: name,
        Registros: data.count,
        Recaudo: data.recaudo,
        Comisión: data.comision,
        Neto: data.neto
      }));
      const wsInter = XLSX.utils.json_to_sheet(dataInter);
      XLSX.utils.book_append_sheet(wb, wsInter, "Por Intermediario");

      // Hoja por ramo
      const dataRamo = Object.entries(metrics.porRamo).map(([name, data]) => ({
        Ramo: name,
        Registros: data.count,
        Recaudo: data.recaudo,
        Comisión: data.comision,
        Neto: data.neto
      }));
      const wsRamo = XLSX.utils.json_to_sheet(dataRamo);
      XLSX.utils.book_append_sheet(wb, wsRamo, "Por Ramo");
    }

    // Hoja de pendientes SARLAFT
    const pendientesSarlaft = records.filter(r => r.pendientes?.includes("SARLAFT"));
    if (pendientesSarlaft.length > 0) {
      const wsSarlaft = XLSX.utils.json_to_sheet(pendientesSarlaft.map(r => ({
        Póliza: r.poliza,
        Asegurado: r.asegurado,
        NIT: r.nit,
        Intermediario: r.intermediario,
        Recaudo: r.recaudo,
        SARLAFT: r.sarlaft
      })));
      XLSX.utils.book_append_sheet(wb, wsSarlaft, "Pendientes SARLAFT");
    }

    // Hoja de pendientes RUI
    const pendientesRUI = records.filter(r => 
      r.pendientes?.includes("Autorización RUI") || r.pendientes?.includes("Fecha RUI")
    );
    if (pendientesRUI.length > 0) {
      const wsRUI = XLSX.utils.json_to_sheet(pendientesRUI.map(r => ({
        Póliza: r.poliza,
        Asegurado: r.asegurado,
        NIT: r.nit,
        "Fecha RUI": r.fechaRUI,
        "Autorización RUI": r.autorizacionPagoRUI
      })));
      XLSX.utils.book_append_sheet(wb, wsRUI, "Pendientes RUI");
    }

    // Descargar
    const fecha = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Comisiones_ABP_${fecha}.xlsx`);
  };

  const getFilteredRecords = () => {
    return records.filter(r => {
      if (filters.mes && r.mes !== filters.mes) return false;
      if (filters.anio && r.anio !== filters.anio) return false;
      if (filters.intermediario && !r.intermediario?.toLowerCase().includes(filters.intermediario.toLowerCase())) return false;
      if (filters.ramo && r.ramo !== filters.ramo) return false;
      if (filters.busqueda) {
        const search = filters.busqueda.toLowerCase();
        const searchable = `${r.poliza} ${r.asegurado} ${r.nit} ${r.intermediario}`.toLowerCase();
        if (!searchable.includes(search)) return false;
      }
      return true;
    });
  };

  const getUniqueValues = (field) => {
    const values = new Set(records.map(r => r[field]).filter(Boolean));
    return Array.from(values).sort();
  };

  const filteredRecords = getFilteredRecords();

  return (
    <div className="commissions-page">
      {/* Tabs */}
      <div className="commissions-tabs">
        <button
          className={`tab ${activeTab === "cargar" ? "active" : ""}`}
          onClick={() => setActiveTab("cargar")}
        >
          Cargar Archivos
        </button>
        <button
          className={`tab ${activeTab === "resumen" ? "active" : ""}`}
          onClick={() => setActiveTab("resumen")}
        >
          Resumen
        </button>
        <button
          className={`tab ${activeTab === "datos" ? "active" : ""}`}
          onClick={() => setActiveTab("datos")}
        >
          Datos ({records.length})
        </button>
        <button
          className={`tab ${activeTab === "archivos" ? "active" : ""}`}
          onClick={() => setActiveTab("archivos")}
        >
          Archivos Cargados
        </button>
        <button
          className={`tab ${activeTab === "informes" ? "active" : ""}`}
          onClick={() => setActiveTab("informes")}
        >
          Informes
        </button>
        {records.length > 0 && (
          <button className="btn-export" onClick={handleExportExcel}>
            Exportar Excel
          </button>
        )}
      </div>

      {/* Tab: Cargar */}
      {activeTab === "cargar" && (
        <div className="tab-content">
          <section className="upload-section">
            <h2>Seleccionar archivos Excel</h2>
            <p className="upload-hint">
              Columnas requeridas: {REQUIRED_COLUMNS.join(", ")}
            </p>
            
            <div className="upload-box">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                multiple
                onChange={handleFileSelect}
                id="excel-upload"
                className="file-input"
              />
              <label htmlFor="excel-upload" className="upload-label">
                <span className="upload-icon"></span>
                <span>Seleccionar archivos Excel</span>
                <span className="upload-hint-small">Puedes seleccionar múltiples archivos</span>
              </label>
            </div>

            {files.length > 0 && (
              <div className="selected-files">
                <h3>Archivos seleccionados ({files.length})</h3>
                <ul>
                  {files.map((f, i) => (
                    <li key={i}>{f.name} ({(f.size / 1024).toFixed(1)} KB)</li>
                  ))}
                </ul>
                <button 
                  className="btn-primary" 
                  onClick={handleProcessFiles}
                  disabled={isProcessing}
                >
                  {isProcessing ? "Procesando..." : "Procesar archivos"}
                </button>
              </div>
            )}
          </section>

          {/* Resultados del procesamiento */}
          {processedData && (
            <section className="process-results">
              <h2>Resultados del procesamiento</h2>
              
              <div className="process-stats">
                <div className="stat-box success">
                  <span className="stat-number">{processedData.valid.length}</span>
                  <span className="stat-label">Registros válidos</span>
                </div>
                <div className="stat-box warning">
                  <span className="stat-number">{processedData.duplicates.length}</span>
                  <span className="stat-label">Duplicados internos</span>
                </div>
                <div className="stat-box error">
                  <span className="stat-number">{processedData.errors.length}</span>
                  <span className="stat-label">Con errores</span>
                </div>
              </div>

              <div className="file-results">
                <h3>Detalle por archivo</h3>
                {processedData.fileStats.map((f, i) => (
                  <div key={i} className={`file-result ${f.status}`}>
                    <span className="file-name">{f.name}</span>
                    {f.status === "success" ? (
                      <span className="file-stats">
                        {f.valid} válidos | {f.duplicates} duplicados | {f.errors} errores
                      </span>
                    ) : (
                      <span className="file-error">{f.message}</span>
                    )}
                  </div>
                ))}
              </div>

              {processedData.valid.length > 0 && (
                <div className="preview-section">
                  <h3>Vista previa (primeros 10 registros)</h3>
                  <div className="preview-table-wrapper">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>Póliza</th>
                          <th>Asegurado</th>
                          <th>NIT</th>
                          <th>Intermediario</th>
                          <th>Ramo</th>
                          <th>Recaudo</th>
                          <th>Comisión</th>
                          <th>Neto</th>
                          <th>Mes/Año</th>
                        </tr>
                      </thead>
                      <tbody>
                        {processedData.valid.slice(0, 10).map((r, i) => (
                          <tr key={i}>
                            <td>{r.poliza}</td>
                            <td>{r.asegurado}</td>
                            <td>{r.nit}</td>
                            <td>{r.intermediario}</td>
                            <td>{r.ramo}</td>
                            <td>{formatCurrency(r.recaudo)}</td>
                            <td>{formatCurrency(r.comision)}</td>
                            <td>{formatCurrency(r.neto)}</td>
                            <td>{r.mes}/{r.anio}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {processedData.valid.length > 10 && (
                    <p className="preview-more">...y {processedData.valid.length - 10} registros más</p>
                  )}

                  <div className="confirm-actions">
                    <button 
                      className="btn-primary btn-large"
                      onClick={handleConfirmUpload}
                      disabled={isProcessing}
                    >
                      {isProcessing ? "Guardando..." : `Confirmar y guardar ${processedData.valid.length} registros`}
                    </button>
                    <button 
                      className="btn-secondary"
                      onClick={() => {
                        setProcessedData(null);
                        setFiles([]);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Estadísticas de carga completada */}
          {uploadStats && (
            <section className="upload-complete">
              <h2>✅ Carga completada</h2>
              <div className="upload-stats">
                <div className="stat-box success">
                  <span className="stat-number">{uploadStats.inserted}</span>
                  <span className="stat-label">Insertados</span>
                </div>
                <div className="stat-box warning">
                  <span className="stat-number">{uploadStats.duplicates}</span>
                  <span className="stat-label">Duplicados (omitidos)</span>
                </div>
                <div className="stat-box info">
                  <span className="stat-number">{uploadStats.duplicadosInternos}</span>
                  <span className="stat-label">Duplicados internos</span>
                </div>
                {uploadStats.errors > 0 && (
                  <div className="stat-box error">
                    <span className="stat-number">{uploadStats.errors}</span>
                    <span className="stat-label">Errores</span>
                  </div>
                )}
              </div>
              <button 
                className="btn-secondary"
                onClick={() => {
                  setUploadStats(null);
                  setActiveTab("resumen");
                }}
              >
                Ver resumen de datos
              </button>
            </section>
          )}
        </div>
      )}

      {/* Tab: Resumen */}
      {activeTab === "resumen" && (
        <div className="tab-content">
          {loading ? (
            <div className="loading">Cargando datos...</div>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <p>No hay datos cargados. Sube archivos Excel para comenzar.</p>
              <button className="btn-primary" onClick={() => setActiveTab("cargar")}>
                Cargar archivos
              </button>
            </div>
          ) : (
            <CommissionsSummary 
              metrics={metrics} 
              onFilterChange={(f) => {
                setFilters({ ...filters, ...f });
                setActiveTab("datos");
              }}
            />
          )}
        </div>
      )}

      {/* Tab: Datos */}
      {activeTab === "datos" && (
        <div className="tab-content">
          {loading ? (
            <div className="loading">Cargando datos...</div>
          ) : (
            <>
              {/* Filtros */}
              <div className="filters-bar">
                <div className="filter-group">
                  <label>Buscar:</label>
                  <input
                    type="text"
                    placeholder="Póliza, asegurado, NIT..."
                    value={filters.busqueda}
                    onChange={(e) => setFilters({ ...filters, busqueda: e.target.value })}
                  />
                </div>
                <div className="filter-group">
                  <label>Mes:</label>
                  <select
                    value={filters.mes}
                    onChange={(e) => setFilters({ ...filters, mes: e.target.value })}
                  >
                    <option value="">Todos</option>
                    {getUniqueValues("mes").map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Año:</label>
                  <select
                    value={filters.anio}
                    onChange={(e) => setFilters({ ...filters, anio: e.target.value })}
                  >
                    <option value="">Todos</option>
                    {getUniqueValues("anio").map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Ramo:</label>
                  <select
                    value={filters.ramo}
                    onChange={(e) => setFilters({ ...filters, ramo: e.target.value })}
                  >
                    <option value="">Todos</option>
                    {getUniqueValues("ramo").map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <button 
                  className="btn-clear"
                  onClick={() => setFilters({ mes: "", anio: "", intermediario: "", ramo: "", busqueda: "" })}
                >
                  Limpiar filtros
                </button>
              </div>

              <div className="data-header">
                <h2>Registros ({filteredRecords.length.toLocaleString()})</h2>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="empty-state">
                  <p>No hay registros que coincidan con los filtros.</p>
                </div>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Póliza</th>
                        <th>Asegurado</th>
                        <th>NIT</th>
                        <th>Intermediario</th>
                        <th>Ramo</th>
                        <th>Recaudo</th>
                        <th>Comisión</th>
                        <th>Neto</th>
                        <th>Mes/Año</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.slice(0, 100).map((r) => (
                        <tr key={r.id} className={r.estadoValidacion === "CON_ERRORES" ? "row-error" : ""}>
                          <td>{r.poliza}</td>
                          <td title={r.asegurado}>{r.asegurado?.substring(0, 25)}</td>
                          <td>{r.nit}</td>
                          <td title={r.intermediario}>{r.intermediario?.substring(0, 20)}</td>
                          <td>{r.ramo}</td>
                          <td className="num">{formatCurrency(r.recaudo)}</td>
                          <td className="num">{formatCurrency(r.comision)}</td>
                          <td className="num">{formatCurrency(r.neto)}</td>
                          <td>{r.mes}/{r.anio}</td>
                          <td>
                            {r.pendientes?.length > 0 && (
                              <span className="badge warning" title={r.pendientes.join(", ")}>
                                ⚠️ {r.pendientes.length}
                              </span>
                            )}
                            {r.estadoValidacion === "CON_ERRORES" && (
                              <span className="badge error">❌</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredRecords.length > 100 && (
                    <p className="table-more">
                      Mostrando 100 de {filteredRecords.length.toLocaleString()} registros. 
                      Usa los filtros o exporta a Excel para ver todos.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: Archivos */}
      {activeTab === "archivos" && (
        <div className="tab-content">
          {loading ? (
            <div className="loading">Cargando archivos...</div>
          ) : uploadedFiles.length === 0 ? (
            <div className="empty-state">
              <p>No hay archivos cargados.</p>
            </div>
          ) : (
            <div className="files-list">
              <h2>Archivos cargados ({uploadedFiles.length})</h2>
              <table className="files-table">
                <thead>
                  <tr>
                    <th>Archivo</th>
                    <th>Fecha de carga</th>
                    <th>Registros</th>
                    <th>Recaudo</th>
                    <th>Comisión</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadedFiles.map((f, i) => (
                    <tr key={i}>
                      <td>{f.nombre}</td>
                      <td>{new Date(f.fechaCarga).toLocaleDateString("es-CO")}</td>
                      <td>{f.registros.toLocaleString()}</td>
                      <td>{formatCurrency(f.recaudo)}</td>
                      <td>{formatCurrency(f.comision)}</td>
                      <td>
                        <button 
                          className="btn-delete"
                          onClick={() => handleDeleteFile(f.nombre)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Informes */}
      {activeTab === "informes" && (
        <div className="tab-content">
          {loading ? (
            <div className="loading">Cargando datos...</div>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <p>No hay datos cargados. Sube archivos Excel para generar informes.</p>
              <button className="btn-primary" onClick={() => setActiveTab("cargar")}>
                Cargar archivos
              </button>
            </div>
          ) : (
            <CommissionsReports records={records} />
          )}
        </div>
      )}
    </div>
  );
}
