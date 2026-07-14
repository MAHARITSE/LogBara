import { useMemo, useState } from 'react';
import { ClipboardList, CheckCircle2, PlayCircle, Search } from 'lucide-react';
import { store } from '../store';
import { Personnel, Inventaire, LigneInventaire } from '../types';
import { nextId, nowTime, today, formatAr } from '../helpers';
import ConfirmModal from '../components/ConfirmModal';

interface Props {
  user: Personnel;
}

export default function InventaireModule({ user }: Props) {
  const [inventaires, setInventaires] = useState(store.getInventaires());
  const [showCurrent, setShowCurrent] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [observation, setObservation] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState('');

  const articles = store.getArticles().filter(a => a.ACTIF && a.GERE_STOCK);
  const lignesInventaire = store.getLignesInventaire();

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const refresh = () => setInventaires(store.getInventaires());

  const currentInventaire = inventaires.find(i => i.IDINVENTAIRE === currentId) || null;
  const currentLines = lignesInventaire.filter(l => l.IDINVENTAIRE === currentId);

  const filteredLines = useMemo(() => {
    return currentLines.filter(line => {
      const art = articles.find(a => a.IDARTICLE === line.IDARTICLE);
      return art?.NOM.toLowerCase().includes(searchTerm.toLowerCase()) || art?.CODE.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [currentLines, articles, searchTerm]);

  const totalEcartValeur = currentLines.reduce((sum, line) => {
    const art = articles.find(a => a.IDARTICLE === line.IDARTICLE);
    return sum + line.ECART * (art?.PRIX_ACHAT || 0);
  }, 0);

  const startInventaire = () => {
    const invList = store.getInventaires();
    const lineList = store.getLignesInventaire();
    const idInventaire = nextId(invList, 'IDINVENTAIRE');

    const newInv: Inventaire = {
      IDINVENTAIRE: idInventaire,
      DATE_INVENTAIRE: today(),
      HEURE: nowTime(),
      IDPERSONNEL: user.IDPERSONNEL,
      OBSERVATION: observation,
      VALIDE: false,
    };

    let lineId = nextId(lineList, 'IDLIGNEINVENTAIRE');
    const newLines: LigneInventaire[] = articles.map(a => ({
      IDLIGNEINVENTAIRE: lineId++,
      IDINVENTAIRE: idInventaire,
      IDARTICLE: a.IDARTICLE,
      STOCK_THEORIQUE: a.STOCK,
      STOCK_PHYSIQUE: a.STOCK,
      ECART: 0,
      CHECKED: false,
    }));

    store.setInventaires([...invList, newInv]);
    store.setLignesInventaire([...lineList, ...newLines]);
    setInventaires([...invList, newInv]);
    setCurrentId(idInventaire);
    setShowCurrent(true);
    setObservation('');
    showMsg('Inventaire démarré');
  };

  const updateLine = (lineId: number, stockPhysique: number) => {
    const list = store.getLignesInventaire();
    const updated = list.map(line =>
      line.IDLIGNEINVENTAIRE === lineId
        ? {
            ...line,
            STOCK_PHYSIQUE: Math.max(0, stockPhysique),
            ECART: Math.max(0, stockPhysique) - line.STOCK_THEORIQUE,
            CHECKED: true,
          }
        : line
    );
    store.setLignesInventaire(updated);
  };

  const toggleChecked = (lineId: number) => {
    const list = store.getLignesInventaire();
    const updated = list.map(line =>
      line.IDLIGNEINVENTAIRE === lineId
        ? { ...line, CHECKED: !line.CHECKED }
        : line
    );
    store.setLignesInventaire(updated);
  };

  const validateInventaire = () => {
    if (!currentInventaire) return;

    const listInv = store.getInventaires();
    const listLines = store.getLignesInventaire();
    const artList = store.getArticles();
    const mvtList = store.getMouvements();
    const lines = listLines.filter(l => l.IDINVENTAIRE === currentInventaire.IDINVENTAIRE);

    const updatedInv = listInv.map(inv =>
      inv.IDINVENTAIRE === currentInventaire.IDINVENTAIRE ? { ...inv, VALIDE: true } : inv
    );

    let mvtId = nextId(mvtList, 'IDMOUVEMENT');
    const newMvts = [...mvtList];

    const updatedArticles = artList.map(article => {
      const line = lines.find(l => l.IDARTICLE === article.IDARTICLE);
      if (!line) return article;

      if (line.ECART !== 0) {
        newMvts.push({
          IDMOUVEMENT: mvtId++,
          DATE_MOUVEMENT: today(),
          HEURE: nowTime(),
          IDARTICLE: article.IDARTICLE,
          TYPE: 'Ajustement',
          QUANTITE: line.ECART,
          REFERENCE: `Inventaire #${currentInventaire.IDINVENTAIRE}`,
        });
      }

      return { ...article, STOCK: line.STOCK_PHYSIQUE };
    });

    store.setInventaires(updatedInv);
    store.setArticles(updatedArticles);
    store.setMouvements(newMvts);
    setShowConfirm(false);
    refresh();
    showMsg('Inventaire validé');
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">📋 Inventaire</h1>
        <button onClick={startInventaire} className="bg-[#0D47A1] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium hover:bg-[#1565C0]">
          <PlayCircle size={18} /> Démarrer un inventaire
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Inventaires total</p>
          <p className="text-2xl font-bold">{inventaires.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Inventaires validés</p>
          <p className="text-2xl font-bold text-green-600">{inventaires.filter(i => i.VALIDE).length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Articles stockés</p>
          <p className="text-2xl font-bold text-[#0D47A1]">{articles.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <label className="text-sm font-medium text-gray-700 mb-1 block">Observation / assistants</label>
        <input
          value={observation}
          onChange={e => setObservation(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border"
          placeholder="Ex: Assistants: Jean, Paul"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
          <h3 className="font-bold text-gray-900">Historique des inventaires</h3>
          {currentInventaire && !currentInventaire.VALIDE && (
            <button onClick={() => setShowCurrent(!showCurrent)} className="px-4 py-2 rounded-xl bg-blue-100 text-blue-700 font-medium hover:bg-blue-200">
              {showCurrent ? 'Masquer l’inventaire en cours' : 'Ouvrir l’inventaire en cours'}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Observations</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Statut</th>
              </tr>
            </thead>
            <tbody>
              {[...inventaires].sort((a, b) => b.IDINVENTAIRE - a.IDINVENTAIRE).map(inv => (
                <tr key={inv.IDINVENTAIRE} className="border-t border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => { setCurrentId(inv.IDINVENTAIRE); setShowCurrent(true); }}>
                  <td className="px-4 py-3 font-medium">#{inv.IDINVENTAIRE}</td>
                  <td className="px-4 py-3 text-sm">{inv.DATE_INVENTAIRE} {inv.HEURE}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{inv.OBSERVATION || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full ${inv.VALIDE ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {inv.VALIDE ? 'Validé' : 'En cours'}
                    </span>
                  </td>
                </tr>
              ))}
              {inventaires.length === 0 && (
                <tr><td colSpan={4} className="text-center py-10 text-gray-400">Aucun inventaire</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCurrent && currentInventaire && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><ClipboardList size={18} /> Inventaire #{currentInventaire.IDINVENTAIRE}</h3>
              <p className="text-sm text-gray-500">{currentInventaire.DATE_INVENTAIRE} {currentInventaire.HEURE}</p>
            </div>
            {!currentInventaire.VALIDE && (
              <button onClick={() => setShowConfirm(true)} className="bg-green-500 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-green-600 flex items-center gap-2">
                <CheckCircle2 size={18} /> Valider l’inventaire
              </button>
            )}
          </div>

          <div className="p-4 border-b border-gray-100">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Rechercher un article..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500 w-10">✓</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Article</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Stock théorique</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Stock physique</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Écart</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Valeur écart</th>
                </tr>
              </thead>
              <tbody>
                {filteredLines.map(line => {
                  const art = articles.find(a => a.IDARTICLE === line.IDARTICLE);
                  const value = line.ECART * (art?.PRIX_ACHAT || 0);
                  return (
                    <tr key={line.IDLIGNEINVENTAIRE} className={`border-t border-gray-50 hover:bg-gray-50 ${line.CHECKED ? 'bg-green-50/50' : ''}`}>
                      <td className="px-2 py-3 text-center">
                        {currentInventaire.VALIDE ? (
                          <span className={line.CHECKED ? 'text-green-500' : 'text-gray-300'}>{line.CHECKED ? '✓' : '○'}</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={line.CHECKED}
                            onChange={() => toggleChecked(line.IDLIGNEINVENTAIRE)}
                            className="w-5 h-5 rounded border-gray-300 text-green-500 focus:ring-green-500 cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{art?.NOM}</p>
                          <p className="text-xs text-gray-400">{art?.CODE}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{line.STOCK_THEORIQUE}</td>
                      <td className="px-4 py-3 text-center">
                        {currentInventaire.VALIDE ? (
                          <span className="font-medium">{line.STOCK_PHYSIQUE}</span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            value={line.STOCK_PHYSIQUE}
                            onChange={e => updateLine(line.IDLIGNEINVENTAIRE, Number(e.target.value))}
                            className="w-24 px-3 py-2 rounded-lg border text-center"
                          />
                        )}
                      </td>
                      <td className={`px-4 py-3 text-center font-bold ${line.ECART > 0 ? 'text-green-600' : line.ECART < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                        {line.ECART > 0 ? `+${line.ECART}` : line.ECART}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${value > 0 ? 'text-green-600' : value < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                        {formatAr(value)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <div className="text-sm text-gray-500">{currentLines.length} article(s)</div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Valeur totale des écarts</p>
              <p className={`text-xl font-bold ${totalEcartValeur >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatAr(totalEcartValeur)}</p>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={showConfirm}
        type="warning"
        title="Valider l’inventaire"
        message="Cette action va ajuster définitivement les stocks selon le stock physique saisi. Continuer ?"
        confirmText="Oui, valider"
        cancelText="Annuler"
        onConfirm={validateInventaire}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
