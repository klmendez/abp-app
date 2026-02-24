const sectionTitles = {
  home: "Inicio",
  activities: "Actividades",
  clients: "Clientes",
  reports: "Informes financieros",
  chartOfAccounts: "Plan de Cuentas",
  vouchers: "Comprobantes",
  users: "Usuarios",
};

export default function Topbar({
  user,
  me,
  membership,
  activeSection,
  onGoHome,
  onSignOut,
  onToggleNav, // (si lo usas para abrir/cerrar sidebar)
}) {
  const currentLabel = sectionTitles[activeSection] || "Panel";
  const isHome = activeSection === "home";
  const breadcrumb = isHome ? "Accesos directos" : `Inicio / ${currentLabel}`;

  return (
    <header className="topbar" role="banner">
      <div className="topbarInner">
        {/* IZQUIERDA: título + breadcrumb (misma lógica) */}
        <div className="topbarLeft">
          {/* (Opcional) Botón menú para mobile/side-nav */}
          {onToggleNav ? (
            <button
              type="button"
              className="topbarMenuBtn"
              onClick={onToggleNav}
              aria-label="Abrir navegación"
              title="Menú"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            </button>
          ) : null}

          <div className="topbarTitleBlock">
            <div className="topbarTitleRow">
              <h1 className="h2 topbarTitle">
                {isHome ? "Bienvenido a ABP Gestión" : currentLabel}
              </h1>

              {!isHome ? (
                <button
                  type="button"
                  className="topbarBackBtn"
                  onClick={onGoHome}
                  aria-label="Volver al inicio"
                  title="Volver al inicio"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="m3 12 9-9 9 9" />
                    <path d="M9 21V9h6v12" />
                  </svg>
                </button>
              ) : null}
            </div>

            <p className="topbarBreadcrumb">{breadcrumb}</p>
          </div>
        </div>

        {/* DERECHA: info usuario + acciones */}
        <div className="topbarRight">
          <div className="topbarUserCard" title={user?.email || ""}>
            <div className="topbarUserEmail">{user?.email || "—"}</div>
            <div className="topbarUserRole">
              {me?.isPlatformSuperAdmin
                ? "Platform SuperAdmin"
                : membership?.role
                ? `Rol: ${membership.role}`
                : "Rol: (sin membership)"}
            </div>
          </div>

          <button className="btn" type="button" onClick={onSignOut}>
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}