import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc, 
  doc,
  writeBatch,
  getDoc,
  updateDoc,
  limit
} from "firebase/firestore";
import { db } from "../../firebase";

const COLLECTION_PATH = (companyId) => `companies/${companyId}/commissions`;

/**
 * Obtiene todos los IDs de registros existentes para deduplicación
 */
export async function getExistingRecordIds(companyId) {
  const ids = new Set();
  try {
    const q = query(collection(db, COLLECTION_PATH(companyId)));
    const snap = await getDocs(q);
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.idRegistro) {
        ids.add(data.idRegistro);
      }
    });
  } catch (error) {
    console.error("Error obteniendo IDs existentes:", error);
  }
  return ids;
}

/**
 * Guarda múltiples registros en Firestore usando batches
 * Retorna estadísticas del proceso
 */
export async function saveCommissionRecords(companyId, records, existingIds) {
  const stats = {
    inserted: 0,
    duplicates: 0,
    errors: 0,
    errorDetails: []
  };

  // Filtrar duplicados contra la base de datos
  const newRecords = records.filter(r => {
    if (existingIds.has(r.idRegistro)) {
      stats.duplicates++;
      return false;
    }
    return true;
  });

  // Guardar en batches de 500 (límite de Firestore)
  const BATCH_SIZE = 500;
  
  for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = newRecords.slice(i, i + BATCH_SIZE);
    
    chunk.forEach(record => {
      const docRef = doc(collection(db, COLLECTION_PATH(companyId)));
      batch.set(docRef, record);
    });

    try {
      await batch.commit();
      stats.inserted += chunk.length;
    } catch (error) {
      console.error("Error en batch:", error);
      stats.errors += chunk.length;
      stats.errorDetails.push({
        batch: Math.floor(i / BATCH_SIZE) + 1,
        error: error.message
      });
    }
  }

  return stats;
}

/**
 * Obtiene registros con filtros opcionales
 */
export async function getCommissionRecords(companyId, filters = {}) {
  try {
    let q = collection(db, COLLECTION_PATH(companyId));
    const constraints = [];

    if (filters.mes) {
      constraints.push(where("mes", "==", filters.mes));
    }
    if (filters.anio) {
      constraints.push(where("anio", "==", filters.anio));
    }
    if (filters.intermediario) {
      constraints.push(where("intermediario", "==", filters.intermediario));
    }
    if (filters.ramo) {
      constraints.push(where("ramo", "==", filters.ramo));
    }
    if (filters.estado) {
      constraints.push(where("estado", "==", filters.estado));
    }
    if (filters.estadoValidacion) {
      constraints.push(where("estadoValidacion", "==", filters.estadoValidacion));
    }

    constraints.push(orderBy("fechaCarga", "desc"));
    
    if (filters.limit) {
      constraints.push(limit(filters.limit));
    }

    q = query(q, ...constraints);
    const snap = await getDocs(q);
    
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("Error obteniendo registros:", error);
    throw error;
  }
}

/**
 * Obtiene todos los registros sin filtros (para reportes)
 */
export async function getAllCommissionRecords(companyId) {
  try {
    const snap = await getDocs(collection(db, COLLECTION_PATH(companyId)));
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Ordenar en cliente para evitar necesidad de índice
    return records.sort((a, b) => {
      const dateA = a.fechaCarga?.toDate?.() || new Date(a.fechaCarga || 0);
      const dateB = b.fechaCarga?.toDate?.() || new Date(b.fechaCarga || 0);
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error obteniendo todos los registros:", error);
    throw error;
  }
}

/**
 * Calcula métricas agregadas de los registros
 */
export function calculateMetrics(records) {
  const metrics = {
    totalRegistros: records.length,
    totalRecaudo: 0,
    totalComision: 0,
    totalNeto: 0,
    totalRteFte: 0,
    totalRteICA: 0,
    totalCREE: 0,
    polizasUnicas: new Set(),
    aseguradosUnicos: new Set(),
    intermediariosUnicos: new Set(),
    ramosUnicos: new Set(),
    registrosConErrores: 0,
    registrosPendientes: 0,
    pendientesSARLAFT: 0,
    pendientesRUI: 0,
    comisionesEnCero: 0,
    porIntermediario: {},
    porRamo: {},
    porMesAnio: {},
    porDepartamento: {},
    porQuincena: {}
  };

  records.forEach(r => {
    // Totales
    metrics.totalRecaudo += r.recaudo || 0;
    metrics.totalComision += r.comision || 0;
    metrics.totalNeto += r.neto || 0;
    metrics.totalRteFte += r.rteFte || 0;
    metrics.totalRteICA += r.rteICA || 0;
    metrics.totalCREE += r.cree || 0;

    // Únicos
    if (r.poliza) metrics.polizasUnicas.add(r.poliza);
    if (r.asegurado) metrics.aseguradosUnicos.add(r.asegurado);
    if (r.intermediario) metrics.intermediariosUnicos.add(r.intermediario);
    if (r.ramo) metrics.ramosUnicos.add(r.ramo);

    // Estados
    if (r.estadoValidacion === "CON_ERRORES") metrics.registrosConErrores++;
    if (r.pendientes && r.pendientes.length > 0) {
      metrics.registrosPendientes++;
      if (r.pendientes.includes("SARLAFT")) metrics.pendientesSARLAFT++;
      if (r.pendientes.includes("Autorización RUI") || r.pendientes.includes("Fecha RUI")) {
        metrics.pendientesRUI++;
      }
    }
    if (r.comision === 0) metrics.comisionesEnCero++;

    // Por intermediario
    const inter = r.intermediario || "Sin intermediario";
    if (!metrics.porIntermediario[inter]) {
      metrics.porIntermediario[inter] = { recaudo: 0, comision: 0, neto: 0, count: 0 };
    }
    metrics.porIntermediario[inter].recaudo += r.recaudo || 0;
    metrics.porIntermediario[inter].comision += r.comision || 0;
    metrics.porIntermediario[inter].neto += r.neto || 0;
    metrics.porIntermediario[inter].count++;

    // Por ramo
    const ramo = r.ramo || "Sin ramo";
    if (!metrics.porRamo[ramo]) {
      metrics.porRamo[ramo] = { recaudo: 0, comision: 0, neto: 0, count: 0 };
    }
    metrics.porRamo[ramo].recaudo += r.recaudo || 0;
    metrics.porRamo[ramo].comision += r.comision || 0;
    metrics.porRamo[ramo].neto += r.neto || 0;
    metrics.porRamo[ramo].count++;

    // Por mes/año
    const periodo = `${r.mes || "?"}-${r.anio || "?"}`;
    if (!metrics.porMesAnio[periodo]) {
      metrics.porMesAnio[periodo] = { recaudo: 0, comision: 0, neto: 0, count: 0 };
    }
    metrics.porMesAnio[periodo].recaudo += r.recaudo || 0;
    metrics.porMesAnio[periodo].comision += r.comision || 0;
    metrics.porMesAnio[periodo].neto += r.neto || 0;
    metrics.porMesAnio[periodo].count++;

    // Por departamento
    const depto = r.departamento || "Sin departamento";
    if (!metrics.porDepartamento[depto]) {
      metrics.porDepartamento[depto] = { recaudo: 0, comision: 0, count: 0 };
    }
    metrics.porDepartamento[depto].recaudo += r.recaudo || 0;
    metrics.porDepartamento[depto].comision += r.comision || 0;
    metrics.porDepartamento[depto].count++;

    // Por quincena
    const quincena = r.quincena || "Sin quincena";
    if (!metrics.porQuincena[quincena]) {
      metrics.porQuincena[quincena] = { recaudo: 0, comision: 0, count: 0 };
    }
    metrics.porQuincena[quincena].recaudo += r.recaudo || 0;
    metrics.porQuincena[quincena].comision += r.comision || 0;
    metrics.porQuincena[quincena].count++;
  });

  // Convertir Sets a números
  metrics.polizasUnicas = metrics.polizasUnicas.size;
  metrics.aseguradosUnicos = metrics.aseguradosUnicos.size;
  metrics.intermediariosUnicos = metrics.intermediariosUnicos.size;
  metrics.ramosUnicos = metrics.ramosUnicos.size;

  return metrics;
}

/**
 * Elimina un registro
 */
export async function deleteCommissionRecord(companyId, recordId) {
  try {
    await deleteDoc(doc(db, COLLECTION_PATH(companyId), recordId));
    return true;
  } catch (error) {
    console.error("Error eliminando registro:", error);
    throw error;
  }
}

/**
 * Elimina todos los registros de un archivo específico
 */
export async function deleteRecordsByFile(companyId, fileName) {
  try {
    const q = query(
      collection(db, COLLECTION_PATH(companyId)),
      where("archivoOrigen", "==", fileName)
    );
    const snap = await getDocs(q);
    
    const batch = writeBatch(db);
    snap.docs.forEach(d => {
      batch.delete(d.ref);
    });
    
    await batch.commit();
    return snap.docs.length;
  } catch (error) {
    console.error("Error eliminando registros por archivo:", error);
    throw error;
  }
}

/**
 * Obtiene lista de archivos cargados con estadísticas
 */
export async function getUploadedFiles(companyId) {
  try {
    const records = await getAllCommissionRecords(companyId);
    const files = {};
    
    records.forEach(r => {
      const fileName = r.archivoOrigen || "Desconocido";
      if (!files[fileName]) {
        files[fileName] = {
          nombre: fileName,
          fechaCarga: r.fechaCarga,
          usuarioCarga: r.usuarioCarga,
          registros: 0,
          recaudo: 0,
          comision: 0
        };
      }
      files[fileName].registros++;
      files[fileName].recaudo += r.recaudo || 0;
      files[fileName].comision += r.comision || 0;
    });
    
    return Object.values(files).sort((a, b) => 
      new Date(b.fechaCarga) - new Date(a.fechaCarga)
    );
  } catch (error) {
    console.error("Error obteniendo archivos:", error);
    throw error;
  }
}
