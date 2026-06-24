// Columnas requeridas del Excel de comisiones (nombres normalizados)
// Mínimo necesario para procesar el archivo
export const REQUIRED_COLUMNS = [
  "poliza",
  "recaudo",
  "comision",
  "mes"
];

// Columnas opcionales pero útiles
export const OPTIONAL_COLUMNS = [
  "clave",
  "intermediario", 
  "nit",
  "ano",
  "ramo",
  "asegurado"
];

// Todas las columnas esperadas
export const ALL_COLUMNS = [
  "Clave",
  "Intermediario",
  "Departamento",
  "Municipio",
  "NIT",
  "Ramo",
  "Sucursal Póliza",
  "Póliza",
  "Endoso",
  "Asegurado",
  "Producto",
  "Recaudo",
  "% Comisión",
  "Comisión",
  "Rte Fte",
  "Rte ICA",
  "CREE",
  "Neto",
  "Mes",
  "Año",
  "Estado",
  "Fecha de Vigencia",
  "Fecha de Recaudo",
  "Fecha RUI",
  "Autorización de Pago RUI",
  "SARLAFT",
  "Contrato ARL",
  "Quincena"
];

/**
 * Valida que el archivo tenga las columnas mínimas requeridas
 */
export function validateColumns(headers) {
  if (!headers || !Array.isArray(headers)) {
    return { isValid: false, missing: REQUIRED_COLUMNS, found: [], total: 0 };
  }
  
  const normalizedHeaders = headers.map(h => normalizeColumnName(h)).filter(Boolean);
  const missing = [];
  const found = [];

  // Debug: mostrar headers normalizados
  console.log("Headers normalizados:", normalizedHeaders.slice(0, 10));

  REQUIRED_COLUMNS.forEach(col => {
    // Buscar coincidencia
    const match = normalizedHeaders.some(h => {
      if (!h) return false;
      // Coincidencia exacta
      if (h === col) return true;
      // El header contiene la columna requerida (ej: "poliza" en "sucursalpoliza")
      if (h.includes(col) && col.length >= 3) return true;
      // Coincidencia para "ano" vs "año" (ya normalizado)
      if (col === "ano" && (h === "ano" || h === "anio" || h.includes("ano"))) return true;
      if (col === "comision" && h.includes("comision")) return true;
      return false;
    });
    
    if (match) {
      found.push(col);
    } else {
      missing.push(col);
    }
  });

  console.log("Columnas encontradas:", found);
  console.log("Columnas faltantes:", missing);

  return {
    isValid: missing.length === 0,
    missing,
    found,
    total: headers.length
  };
}

/**
 * Normaliza el nombre de una columna para comparación
 */
function normalizeColumnName(name) {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remover acentos
    .replace(/[^a-z0-9]/g, "") // Solo alfanuméricos
    .trim();
}

/**
 * Limpia y normaliza un valor de texto
 */
export function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

/**
 * Convierte un valor a número (para campos monetarios)
 */
export function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  
  // Remover caracteres no numéricos excepto punto, coma y signo negativo
  let cleaned = String(value)
    .replace(/[^\d.,-]/g, "")
    .replace(/,/g, "."); // Convertir comas a puntos
  
  // Si hay múltiples puntos, mantener solo el último como decimal
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    cleaned = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Convierte un porcentaje a número decimal
 */
export function parsePercentage(value) {
  if (value === null || value === undefined || value === "") return 0;
  
  let num = parseNumber(value);
  
  // Si el valor original contenía %, ya está en formato porcentaje
  if (String(value).includes("%")) {
    return num / 100;
  }
  
  // Si es mayor a 1, asumir que está en formato porcentaje (ej: 15 = 15%)
  if (num > 1) {
    return num / 100;
  }
  
  return num;
}

/**
 * Convierte una fecha de Excel o string a formato ISO
 */
export function parseDate(value) {
  if (!value) return null;
  
  // Si es un número (fecha de Excel)
  if (typeof value === "number") {
    // Excel usa días desde 1900-01-01 (con bug del año bisiesto 1900)
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return date.toISOString().split("T")[0];
  }
  
  // Si es string, intentar parsear
  const str = String(value).trim();
  
  // Formato DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const fullYear = year.length === 2 ? (parseInt(year) > 50 ? "19" + year : "20" + year) : year;
    return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  
  // Formato YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  
  // Intentar con Date.parse
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().split("T")[0];
  }
  
  return null;
}

/**
 * Busca un valor en el row probando múltiples nombres de columna
 */
function getField(row, ...keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  // Buscar por coincidencia parcial (sin tildes, case insensitive)
  const normalizedKeys = keys.map(k => normalizeColumnName(k));
  for (const [rowKey, value] of Object.entries(row)) {
    const normalizedRowKey = normalizeColumnName(rowKey);
    for (const nk of normalizedKeys) {
      if (normalizedRowKey === nk || normalizedRowKey.includes(nk) || nk.includes(normalizedRowKey)) {
        if (value !== undefined && value !== null && value !== "") {
          return value;
        }
      }
    }
  }
  return "";
}

/**
 * Genera un ID único para un registro basado en campos clave
 * Usado para deduplicación
 */
export function generateRecordId(row) {
  const parts = [
    cleanText(getField(row, "Póliza", "Poliza")),
    cleanText(getField(row, "Endoso")),
    cleanText(getField(row, "NIT", "Nit")),
    cleanText(getField(row, "FECHARECAUDO", "Fecha de Recaudo", "FechaRecaudo")),
    String(parseNumber(getField(row, "Recaudo"))),
    cleanText(getField(row, "Mes")),
    cleanText(getField(row, "Año", "Ano"))
  ];
  
  const combined = parts.join("|").toLowerCase();
  
  // Generar hash simple
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Normaliza un registro completo del Excel
 */
export function normalizeRecord(row, fileName, userId) {
  const normalized = {
    // Campos de texto
    clave: cleanText(getField(row, "Clave")),
    intermediario: cleanText(getField(row, "Intermediario")),
    departamento: cleanText(getField(row, "Departamento")),
    municipio: cleanText(getField(row, "Municipio")),
    nit: cleanText(getField(row, "NIT", "Nit")),
    ramo: cleanText(getField(row, "Ramo")),
    sucursalPoliza: cleanText(getField(row, "SucursalPoliza", "Sucursal Póliza", "Sucursal Poliza")),
    poliza: cleanText(getField(row, "Póliza", "Poliza")),
    endoso: cleanText(getField(row, "Endoso")),
    asegurado: cleanText(getField(row, "Asegurado")),
    producto: cleanText(getField(row, "Producto")),
    estado: cleanText(getField(row, "Estado")),
    autorizacionPagoRUI: cleanText(getField(row, "Se Autoriza Pago RUI", "Autorización de Pago RUI", "Autorizacion de Pago RUI")),
    sarlaft: cleanText(getField(row, "SARLAFT", "Sarlaft")),
    contratoARL: cleanText(getField(row, "CONTRATO ARL", "Contrato ARL")),
    quincena: cleanText(getField(row, "Quincena")),
    direccion: cleanText(getField(row, "Dirección", "Direccion")),
    telefono: cleanText(getField(row, "Teléfono", "Telefono")),
    tipo: cleanText(getField(row, "Tipo")),
    clase: cleanText(getField(row, "Clase")),
    sucursalIntermediario: cleanText(getField(row, "SucursalIntermediario", "Sucursal Intermediario")),
    nroNit: cleanText(getField(row, "NroNit", "Nro Nit")),
    actividad: cleanText(getField(row, "Actividad")),
    
    // Campos numéricos (monetarios)
    recaudo: parseNumber(getField(row, "Recaudo")),
    porcentajeComision: parsePercentage(getField(row, "Comisión_", "Comision_", "% Comisión", "% Comision", "Porcentaje Comision")),
    comision: parseNumber(getField(row, "Comisión", "Comision")),
    rteFte: parseNumber(getField(row, "RteFte", "Rte Fte")),
    rteICA: parseNumber(getField(row, "RteICA", "Rte ICA")),
    cree: parseNumber(getField(row, "CREE", "Cree")),
    neto: parseNumber(getField(row, "Neto")),
    
    // Campos de fecha
    mes: cleanText(getField(row, "Mes")),
    anio: cleanText(getField(row, "Año", "Ano")),
    fechaVigencia: parseDate(getField(row, "FECHAVIGDESDE", "Fecha de Vigencia", "FechaVigencia")),
    fechaRecaudo: parseDate(getField(row, "FECHARECAUDO", "Fecha de Recaudo", "FechaRecaudo")),
    fechaRUI: parseDate(getField(row, "Fecha RUI", "FechaRUI")),
    
    // Campos de control/auditoría
    idRegistro: generateRecordId(row),
    archivoOrigen: fileName,
    fechaCarga: new Date().toISOString(),
    usuarioCarga: userId,
    estadoValidacion: "VALIDADO"
  };
  
  // Validar campos críticos
  const errores = [];
  if (!normalized.poliza) errores.push("Póliza vacía");
  if (!normalized.nit) errores.push("NIT vacío");
  if (normalized.recaudo === 0 && normalized.comision === 0) errores.push("Recaudo y comisión en cero");
  
  if (errores.length > 0) {
    normalized.estadoValidacion = "CON_ERRORES";
    normalized.erroresValidacion = errores;
  }
  
  // Marcar pendientes
  const pendientes = [];
  if (!normalized.sarlaft || normalized.sarlaft.toUpperCase() === "NO" || normalized.sarlaft === "") {
    pendientes.push("SARLAFT");
  }
  if (!normalized.autorizacionPagoRUI) {
    pendientes.push("Autorización RUI");
  }
  if (!normalized.fechaRUI) {
    pendientes.push("Fecha RUI");
  }
  
  if (pendientes.length > 0) {
    normalized.pendientes = pendientes;
  }
  
  return normalized;
}

/**
 * Procesa un array de filas del Excel
 */
export function processExcelRows(rows, headers, fileName, userId) {
  const results = {
    valid: [],
    duplicates: [],
    errors: [],
    seenIds: new Set()
  };
  
  rows.forEach((row, index) => {
    try {
      // Crear objeto con headers
      const rowObj = {};
      headers.forEach((h, i) => {
        if (h) rowObj[h] = row[i];
      });
      
      // Verificar si la fila está vacía
      const hasData = Object.values(rowObj).some(v => v !== null && v !== undefined && v !== "");
      if (!hasData) return;
      
      // Normalizar
      const normalized = normalizeRecord(rowObj, fileName, userId);
      
      // Verificar duplicado interno
      if (results.seenIds.has(normalized.idRegistro)) {
        results.duplicates.push({ ...normalized, filaExcel: index + 2 });
      } else {
        results.seenIds.add(normalized.idRegistro);
        results.valid.push({ ...normalized, filaExcel: index + 2 });
      }
    } catch (error) {
      results.errors.push({
        filaExcel: index + 2,
        error: error.message,
        datos: row
      });
    }
  });
  
  return results;
}

/**
 * Formatea un número como moneda colombiana
 */
export function formatCurrency(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(value || 0);
}

/**
 * Formatea un porcentaje
 */
export function formatPercentage(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 2
  }).format(value || 0);
}

/**
 * Mapa de número de mes a nombre en español
 */
export const MESES = {
  "1": "enero", "01": "enero",
  "2": "febrero", "02": "febrero",
  "3": "marzo", "03": "marzo",
  "4": "abril", "04": "abril",
  "5": "mayo", "05": "mayo",
  "6": "junio", "06": "junio",
  "7": "julio", "07": "julio",
  "8": "agosto", "08": "agosto",
  "9": "septiembre", "09": "septiembre",
  "10": "octubre",
  "11": "noviembre",
  "12": "diciembre"
};

/**
 * Convierte número de mes a nombre
 */
export function mesNumeroANombre(mes) {
  if (!mes) return "";
  const mesStr = String(mes).trim();
  // Si ya es nombre, retornarlo
  if (isNaN(parseInt(mesStr))) {
    return mesStr.toLowerCase();
  }
  return MESES[mesStr] || mesStr;
}

/**
 * Convierte nombre de mes a número
 */
export function mesNombreANumero(mes) {
  if (!mes) return "";
  const mesLower = String(mes).toLowerCase().trim();
  for (const [num, nombre] of Object.entries(MESES)) {
    if (nombre === mesLower) return num.padStart(2, "0");
  }
  // Si ya es número, retornarlo
  if (!isNaN(parseInt(mesLower))) {
    return mesLower.padStart(2, "0");
  }
  return mes;
}

/**
 * Normaliza nombres de clientes/asegurados para agrupar variantes
 * Ej: "COLEGIO MAYOR DEL CAUCA ." -> "COLEGIO MAYOR DEL CAUCA"
 * Ej: "REHABILITAR E.U." / "REHABILITAR LTDA" / "REHABILITAR SAS" -> "REHABILITAR"
 */
export function normalizeClientName(name) {
  if (!name) return "";
  
  let normalized = String(name)
    .toUpperCase()
    .trim()
    // Quitar puntos sueltos al final
    .replace(/\s*\.\s*$/, "")
    // Quitar sufijos de tipo de empresa
    .replace(/\s+(S\.?A\.?S\.?|LTDA\.?|E\.?U\.?|S\.?A\.?|& CIA\.?|Y CIA\.?|LIMITADA|INC\.?)\.?\s*$/i, "")
    // Quitar puntos múltiples
    .replace(/\.+/g, " ")
    // Normalizar espacios múltiples
    .replace(/\s+/g, " ")
    .trim();
  
  return normalized;
}
