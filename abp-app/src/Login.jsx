import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import logoAsset from "./assets/Logo profesional.webp";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const code = err?.code || "";
      if (code === "auth/user-disabled") setError("Tu usuario está deshabilitado.");
      else if (code === "auth/invalid-credential" || code === "auth/wrong-password") setError("Credenciales incorrectas.");
      else if (code === "auth/too-many-requests") setError("Demasiados intentos. Intenta más tarde.");
      else setError("No se pudo iniciar sesión.");
    }
  };

  return (
    <div className="loginShell">
      <div className="loginBackdrop" />
      <div className="loginCard">
        <div className="loginBrand">
          <div className="loginLogo">
            <img src={logoAsset} alt="ABP Gestión" />
          </div>
          <div className="loginBrandCopy">
            <h1>ABP Gestión</h1>
            <p>Plataforma corporativa</p>
          </div>
        </div>

        <div className="loginIntro">
          <p className="loginTag">Bienvenido</p>
          <h2>Inicia sesión</h2>
          <p>Accede a tus módulos y planea las actividades del equipo.</p>
        </div>

        <form onSubmit={handleLogin} className="loginForm">
          <label className="field">
            <span className="label">Correo electrónico</span>
            <input className="loginInput" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@empresa.com" />
          </label>

          <label className="field">
            <span className="label">Contraseña</span>
            <input className="loginInput" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </label>

          <div className="loginActions">
            <button className="loginBtnPrimary" type="submit">
              Ingresar
            </button>
          </div>

          {error ? <div className="loginAlert loginAlertError">{error}</div> : null}
        </form>
      </div>
    </div>
  );
}
