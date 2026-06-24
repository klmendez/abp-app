import { formatCurrency, formatPercentage } from "./commissionsUtils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#ffc658", "#ff7c43", "#665191", "#a05195"];

export default function CommissionsSummary({ metrics, onFilterChange }) {
  if (!metrics) return null;

  // Preparar datos para gráficas
  const dataIntermediarios = Object.entries(metrics.porIntermediario)
    .map(([name, data]) => ({ name: name.substring(0, 20), ...data }))
    .sort((a, b) => b.comision - a.comision)
    .slice(0, 10);

  const dataRamos = Object.entries(metrics.porRamo)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.recaudo - a.recaudo)
    .slice(0, 8);

  const dataPeriodos = Object.entries(metrics.porMesAnio)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const dataDepartamentos = Object.entries(metrics.porDepartamento)
    .map(([name, data]) => ({ name: name.substring(0, 15), ...data }))
    .sort((a, b) => b.recaudo - a.recaudo)
    .slice(0, 8);

  return (
    <div className="commissions-summary">
      {/* Métricas principales */}
      <div className="summary-metrics">
        <div className="metric-item">
          <span className="metric-value">{formatCurrency(metrics.totalRecaudo)}</span>
          <span className="metric-label">Total Recaudo</span>
        </div>
        <div className="metric-item">
          <span className="metric-value">{formatCurrency(metrics.totalComision)}</span>
          <span className="metric-label">Total Comisión</span>
        </div>
        <div className="metric-item">
          <span className="metric-value">{formatCurrency(metrics.totalNeto)}</span>
          <span className="metric-label">Total Neto</span>
        </div>
        <div className="metric-item">
          <span className="metric-value">{formatCurrency(metrics.totalRteFte + metrics.totalRteICA + metrics.totalCREE)}</span>
          <span className="metric-label">Total Retenciones</span>
        </div>
      </div>

      {/* Estadísticas secundarias */}
      <div className="summary-stats">
        <div className="stat-item">
          <span className="stat-value">{metrics.totalRegistros.toLocaleString()}</span>
          <span className="stat-label">Registros</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{metrics.polizasUnicas.toLocaleString()}</span>
          <span className="stat-label">Pólizas</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{metrics.aseguradosUnicos.toLocaleString()}</span>
          <span className="stat-label">Asegurados</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{metrics.intermediariosUnicos}</span>
          <span className="stat-label">Intermediarios</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{metrics.ramosUnicos}</span>
          <span className="stat-label">Ramos</span>
        </div>
      </div>

      {/* Gráficas */}
      <div className="summary-charts">
        {/* Comisiones por Intermediario */}
        {dataIntermediarios.length > 0 && (
          <div className="chart-card">
            <h3>Top 10 Intermediarios por Comisión</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dataIntermediarios} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="comision" fill="#0088FE" name="Comisión" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recaudo por Ramo */}
        {dataRamos.length > 0 && (
          <div className="chart-card">
            <h3>Recaudo por Ramo</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dataRamos}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="recaudo"
                >
                  {dataRamos.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Evolución por Período */}
        {dataPeriodos.length > 1 && (
          <div className="chart-card wide">
            <h3>Evolución por Período</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dataPeriodos}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
                <Line type="monotone" dataKey="recaudo" stroke="#0088FE" name="Recaudo" strokeWidth={2} />
                <Line type="monotone" dataKey="comision" stroke="#00C49F" name="Comisión" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Por Departamento */}
        {dataDepartamentos.length > 0 && (
          <div className="chart-card">
            <h3>Recaudo por Departamento</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dataDepartamentos}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="recaudo" fill="#FFBB28" name="Recaudo" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Detalles de retenciones */}
      <div className="summary-retentions">
        <h3>Detalle de Retenciones</h3>
        <div className="retention-items">
          <div className="retention-item">
            <span className="retention-label">Rte Fte</span>
            <span className="retention-value">{formatCurrency(metrics.totalRteFte)}</span>
          </div>
          <div className="retention-item">
            <span className="retention-label">Rte ICA</span>
            <span className="retention-value">{formatCurrency(metrics.totalRteICA)}</span>
          </div>
          <div className="retention-item">
            <span className="retention-label">CREE</span>
            <span className="retention-value">{formatCurrency(metrics.totalCREE)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
