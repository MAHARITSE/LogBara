import { useState } from 'react';
import { Receipt, XCircle, Printer, BarChart3, RotateCcw } from 'lucide-react';
import { store } from '../store';
import { Personnel, Vente, LigneVente } from '../types';
import { formatAr, dateLabel, today, nowTime, nextId } from '../helpers';
import { printTicket } from '../components/PrintTicket';
import ConfirmModal from '../components/ConfirmModal';

interface Props { user: Personnel }

export default function Ventes({ user }: Props) {
  const [confirmCancel, setConfirmCancel] = useState<Vente | null>(null);
  const [showReturnModal, setShowReturnModal] = useState<Vente | null>(null);
  const [returnItems, setReturnItems] = useState<Record<number, number>>({});
  const [toast, setToast] = useState('');

  const ventes = store.getVentes();
  const lignesVente = store.getLignesVente();
  const personnel = store.getPersonnel();
  const articles = store.getArticles();
  const paiements = store.getPaiements();

  const isAdmin = user.ROLE === 'Administrateur';
  const isGerant = user.ROLE === 'Gérant';
  const isCaissier = user.ROLE === 'Caissier';

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // Ventes visibles
  const visibleVentes = ventes.filter(v => {
    if (isAdmin || isGerant) return true;
    if (isCaissier) return v.IDPERSONNEL === user.IDPERSONNEL && v.STATUT === 'Payée' && !v.CLOTUREE;
    return false;
  }).sort((a, b) => b.IDVENTE - a.IDVENTE);

  // Stats par caissier (Admin/Gérant)
  const caissierStats = (isAdmin || isGerant) ? personnel
    .filter(p => ['Caissier', 'Gérant'].includes(p.ROLE))
    .map(p => {
      const pVentes = ventes.filter(v => v.IDPERSONNEL === p.IDPERSONNEL && v.STATUT === 'Payée' && v.DATE_VENTE === today());
      const ca = pVentes.reduce((s, v) => s + v.TOTAL - v.REMISE, 0);
      const cancelled = ventes.filter(v => v.IDPERSONNEL === p.IDPERSONNEL && v.STATUT === 'Annulée' && v.DATE_VENTE === today()).length;
      return { ...p, ca, nbVentes: pVentes.length, cancelled };
    })
    .filter(p => p.ca > 0 || p.nbVentes > 0)
  : [];

  const cancelVente = () => {
    if (!confirmCancel) return;
    const updatedVentes = ventes.map(v =>
      v.IDVENTE === confirmCancel.IDVENTE ? { ...v, STATUT: 'Annulée' as const } : v
    );
    store.setVentes(updatedVentes);

    // Restaurer le stock
    const lignes = lignesVente.filter(l => l.IDVENTE === confirmCancel.IDVENTE);
    const artList = store.getArticles();
    const mvts = store.getMouvements();
    let mvtId = nextId(mvts, 'IDMOUVEMENT');
    const newMvts = [...mvts];

    const updatedArts = artList.map(a => {
      const ligne = lignes.find(l => l.IDARTICLE === a.IDARTICLE);
      if (ligne && a.GERE_STOCK) {
        newMvts.push({
          IDMOUVEMENT: mvtId++,
          DATE_MOUVEMENT: today(),
          HEURE: nowTime(),
          IDARTICLE: a.IDARTICLE,
          TYPE: 'Entrée' as const,
          QUANTITE: ligne.QUANTITE,
          REFERENCE: `Annulation ${confirmCancel.NUMERO_FACTURE}`,
        });
        return { ...a, STOCK: a.STOCK + ligne.QUANTITE };
      }
      return a;
    });

    store.setArticles(updatedArts);
    store.setMouvements(newMvts);

    setConfirmCancel(null);
    showMsg('Vente annulée');
  };

  // Retour partiel d'articles
  const handleReturn = () => {
    if (!showReturnModal) return;

    const venteLignes = lignesVente.filter(l => l.IDVENTE === showReturnModal.IDVENTE);
    const artList = store.getArticles();
    const mvts = store.getMouvements();
    let mvtId = nextId(mvts, 'IDMOUVEMENT');
    const newMvts = [...mvts];
    const updatedArts = [...artList];
    let updatedLignes = [...lignesVente];
    
    let totalReturned = 0;

    Object.entries(returnItems).forEach(([ligneId, returnQty]) => {
      if (returnQty <= 0) return;

      const ligne = venteLignes.find(l => l.IDLIGNEVENTE === Number(ligneId));
      if (!ligne) return;

      const article = artList.find(a => a.IDARTICLE === ligne.IDARTICLE);
      if (!article) return;

      // Mettre à jour la ligne de vente
      const ligneIdx = updatedLignes.findIndex(l => l.IDLIGNEVENTE === ligne.IDLIGNEVENTE);
      if (ligneIdx >= 0) {
        const newQty = updatedLignes[ligneIdx].QUANTITE - returnQty;
        if (newQty <= 0) {
          updatedLignes = updatedLignes.filter(l => l.IDLIGNEVENTE !== ligne.IDLIGNEVENTE);
        } else {
          updatedLignes[ligneIdx] = {
            ...updatedLignes[ligneIdx],
            QUANTITE: newQty,
            MONTANT: newQty * ligne.PRIX_UNITAIRE,
          };
        }
      }

      // Restaurer le stock si géré
      if (article.GERE_STOCK) {
        const artIdx = updatedArts.findIndex(a => a.IDARTICLE === article.IDARTICLE);
        if (artIdx >= 0) {
          updatedArts[artIdx] = {
            ...updatedArts[artIdx],
            STOCK: updatedArts[artIdx].STOCK + returnQty,
          };
        }

        newMvts.push({
          IDMOUVEMENT: mvtId++,
          DATE_MOUVEMENT: today(),
          HEURE: nowTime(),
          IDARTICLE: article.IDARTICLE,
          TYPE: 'Entrée' as const,
          QUANTITE: returnQty,
          REFERENCE: `Retour ${showReturnModal.NUMERO_FACTURE} — ${user.PRENOM} ${user.NOM}`,
        });
      }

      totalReturned += returnQty * ligne.PRIX_UNITAIRE;
    });

    // Mettre à jour le total de la vente
    const newTotal = updatedLignes
      .filter(l => l.IDVENTE === showReturnModal.IDVENTE)
      .reduce((s, l) => s + l.MONTANT, 0);

    const updatedVentes = ventes.map(v =>
      v.IDVENTE === showReturnModal.IDVENTE
        ? { ...v, TOTAL: newTotal }
        : v
    );

    store.setLignesVente(updatedLignes);
    store.setArticles(updatedArts);
    store.setMouvements(newMvts);
    store.setVentes(updatedVentes);

    setShowReturnModal(null);
    setReturnItems({});
    showMsg(`Retour effectué: ${formatAr(totalReturned)} déduit`);
  };

  const printVente = (vente: Vente) => {
    const lignes = lignesVente.filter(l => l.IDVENTE === vente.IDVENTE);
    const caissier = personnel.find(p => p.IDPERSONNEL === vente.IDPERSONNEL);

    const rows = lignes.map(l => {
      const art = articles.find(a => a.IDARTICLE === l.IDARTICLE);
      return `<tr><td>${art?.NOM || '-'}</td><td style="text-align:right">${l.QUANTITE}</td><td style="text-align:right">${formatAr(l.PRIX_UNITAIRE)}</td><td style="text-align:right">${formatAr(l.MONTANT)}</td></tr>`;
    }).join('');

    printTicket(`
      <div class="center bold">FACTURE</div>
      <div class="center">${vente.NUMERO_FACTURE}</div>
      <div class="row"><span>${vente.DATE_VENTE}</span><span>${vente.HEURE}</span></div>
      <div>Caissier: ${caissier?.PRENOM} ${caissier?.NOM}</div>
      <div>Type: ${vente.TYPE}</div>
      <div class="line"></div>
      <table>
        <tr><td class="bold">Article</td><td class="bold right">Qté</td><td class="bold right">PU</td><td class="bold right">Mt</td></tr>
        ${rows}
      </table>
      <div class="line"></div>
      <div class="row"><span>Sous-total</span><span>${formatAr(vente.TOTAL)}</span></div>
      ${vente.REMISE > 0 ? `<div class="row"><span>Remise</span><span>-${formatAr(vente.REMISE)}</span></div>` : ''}
      <div class="row bold"><span>TOTAL</span><span>${formatAr(vente.TOTAL - vente.REMISE)}</span></div>
    `, 'Facture');
  };

  const getStatusBadge = (statut: string) => {
    const colors: Record<string, string> = {
      'Payée': 'bg-green-100 text-green-700',
      'Annulée': 'bg-red-100 text-red-700',
      'En cours': 'bg-yellow-100 text-yellow-700',
    };
    return colors[statut] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-[60] animate-pulse">{toast}</div>}

      <h1 className="text-2xl font-bold text-gray-900">🧾 Ventes</h1>

      {/* Stats par caissier */}
      {caissierStats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {caissierStats.map(p => (
            <div key={p.IDPERSONNEL} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <p className="font-medium">{p.PRENOM} {p.NOM}</p>
                  <p className="text-xs text-gray-500">{p.ROLE}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <p className="font-bold text-[#0D47A1]">{formatAr(p.ca)}</p>
                  <p className="text-xs text-gray-400">CA</p>
                </div>
                <div>
                  <p className="font-bold text-green-600">{p.nbVentes}</p>
                  <p className="text-xs text-gray-400">Ventes</p>
                </div>
                <div>
                  <p className="font-bold text-red-500">{p.cancelled}</p>
                  <p className="text-xs text-gray-400">Annulées</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isCaissier && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-blue-700 text-sm">ℹ️ Vous voyez uniquement vos ventes payées non clôturées du jour.</p>
        </div>
      )}

      {/* Liste des ventes */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">N° Facture</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Heure</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Caissier</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleVentes.map((v, i) => {
                const caissier = personnel.find(p => p.IDPERSONNEL === v.IDPERSONNEL);
                return (
                  <tr key={v.IDVENTE} className={`border-t border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-3 font-medium text-sm">{v.NUMERO_FACTURE}</td>
                    <td className="px-4 py-3 text-sm">{dateLabel(v.DATE_VENTE)}</td>
                    <td className="px-4 py-3 text-sm">{v.HEURE}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${v.TYPE === 'Comptoir' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        {v.TYPE}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{caissier?.PRENOM || '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#0D47A1]">{formatAr(v.TOTAL - v.REMISE)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(v.STATUT)}`}>
                        {v.STATUT}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => printVente(v)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Imprimer">
                          <Printer size={16} className="text-gray-500" />
                        </button>
                        {(isAdmin || isGerant) && v.STATUT === 'Payée' && (
                          <>
                            <button 
                              onClick={() => { setReturnItems({}); setShowReturnModal(v); }}
                              className="p-1.5 rounded-lg hover:bg-orange-50" 
                              title="Retour article"
                            >
                              <RotateCcw size={16} className="text-orange-500" />
                            </button>
                            {isAdmin && (
                              <button onClick={() => setConfirmCancel(v)} className="p-1.5 rounded-lg hover:bg-red-50" title="Annuler">
                                <XCircle size={16} className="text-red-500" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleVentes.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">Aucune vente</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Retour Article */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowReturnModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-orange-500 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <RotateCcw size={20} /> Retour Article - {showReturnModal.NUMERO_FACTURE}
              </h3>
              <button onClick={() => setShowReturnModal(null)} className="text-white">✕</button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {lignesVente.filter(l => l.IDVENTE === showReturnModal.IDVENTE).map(ligne => {
                const article = articles.find(a => a.IDARTICLE === ligne.IDARTICLE);
                const currentReturn = returnItems[ligne.IDLIGNEVENTE] || 0;

                return (
                  <div key={ligne.IDLIGNEVENTE} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">{article?.EMOJI} {article?.NOM}</p>
                        <p className="text-sm text-gray-500">
                          {ligne.QUANTITE} x {formatAr(ligne.PRIX_UNITAIRE)}
                        </p>
                      </div>
                      <p className="font-bold text-[#0D47A1]">{formatAr(ligne.MONTANT)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">Retourner:</span>
                      <input
                        type="number"
                        min="0"
                        max={ligne.QUANTITE}
                        value={currentReturn}
                        onChange={e => setReturnItems({
                          ...returnItems,
                          [ligne.IDLIGNEVENTE]: Math.min(
                            Math.max(0, Number(e.target.value)),
                            ligne.QUANTITE
                          )
                        })}
                        className="w-20 text-center border rounded-lg px-2 py-1"
                      />
                      <span className="text-sm text-gray-400">/ {ligne.QUANTITE}</span>
                    </div>
                  </div>
                );
              })}

              {Object.values(returnItems).some(v => v > 0) && (
                <div className="bg-orange-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-orange-600">Montant à rembourser</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatAr(
                      Object.entries(returnItems).reduce((sum, [ligneId, qty]) => {
                        const ligne = lignesVente.find(l => l.IDLIGNEVENTE === Number(ligneId));
                        return sum + (ligne ? qty * ligne.PRIX_UNITAIRE : 0);
                      }, 0)
                    )}
                  </p>
                </div>
              )}

              <button
                onClick={handleReturn}
                disabled={!Object.values(returnItems).some(v => v > 0)}
                className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50"
              >
                Confirmer le retour
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmCancel}
        type="danger"
        title="Annuler la vente"
        message={`Voulez-vous vraiment annuler la vente ${confirmCancel?.NUMERO_FACTURE} ? Le stock sera restauré.`}
        confirmText="Oui, annuler"
        cancelText="Non"
        onConfirm={cancelVente}
        onCancel={() => setConfirmCancel(null)}
      />
    </div>
  );
}
