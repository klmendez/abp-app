import React from "react";

const quickLinks = [
  {
    id: "activities",
    title: "Actividades",
    description: "Planifica y da seguimiento a las tareas del equipo.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M7 8h10" />
        <path d="M7 12h4" />
        <path d="M7 16h6" />
      </svg>
    ),
  },
  {
    id: "clients",
    title: "Clientes",
    description: "Gestiona la información clave y contactos.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
        <path d="M6 21a6 6 0 0 1 12 0" />
      </svg>
    ),
  },
  {
    id: "reports",
    title: "Informes financieros",
    description: "Consulta indicadores y reportes contables.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 15l3-3 3 2 4-5" />
        <path d="M15 3v5h5" />
      </svg>
    ),
  },
  {
    id: "chartOfAccounts",
    title: "Plan de cuentas",
    description: "Visualiza y ordena tu catálogo contable.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 4h9" />
        <path d="M5 8h9" />
        <path d="M5 12h6" />
        <path d="M5 16h6" />
        <path d="M15 4h4v16h-4z" />
      </svg>
    ),
  },
];

export default function HomePage({ onNavigate }) {
  return (
    <div className="homeShell">
      <section className="homeQuick">
        <div className="homeQuickHeader">
          <h2>Accesos directos</h2>
          <p>Selecciona un módulo para continuar</p>
        </div>
        <div className="homeQuickGrid">
          {quickLinks.map((link) => (
            <button key={link.id} type="button" className="homeQuickCard" onClick={() => onNavigate?.(link.id)}>
              <div className="homeQuickIcon" aria-hidden>
                {link.icon}
              </div>
              <div>
                <div className="homeQuickTitle">{link.title}</div>
                <div className="homeQuickDescription">{link.description}</div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
