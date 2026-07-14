import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Users } from 'lucide-react';
import { store } from '../store';
import { Personnel } from '../types';
import { nextId, capitalize, roleColors } from '../helpers';
import ConfirmModal from '../components/ConfirmModal';

interface Props {
  user: Personnel;
}

const roles = ['Administrateur', 'Gérant', 'Caissier', 'Serveur', 'Magasinier'] as const;

export default function PersonnelModule({ user: _user }: Props) {
  const [personnel, setPersonnel] = useState(store.getPersonnel());
  const [showForm, setShowForm] = useState(false);
  const [editPersonnel, setEditPersonnel] = useState<Personnel | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Personnel | null>(null);
  const [toast, setToast] = useState('');

  const [form, setForm] = useState({
    NOM: '',
    PRENOM: '',
    LOGIN: '',
    MOT_DE_PASSE: '',
    ROLE: 'Caissier' as Personnel['ROLE'],
    ACTIF: true,
  });

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const refresh = () => setPersonnel(store.getPersonnel());

  const openAddForm = () => {
    setEditPersonnel(null);
    setForm({
      NOM: '',
      PRENOM: '',
      LOGIN: '',
      MOT_DE_PASSE: '',
      ROLE: 'Caissier',
      ACTIF: true,
    });
    setShowForm(true);
  };

  const openEditForm = (p: Personnel) => {
    setEditPersonnel(p);
    setForm({
      NOM: p.NOM,
      PRENOM: p.PRENOM,
      LOGIN: p.LOGIN,
      MOT_DE_PASSE: p.MOT_DE_PASSE,
      ROLE: p.ROLE,
      ACTIF: p.ACTIF,
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.NOM.trim() || !form.LOGIN.trim() || !form.MOT_DE_PASSE.trim()) {
      showMsg('Nom, login et mot de passe obligatoires');
      return;
    }

    // Vérifier unicité login
    const existing = personnel.find(p => 
      p.LOGIN.toLowerCase() === form.LOGIN.toLowerCase() && 
      p.IDPERSONNEL !== editPersonnel?.IDPERSONNEL
    );
    if (existing) {
      showMsg('Ce login existe déjà');
      return;
    }

    if (editPersonnel) {
      const updated = personnel.map(p =>
        p.IDPERSONNEL === editPersonnel.IDPERSONNEL
          ? { ...p, NOM: capitalize(form.NOM), PRENOM: capitalize(form.PRENOM), LOGIN: form.LOGIN.toLowerCase(), MOT_DE_PASSE: form.MOT_DE_PASSE, ROLE: form.ROLE, ACTIF: form.ACTIF }
          : p
      );
      store.setPersonnel(updated);
      showMsg('Personnel modifié');
    } else {
      const newP: Personnel = {
        IDPERSONNEL: nextId(personnel, 'IDPERSONNEL'),
        NOM: capitalize(form.NOM),
        PRENOM: capitalize(form.PRENOM),
        LOGIN: form.LOGIN.toLowerCase(),
        MOT_DE_PASSE: form.MOT_DE_PASSE,
        ROLE: form.ROLE,
        ACTIF: form.ACTIF,
      };
      store.setPersonnel([...personnel, newP]);
      showMsg('Personnel créé');
    }

    setShowForm(false);
    refresh();
  };

  const handleDelete = (p: Personnel) => {
    // Vérifier si utilisé dans des ventes
    const ventes = store.getVentes();
    if (ventes.some(v => v.IDPERSONNEL === p.IDPERSONNEL)) {
      showMsg('Impossible: personnel lié à des ventes');
      setConfirmDelete(null);
      return;
    }
    store.setPersonnel(personnel.filter(x => x.IDPERSONNEL !== p.IDPERSONNEL));
    setConfirmDelete(null);
    refresh();
    showMsg('Personnel supprimé');
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">👤 Personnel</h1>
        <button
          onClick={openAddForm}
          className="bg-[#0D47A1] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium hover:bg-[#1565C0]"
        >
          <Plus size={18} /> Nouveau
        </button>
      </div>

      {/* Liste */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {personnel.map(p => (
          <div key={p.IDPERSONNEL} className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 ${!p.ACTIF ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <Users className="text-gray-400" size={24} />
                </div>
                <div>
                  <p className="font-bold">{p.PRENOM} {p.NOM}</p>
                  <p className="text-sm text-gray-500">@{p.LOGIN}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${roleColors[p.ROLE]}`}>
                {p.ROLE}
              </span>
            </div>
            
            <div className="mt-4 flex items-center justify-between">
              <span className={`text-xs ${p.ACTIF ? 'text-green-500' : 'text-red-500'}`}>
                {p.ACTIF ? '● Actif' : '○ Inactif'}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => openEditForm(p)}
                  className="p-1.5 rounded-lg hover:bg-blue-50"
                >
                  <Edit2 size={16} className="text-blue-500" />
                </button>
                <button
                  onClick={() => setConfirmDelete(p)}
                  className="p-1.5 rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={16} className="text-red-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">👤 {editPersonnel ? 'Modifier' : 'Nouveau'} personnel</h3>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Nom *</label>
                  <input
                    type="text"
                    value={form.NOM}
                    onChange={e => setForm({ ...form, NOM: capitalize(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Prénom</label>
                  <input
                    type="text"
                    value={form.PRENOM}
                    onChange={e => setForm({ ...form, PRENOM: capitalize(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Login *</label>
                <input
                  type="text"
                  value={form.LOGIN}
                  onChange={e => setForm({ ...form, LOGIN: e.target.value.toLowerCase() })}
                  className="w-full px-4 py-2.5 rounded-xl border"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Mot de passe *</label>
                <input
                  type="text"
                  value={form.MOT_DE_PASSE}
                  onChange={e => setForm({ ...form, MOT_DE_PASSE: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Rôle</label>
                <select
                  value={form.ROLE}
                  onChange={e => setForm({ ...form, ROLE: e.target.value as Personnel['ROLE'] })}
                  className="w-full px-4 py-2.5 rounded-xl border"
                >
                  {roles.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ACTIF}
                  onChange={e => setForm({ ...form, ACTIF: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm">Compte actif</span>
              </label>

              <button
                onClick={handleSave}
                className="w-full bg-[#0D47A1] text-white py-3 rounded-xl font-bold hover:bg-[#1565C0]"
              >
                {editPersonnel ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        type="danger"
        title="Supprimer"
        message={`Voulez-vous vraiment supprimer "${confirmDelete?.PRENOM} ${confirmDelete?.NOM}" ?`}
        confirmText="Oui, supprimer"
        cancelText="Non"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
