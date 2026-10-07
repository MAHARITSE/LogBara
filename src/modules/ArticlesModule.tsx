import { useState, useRef } from 'react';
import { Plus, Edit2, Trash2, X, Search, Package, Bell, BellOff, Upload, Image as ImageIcon, Ban, Eye } from 'lucide-react';
import { store } from '../store';
import { Personnel, Article } from '../types';
import { formatAr, nextId, capitalize } from '../helpers';
import ConfirmModal from '../components/ConfirmModal';
import MoneyInput from '../components/MoneyInput';
import { fileToDataUrl } from '../utils/imageUtils';

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
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emojiPalette = [
    '🍺', '🍻', '🥃', '🍷', '🍸', '🍹', '🍾', '🥤', '💧', '🧃', '☕', '🧋',
    '🥜', '🍟', '🍢', '🍗', '🥩', '🍖', '🍔', '🍕', '🌭', '🥪', '🥗', '🍨',
    '🍰', '🍿', '🧀', '🍋', '🍽️', '🏷️', '📦'
  ];

  // Form state
  const [form, setForm] = useState({
    CODE: '',
    NOM: '',
    IDFAMILLE: 0,
    EMOJI: '📦',
    IMAGE: '',
    PRIX_ACHAT: 0,
    PRIX_VENTE: 0,
    STOCK: 0,
    STOCK_MIN: 5,
    GERE_STOCK: true,
    SAISIE_PRIX_VENTE: false,
    ALERTE_STOCK: true,
    NE_PLUS_VENDRE: false,
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
      IMAGE: '',
      PRIX_ACHAT: 0,
      PRIX_VENTE: 0,
      STOCK: 0,
      STOCK_MIN: 5,
      GERE_STOCK: true,
      SAISIE_PRIX_VENTE: false,
      ALERTE_STOCK: true,
      NE_PLUS_VENDRE: false,
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
      IMAGE: article.IMAGE || '',
      PRIX_ACHAT: article.PRIX_ACHAT,
      PRIX_VENTE: article.PRIX_VENTE,
      STOCK: article.STOCK,
      STOCK_MIN: article.STOCK_MIN,
      GERE_STOCK: article.GERE_STOCK,
      SAISIE_PRIX_VENTE: article.SAISIE_PRIX_VENTE,
      ALERTE_STOCK: article.ALERTE_STOCK !== false,
      NE_PLUS_VENDRE: !!article.NE_PLUS_VENDRE,
    });
    setShowForm(true);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingImage(true);
      const dataUrl = await fileToDataUrl(file, { maxWidth: 320, maxHeight: 320, quality: 0.88 });
      setForm(prev => ({ ...prev, IMAGE: dataUrl }));
      showMsg('Image chargée avec succès');
    } catch (err) {
      showMsg('Erreur lors du traitement de l’image');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveArticleImage = () => {
    setForm(prev => ({ ...prev, IMAGE: '' }));
    showMsg('Image retirée (retour à l’émoji)');
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

  // Toggle rapide de l'alerte de stock (évite les alertes persistantes si produit en rupture totale ou fin de vente)
  const toggleAlerteStock = (article: Article) => {
    const isCurrentlyActive = article.ALERTE_STOCK !== false;
    const newAlerte = !isCurrentlyActive;
    const updated = articles.map(a =>
      a.IDARTICLE === article.IDARTICLE
        ? { ...a, ALERTE_STOCK: newAlerte }
        : a
    );
    store.setArticles(updated);
    refresh();
    showMsg(newAlerte ? `Alerte de stock activée pour "${article.NOM}"` : `Alerte coupée pour "${article.NOM}" (rupture / fin de vente)`);
  };

  // Toggle "Ne plus vendre" (masquer de la caisse POS)
  const toggleNePlusVendre = (article: Article) => {
    const isNePlusVendre = !article.NE_PLUS_VENDRE;
    const updated = articles.map(a =>
      a.IDARTICLE === article.IDARTICLE
        ? { ...a, NE_PLUS_VENDRE: isNePlusVendre }
        : a
    );
    store.setArticles(updated);
    refresh();
    showMsg(isNePlusVendre ? `Article "${article.NOM}" masqué dans la caisse POS` : `Article "${article.NOM}" désormais en vente dans la caisse`);
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
                const isLowStock = a.GERE_STOCK && a.STOCK <= a.STOCK_MIN && (a.ALERTE_STOCK !== false);
                return (
                  <tr key={a.IDARTICLE} className={`border-t border-gray-50 hover:bg-gray-50 ${!a.ACTIF ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-sm">{a.CODE}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {a.IMAGE ? (
                          <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-200 bg-slate-50 flex items-center justify-center shrink-0 shadow-2xs">
                            <img src={a.IMAGE} alt={a.NOM} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <span className="text-xl shrink-0">{a.EMOJI || '📦'}</span>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{a.NOM}</span>
                          {a.NE_PLUS_VENDRE && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-700 font-bold rounded-md flex items-center gap-1 shrink-0">
                              <Ban size={10} /> Ne plus vendre
                            </span>
                          )}
                        </div>
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
                    <td className={`px-4 py-3 text-center font-semibold ${isLowStock ? 'text-red-500 font-bold' : ''}`}>
                      {a.GERE_STOCK ? a.STOCK : '∞'}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => toggleNePlusVendre(a)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              a.NE_PLUS_VENDRE ? 'hover:bg-red-100 text-red-600 bg-red-50' : 'hover:bg-gray-100 text-gray-400'
                            }`}
                            title={a.NE_PLUS_VENDRE ? "Réautoriser la vente en caisse" : "Ne plus vendre (masquer dans la caisse POS)"}
                          >
                            <Ban size={16} />
                          </button>
                          <button
                            onClick={() => toggleAlerteStock(a)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              a.ALERTE_STOCK !== false ? 'hover:bg-amber-50 text-amber-600' : 'hover:bg-gray-100 text-gray-400'
                            }`}
                            title={a.ALERTE_STOCK !== false ? "Désactiver l'alerte de stock" : "Réactiver l'alerte de stock"}
                          >
                            {a.ALERTE_STOCK !== false ? <Bell size={16} /> : <BellOff size={16} />}
                          </button>
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
                  <td colSpan={canEdit ? 10 : 9} className="text-center py-8 text-gray-400">
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Package size={20} />
                {editArticle ? 'Modifier' : 'Nouvel'} article
              </h3>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Visuel : Image ou Emoji */}
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                    Visuel de l'article (Image ou Emoji)
                  </label>
                  {form.IMAGE && (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      🖼️ Image active
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5">
                  {/* Prévisualisation */}
                  <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 shadow-2xs flex items-center justify-center overflow-hidden shrink-0">
                    {form.IMAGE ? (
                      <img src={form.IMAGE} alt="Aperçu" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl select-none">{form.EMOJI || '📦'}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2 w-full">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageFileChange}
                      accept="image/png,image/jpeg,image/jpg,image/x-icon,image/vnd.microsoft.icon,image/ico,image/webp,image/svg+xml"
                      className="hidden"
                      id="article-image-file-input"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        htmlFor="article-image-file-input"
                        className="px-3 py-1.5 bg-[#0D47A1] hover:bg-[#1565C0] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                      >
                        <Upload size={14} />
                        <span>{isUploadingImage ? 'Traitement...' : form.IMAGE ? 'Changer l\'image' : 'Charger une image (PNG, JPG, ICO)'}</span>
                      </label>

                      {form.IMAGE && (
                        <button
                          type="button"
                          onClick={handleRemoveArticleImage}
                          className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Trash2 size={13} />
                          <span>Retirer l'image</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-medium">Saisir un Emoji :</span>
                      <input
                        type="text"
                        value={form.EMOJI}
                        onChange={e => setForm({ ...form, EMOJI: e.target.value })}
                        className="w-14 px-2 py-1 rounded-lg border border-gray-300 bg-white text-center text-lg focus:ring-2 focus:ring-[#0D47A1] focus:outline-hidden"
                        maxLength={4}
                      />
                    </div>
                  </div>
                </div>

                {/* Palette d'émojis rapides */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Ou choisir un emoji rapide :</p>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white rounded-xl border border-gray-200">
                    {emojiPalette.map(e => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setForm({ ...form, EMOJI: e, IMAGE: '' })}
                        className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all cursor-pointer ${
                          !form.IMAGE && form.EMOJI === e
                            ? 'bg-blue-100 ring-2 ring-[#0D47A1] shadow-2xs'
                            : 'hover:bg-gray-100'
                        }`}
                        title={`Choisir ${e}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Prix d'achat</label>
                  <MoneyInput
                    value={form.PRIX_ACHAT}
                    onChange={val => setForm({ ...form, PRIX_ACHAT: val })}
                    className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-[#0D47A1] focus:border-transparent"
                    placeholder="0"
                    allowZero={false}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Prix de vente</label>
                  <MoneyInput
                    value={form.PRIX_VENTE}
                    onChange={val => setForm({ ...form, PRIX_VENTE: val })}
                    className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-[#0D47A1] focus:border-transparent"
                    placeholder="0"
                    allowZero={false}
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

              <div className="space-y-3 pt-1">
                <div className="flex gap-6 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.GERE_STOCK}
                      onChange={e => setForm({ ...form, GERE_STOCK: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-[#0D47A1] focus:ring-[#0D47A1]"
                    />
                    <span className="text-sm font-medium">Gérer le stock</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.SAISIE_PRIX_VENTE}
                      onChange={e => setForm({ ...form, SAISIE_PRIX_VENTE: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium">Prix libre (saisie à la vente)</span>
                  </label>
                </div>

                <div className="p-3 bg-red-50/70 rounded-xl border border-red-200">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.NE_PLUS_VENDRE}
                      onChange={e => setForm({ ...form, NE_PLUS_VENDRE: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500 mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-bold text-red-900 block">🚫 Ne plus vendre (Masquer dans la caisse POS)</span>
                      <span className="text-xs text-gray-600">
                        Masque cet article sur le terminal de caisse POS pour éviter de surcharger la liste d'articles à vendre.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.ALERTE_STOCK}
                      onChange={e => setForm({ ...form, ALERTE_STOCK: e.target.checked })}
                      disabled={!form.GERE_STOCK}
                      className="w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500 mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-bold text-gray-900 block">Activer l'alerte de stock bas</span>
                      <span className="text-xs text-gray-500">
                        Décochez cette option si le produit ne se vend plus ou s'il est en rupture totale définitive, afin d'éviter une alerte persistante.
                      </span>
                    </div>
                  </label>
                </div>
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
