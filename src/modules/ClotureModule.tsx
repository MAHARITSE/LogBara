import { useState, useMemo } from 'react';
import { Lock, AlertTriangle, Printer, Check } from 'lucide-react';
import { store } from '../store';
import { Personnel } from '../types';
import { formatAr, today, nowTime, nextId } from '../helpers';
import { printTicket } from '../components/PrintTicket';
import ConfirmModal from '../components/ConfirmModal';

interface Props {
  user: Personnel;
}

export default function ClotureModule({ user }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState('');

  const ventes = store.getVentes();
  const paiements = store.getPaiements();
  const clotures = store.getClotures();
  const clients = store.getClients();
  const achats = store.getAchats();
  const tables = store.getTables();

  const isAdmin = user.ROLE === 'Administrateur';

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // Vérifier si déjà clôturé aujourd'hui
  const alreadyClosed = clotures.some(
    c => c.DATE_CLOTURE === today() && c.IDPERSONNEL === user.IDPERSONNEL
  );

  // Tables non payées
  const tablesNonPayees = tables.filter(
    t => t.ETAT === 'Occupée' && t.IDCAISSIER === user.IDPERSONNEL
  );

  // Calculs
  const stats = useMemo(() => {
    const ventesJour = ventes.filter(
      v => v.DATE_VENTE === today() && v.IDPERSONNEL === user.IDPERSONNEL && v.STATUT === 'Payée' && !v.CLOTUREE
    );

    const paiementsJour = paiements.filter(
      p => p.DATE_PAIEMENT === today() && p.IDPERSONNEL === user.IDPERSONNEL &&
        ventesJour.some(v => v.IDVENTE === p.IDVENTE)
    );

    const totalVentes = ventesJour.reduce((s, v) => s + v.TOTAL - v.REMISE, 0);
    const totalRemises = ventesJour.reduce((s, v) => s + v.REMISE, 0);
    const nbVentes = ventesJour.length;

    const totalEspeces = paiementsJour.filter(p => p.MODE_PAIEMENT === 'Espèces').reduce((s, p) => s + p.MONTANT, 0);
    const totalMobile = paiementsJour.filter(p => p.MODE_PAIEMENT === 'Mobile Money').reduce((s, p) => s + p.MONTANT, 0);
    
    const creditsJour = paiementsJour.filter(p => p.MODE_PAIEMENT === 'Crédit');
    const totalCredit = creditsJour.reduce((s, p) => s + p.MONTANT, 0);

    // Détails crédits par client
    const creditDetails: { client: string; montant: number }[] = [];
    creditsJour.forEach(p => {
      const client = clients.find(c => c.IDCLIENT === p.IDCLIENT);
      const existing = creditDetails.find(d => d.client === (client?.NOM_CLIENT || 'Inconnu'));
      if (existing) {
        existing.montant += p.MONTANT;
      } else {
        creditDetails.push({ client: client?.NOM_CLIENT || 'Inconnu', montant: p.MONTANT });
      }
    });

    // Remboursements reçus (paiements sans vente)
    const remboursements = paiements.filter(
      p => p.DATE_PAIEMENT === today() && p.IDPERSONNEL === user.IDPERSONNEL && !p.IDVENTE
    );
    const totalRemboursements = remboursements.reduce((s, p) => s + p.MONTANT, 0);

    // Détails remboursements par client
    const remboursementDetails: { client: string; montant: number }[] = [];
    remboursements.forEach(p => {
      const client = clients.find(c => c.IDCLIENT === p.IDCLIENT);
      const nom = client?.NOM_CLIENT || 'Inconnu';
      const existing = remboursementDetails.find(d => d.client === nom);
      if (existing) { existing.montant += p.MONTANT; }
      else { remboursementDetails.push({ client: nom, montant: p.MONTANT }); }
    });

    // Achats du jour
    const achatsJour = achats.filter(
      a => a.DATE_ACHAT === today() && !a.CLOTUREE
    );
    const totalAchats = achatsJour.reduce((s, a) => s + a.TOTAL, 0);

    // Espèces attendues
    const especesAttendues = totalEspeces + totalRemboursements - totalAchats;

    return {
      totalVentes,
      totalRemises,
      nbVentes,
      totalEspeces,
      totalMobile,
      totalCredit,
      creditDetails,
      totalRemboursements,
      remboursementDetails,
      totalAchats,
      especesAttendues,
      ventesJour,
      achatsJour,
    };
  }, [ventes, paiements, clients, achats, user.IDPERSONNEL]);

  // Effectuer la clôture
  const handleCloture = () => {
    if (tablesNonPayees.length > 0) {
      showMsg('Impossible de clôturer avec des tables non payées');
      return;
    }

    const idCloture = nextId(clotures, 'IDCLOTURE');

    const newCloture = {
      IDCLOTURE: idCloture,
      DATE_CLOTURE: today(),
      HEURE: nowTime(),
      IDPERSONNEL: user.IDPERSONNEL,
      TOTAL_VENTES: stats.totalVentes,
      TOTAL_REMISES: stats.totalRemises,
      TOTAL_ESPECES: stats.totalEspeces,
      TOTAL_MOBILE: stats.totalMobile,
      TOTAL_CREDIT: stats.totalCredit,
      TOTAL_REMBOURSEMENTS: stats.totalRemboursements,
      NB_VENTES: stats.nbVentes,
    };

    // Marquer les ventes comme clôturées
    const updatedVentes = ventes.map(v =>
      stats.ventesJour.some(vj => vj.IDVENTE === v.IDVENTE)
        ? { ...v, CLOTUREE: true, IDCLOTURE: idCloture }
        : v
    );

    // Marquer les achats comme clôturés
    const updatedAchats = achats.map(a =>
      stats.achatsJour.some(aj => aj.IDACHAT === a.IDACHAT)
        ? { ...a, CLOTUREE: true, IDCLOTURE: idCloture }
        : a
    );

    store.setClotures([...clotures, newCloture]);
    store.setVentes(updatedVentes);
    store.setAchats(updatedAchats);

    setShowConfirm(false);
    showMsg('Caisse clôturée avec succès !');

    // Imprimer un seul ticket : clôture + récap par article
    printClotureComplete(newCloture);
  };

  // Ticket unique : clôture + récap ventes par article
  const printClotureComplete = (cloture: typeof clotures[0]) => {
    // Récap par article
    const freshVentes = store.getVentes();
    const allArticles = store.getArticles();
    const allLignes = store.getLignesVente();
    const ventesJour = freshVentes.filter(
      v => v.DATE_VENTE === today() && v.IDPERSONNEL === user.IDPERSONNEL && v.STATUT === 'Payée'
    );
    const lignesJour = allLignes.filter(l => ventesJour.some(v => v.IDVENTE === l.IDVENTE));

    const tcd: Record<number, { nom: string; qte: number; montant: number }> = {};
    lignesJour.forEach(l => {
      const art = allArticles.find(a => a.IDARTICLE === l.IDARTICLE);
      if (!tcd[l.IDARTICLE]) tcd[l.IDARTICLE] = { nom: art?.NOM || '-', qte: 0, montant: 0 };
      tcd[l.IDARTICLE].qte += l.QUANTITE;
      tcd[l.IDARTICLE].montant += l.MONTANT;
    });

    const artRows = Object.values(tcd)
      .sort((a, b) => b.montant - a.montant)
      .map(r => `<tr><td>${r.nom}</td><td class="right">${r.qte}</td><td class="right">${formatAr(r.montant)}</td></tr>`)
      .join('');
    const totalQte = Object.values(tcd).reduce((s, r) => s + r.qte, 0);
    const totalMontant = Object.values(tcd).reduce((s, r) => s + r.montant, 0);

    printTicket(`
      <div class="center bold">CLOTURE DE CAISSE</div>
      <div class="row"><span>${cloture.DATE_CLOTURE}</span><span>${cloture.HEURE}</span></div>
      <div>Caissier: ${user.PRENOM} ${user.NOM}</div>
      <div class="line"></div>

      <div class="row"><span>Nombre de ventes</span><span>${cloture.NB_VENTES}</span></div>
      <div class="row"><span>Total ventes</span><span>${formatAr(cloture.TOTAL_VENTES)}</span></div>
      <div class="row"><span>Remises accordees</span><span>-${formatAr(cloture.TOTAL_REMISES)}</span></div>
      <div class="line"></div>

      <div class="bold">Detail des paiements:</div>
      <div class="row"><span>Especes</span><span>${formatAr(cloture.TOTAL_ESPECES)}</span></div>
      <div class="row"><span>Mobile Money</span><span>${formatAr(cloture.TOTAL_MOBILE)}</span></div>
      <div class="row"><span>Credits</span><span>${formatAr(cloture.TOTAL_CREDIT)}</span></div>
      ${cloture.TOTAL_REMBOURSEMENTS > 0 ? `<div class="row"><span>Remboursements</span><span>${formatAr(cloture.TOTAL_REMBOURSEMENTS)}</span></div>` : ''}
      <div class="line"></div>

      <div class="row bold"><span>ESPECES ATTENDUES</span><span>${formatAr(cloture.TOTAL_ESPECES + cloture.TOTAL_REMBOURSEMENTS)}</span></div>
      <div class="line"></div>
      <br/>

      <div class="center bold">RECAP VENTES PAR ARTICLE</div>
      <div class="line"></div>
      <table>
        <tr><td class="bold">Article</td><td class="bold right">Qte</td><td class="bold right">Montant</td></tr>
        ${artRows}
      </table>
      <div class="line"></div>
      <div class="row"><span>Total articles</span><span>${totalQte}</span></div>
      <div class="row bold"><span>TOTAL</span><span>${formatAr(totalMontant)}</span></div>
    `);
  };

  // Réutilisé par l'historique admin
  const printCloture = (cloture: typeof clotures[0]) => {
    printClotureComplete(cloture);
  };

  // Admin: Historique des clôtures
  if (isAdmin) {
    return (
      <div className="space-y-6">
        {toast && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50">{toast}</div>}

        <h1 className="text-2xl font-bold text-gray-900">📜 Historique des clôtures</h1>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Caissier</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Ventes</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Remises</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Espèces</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Mobile</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Crédits</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clotures.sort((a, b) => b.IDCLOTURE - a.IDCLOTURE).map(c => {
                  const caissier = store.getPersonnel().find(p => p.IDPERSONNEL === c.IDPERSONNEL);
                  return (
                    <tr key={c.IDCLOTURE} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{c.DATE_CLOTURE} {c.HEURE}</td>
                      <td className="px-4 py-3 text-sm">{caissier?.PRENOM} {caissier?.NOM}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatAr(c.TOTAL_VENTES)}</td>
                      <td className="px-4 py-3 text-right text-red-500">-{formatAr(c.TOTAL_REMISES)}</td>
                      <td className="px-4 py-3 text-right">{formatAr(c.TOTAL_ESPECES)}</td>
                      <td className="px-4 py-3 text-right">{formatAr(c.TOTAL_MOBILE)}</td>
                      <td className="px-4 py-3 text-right">{formatAr(c.TOTAL_CREDIT)}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => printCloture(c)}
                          className="p-1.5 rounded-lg hover:bg-gray-100"
                          title="Imprimer"
                        >
                          <Printer size={16} className="text-gray-500" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {clotures.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">
                      Aucune clôture
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Caissier/Gérant: Interface de clôture
  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50">{toast}</div>}

      <h1 className="text-2xl font-bold text-gray-900">🔒 Clôture de caisse</h1>

      {alreadyClosed ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <Check size={48} className="mx-auto text-green-500 mb-4" />
          <h2 className="text-xl font-bold text-green-700 mb-2">Caisse déjà clôturée</h2>
          <p className="text-green-600">Vous avez déjà effectué votre clôture aujourd'hui.</p>
        </div>
      ) : (
        <>
          {/* Alertes */}
          {tablesNonPayees.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="text-yellow-500" size={24} />
              <div>
                <p className="font-medium text-yellow-700">Tables non payées</p>
                <p className="text-sm text-yellow-600">
                  {tablesNonPayees.length} table(s) occupée(s) : {tablesNonPayees.map(t => t.DESCRIPTION).join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Résumé */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Nombre de ventes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.nbVentes}</p>
            </div>
            
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Total des ventes</p>
              <p className="text-2xl font-bold text-[#0D47A1]">{formatAr(stats.totalVentes)}</p>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Remises accordées</p>
              <p className="text-2xl font-bold text-red-500">-{formatAr(stats.totalRemises)}</p>
            </div>
          </div>

          {/* Détail des paiements */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg mb-4">💳 Détail des paiements</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">💵 Espèces</span>
                <span className="font-semibold">{formatAr(stats.totalEspeces)}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">📱 Mobile Money</span>
                <span className="font-semibold">{formatAr(stats.totalMobile)}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">📝 Crédits</span>
                <span className="font-semibold">{formatAr(stats.totalCredit)}</span>
              </div>

              {stats.creditDetails.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 mt-2">
                  <p className="text-xs text-gray-500 mb-2">Détail des crédits:</p>
                  {stats.creditDetails.map((d, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{d.client}</span>
                      <span>{formatAr(d.montant)}</span>
                    </div>
                  ))}
                </div>
              )}

              {stats.totalRemboursements > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">🔄 Remboursements reçus</span>
                  <span className="font-semibold text-green-500">+{formatAr(stats.totalRemboursements)}</span>
                </div>
              )}

              {stats.remboursementDetails.length > 0 && (
                <div className="bg-green-50 rounded-lg p-3 mt-2">
                  <p className="text-xs text-gray-500 mb-2">Détail des remboursements:</p>
                  {stats.remboursementDetails.map((d, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-green-700">{d.client}</span>
                      <span className="font-semibold text-green-600">+{formatAr(d.montant)}</span>
                    </div>
                  ))}
                </div>
              )}

              {stats.totalAchats > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">🛒 Achats du jour</span>
                  <span className="font-semibold text-red-500">-{formatAr(stats.totalAchats)}</span>
                </div>
              )}
            </div>

            <div className="mt-6 bg-[#0D47A1] text-white rounded-xl p-4">
              <div className="flex justify-between text-lg">
                <span>Espèces attendues</span>
                <span className="font-bold">{formatAr(stats.especesAttendues)}</span>
              </div>
            </div>
          </div>

          {/* Bouton clôture */}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={tablesNonPayees.length > 0 || stats.nbVentes === 0}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Lock size={24} />
            Clôturer la caisse
          </button>

          {/* Récap ventes par article */}
          {stats.ventesJour.length > 0 && (() => {
            const allArticles = store.getArticles();
            const allLignes = store.getLignesVente();
            const lignesJour = allLignes.filter(l => stats.ventesJour.some(v => v.IDVENTE === l.IDVENTE));
            const tcd: Record<number, { nom: string; emoji: string; qte: number; montant: number }> = {};
            lignesJour.forEach(l => {
              const art = allArticles.find(a => a.IDARTICLE === l.IDARTICLE);
              if (!tcd[l.IDARTICLE]) tcd[l.IDARTICLE] = { nom: art?.NOM || '-', emoji: art?.EMOJI || '📦', qte: 0, montant: 0 };
              tcd[l.IDARTICLE].qte += l.QUANTITE;
              tcd[l.IDARTICLE].montant += l.MONTANT;
            });
            const sorted = Object.values(tcd).sort((a, b) => b.montant - a.montant);
            const totalQte = sorted.reduce((s, r) => s + r.qte, 0);
            const totalMontant = sorted.reduce((s, r) => s + r.montant, 0);

            return (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">🧾 Récap ventes par article ({stats.nbVentes} vente{stats.nbVentes > 1 ? 's' : ''})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Article</th>
                        <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 w-24">Qté vendue</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 w-32">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((r, i) => (
                        <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-sm font-medium">{r.emoji} {r.nom}</td>
                          <td className="px-4 py-2.5 text-center font-semibold">{r.qte}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-[#0D47A1]">{formatAr(r.montant)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr className="border-t-2 border-gray-200">
                        <td className="px-4 py-3 font-bold text-sm">TOTAL</td>
                        <td className="px-4 py-3 text-center font-bold">{totalQte}</td>
                        <td className="px-4 py-3 text-right font-bold text-[#0D47A1] text-lg">{formatAr(totalMontant)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}
        </>
      )}

      <ConfirmModal
        open={showConfirm}
        type="warning"
        title="Confirmer la clôture"
        message="Cette action est irréversible. Voulez-vous vraiment clôturer la caisse ?"
        confirmText="Oui, clôturer"
        cancelText="Non"
        onConfirm={handleCloture}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
