import { useState, useEffect } from 'react';
import { Package, TrendingUp, TrendingDown, AlertTriangle, Search, Plus, Minus, RotateCcw, X, ShieldAlert, CheckCircle2, Bell, BellOff } from 'lucide-react';
import { store } from '../store';
import { Personnel } from '../types';
import { today, nowTime, nextId } from '../helpers';

interface Props {
  user: Personnel;
  onNavigateToCaisse?: () => void;
}

export default function StockModule({ user }: Props) {
  const [articles, setArticles] = useState(store.getArticles().filter(a => a.ACTIF && a.GERE_STOCK));
  const [mouvements, setMouvements] = useState(store.getMouvements());
  const [searchTerm, setSearchTerm] = useState('');
  const [showMvt, setShowMvt] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<number | null>(null);
  const [mvtType, setMvtType] = useState<'Entrée' | 'Sortie' | 'Ajustement'>('Entrée');
  const [mvtQty, setMvtQty] = useState(1);
  const [mvtRef, setMvtRef] = useState('');
  const [toast, setToast] = useState('');

  const canManageStock = ['Administrateur', 'Gérant', 'Magasinier'].includes(user.ROLE);
  const familles = store.getFamilles();

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const refresh = () => {
    setArticles(store.getArticles().filter(a => a.ACTIF && a.GERE_STOCK));
    setMouvements(store.getMouvements());
  };

  const toggleAlerte = (artId: number) => {
    const artList = store.getArticles();
    const art = artList.find(a => a.IDARTICLE === artId);
    if (!art) return;
    const newAlerte = !(art.ALERTE_STOCK !== false);
    const updated = artList.map(a => a.IDARTICLE === artId ? { ...a, ALERTE_STOCK: newAlerte } : a);
    store.setArticles(updated);
    refresh();
    showMsg(newAlerte ? `Alerte réactivée pour ${art.NOM}` : `Alerte désactivée pour ${art.NOM}`);
  };

  useEffect(() => {
    const handleUpdate = () => {
      refresh();
    };
    window.addEventListener('barpos-articles-updated', handleUpdate);
    window.addEventListener('barpos-data-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      window.removeEventListener('barpos-articles-updated', handleUpdate);
      window.removeEventListener('barpos-data-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, []);

  const filteredArticles = articles.filter(a =>
    a.NOM.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.CODE.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const articlesEnAlerte = articles.filter(a => (a.ALERTE_STOCK !== false) && a.STOCK <= a.STOCK_MIN);
  const filteredAlertes = articlesEnAlerte.filter(a =>
    a.NOM.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.CODE.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // VUE SPÉCIALE CAISSIER : affichage des alertes sans le tableau Article | Famille | Stock | Min | Actions
  if (!canManageStock) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        {toast && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="text-orange-500" size={26} />
              Alertes de stock
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Articles dont le niveau de stock est critique ou en rupture
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium self-start sm:self-auto">
            <ShieldAlert size={16} className="text-amber-600 shrink-0" />
            <span>Consultation caisse (gestion des stocks restreinte)</span>
          </div>
        </div>

        {/* Message d'information pour la caisse */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
          <p className="font-semibold mb-1">Information pour le poste Caisse :</p>
          <p className="text-blue-700">
            Le caissier n'a pas accès à la modification du stock. Veuillez signaler les articles en alerte ci-dessous au magasinier ou à la gérance pour réapprovisionnement.
          </p>
        </div>

        {/* Recherche parmi les alertes */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Filtrer un article en alerte..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#0D47A1] focus:border-transparent"
            />
          </div>
        </div>

        {/* Liste des alertes sans le tableau de gestion */}
        {articlesEnAlerte.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-8 text-center">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Aucune alerte de stock</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Tous les articles gérés en stock sont actuellement au-dessus de leur seuil d'alerte.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-gray-600 font-medium px-1">
              <span>{filteredAlertes.length} article{filteredAlertes.length > 1 ? 's' : ''} en stock bas</span>
              <span className="text-xs text-orange-600 font-semibold">Stock critique</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredAlertes.map(a => {
                const famille = familles.find(f => f.IDFAMILLE === a.IDFAMILLE);
                const isOutOfStock = a.STOCK <= 0;
                return (
                  <div
                    key={a.IDARTICLE}
                    className={`rounded-2xl p-4 border transition-all ${
                      isOutOfStock
                        ? 'bg-red-50/70 border-red-200 text-red-900'
                        : 'bg-orange-50/70 border-orange-200 text-orange-950'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {a.IMAGE ? (
                          <div className="w-10 h-10 rounded-xl overflow-hidden border border-gray-200 bg-white flex items-center justify-center shrink-0 shadow-2xs">
                            <img src={a.IMAGE} alt={a.NOM} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <span className="text-3xl select-none">{a.EMOJI || '📦'}</span>
                        )}
                        <div>
                          <p className="font-bold text-gray-900 leading-snug">{a.NOM}</p>
                          <p className="text-xs text-gray-400 font-mono">{a.CODE}</p>
                        </div>
                      </div>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white shrink-0"
                        style={{ backgroundColor: famille?.COULEUR || '#64748b' }}
                      >
                        {famille?.FAMILLE || 'Divers'}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-gray-500 block">Stock actuel</span>
                        <span className={`text-xl font-extrabold tabular-nums ${isOutOfStock ? 'text-red-600' : 'text-orange-600'}`}>
                          {a.STOCK}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-gray-500 block">Seuil d'alerte</span>
                        <span className="text-sm font-semibold text-gray-700 tabular-nums">
                          min: {a.STOCK_MIN}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5">
                      {isOutOfStock ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-100/80 px-2 py-0.5 rounded-md">
                          Rupture de stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-700 bg-orange-100/80 px-2 py-0.5 rounded-md">
                          Approvisionnement requis
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleMouvement = () => {
    if (!selectedArticle || mvtQty <= 0) return;

    const artList = store.getArticles();
    const mvtList = store.getMouvements();
    const art = artList.find(a => a.IDARTICLE === selectedArticle);
    if (!art) return;

    let newStock = art.STOCK;
    if (mvtType === 'Entrée') newStock += mvtQty;
    else if (mvtType === 'Sortie') newStock -= mvtQty;
    else newStock = mvtQty; // Ajustement

    if (newStock < 0) {
      showMsg('Stock insuffisant');
      return;
    }

    // Créer le mouvement
    const newMvt = {
      IDMOUVEMENT: nextId(mvtList, 'IDMOUVEMENT'),
      DATE_MOUVEMENT: today(),
      HEURE: nowTime(),
      IDARTICLE: selectedArticle,
      TYPE: mvtType,
      QUANTITE: mvtType === 'Ajustement' ? mvtQty - art.STOCK : mvtQty,
      REFERENCE: mvtRef || `Mvt manuel - ${user.PRENOM}`,
    };

    // Mettre à jour le stock
    const updatedArts = artList.map(a =>
      a.IDARTICLE === selectedArticle ? { ...a, STOCK: newStock } : a
    );

    store.setArticles(updatedArts);
    store.setMouvements([...mvtList, newMvt]);

    setShowMvt(false);
    setSelectedArticle(null);
    setMvtQty(1);
    setMvtRef('');
    refresh();
    showMsg('Mouvement enregistré');
  };

  const motifs = {
    'Entrée': ['Achat', 'Retour client', 'Transfert entrant', 'Don reçu'],
    'Sortie': ['Casse', 'Perte', 'Vol', 'Transfert sortant', 'Consommation interne'],
    'Ajustement': ['Inventaire', 'Correction erreur', 'Ajustement positif', 'Ajustement négatif'],
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

      <h1 className="text-2xl font-bold text-gray-900">📦 Gestion du stock</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <Package className="text-blue-500 mb-2" size={24} />
          <p className="text-sm text-gray-500">Articles stockés</p>
          <p className="text-xl font-bold">{articles.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <TrendingUp className="text-green-500 mb-2" size={24} />
          <p className="text-sm text-gray-500">Entrées du jour</p>
          <p className="text-xl font-bold">{mouvements.filter(m => m.DATE_MOUVEMENT === today() && m.TYPE === 'Entrée').length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <TrendingDown className="text-red-500 mb-2" size={24} />
          <p className="text-sm text-gray-500">Sorties du jour</p>
          <p className="text-xl font-bold">{mouvements.filter(m => m.DATE_MOUVEMENT === today() && m.TYPE === 'Sortie').length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <AlertTriangle className="text-orange-500 mb-2" size={24} />
          <p className="text-sm text-gray-500">En alerte</p>
          <p className="text-xl font-bold text-orange-500">{articlesEnAlerte.length}</p>
        </div>
      </div>

      {/* Articles en alerte */}
      {articlesEnAlerte.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <h3 className="font-bold text-orange-700 mb-3 flex items-center gap-2">
            <AlertTriangle size={18} />
            Articles en alerte ({articlesEnAlerte.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {articlesEnAlerte.map(a => (
              <div key={a.IDARTICLE} className="bg-white rounded-lg p-3 border border-orange-200 flex flex-col justify-between">
                <div>
                  <p className="font-medium text-sm">{a.NOM}</p>
                  <p className="text-xs text-orange-600">Stock: {a.STOCK} / Min: {a.STOCK_MIN}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleAlerte(a.IDARTICLE)}
                  className="mt-2 text-[11px] text-gray-500 hover:text-red-600 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Désactiver l'alerte pour cet article (si fin de vente ou rupture définitive)"
                >
                  <BellOff size={12} />
                  <span>Couper l'alerte</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recherche */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Rechercher un article..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-[#0D47A1]"
          />
        </div>
      </div>

      {/* Liste des articles */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Article</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Famille</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Stock</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Min</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredArticles.map(a => {
                const famille = familles.find(f => f.IDFAMILLE === a.IDFAMILLE);
                const isLow = a.STOCK <= a.STOCK_MIN && (a.ALERTE_STOCK !== false);
                return (
                  <tr key={a.IDARTICLE} className={`border-t border-gray-50 hover:bg-gray-50 ${isLow ? 'bg-orange-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {a.IMAGE ? (
                          <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-200 bg-white flex items-center justify-center shrink-0 shadow-2xs">
                            <img src={a.IMAGE} alt={a.NOM} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <span className="text-xl shrink-0">{a.EMOJI || '📦'}</span>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{a.NOM}</p>
                          <p className="text-xs text-gray-400">{a.CODE}</p>
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
                    <td className={`px-4 py-3 text-center font-bold ${isLow ? 'text-orange-500' : ''}`}>
                      {a.STOCK}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {a.STOCK_MIN}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => { setSelectedArticle(a.IDARTICLE); setMvtType('Entrée'); setShowMvt(true); }}
                          className="p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200"
                          title="Entrée"
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={() => { setSelectedArticle(a.IDARTICLE); setMvtType('Sortie'); setShowMvt(true); }}
                          className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200"
                          title="Sortie"
                        >
                          <Minus size={16} />
                        </button>
                        <button
                          onClick={() => { setSelectedArticle(a.IDARTICLE); setMvtType('Ajustement'); setMvtQty(a.STOCK); setShowMvt(true); }}
                          className="p-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200"
                          title="Ajustement"
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button
                          onClick={() => toggleAlerte(a.IDARTICLE)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            a.ALERTE_STOCK !== false
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                          title={a.ALERTE_STOCK !== false ? "Désactiver l'alerte pour cet article" : "Réactiver l'alerte pour cet article"}
                        >
                          {a.ALERTE_STOCK !== false ? <Bell size={16} /> : <BellOff size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Mouvement */}
      {showMvt && selectedArticle && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className={`px-6 py-4 text-white flex items-center justify-between ${mvtType === 'Entrée' ? 'bg-green-500' : mvtType === 'Sortie' ? 'bg-red-500' : 'bg-blue-500'}`}>
              <div>
                <h3 className="font-bold text-lg">
                  {mvtType === 'Entrée' ? '➕ Entrée de stock' : mvtType === 'Sortie' ? '➖ Sortie de stock' : '🔄 Ajustement'}
                </h3>
                <p className="text-sm opacity-80">
                  {articles.find(a => a.IDARTICLE === selectedArticle)?.NOM}
                </p>
              </div>
              <button onClick={() => setShowMvt(false)} className="p-1 rounded-lg hover:bg-white/20">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  {mvtType === 'Ajustement' ? 'Nouveau stock' : 'Quantité'}
                </label>
                <input
                  type="number"
                  value={mvtQty}
                  onChange={e => setMvtQty(Math.max(mvtType === 'Ajustement' ? 0 : 1, Number(e.target.value)))}
                  className="w-full px-4 py-3 rounded-xl border text-center text-2xl font-bold"
                  min={mvtType === 'Ajustement' ? 0 : 1}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Motif / Référence</label>
                <select
                  value={mvtRef}
                  onChange={e => setMvtRef(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border mb-2"
                >
                  <option value="">-- Choisir un motif --</option>
                  {motifs[mvtType].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={mvtRef}
                  onChange={e => setMvtRef(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border"
                  placeholder="Ou saisir un motif..."
                />
              </div>

              <button
                onClick={handleMouvement}
                className={`w-full py-3 rounded-xl font-bold text-white ${
                  mvtType === 'Entrée' ? 'bg-green-500 hover:bg-green-600' : 
                  mvtType === 'Sortie' ? 'bg-red-500 hover:bg-red-600' : 
                  'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                Valider le mouvement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
