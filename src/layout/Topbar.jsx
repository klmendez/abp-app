const sectionTitles = {
  home: "Inicio",
  activities: "Actividades",
  clients: "Clientes",
  reports: "Informes financieros",
  powerbi: "Informe Power BI",
  chartOfAccounts: "Plan de Cuentas",
  vouchers: "Comprobantes",
  commissions: "Comisiones",
  users: "Usuarios",
};

export default function Topbar({
  user,
  onSignOut,
  activeSection,
  onToggleNav,
}) {
  const currentLabel = sectionTitles[activeSection] || "Panel";

  return (
    <header className="topbar" role="banner">
      <div className="topbarInner">
        <div className="topbarLeft">
          {onToggleNav && (
            <button
              type="button"
              className="topbarMenuBtn"
              onClick={onToggleNav}
              aria-label="Abrir navegación"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            </button>
          )}
          <h1 className="topbarTitle">{currentLabel}</h1>
        </div>

        <div className="topbarRight">
          <span className="topbarUserEmail">{user?.email || ""}</span>
          <button className="btn" type="button" onClick={onSignOut}>
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
