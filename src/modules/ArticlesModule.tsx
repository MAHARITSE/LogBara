import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Search, Package } from 'lucide-react';
import { store } from '../store';
import { Personnel, Article } from '../types';
import { formatAr, nextId, capitalize } from '../helpers';
import ConfirmModal from '../components/ConfirmModal';

interface Props {
  user: Personnel;
}

export default function ArticlesModule({ user }: Props) {
  const [articles, setArticles] = useState(store.getArticles());
  const [searchTerm, setSearchTerm] = useState('');
  const [familleFilter, setFamilleFilter] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editArticle, setEditArticle] = useState<Article | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Article | null>(null);
  const [toast, setToast] = useState('');

  // Form state
  const [form, setForm] = useState({
    CODE: '',
    NOM: '',
    IDFAMILLE: 0,
    EMOJI: '📦',
    PRIX_ACHAT: 0,
    PRIX_VENTE: 0,
    STOCK: 0,
    STOCK_MIN: 5,
    GERE_STOCK: true,
    SAISIE_PRIX_VENTE: false,
  });

  const familles = store.getFamilles();
  const isAdmin = user.ROLE === 'Administrateur';
  const isGerant = user.ROLE === 'Gérant';
  const canEdit = isAdmin || isGerant;
  const canDelete = isAdmin;

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const refresh = () => setArticles(store.getArticles());

  // Filtrer les articles
  const filteredArticles = articles.filter(a => {
    if (familleFilter && a.IDFAMILLE !== familleFilter) return false;
    if (searchTerm && !a.NOM.toLowerCase().includes(searchTerm.toLowerCase()) && !a.CODE.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // Ouvrir le formulaire pour ajout
  const openAddForm = () => {
    const nextCode = `ART${String(nextId(articles, 'IDARTICLE')).padStart(3, '0')}`;
    setEditArticle(null);
    setForm({
      CODE: nextCode,
      NOM: '',
      IDFAMILLE: familles[0]?.IDFAMILLE || 0,
      EMOJI: '📦',
      PRIX_ACHAT: 0,
      PRIX_VENTE: 0,
      STOCK: 0,
      STOCK_MIN: 5,
      GERE_STOCK: true,
      SAISIE_PRIX_VENTE: false,
    });
    setShowForm(true);
  };

  // Ouvrir le formulaire pour modification
  const openEditForm = (article: Article) => {
    setEditArticle(article);
    setForm({
      CODE: article.CODE,
      NOM: article.NOM,
      IDFAMILLE: article.IDFAMILLE,
      EMOJI: article.EMOJI || '📦',
      PRIX_ACHAT: article.PRIX_ACHAT,
      PRIX_VENTE: article.PRIX_VENTE,
      STOCK: article.STOCK,
      STOCK_MIN: article.STOCK_MIN,
      GERE_STOCK: article.GERE_STOCK,
      SAISIE_PRIX_VENTE: article.SAISIE_PRIX_VENTE,
    });
    setShowForm(true);
  };

  // Sauvegarder
  const handleSave = () => {
    if (!form.NOM.trim()) {
      showMsg('Nom obligatoire');
      return;
    }
    if (!form.IDFAMILLE) {
      showMsg('Famille obligatoire');
      return;
    }

    if (editArticle) {
      // Modification
      const updated = articles.map(a =>
        a.IDARTICLE === editArticle.IDARTICLE
          ? { ...a, ...form, NOM: capitalize(form.NOM.trim()) }
          : a
      );
      store.setArticles(updated);
      showMsg('Article modifié');
    } else {
      // Ajout
      const newArticle: Article = {
        IDARTICLE: nextId(articles, 'IDARTICLE'),
        ...form,
        NOM: capitalize(form.NOM.trim()),
        ACTIF: true,
      };
      store.setArticles([...articles, newArticle]);
      showMsg('Article créé');
    }

    setShowForm(false);
    refresh();
  };

  // Supprimer
  const handleDelete = (article: Article) => {
    store.setArticles(articles.filter(a => a.IDARTICLE !== article.IDARTICLE));
    setConfirmDelete(null);
    refresh();
    showMsg('Article supprimé');
  };

  // Toggle rapide des checkboxes
  const toggleGereStock = (article: Article) => {
    const updated = articles.map(a =>
      a.IDARTICLE === article.IDARTICLE
        ? { ...a, GERE_STOCK: !a.GERE_STOCK }
        : a
    );
    store.setArticles(updated);
    refresh();
  };

  const toggleSaisiePrix = (article: Article) => {
    const updated = articles.map(a =>
      a.IDARTICLE === article.IDARTICLE
        ? { ...a, SAISIE_PRIX_VENTE: !a.SAISIE_PRIX_VENTE }
        : a
    );
    store.setArticles(updated);
    refresh();
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">📦 Articles</h1>
        {canEdit && (
          <button
            onClick={openAddForm}
            className="bg-[#0D47A1] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium hover:bg-[#1565C0]"
          >
            <Plus size={18} /> Nouvel article
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
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
          <select
            value={familleFilter || ''}
            onChange={e => setFamilleFilter(e.target.value ? Number(e.target.value) : null)}
            className="px-4 py-2.5 rounded-xl border"
          >
            <option value="">Toutes les familles</option>
            {familles.map(f => (
              <option key={f.IDFAMILLE} value={f.IDFAMILLE}>{f.FAMILLE}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Nom</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Famille</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">PA</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">PV</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Stocké</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Prix libre</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Stock</th>
                {canEdit && <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredArticles.map(a => {
                const famille = familles.find(f => f.IDFAMILLE === a.IDFAMILLE);
                const isLowStock = a.GERE_STOCK && a.STOCK <= a.STOCK_MIN;
                return (
                  <tr key={a.IDARTICLE} className={`border-t border-gray-50 hover:bg-gray-50 ${!a.ACTIF ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-sm">{a.CODE}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{a.EMOJI}</span>
                        <span className="font-medium">{a.NOM}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span 
                        className="text-xs px-2 py-1 rounded-full text-white"
                        style={{ backgroundColor: famille?.COULEUR }}
                      >
                        {famille?.FAMILLE}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">{formatAr(a.PRIX_ACHAT)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatAr(a.PRIX_VENTE)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => canEdit && toggleGereStock(a)}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                          a.GERE_STOCK 
                            ? 'bg-green-500 border-green-500 text-white' 
                            : 'border-gray-300 bg-white'
                        } ${canEdit ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                      >
                        {a.GERE_STOCK && '✓'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => canEdit && toggleSaisiePrix(a)}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                          a.SAISIE_PRIX_VENTE 
                            ? 'bg-orange-500 border-orange-500 text-white' 
                            : 'border-gray-300 bg-white'
                        } ${canEdit ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                      >
                        {a.SAISIE_PRIX_VENTE && '✓'}
                      </button>
                    </td>
                    <td className={`px-4 py-3 text-center font-semibold ${isLowStock ? 'text-red-500' : ''}`}>
                      {a.GERE_STOCK ? a.STOCK : '∞'}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditForm(a)}
                            className="p-1.5 rounded-lg hover:bg-blue-50"
                            title="Modifier"
                          >
                            <Edit2 size={16} className="text-blue-500" />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => setConfirmDelete(a)}
                              className="p-1.5 rounded-lg hover:bg-red-50"
                              title="Supprimer"
                            >
                              <Trash2 size={16} className="text-red-500" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredArticles.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 9 : 8} className="text-center py-8 text-gray-400">
                    Aucun article
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Package size={20} />
                {editArticle ? 'Modifier' : 'Nouvel'} article
              </h3>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Code *</label>
                  <input
                    type="text"
                    value={form.CODE}
                    onChange={e => setForm({ ...form, CODE: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2.5 rounded-xl border"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Emoji</label>
                  <input
                    type="text"
                    value={form.EMOJI}
                    onChange={e => setForm({ ...form, EMOJI: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border text-2xl text-center"
                    maxLength={2}
                  />
                </div>
              </div>

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
                <label className="text-sm font-medium text-gray-700 mb-1 block">Famille *</label>
                <select
                  value={form.IDFAMILLE}
                  onChange={e => setForm({ ...form, IDFAMILLE: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl border"
                >
                  <option value={0}>-- Sélectionner --</option>
                  {familles.map(f => (
                    <option key={f.IDFAMILLE} value={f.IDFAMILLE}>{f.FAMILLE}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Prix d'achat</label>
                  <input
                    type="number"
                    value={form.PRIX_ACHAT || ''}
                    onChange={e => setForm({ ...form, PRIX_ACHAT: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Prix de vente</label>
                  <input
                    type="number"
                    value={form.PRIX_VENTE || ''}
                    onChange={e => setForm({ ...form, PRIX_VENTE: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Stock initial</label>
                  <input
                    type="number"
                    value={form.STOCK || ''}
                    onChange={e => setForm({ ...form, STOCK: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border"
                    disabled={!form.GERE_STOCK}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Stock minimum</label>
                  <input
                    type="number"
                    value={form.STOCK_MIN || ''}
                    onChange={e => setForm({ ...form, STOCK_MIN: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border"
                    disabled={!form.GERE_STOCK}
                  />
                </div>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.GERE_STOCK}
                    onChange={e => setForm({ ...form, GERE_STOCK: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-[#0D47A1] focus:ring-[#0D47A1]"
                  />
                  <span className="text-sm">Gérer le stock</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.SAISIE_PRIX_VENTE}
                    onChange={e => setForm({ ...form, SAISIE_PRIX_VENTE: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm">Prix libre (saisie à la vente)</span>
                </label>
              </div>

              <button
                onClick={handleSave}
                className="w-full bg-[#0D47A1] text-white py-3 rounded-xl font-bold hover:bg-[#1565C0]"
              >
                {editArticle ? 'Modifier' : 'Créer'} l'article
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        type="danger"
        title="Supprimer l'article"
        message={`Voulez-vous vraiment supprimer "${confirmDelete?.NOM}" ?`}
        confirmText="Oui, supprimer"
        cancelText="Non"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
