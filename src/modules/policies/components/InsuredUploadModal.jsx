import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { db } from "../../../firebase";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";

const normalizeHeader = (h) =>
  (h || "")
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const COLUMN_MAP = {
  REG: ["REG", "REG.", "REGISTRO", "NO", "NUMERO", "NUM", "#"],
  NOMBRE: ["NOMBRE", "NOMBRES", "APELLIDO", "APELLIDOS", "NOMBRE COMPLETO"],
  CEDULA: ["CEDULA", "DOCUMENTO", "IDENTIFICACION", "ID", "C.C", "CC", "DNI"],
  SEXO: ["SEXO", "GENERO", "GÉNERO", "SEX"],
  FECHA_NACIMIENTO: ["FECHA DE NACIMIENTO", "FECHA NACIMIENTO", "NACIMIENTO", "BIRTH", "FN"],
  EDAD: ["EDAD", "AGE"],
  EXTRAPRIMA: ["EXTRAPRIMA", "EXTRA PRIMA", "RECARGO", "SURCHARGE"],
  VALOR_MENSUAL: [
    "VALOR MENSUAL POR ASEGURADO",
    "VALOR MENSUAL",
    "PRIMA MENSUAL",
    "MENSUAL",
    "VALOR",
    "COSTO MENSUAL",
  ],
  OBSERVACIONES: ["OBSERVACIONES", "OBSERVACION", "NOTAS", "NOTA", "COMENTARIOS"],
};

function detectColumn(headers) {
  const normalized = headers.map(normalizeHeader);
  const result = {};
  for (const [key, candidates] of Object.entries(COLUMN_MAP)) {
    for (const candidate of candidates) {
      const idx = normalized.findIndex((h) => h === candidate || h.includes(candidate));
      if (idx >= 0) {
        result[key] = idx;
        break;
      }
    }
  }
  return result;
}

function parseDateValue(v) {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().split("T")[0];
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m}-${d}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [d, m, y] = s.split("-");
    return `${y}-${m}-${d}`;
  }
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return s;
}

function parseMoney(v) {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const cleaned = String(v)
    .replace(/[$,\s]/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseExtraprima(v) {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const s = String(v).trim().toLowerCase();
  if (s === "si" || s === "sí" || s === "yes" || s === "true" || s === "1") return 1;
  if (s === "no" || s === "false" || s === "0") return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function countDetectedColumns(headers) {
  const detected = detectColumn(headers);
  return Object.keys(detected).length;
}

function findHeaderRow(json, maxScan = 15) {
  let bestRow = 0;
  let bestCount = 0;
  for (let i = 0; i < Math.min(maxScan, json.length); i++) {
    const row = json[i];
    if (!Array.isArray(row)) continue;
    const count = countDetectedColumns(row);
    if (count > bestCount) {
      bestCount = count;
      bestRow = i;
    }
  }
  return { rowIndex: bestRow, count: bestCount };
}

export default function InsuredUploadModal({ clientUid, clientName, onClose }) {
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState({});
  const [headerRowIndex, setHeaderRowIndex] = useState(1);
  const [rawJson, setRawJson] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const fileRef = useRef(null);

  const parseFromRow = (json, headerIdx) => {
    const headers = json[headerIdx];
    const detected = detectColumn(headers);

    if (detected.NOMBRE === undefined) {
      setError(
        "No se pudo detectar la columna de NOMBRE en la fila " +
          (headerIdx + 1) +
          ". Encabezados encontrados: " +
          headers.join(", ")
      );
      setRows([]);
      return;
    }

    setColumns(detected);
    const parsedRows = [];
    for (let i = headerIdx + 1; i < json.length; i++) {
      const r = json[i];
      if (!Array.isArray(r) || !r.some((c) => c !== "")) continue; // fila vacía
      parsedRows.push({
        reg: r[detected.REG ?? 0] ?? i,
        nombre: r[detected.NOMBRE] ?? "",
        cedula: r[detected.CEDULA] ? String(r[detected.CEDULA]) : "",
        sexo: r[detected.SEXO] ? String(r[detected.SEXO]) : "",
        fechaNacimiento: parseDateValue(r[detected.FECHA_NACIMIENTO]),
        edad: r[detected.EDAD] ? parseInt(r[detected.EDAD], 10) || "" : "",
        extraprima: parseExtraprima(r[detected.EXTRAPRIMA]),
        valorMensual: parseMoney(r[detected.VALOR_MENSUAL]),
        observaciones: r[detected.OBSERVACIONES] ? String(r[detected.OBSERVACIONES]) : "",
      });
    }

    setRows(parsedRows);
    setInfo(
      `${parsedRows.length} asegurados detectados (fila de encabezados: ${headerIdx + 1}). Revisa la tabla y presiona Guardar.`
    );
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setInfo("");
    setRows([]);
    setRawJson([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        if (json.length < 2) {
          setError("El archivo no tiene suficientes filas (mínimo encabezado + 1 dato).");
          return;
        }

        setRawJson(json);
        const best = findHeaderRow(json);
        const autoRow = best.rowIndex;
        setHeaderRowIndex(autoRow + 1); // 1-indexed for UI
        parseFromRow(json, autoRow);
      } catch (err) {
        console.error(err);
        setError("Error leyendo el archivo: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleRowChange = (val) => {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 1 || n > rawJson.length) return;
    setHeaderRowIndex(n);
    if (rawJson.length > 0) {
      parseFromRow(rawJson, n - 1);
    }
  };

  const handleSave = async () => {
    if (!clientUid) {
      setError("clientUid es obligatorio");
      return;
    }
    if (rows.length === 0) {
      setError("No hay datos para guardar");
      return;
    }
    setUploading(true);
    setError("");
    try {
      // Crear la póliza
      const policyRef = doc(collection(db, "clientPolicies"));
      await setDoc(policyRef, {
        clientUid,
        clientName: clientName || "",
        policyType: "VIDA_GRUPO",
        createdAt: serverTimestamp(),
      });

      // Guardar asegurados
      const insuredCol = collection(db, "clientPolicies", policyRef.id, "insuredPeople");
      for (const row of rows) {
        const personRef = doc(insuredCol);
        await setDoc(personRef, {
          ...row,
          policyId: policyRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setInfo(`Guardado exitoso. Póliza ID: ${policyRef.id} con ${rows.length} asegurados.`);
      setRows([]);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      console.error(err);
      setError(err?.message || "Error guardando en Firestore");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 20,
          width: "min(900px, 95vw)",
          maxHeight: "90vh",
          overflow: "auto",
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Cargar asegurados (Vida Grupo)</h3>
          <button onClick={onClose} style={{ fontSize: 18 }}>×</button>
        </div>

        <p style={{ margin: 0, color: "#666", fontSize: 12 }}>
          Cliente: <strong>{clientName || clientUid}</strong>
        </p>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#333" }}>
            Archivo Excel (.xlsx, .xls) o CSV
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            style={{ padding: 10 }}
          />
        </label>

        {rawJson.length > 0 && (
          <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#333" }}>
              Fila de encabezados:
            </span>
            <input
              type="number"
              min={1}
              max={rawJson.length}
              value={headerRowIndex}
              onChange={(e) => handleRowChange(e.target.value)}
              style={{ width: 60, padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13 }}
            />
            <span style={{ fontSize: 11, color: "#888" }}>
              (Si los encabezados no se detectan bien, cambia este número)
            </span>
          </label>
        )}

        {error ? (
          <div style={{ color: "#b00020", fontSize: 13 }}>{error}</div>
        ) : null}
        {info ? (
          <div style={{ color: "#1b5e20", fontSize: 13 }}>{info}</div>
        ) : null}

        {rows.length > 0 && (
          <>
            <div style={{ overflowX: "auto", maxHeight: 320 }}>
              <table
                border="1"
                cellPadding="6"
                style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}
              >
                <thead>
                  <tr>
                    <th>REG</th>
                    <th>Nombre</th>
                    <th>Cédula</th>
                    <th>Sexo</th>
                    <th>Fecha Nac.</th>
                    <th>Edad</th>
                    <th>Extraprima</th>
                    <th>Valor Mensual</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.reg}</td>
                      <td>{r.nombre}</td>
                      <td>{r.cedula}</td>
                      <td>{r.sexo}</td>
                      <td>{r.fechaNacimiento}</td>
                      <td>{r.edad}</td>
                      <td>{r.extraprima}</td>
                      <td>{r.valorMensual}</td>
                      <td>{r.observaciones}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={handleSave} disabled={uploading}>
                {uploading ? "Guardando..." : "Guardar en Firestore"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
