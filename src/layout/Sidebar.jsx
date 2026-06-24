import { useState } from "react";
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
    id: "powerbi",
    label: "Informe Power BI",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
        <path d="M5 4h14v16H5z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 16V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M12 16V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M16 16v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
  {
    id: "commissions",
    label: "Comisiones",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 6v2M12 16v2M9 9.5c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2s-.9 2-2 2h-2c-1.1 0-2 .9-2 2s.9 2 2 2h2c1.1 0 2-.9 2-2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function Sidebar({ activeSection, onChangeSection, isOpen, onClose }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside 
      className={`sidebar ${isOpen ? "is-open" : ""} ${isCollapsed ? "is-collapsed" : ""}`} 
      aria-label="Navegación principal"
    >
      <div className="sidebarHeader">
        {!isCollapsed && (
          <div className="sidebarBrand">
            <img src={logoPro} alt="ABP Gestión" />
          </div>
        )}
        <button 
          type="button" 
          className="sidebarToggle" 
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? "Expandir menú" : "Colapsar menú"}
          title={isCollapsed ? "Expandir" : "Colapsar"}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            {isCollapsed ? (
              <path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>
        <button type="button" className="sidebarClose" onClick={onClose} aria-label="Cerrar menú lateral">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
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
            title={isCollapsed ? s.label : undefined}
          >
            <span className="sidebarNavIcon">{s.icon}</span>
            {!isCollapsed && <span className="sidebarNavLabel">{s.label}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}
