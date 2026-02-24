import { useEffect, useState } from "react";
import Sidebar from "../layout/Sidebar";
import Topbar from "../layout/Topbar";

export default function MainLayout({ user, me, membership, activeSection, onChangeSection, onGoHome, children, onSignOut }) {
  const [isNavOpen, setIsNavOpen] = useState(false);

  useEffect(() => {
    const closeIfDesktop = () => {
      if (window.innerWidth >= 1024) setIsNavOpen(false);
    };
    window.addEventListener("resize", closeIfDesktop);
    return () => window.removeEventListener("resize", closeIfDesktop);
  }, []);

  return (
    <div className="app-layout">
      <Sidebar
        activeSection={activeSection}
        onChangeSection={onChangeSection}
        isOpen={isNavOpen}
        onClose={() => setIsNavOpen(false)}
      />

      {isNavOpen ? <button type="button" className="appBackdrop" aria-label="Cerrar navegación" onClick={() => setIsNavOpen(false)} /> : null}

      <div className="app-main">
        <Topbar
          user={user}
          me={me}
          membership={membership}
          onSignOut={onSignOut}
          activeSection={activeSection}
          onGoHome={onGoHome}
          onToggleNav={() => setIsNavOpen((v) => !v)}
        />
        <main className="page">
          {children}
        </main>
      </div>
    </div>
  );
}
