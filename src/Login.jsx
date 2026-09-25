import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import logoAsset from "./assets/Logo profesional.webp";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    setError("");
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const code = err?.code || "";
      if (code === "auth/user-disabled") setError("Tu usuario está deshabilitado.");
      else if (code === "auth/invalid-credential" || code === "auth/wrong-password") setError("Credenciales incorrectas.");
      else if (code === "auth/too-many-requests") setError("Demasiados intentos. Intenta más tarde.");
      else setError("No se pudo iniciar sesión.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="loginShell">
      <section className="loginPresentation">
        <div className="loginPresentationBrand"><img src={logoAsset} alt="" />ABP Seguros</div>
        <div>
          <p className="loginTag">TU PORTAL DE GESTIÓN</p>
          <h2>Tu equipo,<br />en un solo lugar.</h2>
          <p>Gestiona tus clientes, organiza las actividades y consulta la información de tu operación con ABP.</p>
        </div>
        <small>Acompañamiento cercano, en cada paso.</small>
      </section>
      <div className="loginFormArea">
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
          <h2>Bienvenido de nuevo</h2>
          <p>Accede a tus módulos y planea las actividades del equipo.</p>
        </div>

        <form onSubmit={handleLogin} className="loginForm">
          <label className="field">
            <span className="label">Correo electrónico</span>
            <input className="loginInput" type="email" required autoComplete="username" disabled={isLoading} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@empresa.com" />
          </label>

          <label className="field">
            <span className="label">Contraseña</span>
            <div className="loginPasswordField">
              <input className="loginInput" type={showPassword ? "text" : "password"} required autoComplete="current-password" disabled={isLoading} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              <button type="button" className="loginPasswordToggle" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Ocultar" : "Mostrar"}</button>
            </div>
          </label>

          <div className="loginActions">
            <button className="loginBtnPrimary" type="submit" disabled={isLoading}>
              {isLoading ? "Ingresando…" : "Ingresar a mi portal"}
            </button>
          </div>

          {error ? <div role="alert" className="loginAlert loginAlertError">{error}</div> : null}
        </form>
      </div>
      </div>
    </div>
  );
}
