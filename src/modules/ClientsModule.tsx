import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Search } from 'lucide-react';
import { store } from '../store';
import { Personnel, Client } from '../types';
import { formatAr, nextId, today, capitalize } from '../helpers';
import ConfirmModal from '../components/ConfirmModal';
import PhoneInput from '../components/PhoneInput';

interface Props {
  user: Personnel;
}

export default function ClientsModule({ user: _user }: Props) {
  const [clients, setClients] = useState(store.getClients());
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);
  const [toast, setToast] = useState('');

  const [form, setForm] = useState({
    NOM_CLIENT: '',
    TELEPHONE: '',
    ADRESSE: '',
  });

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const refresh = () => setClients(store.getClients());

  const filteredClients = clients.filter(c =>
    c.NOM_CLIENT.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.TELEPHONE.includes(searchTerm)
  );

  const totalCredits = clients.reduce((s, c) => s + c.CREDIT_TOTAL, 0);

  const openAddForm = () => {
    setEditClient(null);
    setForm({ NOM_CLIENT: '', TELEPHONE: '', ADRESSE: '' });
    setShowForm(true);
  };

  const openEditForm = (client: Client) => {
    setEditClient(client);
    setForm({
      NOM_CLIENT: client.NOM_CLIENT,
      TELEPHONE: client.TELEPHONE,
      ADRESSE: client.ADRESSE,
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.NOM_CLIENT.trim()) {
      showMsg('Nom obligatoire');
      return;
    }

    if (editClient) {
      const updated = clients.map(c =>
        c.IDCLIENT === editClient.IDCLIENT
          ? { ...c, NOM_CLIENT: capitalize(form.NOM_CLIENT), TELEPHONE: form.TELEPHONE, ADRESSE: form.ADRESSE }
          : c
      );
      store.setClients(updated);
      showMsg('Client modifié');
    } else {
      const newClient: Client = {
        IDCLIENT: nextId(clients, 'IDCLIENT'),
        NOM_CLIENT: capitalize(form.NOM_CLIENT),
        TELEPHONE: form.TELEPHONE,
        ADRESSE: form.ADRESSE,
        CREDIT_TOTAL: 0,
        DATE_CREATION: today(),
      };
      store.setClients([...clients, newClient]);
      showMsg('Client créé');
    }

    setShowForm(false);
    refresh();
  };

  const handleDelete = (client: Client) => {
    if (client.CREDIT_TOTAL > 0) {
      showMsg('Impossible de supprimer un client avec crédit');
      setConfirmDelete(null);
      return;
    }
    store.setClients(clients.filter(c => c.IDCLIENT !== client.IDCLIENT));
    setConfirmDelete(null);
    refresh();
    showMsg('Client supprimé');
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">👥 Clients</h1>
        <button
          onClick={openAddForm}
          className="bg-[#0D47A1] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium hover:bg-[#1565C0]"
        >
          <Plus size={18} /> Nouveau client
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Nombre de clients</p>
          <p className="text-2xl font-bold">{clients.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Total crédits</p>
          <p className="text-2xl font-bold text-red-500">{formatAr(totalCredits)}</p>
        </div>
      </div>

      {/* Recherche */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-[#0D47A1]"
          />
        </div>
      </div>

      {/* Liste */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Nom</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Téléphone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Adresse</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Crédit</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(c => (
                <tr key={c.IDCLIENT} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.NOM_CLIENT}</td>
                  <td className="px-4 py-3 text-sm">{c.TELEPHONE || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.ADRESSE || '-'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${c.CREDIT_TOTAL > 0 ? 'text-red-500' : ''}`}>
                    {formatAr(c.CREDIT_TOTAL)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openEditForm(c)}
                        className="p-1.5 rounded-lg hover:bg-blue-50"
                        title="Modifier"
                      >
                        <Edit2 size={16} className="text-blue-500" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(c)}
                        className="p-1.5 rounded-lg hover:bg-red-50"
                        title="Supprimer"
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-400">
                    Aucun client
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">👤 {editClient ? 'Modifier' : 'Nouveau'} client</h3>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Nom *</label>
                <input
                  type="text"
                  value={form.NOM_CLIENT}
                  onChange={e => setForm({ ...form, NOM_CLIENT: capitalize(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl border"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Téléphone</label>
                <PhoneInput
                  value={form.TELEPHONE}
                  onChange={v => setForm({ ...form, TELEPHONE: v })}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Adresse</label>
                <input
                  type="text"
                  value={form.ADRESSE}
                  onChange={e => setForm({ ...form, ADRESSE: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border"
                />
              </div>

              <button
                onClick={handleSave}
                className="w-full bg-[#0D47A1] text-white py-3 rounded-xl font-bold hover:bg-[#1565C0]"
              >
                {editClient ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        type="danger"
        title="Supprimer le client"
        message={`Voulez-vous vraiment supprimer "${confirmDelete?.NOM_CLIENT}" ?`}
        confirmText="Oui, supprimer"
        cancelText="Non"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
