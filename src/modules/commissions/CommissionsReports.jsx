import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import { formatCurrency, mesNumeroANombre, normalizeClientName } from "./commissionsUtils";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

const MESES_ORDEN = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export default function CommissionsReports({ records }) {
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [selectedAnio, setSelectedAnio] = useState(null);
  const [selectedMes, setSelectedMes] = useState(null);
  const [selectedRamo, setSelectedRamo] = useState(null);
  const [tipoFecha, setTipoFecha] = useState("recaudo"); // recaudo o vigencia

  // Normalizar mes a nombre y nombres de clientes
  const normalizedRecords = useMemo(() => {
    return records.map(r => ({
      ...r,
      mesNombre: mesNumeroANombre(r.mes),
      cliente: normalizeClientName(r.asegurado || r.intermediario) || "Sin cliente"
    }));
  }, [records]);

  // Obtener valores únicos para filtros
  const clientes = useMemo(() => {
    const set = new Set(normalizedRecords.map(r => r.cliente).filter(Boolean));
    return Array.from(set).sort();
  }, [normalizedRecords]);

  const anios = useMemo(() => {
    const set = new Set(normalizedRecords.map(r => r.anio).filter(Boolean));
    return Array.from(set).sort().reverse();
  }, [normalizedRecords]);

  const meses = useMemo(() => {
    const set = new Set(normalizedRecords.map(r => r.mesNombre).filter(Boolean));
    return MESES_ORDEN.filter(m => set.has(m));
  }, [normalizedRecords]);

  const ramos = useMemo(() => {
    const set = new Set(normalizedRecords.map(r => r.ramo).filter(Boolean));
    return Array.from(set).sort();
  }, [normalizedRecords]);

  // Filtrar registros
  const filteredRecords = useMemo(() => {
    return normalizedRecords.filter(r => {
      if (selectedCliente && r.cliente !== selectedCliente) return false;
      if (selectedAnio && r.anio !== selectedAnio) return false;
      if (selectedMes && r.mesNombre !== selectedMes) return false;
      if (selectedRamo && r.ramo !== selectedRamo) return false;
      return true;
    });
  }, [normalizedRecords, selectedCliente, selectedAnio, selectedMes, selectedRamo]);

  // Calcular totales
  const totales = useMemo(() => {
    return filteredRecords.reduce((acc, r) => ({
      comision: acc.comision + (r.comision || 0),
      recaudo: acc.recaudo + (r.recaudo || 0),
      neto: acc.neto + (r.neto || 0),
      count: acc.count + 1
    }), { comision: 0, recaudo: 0, neto: 0, count: 0 });
  }, [filteredRecords]);

  // Datos por cliente
  const dataByCliente = useMemo(() => {
    const map = {};
    filteredRecords.forEach(r => {
      const key = r.cliente;
      if (!map[key]) map[key] = { cliente: key, comision: 0, recaudo: 0, count: 0 };
      map[key].comision += r.comision || 0;
      map[key].recaudo += r.recaudo || 0;
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => b.comision - a.comision).slice(0, 15);
  }, [filteredRecords]);

  // Datos por mes (ordenados)
  const dataByMes = useMemo(() => {
    const map = {};
    filteredRecords.forEach(r => {
      const key = r.mesNombre;
      if (!key) return;
      if (!map[key]) map[key] = { mes: key, comision: 0, recaudo: 0, count: 0 };
      map[key].comision += r.comision || 0;
      map[key].recaudo += r.recaudo || 0;
      map[key].count += 1;
    });
    return MESES_ORDEN.filter(m => map[m]).map(m => map[m]);
  }, [filteredRecords]);

  // Datos por cliente y mes (para gráfica principal)
  const dataClienteMes = useMemo(() => {
    if (!selectedCliente) return [];
    const map = {};
    filteredRecords.forEach(r => {
      const key = r.mesNombre;
      if (!key) return;
      if (!map[key]) map[key] = { mes: key, comision: 0, recaudo: 0 };
      map[key].comision += r.comision || 0;
      map[key].recaudo += r.recaudo || 0;
    });
    return MESES_ORDEN.filter(m => map[m]).map(m => ({
      ...map[m],
      mesAnio: `${m}\n${selectedAnio || ""}`
    }));
  }, [filteredRecords, selectedCliente, selectedAnio]);

  // Tabla detalle por cliente
  const tablaCliente = useMemo(() => {
    if (!selectedCliente) return [];
    const map = {};
    filteredRecords.forEach(r => {
      const key = `${r.anio}-${r.mesNombre}`;
      if (!map[key]) map[key] = { cliente: r.cliente, anio: r.anio, mes: r.mesNombre, comision: 0 };
      map[key].comision += r.comision || 0;
    });
    return Object.values(map).sort((a, b) => {
      if (a.anio !== b.anio) return b.anio - a.anio;
      return MESES_ORDEN.indexOf(a.mes) - MESES_ORDEN.indexOf(b.mes);
    });
  }, [filteredRecords, selectedCliente]);

  // Porcentaje de comisión por cliente
  const porcentajeComision = useMemo(() => {
    if (!selectedCliente || filteredRecords.length === 0) return null;
    const totalRecaudo = filteredRecords.reduce((sum, r) => sum + (r.recaudo || 0), 0);
    const totalComision = filteredRecords.reduce((sum, r) => sum + (r.comision || 0), 0);
    if (totalRecaudo === 0) return 0;
    return ((totalComision / totalRecaudo) * 100).toFixed(1);
  }, [filteredRecords, selectedCliente]);

  const clearFilters = () => {
    setSelectedCliente(null);
    setSelectedAnio(null);
    setSelectedMes(null);
    setSelectedRamo(null);
  };

  return (
    <div className="commissions-reports">
      {/* Header con título */}
      <div className="reports-header">
        <h2>INFORME DE INGRESOS DE COMISIONES POR CLIENTE</h2>
        {selectedRamo && <span className="reports-subtitle">{selectedRamo}</span>}
      </div>

      {/* Filtros tipo Power BI */}
      <div className="reports-filters">
        <div className="filter-section">
          <h4>SELECCIONA EL AÑO PARA MÁS DETALLE</h4>
          <div className="filter-buttons">
            {anios.map(anio => (
              <button
                key={anio}
                className={`filter-btn ${selectedAnio === anio ? "active" : ""}`}
                onClick={() => setSelectedAnio(selectedAnio === anio ? null : anio)}
              >
                {anio}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <h4>CLIENTES</h4>
          <p className="filter-hint">En este apartado puedes seleccionar el cliente para mirar con más detalle</p>
          <div className="filter-list">
            {clientes.slice(0, 15).map(cliente => (
              <label key={cliente} className="filter-radio">
                <input
                  type="radio"
                  name="cliente"
                  checked={selectedCliente === cliente}
                  onChange={() => setSelectedCliente(selectedCliente === cliente ? null : cliente)}
                />
                <span title={cliente}>{cliente.length > 35 ? cliente.substring(0, 35) + "..." : cliente}</span>
              </label>
            ))}
            {clientes.length > 15 && (
              <p className="filter-more">...y {clientes.length - 15} más</p>
            )}
          </div>
        </div>

        <div className="filter-section">
          <h4>RAMO</h4>
          <div className="filter-buttons">
            {ramos.map(ramo => (
              <button
                key={ramo}
                className={`filter-btn small ${selectedRamo === ramo ? "active" : ""}`}
                onClick={() => setSelectedRamo(selectedRamo === ramo ? null : ramo)}
              >
                {ramo}
              </button>
            ))}
          </div>
        </div>

        {(selectedCliente || selectedAnio || selectedMes || selectedRamo) && (
          <button className="btn-clear-filters" onClick={clearFilters}>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla resumen */}
      {selectedCliente && (
        <div className="reports-table-section">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Año</th>
                <th>Mes</th>
                <th>Suma de Comisión</th>
              </tr>
            </thead>
            <tbody>
              {tablaCliente.map((row, i) => (
                <tr key={i}>
                  <td>{row.cliente}</td>
                  <td>{row.anio}</td>
                  <td>{row.mes}</td>
                  <td className="num">{formatCurrency(row.comision)}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={3}><strong>Total</strong></td>
                <td className="num"><strong>{formatCurrency(totales.comision)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Totales */}
      <div className="reports-totals">
        <div className="total-card">
          <span className="total-label">Total ingresos de Comisiones</span>
          <span className="total-value">{formatCurrency(totales.comision)}</span>
        </div>
        <div className="total-card">
          <span className="total-label">Total Recaudo</span>
          <span className="total-value">{formatCurrency(totales.recaudo)}</span>
        </div>
        <div className="total-card">
          <span className="total-label">Registros</span>
          <span className="total-value">{totales.count.toLocaleString()}</span>
        </div>
      </div>

      {/* Gráficas */}
      <div className="reports-charts">
        {/* Gráfica principal - Comisiones por mes */}
        <div className="chart-section main-chart">
          <h3>
            INGRESO DE COMISIONES POR {selectedCliente ? "CLIENTE, " : ""}MES Y AÑO
            {selectedAnio && <span className="chart-year"> • Año {selectedAnio}</span>}
          </h3>
          {selectedCliente && (
            <p className="chart-subtitle">{selectedCliente}</p>
          )}
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={selectedCliente ? dataClienteMes : dataByMes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="mes" 
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => v}
              />
              <YAxis 
                tickFormatter={(v) => `$${(v/1000000).toFixed(1)} mill.`}
                tick={{ fontSize: 11 }}
              />
              <Tooltip 
                formatter={(v) => formatCurrency(v)}
                labelFormatter={(label) => `${label} ${selectedAnio || ""}`}
              />
              <Bar 
                dataKey="comision" 
                fill="#3b82f6" 
                name="Suma de Comisión"
                radius={[4, 4, 0, 0]}
                label={{ 
                  position: 'top', 
                  formatter: (v) => `$${(v/1000000).toFixed(2)} mill.`,
                  fontSize: 10
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Porcentaje de comisión */}
        {selectedCliente && porcentajeComision && (
          <div className="chart-section small-chart">
            <h3>Recuento de Cliente por % Comisión</h3>
            <div className="percentage-display">
              <div className="percentage-circle">
                <span className="percentage-value">{totales.count.toLocaleString()}</span>
                <span className="percentage-label">(100%)</span>
              </div>
              <div className="percentage-legend">
                <span className="legend-dot"></span>
                <span>% Comisión: {porcentajeComision}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Gráfica por cliente (cuando no hay cliente seleccionado) */}
        {!selectedCliente && dataByCliente.length > 0 && (
          <div className="chart-section">
            <h3>Top 15 Clientes por Comisión</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={dataByCliente} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  type="number"
                  tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`}
                />
                <YAxis 
                  type="category" 
                  dataKey="cliente" 
                  width={200}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => v.length > 30 ? v.substring(0, 30) + "..." : v}
                />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="comision" fill="#3b82f6" name="Comisión" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Máx. de % Comisión por Cliente, Año y Mes */}
        {selectedCliente && dataClienteMes.length > 0 && (
          <div className="chart-section small-chart">
            <h3>Máx. de % Comisión por Cliente, Año y Mes</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dataClienteMes}>
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis hide />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="comision" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {dataClienteMes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="chart-footer">{selectedCliente}</p>
          </div>
        )}
      </div>

      {/* Selector de tipo de fecha */}
      <div className="reports-date-type">
        <span>Analizar por:</span>
        <label>
          <input
            type="radio"
            name="tipoFecha"
            checked={tipoFecha === "recaudo"}
            onChange={() => setTipoFecha("recaudo")}
          />
          Fecha de Recaudo
        </label>
        <label>
          <input
            type="radio"
            name="tipoFecha"
            checked={tipoFecha === "vigencia"}
            onChange={() => setTipoFecha("vigencia")}
          />
          Fecha de Vigencia
        </label>
      </div>
    </div>
  );
}
