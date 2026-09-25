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
  const [selectedClientForLanding, setSelectedClientForLanding] = useState(initialClient || null);
  const [isModalOpen, setIsModalOpen] = useState(initialClientMode === "edit" && !!initialClient?.id);
  const [editingClient, setEditingClient] = useState(initialClientMode === "edit" ? initialClient : null);

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
    onInitialClientConsumed?.();
  }, [initialClient, onInitialClientConsumed]);

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

  return (
    <div className="pageContent">
      <div className="clientsPageHeader">
        <p className="pageIntro">Consulta tus clientes, sus contactos y el seguimiento comercial.</p>
        <button type="button" className="btn btnPrimary addButton" onClick={handleCreate} aria-label="Nuevo cliente" title="Nuevo cliente">
          +
        </button>
      </div>

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
    </div>
  );
}
