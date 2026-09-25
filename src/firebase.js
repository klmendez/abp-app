import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBVgl3sIuHlEgioYPWJnHnhU69_lnMz3Lw",
  authDomain: "abp-agencia-de-seguros.firebaseapp.com",
  projectId: "abp-agencia-de-seguros",
  storageBucket: "abp-agencia-de-seguros.firebasestorage.app",
  messagingSenderId: "687377228016",
  appId: "1:687377228016:web:ad08b396c5340b12836235",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

let db;
try {
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
} catch {
  // Si ya fue inicializado (ej. por HMR), usar getFirestore
  db = getFirestore(app);
}
export { db };

let blockedAlertShown = false;

function showBlockedWarning() {
  if (blockedAlertShown) return;
  blockedAlertShown = true;
  const msg =
    "Parece que la conexión con la base de datos está siendo bloqueada.\n\n" +
    "Esto suele deberse a un bloqueador de anuncios (AdBlock, uBlock, etc.) " +
    "o a la configuración de red/firewall.\n\n" +
    "Para solucionarlo:\n" +
    "1) Desactiva el bloqueador de anuncios para este sitio.\n" +
    "2) Si estás en una red corporativa, pide al área de TI que permita *.googleapis.com\n" +
    "3) Prueba con otro navegador o en modo incógnito sin extensiones.";
  setTimeout(() => {
    window.alert(msg);
  }, 0);
}

// Interceptar errores de fetch/XHR hacia firestore.googleapis.com
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const url = String(args[0] || "");
  try {
    const response = await originalFetch.apply(this, args);
    return response;
  } catch (err) {
    if (url.includes("firestore.googleapis.com")) {
      const msg = err?.message || "";
      if (
        msg.includes("ERR_BLOCKED_BY_CLIENT") ||
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("net::ERR")
      ) {
        showBlockedWarning();
      }
    }
    throw err;
  }
};

// Interceptar errores de XMLHttpRequest (canal de Firestore usa XHR/WebChannel)
const originalXHRSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function (...args) {
  const xhr = this;
  const originalOnError = xhr.onerror;
  xhr.onerror = function () {
    try {
      const url = xhr.responseURL || "";
      if (url.includes("firestore.googleapis.com")) {
        showBlockedWarning();
      }
    } catch {
      // ignorar
    }
    if (originalOnError) {
      originalOnError.apply(this, arguments);
    }
  };
  return originalXHRSend.apply(this, args);
};
