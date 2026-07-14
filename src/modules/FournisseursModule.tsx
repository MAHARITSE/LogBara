import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Search, Truck } from 'lucide-react';
import { store } from '../store';
import { Personnel, Fournisseur } from '../types';
import { nextId, capitalize } from '../helpers';
import ConfirmModal from '../components/ConfirmModal';
import PhoneInput from '../components/PhoneInput';

interface Props {
  user: Personnel;
}

export default function FournisseursModule({ user: _user }: Props) {
  const [fournisseurs, setFournisseurs] = useState(store.getFournisseurs());
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editFournisseur, setEditFournisseur] = useState<Fournisseur | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Fournisseur | null>(null);
  const [toast, setToast] = useState('');

  const [form, setForm] = useState({
    NOM: '',
    ADRESSE: '',
    TELEPHONE: '',
    EMAIL: '',
    NIF: '',
    STAT: '',
  });

  const achats = store.getAchats();

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const refresh = () => setFournisseurs(store.getFournisseurs());

  const filtered = fournisseurs.filter(f =>
    f.NOM.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.TELEPHONE.includes(searchTerm) ||
    (f.EMAIL || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddForm = () => {
    setEditFournisseur(null);
    setForm({ NOM: '', ADRESSE: '', TELEPHONE: '', EMAIL: '', NIF: '', STAT: '' });
    setShowForm(true);
  };

  const openEditForm = (f: Fournisseur) => {
    setEditFournisseur(f);
    setForm({
      NOM: f.NOM,
      ADRESSE: f.ADRESSE || '',
      TELEPHONE: f.TELEPHONE || '',
      EMAIL: f.EMAIL || '',
      NIF: f.NIF || '',
      STAT: f.STAT || '',
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.NOM.trim()) {
      showMsg('Nom du fournisseur obligatoire');
      return;
    }

    if (editFournisseur) {
      const updated = fournisseurs.map(f =>
        f.IDFOURNISSEUR === editFournisseur.IDFOURNISSEUR
          ? {
              ...f,
              NOM: capitalize(form.NOM.trim()),
              ADRESSE: form.ADRESSE,
              TELEPHONE: form.TELEPHONE,
              EMAIL: form.EMAIL,
              NIF: form.NIF,
              STAT: form.STAT,
            }
          : f
      );
      store.setFournisseurs(updated);
      showMsg('Fournisseur modifié');
    } else {
      const newF: Fournisseur = {
        IDFOURNISSEUR: nextId(fournisseurs, 'IDFOURNISSEUR'),
        NOM: capitalize(form.NOM.trim()),
        ADRESSE: form.ADRESSE,
        TELEPHONE: form.TELEPHONE,
        EMAIL: form.EMAIL,
        NIF: form.NIF,
        STAT: form.STAT,
      };
      store.setFournisseurs([...fournisseurs, newF]);
      showMsg('Fournisseur créé');
    }

    setShowForm(false);
    refresh();
  };

  const handleDelete = (f: Fournisseur) => {
    const countAchats = achats.filter(a => a.IDFOURNISSEUR === f.IDFOURNISSEUR).length;
    if (countAchats > 0) {
      showMsg(`Suppression impossible : ${countAchats} achat(s) lié(s)`);
      setConfirmDelete(null);
      return;
    }

    store.setFournisseurs(fournisseurs.filter(x => x.IDFOURNISSEUR !== f.IDFOURNISSEUR));
    setConfirmDelete(null);
    refresh();
    showMsg('Fournisseur supprimé');
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🚚 Fournisseurs</h1>
        <button onClick={openAddForm} className="bg-[#0D47A1] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium hover:bg-[#1565C0]">
          <Plus size={18} /> Nouveau fournisseur
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Rechercher un fournisseur..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-[#0D47A1]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(f => {
          const countAchats = achats.filter(a => a.IDFOURNISSEUR === f.IDFOURNISSEUR).length;
          return (
            <div key={f.IDFOURNISSEUR} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Truck size={22} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{f.NOM}</p>
                    <p className="text-xs text-gray-400">{countAchats} achat(s)</p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEditForm(f)} className="p-1.5 rounded-lg hover:bg-blue-50" title="Modifier">
                    <Edit2 size={16} className="text-blue-500" />
                  </button>
                  <button onClick={() => setConfirmDelete(f)} className="p-1.5 rounded-lg hover:bg-red-50" title="Supprimer">
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <p><span className="font-medium text-gray-800">Téléphone :</span> {f.TELEPHONE || '-'}</p>
                <p><span className="font-medium text-gray-800">Adresse :</span> {f.ADRESSE || '-'}</p>
                <p><span className="font-medium text-gray-800">Email :</span> {f.EMAIL || '-'}</p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <p><span className="font-medium text-gray-800">NIF :</span> {f.NIF || '-'}</p>
                  <p><span className="font-medium text-gray-800">STAT :</span> {f.STAT || '-'}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">
          Aucun fournisseur
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">🚚 {editFournisseur ? 'Modifier' : 'Nouveau'} fournisseur</h3>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Nom *</label>
                <input value={form.NOM} onChange={e => setForm({ ...form, NOM: capitalize(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Adresse</label>
                <input value={form.ADRESSE} onChange={e => setForm({ ...form, ADRESSE: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Téléphone</label>
                <PhoneInput value={form.TELEPHONE} onChange={v => setForm({ ...form, TELEPHONE: v })} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
                <input type="email" value={form.EMAIL} onChange={e => setForm({ ...form, EMAIL: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">NIF</label>
                  <input value={form.NIF} onChange={e => setForm({ ...form, NIF: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">STAT</label>
                  <input value={form.STAT} onChange={e => setForm({ ...form, STAT: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border" />
                </div>
              </div>

              <button onClick={handleSave} className="w-full bg-[#0D47A1] text-white py-3 rounded-xl font-bold hover:bg-[#1565C0]">
                {editFournisseur ? 'Modifier' : 'Créer'} le fournisseur
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        type="danger"
        title="Supprimer le fournisseur"
        message={`Voulez-vous vraiment supprimer "${confirmDelete?.NOM}" ?`}
        confirmText="Oui, supprimer"
        cancelText="Non"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
