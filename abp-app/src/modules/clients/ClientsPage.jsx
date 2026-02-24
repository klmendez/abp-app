import { useEffect, useState } from "react";
import ClientsTable from "./components/ClientsTable";
import ClientLanding from "./components/ClientLanding";
import ClientFormModal from "./components/ClientFormModal";

export default function ClientsPage({
  companyId,
  userId,
  onCreateActivityForClient,
  onEditActivityFromClient,
  initialClient,
  initialClientMode,
  onInitialClientConsumed,
}) {
  const [selectedClientForLanding, setSelectedClientForLanding] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  const handleSelect = (client) => setSelectedClientForLanding(client);

  const handleEdit = (client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingClient(null);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (!initialClient?.id) return;
    setSelectedClientForLanding(initialClient);
    if (initialClientMode === "edit") {
      setEditingClient(initialClient);
      setIsModalOpen(true);
    }
    onInitialClientConsumed?.();
  }, [initialClient?.id]);

  // Cuando entra a un cliente, dejamos que ClientLanding controle su layout interno
  if (selectedClientForLanding) {
    return (
      <>
        <ClientLanding
          client={selectedClientForLanding}
          onBack={() => setSelectedClientForLanding(null)}
          onEditClient={() => handleEdit(selectedClientForLanding)}
          onNewActivity={() => onCreateActivityForClient?.(selectedClientForLanding)}
          onEditActivity={(activity) => onEditActivityFromClient?.(activity)}
          companyId={companyId}
          userId={userId}
        />

        {isModalOpen && (
          <ClientFormModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            client={editingClient}
            onSaved={(saved) => {
              if (saved?.id && selectedClientForLanding?.id === saved.id) {
                setSelectedClientForLanding(saved);
              }
              setEditingClient(saved);
            }}
            companyId={companyId}
            userId={userId}
          />
        )}
      </>
    );
  }

  // Vista lista de clientes con el patrón HomePage (homeShell/homeQuick)
  return (
    <div className="homeShell">
      <section className="homeQuick">
        <div className="homeQuickHeader">
          <div>
            <h2>Clientes</h2>
            <p>Gestiona la información clave y contactos.</p>
          </div>

          <div className="homeQuickHeaderActions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btnPrimary" onClick={handleCreate}>
              Nuevo cliente
            </button>
          </div>
        </div>

        {/* Contenido principal limpio (sin card adicional) */}
        <ClientsTable companyId={companyId} onSelect={handleSelect} />

        {isModalOpen && (
          <ClientFormModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            client={editingClient}
            onSaved={(saved) => {
              setEditingClient(saved);
            }}
            companyId={companyId}
            userId={userId}
          />
        )}
      </section>
    </div>
  );
}