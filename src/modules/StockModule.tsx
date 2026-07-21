import { useState } from 'react';
import { Package, TrendingUp, TrendingDown, AlertTriangle, Search, Plus, Minus, RotateCcw } from 'lucide-react';
import { store } from '../store';
import { Personnel } from '../types';
import { today, nowTime, nextId } from '../helpers';

interface Props {
  user: Personnel;
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

  const familles = store.getFamilles();

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const refresh = () => {
    setArticles(store.getArticles().filter(a => a.ACTIF && a.GERE_STOCK));
    setMouvements(store.getMouvements());
  };

  const filteredArticles = articles.filter(a =>
    a.NOM.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.CODE.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const articlesEnAlerte = articles.filter(a => a.STOCK <= a.STOCK_MIN);

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
              <div key={a.IDARTICLE} className="bg-white rounded-lg p-3 border border-orange-200">
                <p className="font-medium text-sm">{a.NOM}</p>
                <p className="text-xs text-orange-600">Stock: {a.STOCK} / Min: {a.STOCK_MIN}</p>
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
                const isLow = a.STOCK <= a.STOCK_MIN;
                return (
                  <tr key={a.IDARTICLE} className={`border-t border-gray-50 hover:bg-gray-50 ${isLow ? 'bg-orange-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{a.EMOJI}</span>
                        <div>
                          <p className="font-medium">{a.NOM}</p>
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowMvt(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className={`px-6 py-4 text-white ${mvtType === 'Entrée' ? 'bg-green-500' : mvtType === 'Sortie' ? 'bg-red-500' : 'bg-blue-500'}`}>
              <h3 className="font-bold text-lg">
                {mvtType === 'Entrée' ? '➕ Entrée de stock' : mvtType === 'Sortie' ? '➖ Sortie de stock' : '🔄 Ajustement'}
              </h3>
              <p className="text-sm opacity-80">
                {articles.find(a => a.IDARTICLE === selectedArticle)?.NOM}
              </p>
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
