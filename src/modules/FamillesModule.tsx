import { useState } from 'react';
import { Plus, Edit2, Trash2, X, GripVertical } from 'lucide-react';
import { store } from '../store';
import { Personnel, Famille } from '../types';
import { nextId, capitalize } from '../helpers';
import ConfirmModal from '../components/ConfirmModal';

interface Props {
  user: Personnel;
}

export default function FamillesModule({ user: _user }: Props) {
  const [familles, setFamilles] = useState(store.getFamilles());
  const [showForm, setShowForm] = useState(false);
  const [editFamille, setEditFamille] = useState<Famille | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Famille | null>(null);
  const [toast, setToast] = useState('');

  const [form, setForm] = useState({
    CODE: '',
    FAMILLE: '',
    COULEUR: '#0D47A1',
  });

  const articles = store.getArticles();

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const refresh = () => setFamilles(store.getFamilles());

  const openAddForm = () => {
    setEditFamille(null);
    setForm({
      CODE: '',
      FAMILLE: '',
      COULEUR: '#0D47A1',
    });
    setShowForm(true);
  };

  const openEditForm = (famille: Famille) => {
    setEditFamille(famille);
    setForm({
      CODE: famille.CODE,
      FAMILLE: famille.FAMILLE,
      COULEUR: famille.COULEUR,
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.CODE.trim() || !form.FAMILLE.trim()) {
      showMsg('Code et nom obligatoires');
      return;
    }

    if (editFamille) {
      const updated = familles.map(f =>
        f.IDFAMILLE === editFamille.IDFAMILLE
          ? { ...f, CODE: form.CODE.toUpperCase(), FAMILLE: capitalize(form.FAMILLE), COULEUR: form.COULEUR }
          : f
      );
      store.setFamilles(updated);
      showMsg('Famille modifiée');
    } else {
      const newFamille: Famille = {
        IDFAMILLE: nextId(familles, 'IDFAMILLE'),
        CODE: form.CODE.toUpperCase(),
        FAMILLE: capitalize(form.FAMILLE),
        COULEUR: form.COULEUR,
        ORDRE: familles.length + 1,
      };
      store.setFamilles([...familles, newFamille]);
      showMsg('Famille créée');
    }

    setShowForm(false);
    refresh();
  };

  const handleDelete = (famille: Famille) => {
    // Vérifier s'il y a des articles
    const articlesCount = articles.filter(a => a.IDFAMILLE === famille.IDFAMILLE).length;
    if (articlesCount > 0) {
      showMsg(`Impossible de supprimer : ${articlesCount} article(s) liés`);
      setConfirmDelete(null);
      return;
    }

    store.setFamilles(familles.filter(f => f.IDFAMILLE !== famille.IDFAMILLE));
    setConfirmDelete(null);
    refresh();
    showMsg('Famille supprimée');
  };

  const couleurs = [
    '#F59E0B', '#8B5CF6', '#10B981', '#EC4899', '#0D47A1',
    '#EF4444', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🏷️ Familles d'articles</h1>
        <button
          onClick={openAddForm}
          className="bg-[#0D47A1] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium hover:bg-[#1565C0]"
        >
          <Plus size={18} /> Nouvelle famille
        </button>
      </div>

      {/* Liste des familles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {familles.sort((a, b) => a.ORDRE - b.ORDRE).map(f => {
          const count = articles.filter(a => a.IDFAMILLE === f.IDFAMILLE).length;
          return (
            <div 
              key={f.IDFAMILLE} 
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div 
                className="h-2" 
                style={{ backgroundColor: f.COULEUR }}
              />
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="text-gray-300 cursor-move" size={20} />
                    <div>
                      <p className="font-bold text-lg">{f.FAMILLE}</p>
                      <p className="text-sm text-gray-500 font-mono">{f.CODE}</p>
                    </div>
                  </div>
                  <div 
                    className="w-8 h-8 rounded-lg" 
                    style={{ backgroundColor: f.COULEUR }}
                  />
                </div>
                
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-gray-500">{count} article(s)</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditForm(f)}
                      className="p-1.5 rounded-lg hover:bg-blue-50"
                      title="Modifier"
                    >
                      <Edit2 size={16} className="text-blue-500" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(f)}
                      className="p-1.5 rounded-lg hover:bg-red-50"
                      title="Supprimer"
                    >
                      <Trash2 size={16} className="text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {familles.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          Aucune famille
        </div>
      )}

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">
                🏷️ {editFamille ? 'Modifier' : 'Nouvelle'} famille
              </h3>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Code *</label>
                <input
                  type="text"
                  value={form.CODE}
                  onChange={e => setForm({ ...form, CODE: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 rounded-xl border"
                  placeholder="Ex: BIE"
                  maxLength={5}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Nom *</label>
                <input
                  type="text"
                  value={form.FAMILLE}
                  onChange={e => setForm({ ...form, FAMILLE: capitalize(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl border"
                  placeholder="Ex: Bières"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Couleur</label>
                <div className="flex flex-wrap gap-2">
                  {couleurs.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm({ ...form, COULEUR: c })}
                      className={`w-10 h-10 rounded-lg transition-all ${
                        form.COULEUR === c ? 'ring-4 ring-offset-2 ring-gray-400' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={form.COULEUR}
                  onChange={e => setForm({ ...form, COULEUR: e.target.value })}
                  className="mt-2 w-full h-10 rounded-lg cursor-pointer"
                />
              </div>

              <button
                onClick={handleSave}
                className="w-full bg-[#0D47A1] text-white py-3 rounded-xl font-bold hover:bg-[#1565C0]"
              >
                {editFamille ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        type="danger"
        title="Supprimer la famille"
        message={`Voulez-vous vraiment supprimer "${confirmDelete?.FAMILLE}" ?`}
        confirmText="Oui, supprimer"
        cancelText="Non"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
