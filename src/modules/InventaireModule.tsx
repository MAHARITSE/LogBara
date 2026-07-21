import { useMemo, useState } from 'react';
import { ClipboardList, CheckCircle2, PlayCircle, Search, ArrowLeft, AlertTriangle } from 'lucide-react';
import { store } from '../store';
import { Personnel, Inventaire, LigneInventaire } from '../types';
import { nextId, nowTime, today, formatAr } from '../helpers';
import ConfirmModal from '../components/ConfirmModal';

interface Props { user: Personnel }

// Sous-composant : Fiche détail d'un inventaire
function InventaireDetail({ invId, user: _user, onBack }: { invId: number; user: Personnel; onBack: () => void }) {
  const [rk, setRk] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState('');

  const showMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  // Relire TOUT à chaque refresh
  const allInv = useMemo(() => store.getInventaires(), [rk]);
  const allLines = useMemo(() => store.getLignesInventaire(), [rk]);
  const articles = store.getArticles().filter(a => a.ACTIF && a.GERE_STOCK);

  const inv = allInv.find(i => i.IDINVENTAIRE === invId);
  const lines = allLines.filter(l => l.IDINVENTAIRE === invId);

  // Calcul des jours écoulés et droit de modification
  const daysSince = inv ? Math.floor((Date.now() - new Date(inv.DATE_INVENTAIRE + 'T00:00:00').getTime()) / 86400000) : 0;
  const isExpired = daysSince > 30;
  const canEdit = inv ? (!inv.VALIDE && !isExpired) : false;
  const daysLeft = 30 - daysSince;

  const filteredLines = useMemo(() => {
    if (!searchTerm) return lines;
    return lines.filter(line => {
      const art = articles.find(a => a.IDARTICLE === line.IDARTICLE);
      if (!art) return false;
      const s = searchTerm.toLowerCase();
      return art.NOM.toLowerCase().includes(s) || art.CODE.toLowerCase().includes(s);
    });
  }, [lines, articles, searchTerm]);

  const totalEcartValeur = lines.reduce((sum, l) => {
    const art = articles.find(a => a.IDARTICLE === l.IDARTICLE);
    return sum + l.ECART * (art?.PRIX_ACHAT || 0);
  }, 0);

  const checkedCount = lines.filter(l => l.CHECKED).length;

  // Modifier le stock physique
  const updateLine = (lineId: number, stockPhysique: number) => {
    if (!canEdit) return;
    const all = store.getLignesInventaire();
    const sp = Math.max(0, stockPhysique);
    store.setLignesInventaire(all.map(l =>
      l.IDLIGNEINVENTAIRE === lineId
        ? { ...l, STOCK_PHYSIQUE: sp, ECART: sp - l.STOCK_THEORIQUE, CHECKED: true }
        : l
    ));
    setRk(k => k + 1);
  };

  // Toggle checkbox vérifié
  const toggleChecked = (lineId: number) => {
    if (!canEdit) return;
    const all = store.getLignesInventaire();
    store.setLignesInventaire(all.map(l =>
      l.IDLIGNEINVENTAIRE === lineId ? { ...l, CHECKED: !l.CHECKED } : l
    ));
    setRk(k => k + 1);
  };

  // Valider définitivement
  const validateInventaire = () => {
    if (!inv || !canEdit) return;

    const invList = store.getInventaires();
    const lineList = store.getLignesInventaire();
    const artList = store.getArticles();
    const mvtList = store.getMouvements();
    const invLines = lineList.filter(l => l.IDINVENTAIRE === invId);

    // Marquer validé
    store.setInventaires(invList.map(i => i.IDINVENTAIRE === invId ? { ...i, VALIDE: true } : i));

    // Ajuster les stocks et créer les mouvements
    let mvtId = nextId(mvtList, 'IDMOUVEMENT');
    const newMvts = [...mvtList];

    const updatedArticles = artList.map(article => {
      const line = invLines.find(l => l.IDARTICLE === article.IDARTICLE);
      if (!line) return article;
      if (line.ECART !== 0) {
        newMvts.push({
          IDMOUVEMENT: mvtId++,
          DATE_MOUVEMENT: today(),
          HEURE: nowTime(),
          IDARTICLE: article.IDARTICLE,
          TYPE: 'Ajustement',
          QUANTITE: line.ECART,
          REFERENCE: `Inventaire #${invId}`,
        });
      }
      return { ...article, STOCK: line.STOCK_PHYSIQUE };
    });

    store.setArticles(updatedArticles);
    store.setMouvements(newMvts);
    setShowConfirm(false);
    setRk(k => k + 1);
    showMsg('Inventaire validé — stocks ajustés');
  };

  if (!inv) return <div className="text-center py-12 text-gray-400">Inventaire introuvable</div>;

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

      {/* Header avec retour */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2.5 rounded-xl border hover:bg-gray-50"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList size={24} /> Inventaire #{inv.IDINVENTAIRE}
              {inv.VALIDE && <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">Validé</span>}
              {!inv.VALIDE && isExpired && <span className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded-full">Expiré</span>}
              {canEdit && <span className="text-sm bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full">Modifiable ({daysLeft}j)</span>}
            </h1>
            <p className="text-sm text-gray-500">{inv.DATE_INVENTAIRE} {inv.HEURE} {inv.OBSERVATION ? `— ${inv.OBSERVATION}` : ''}</p>
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setShowConfirm(true)} className="bg-green-500 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-green-600 flex items-center gap-2">
            <CheckCircle2 size={18} /> Valider définitivement
          </button>
        )}
      </div>

      {/* Alerte expiration */}
      {!inv.VALIDE && isExpired && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
          <AlertTriangle size={20} />
          <p className="text-sm">Cet inventaire a dépassé 30 jours depuis sa création. Il n'est plus modifiable. Démarrez un nouvel inventaire.</p>
        </div>
      )}

      {/* Alerte bientôt expiration */}
      {canEdit && daysLeft <= 5 && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-3 text-orange-700">
          <AlertTriangle size={20} />
          <p className="text-sm font-medium">Attention : il reste {daysLeft} jour(s) pour modifier et valider cet inventaire.</p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">Articles</p>
          <p className="text-2xl font-bold">{lines.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">Vérifiés</p>
          <p className="text-2xl font-bold text-green-600">{checkedCount}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">Écarts</p>
          <p className="text-2xl font-bold text-orange-500">{lines.filter(l => l.ECART !== 0).length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">Valeur écarts</p>
          <p className={`text-2xl font-bold ${totalEcartValeur >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatAr(totalEcartValeur)}</p>
        </div>
      </div>

      {/* Recherche */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Rechercher un article..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border" />
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 w-12">✓</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Article</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-28">Théorique</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-36">Physique</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-24">Écart</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 w-32">Valeur</th>
              </tr>
            </thead>
            <tbody>
              {filteredLines.map(line => {
                const art = articles.find(a => a.IDARTICLE === line.IDARTICLE);
                const value = line.ECART * (art?.PRIX_ACHAT || 0);
                return (
                  <tr key={line.IDLIGNEINVENTAIRE} className={`border-t border-gray-50 hover:bg-gray-50 ${line.CHECKED ? 'bg-green-50/60' : ''}`}>
                    <td className="px-3 py-3 text-center">
                      {canEdit ? (
                        <input
                          type="checkbox"
                          checked={line.CHECKED}
                          onChange={() => toggleChecked(line.IDLIGNEINVENTAIRE)}
                          className="w-5 h-5 rounded border-gray-300 text-green-500 focus:ring-green-500 cursor-pointer accent-green-500"
                        />
                      ) : (
                        <span className={`text-lg ${line.CHECKED ? 'text-green-500' : 'text-gray-300'}`}>{line.CHECKED ? '✓' : '○'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{art?.EMOJI} {art?.NOM}</p>
                      <p className="text-xs text-gray-400">{art?.CODE}</p>
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-gray-600">{line.STOCK_THEORIQUE}</td>
                    <td className="px-4 py-3 text-center">
                      {canEdit ? (
                        <input
                          type="number"
                          min={0}
                          value={line.STOCK_PHYSIQUE}
                          onChange={e => updateLine(line.IDLIGNEINVENTAIRE, parseInt(e.target.value) || 0)}
                          onFocus={e => e.target.select()}
                          className="w-28 px-3 py-2 rounded-lg border border-gray-300 text-center font-semibold focus:ring-2 focus:ring-[#0D47A1] focus:border-transparent"
                        />
                      ) : (
                        <span className="font-medium">{line.STOCK_PHYSIQUE}</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-center font-bold ${line.ECART > 0 ? 'text-green-600' : line.ECART < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {line.ECART > 0 ? `+${line.ECART}` : line.ECART}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold text-sm ${value > 0 ? 'text-green-600' : value < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {formatAr(value)}
                    </td>
                  </tr>
                );
              })}
              {filteredLines.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">Aucun article trouvé</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {checkedCount}/{lines.length} vérifié(s) — {lines.filter(l => l.ECART !== 0).length} écart(s)
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Valeur totale des écarts</p>
            <p className={`text-xl font-bold ${totalEcartValeur >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatAr(totalEcartValeur)}</p>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showConfirm}
        type="warning"
        title="Valider l'inventaire"
        message="Les stocks seront ajustés selon le stock physique saisi. Cette action est irréversible. Continuer ?"
        confirmText="Oui, valider"
        cancelText="Annuler"
        onConfirm={validateInventaire}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}

// Composant principal : Liste des inventaires
export default function InventaireModule({ user }: Props) {
  const [rk, setRk] = useState(0);
  const [openInvId, setOpenInvId] = useState<number | null>(null);
  const [observation, setObservation] = useState('');
  const [toast, setToast] = useState('');

  const inventaires = useMemo(() => store.getInventaires(), [rk]);
  const articles = store.getArticles().filter(a => a.ACTIF && a.GERE_STOCK);

  const showMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const daysSince = (dateStr: string): number => Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000);

  const getStatus = (inv: Inventaire) => {
    if (inv.VALIDE) return { label: 'Validé', color: 'bg-green-100 text-green-700' };
    const d = daysSince(inv.DATE_INVENTAIRE);
    if (d > 30) return { label: 'Expiré', color: 'bg-red-100 text-red-700' };
    return { label: `En cours (${30 - d}j)`, color: 'bg-yellow-100 text-yellow-700' };
  };

  // Démarrer un inventaire et l'ouvrir
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
    setObservation('');
    setRk(k => k + 1);
    showMsg('Inventaire créé');

    // Ouvrir la fiche dans la page dédiée
    setOpenInvId(idInventaire);
  };

  // Si un inventaire est ouvert, afficher la page dédiée
  if (openInvId !== null) {
    return (
      <InventaireDetail
        invId={openInvId}
        user={user}
        onBack={() => { setOpenInvId(null); setRk(k => k + 1); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">📋 Inventaire</h1>
        <button onClick={startInventaire} className="bg-[#0D47A1] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium hover:bg-[#1565C0]">
          <PlayCircle size={18} /> Démarrer un inventaire
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Inventaires total</p>
          <p className="text-2xl font-bold">{inventaires.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Validés</p>
          <p className="text-2xl font-bold text-green-600">{inventaires.filter(i => i.VALIDE).length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Articles stockés</p>
          <p className="text-2xl font-bold text-[#0D47A1]">{articles.length}</p>
        </div>
      </div>

      {/* Observation */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <label className="text-sm font-medium text-gray-700 mb-1 block">Observation / assistants (prochain inventaire)</label>
        <input value={observation} onChange={e => setObservation(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border" placeholder="Ex: Assistants: Jean, Paul" />
      </div>

      {/* Historique */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Historique des inventaires</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Observation</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Statut</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {[...inventaires].sort((a, b) => b.IDINVENTAIRE - a.IDINVENTAIRE).map(inv => {
                const status = getStatus(inv);
                return (
                  <tr key={inv.IDINVENTAIRE} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">#{inv.IDINVENTAIRE}</td>
                    <td className="px-4 py-3 text-sm">{inv.DATE_INVENTAIRE} {inv.HEURE}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{inv.OBSERVATION || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full ${status.color}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setOpenInvId(inv.IDINVENTAIRE)} className="px-4 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200">
                        Ouvrir
                      </button>
                    </td>
                  </tr>
                );
              })}
              {inventaires.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400">Aucun inventaire</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
