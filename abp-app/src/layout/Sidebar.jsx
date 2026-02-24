import logoPro from "../assets/Logo profesional.webp";

const sections = [
  {
    id: "home",
    label: "Inicio",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
        <path d="M4 10.5 12 4l8 6.5v8.5a1 1 0 0 1-1 1h-5v-5h-4v5H5a1 1 0 0 1-1-1z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "activities",
    label: "Actividades",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
        <path d="M4 5h16v3H4zM4 11h10v3H4zM4 17h7v3H4z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "clients",
    label: "Clientes",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-6 9v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "reports",
    label: "Informes financieros",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
        <path d="M5 4h14v16H5z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 14l2-3 2 2 3-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "chartOfAccounts",
    label: "Plan de Cuentas",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
        <path d="M5 5h9v4H5zM5 11h9v4H5zM5 17h6v4H5zM16 5h3v16h-3z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "vouchers",
    label: "Comprobantes",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
        <path d="M6 4h12v16H6z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 8h6M9 12h6M9 16h3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function Sidebar({ activeSection, onChangeSection, isOpen, onClose }) {
  return (
    <aside className={`sidebar ${isOpen ? "is-open" : ""}`} aria-label="Navegación principal">
      <div className="sidebarHeader">
        <div className="sidebarBrand">
          <img src={logoPro} alt="ABP Gestión" />
        </div>
        <button type="button" className="sidebarClose" onClick={onClose} aria-label="Cerrar menú lateral">
          Cerrar
        </button>
      </div>

      <nav className="sidebarNav">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              onChangeSection(s.id);
              onClose?.();
            }}
            className={`sidebarNavItem ${activeSection === s.id ? "is-active" : ""}`}
            aria-current={activeSection === s.id ? "page" : undefined}
          >
            <span className="sidebarNavItemInner">
              <span className="sidebarNavIcon">{s.icon}</span>
              <span className="sidebarNavLabel">{s.label}</span>
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
