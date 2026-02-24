import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./Login";
import { loadMe } from "./useMe";
import { loadMembership } from "./useMembership";
import MainLayout from "./layout/MainLayout";
import ActivitiesPage from "./modules/activities/ActivitiesPage";
import ClientsPage from "./modules/clients/ClientsPage";
import ChartOfAccountsPage from "./modules/accounting/ChartOfAccountsPage";
import VouchersPage from "./modules/accounting/VouchersPage";
import ReportsPage from "./modules/reports/ReportsPage";
import HomePage from "./modules/home/HomePage";
import UsersAdmin from "./UsersAdmin";

export default function App() {
  const [user, setUser] = useState(null);
  const [me, setMe] = useState(null);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("home");
  const [activityDraftClient, setActivityDraftClient] = useState(null);
  const [activityDraftEdit, setActivityDraftEdit] = useState(null);
  const [clientDraft, setClientDraft] = useState(null);
  const [clientDraftMode, setClientDraftMode] = useState("view");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setMe(null);
        setMembership(null);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const profile = await loadMe(u.uid);
        const mem = await loadMembership("abp", u.uid);
        setMe(profile);
        setMembership(mem);
      } catch (error) {
        console.error("Error cargando datos:", error);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return <div style={{ padding: 40 }}>Cargando...</div>;
  
  if (!user) return <Login onLogin={setUser} />;

  if (!me) {
    return (
      <div style={{ padding: 40 }}>
        <h2>No existe tu perfil en Firestore</h2>
        <p>Revisa la colección: <b>users/{user.uid}</b></p>
        <button onClick={() => signOut(auth)}>Cerrar sesión</button>
      </div>
    );
  }

  if (!me?.isPlatformSuperAdmin && me?.status && me.status !== "ACTIVE") {
    return (
      <div style={{ padding: 40 }}>
        <h2>Usuario inactivo</h2>
        <p>Tu usuario está marcado como inactivo. Contacta al administrador.</p>
        <button onClick={() => signOut(auth)}>Cerrar sesión</button>
      </div>
    );
  }

  if (!membership && !me?.isPlatformSuperAdmin) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Sin acceso</h2>
        <p>No tienes membership activo en ABP.</p>
        <button onClick={() => signOut(auth)}>Cerrar sesión</button>
      </div>
    );
  }

  if (!me?.isPlatformSuperAdmin && membership?.status && membership.status !== "ACTIVE") {
    return (
      <div style={{ padding: 40 }}>
        <h2>Sin acceso</h2>
        <p>Tu membership en esta empresa está inactivo.</p>
        <button onClick={() => signOut(auth)}>Cerrar sesión</button>
      </div>
    );
  }

  const canManageUsers =
    !!me?.isPlatformSuperAdmin || membership?.role === "ADMIN_EMPRESA" || membership?.role === "COORDINADOR";

  const handleCreateActivityForClient = (client) => {
    setActivityDraftClient(client);
    setActivityDraftEdit(null);
    setActiveSection("activities");
  };

  const handleEditActivityFromClient = (activity) => {
    setActivityDraftEdit(activity);
    setActivityDraftClient(null);
    setActiveSection("activities");
  };

  const handleEditClientFromActivity = (client) => {
    setClientDraft(client);
    setClientDraftMode("edit");
    setActiveSection("clients");
  };

  const renderSection = () => {
    if (activeSection === "home") {
      return <HomePage onNavigate={(section) => setActiveSection(section)} />;
    }
    if (activeSection === "clients") {
      return (
        <ClientsPage
          companyId="abp"
          userId={user.uid}
          onCreateActivityForClient={handleCreateActivityForClient}
          onEditActivityFromClient={handleEditActivityFromClient}
          initialClient={clientDraft}
          initialClientMode={clientDraftMode}
          onInitialClientConsumed={() => {
            setClientDraft(null);
            setClientDraftMode("view");
          }}
        />
      );
    }
    if (activeSection === "chartOfAccounts") {
      return <ChartOfAccountsPage companyId="abp" userId={user.uid} />;
    }
    if (activeSection === "vouchers") {
      return <VouchersPage companyId="abp" userId={user.uid} />;
    }
    if (activeSection === "reports") {
      return <ReportsPage companyId="abp" />;
    }
    if (activeSection === "users" && canManageUsers) {
      return <UsersAdmin companyId="abp" currentUserId={user.uid} />;
    }
    // default: actividades
    return (
      <ActivitiesPage
        companyId="abp"
        userId={user.uid}
        initialClient={activityDraftClient}
        initialEditActivity={activityDraftEdit}
        onInitialClientConsumed={() => setActivityDraftClient(null)}
        onInitialEditActivityConsumed={() => setActivityDraftEdit(null)}
        onEditClientFromActivity={handleEditClientFromActivity}
      />
    );
  };

  return (
    <MainLayout
      user={user}
      me={me}
      membership={membership}
      activeSection={activeSection}
      onChangeSection={setActiveSection}
      onGoHome={() => setActiveSection("home")}
      onSignOut={() => signOut(auth)}
    >
      {renderSection()}
    </MainLayout>
  );
}