import { useEffect, useState } from "react";
import Sidebar from "../layout/Sidebar";
import Topbar from "../layout/Topbar";

export default function MainLayout({ user, activeSection, onChangeSection, children, onSignOut, canManageUsers }) {
  const [isNavOpen, setIsNavOpen] = useState(false);

  useEffect(() => {
    const closeIfDesktop = () => {
      if (window.innerWidth > 1024) setIsNavOpen(false);
    };
    window.addEventListener("resize", closeIfDesktop);
    return () => window.removeEventListener("resize", closeIfDesktop);
  }, []);

  useEffect(() => {
    if (!isNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsNavOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isNavOpen]);

  return (
    <div className="app-layout">
      <Sidebar
        activeSection={activeSection}
        onChangeSection={onChangeSection}
        isOpen={isNavOpen}
        onClose={() => setIsNavOpen(false)}
        canManageUsers={canManageUsers}
      />

      {isNavOpen ? <button type="button" className="appBackdrop" aria-label="Cerrar navegación" onClick={() => setIsNavOpen(false)} /> : null}

      <div className="app-main">
        <Topbar
          user={user}
          onSignOut={onSignOut}
          activeSection={activeSection}
          isNavOpen={isNavOpen}
          onToggleNav={() => setIsNavOpen((v) => !v)}
        />
        <main className="page">
          {children}
        </main>
      </div>
    </div>
  );
}
