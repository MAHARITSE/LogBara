import { useState, useMemo } from 'react';
import { Lock, AlertTriangle, Printer, Clock } from 'lucide-react';
import { store } from '../store';
import { Personnel, Cloture } from '../types';
import { formatAr, today, nowTime, nextId } from '../helpers';
import { printClotureTicket, buildSocieteHeaderHtml } from '../components/PrintTicket';
import ConfirmModal from '../components/ConfirmModal';

interface Props {
  user: Personnel;
  onLogout?: () => void;
}

/**
 * Une opération (horodatée date + heure) est-elle postérieure à une clôture ?
 * Sans clôture de référence, tout est considéré comme postérieur.
 */
const isAfterCloture = (date: string, heure: string | undefined, ref?: Cloture): boolean => {
  if (!ref) return true;
  if (date !== ref.DATE_CLOTURE) return date > ref.DATE_CLOTURE;
  return (heure || '') > (ref.HEURE || '');
};

/** Dernière clôture (par IDCLOTURE) d'une liste, éventuellement filtrée par caissier. */
const lastClotureOf = (list: Cloture[], idPersonnel?: number): Cloture | undefined =>
  list
    .filter(c => idPersonnel === undefined || c.IDPERSONNEL === idPersonnel)
    .reduce<Cloture | undefined>((last, c) => (!last || c.IDCLOTURE > last.IDCLOTURE ? c : last), undefined);

export default function ClotureModule({ user, onLogout }: Props) {
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
  // ---------------------------------------------------------------------------
  // RATTACHEMENT À LA CLÔTURE (anti-vol) :
  // On ne sélectionne plus « les opérations d'aujourd'hui » mais « les opérations
  // qui ne sont rattachées à AUCUNE clôture ». Ainsi, une vente / un achat /
  // un remboursement saisi APRÈS la clôture du jour n'est jamais perdu ni
  // ajouté à la clôture déjà faite : il part automatiquement dans la
  // PROCHAINE clôture (celle du lendemain).
  // Borne basse : date de la dernière clôture, pour ne pas ramasser de très
  // anciennes opérations orphelines datant d'avant cette correction.
  // ---------------------------------------------------------------------------
  const stats = useMemo(() => {
    const lastUserCloture = lastClotureOf(clotures, user.IDPERSONNEL);
    const lastGlobalCloture = lastClotureOf(clotures);

    const ventesJour = ventes.filter(
      v => v.IDPERSONNEL === user.IDPERSONNEL && v.STATUT === 'Payée' && !v.CLOTUREE && !v.IDCLOTURE &&
        (!lastUserCloture || v.DATE_VENTE >= lastUserCloture.DATE_CLOTURE)
    );
    const idsVentesJour = new Set(ventesJour.map(v => v.IDVENTE));

    // Paiements des ventes à clôturer (quelle que soit leur date)
    const paiementsJour = paiements.filter(
      p => p.IDVENTE !== null && p.IDVENTE !== undefined && idsVentesJour.has(p.IDVENTE)
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

    // Remboursements reçus (paiements sans vente) non encore rattachés à une clôture
    const remboursements = paiements.filter(
      p => !p.IDVENTE && p.IDPERSONNEL === user.IDPERSONNEL && !p.IDCLOTURE &&
        isAfterCloture(p.DATE_PAIEMENT, p.HEURE, lastUserCloture)
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

    // Achats non encore rattachés à une clôture (depuis la dernière clôture)
    const achatsJour = achats.filter(
      a => !a.CLOTUREE && !a.IDCLOTURE &&
        (!lastGlobalCloture || a.DATE_ACHAT >= lastGlobalCloture.DATE_CLOTURE)
    );
    const totalAchats = achatsJour.reduce((s, a) => s + a.TOTAL, 0);

    // Espèces attendues (versement) — sans déduire les achats du jour
    const especesAttendues = totalEspeces + totalRemboursements;

    // Heure d'ouverture de la session de caisse
    const activeOuverture = store.getOuvertureSession(user.IDPERSONNEL);
    const sessionCaissier = store.getOuverturesHistory()
      .filter(o => o.IDPERSONNEL === user.IDPERSONNEL && o.DATE_OUVERTURE === today())
      .sort((a, b) => b.IDOUVERTURE - a.IDOUVERTURE)[0];
    const premiereVente = ventesJour.map(v => v.HEURE).filter(Boolean).sort()[0];
    const heureOuverture = activeOuverture?.HEURE_OUVERTURE || sessionCaissier?.HEURE_OUVERTURE || premiereVente || nowTime();

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
      remboursements,
      heureOuverture,
      // Date de la plus ancienne opération en attente (caisse ouverte depuis…)
      ouverteDepuis: [
        ...ventesJour.map(v => v.DATE_VENTE),
        ...remboursements.map(p => p.DATE_PAIEMENT),
      ].sort()[0] || '',
    };
  }, [ventes, paiements, clients, achats, clotures, user.IDPERSONNEL]);

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
      HEURE: nowTime(), // heure de fermeture
      HEURE_OUVERTURE: stats.heureOuverture || nowTime(),
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

    // Marquer les remboursements comme rattachés à cette clôture
    const idsRemb = new Set(stats.remboursements.map(p => p.IDPAIEMENT));
    const updatedPaiements = paiements.map(p =>
      idsRemb.has(p.IDPAIEMENT) ? { ...p, IDCLOTURE: idCloture } : p
    );

    // La clôture doit exister avant d'y rattacher ventes / achats / paiements
    store.setClotures([...clotures, newCloture]);
    store.setVentes(updatedVentes);
    store.setAchats(updatedAchats);
    if (idsRemb.size > 0) store.setPaiements(updatedPaiements);
    store.closeOuvertureSession();

    setShowConfirm(false);
    showMsg('Caisse clôturée avec succès ! Déconnexion...');

    const isPrinterActive = store.isUserPrinterEnabled(user.IDPERSONNEL);

    // Imprimer un seul ticket : clôture + récap par article
    // Si imprimante activée -> mode kiosque direct (uniquement lors de la clôture active)
    // Sinon -> ouverture de la fenêtre d'aperçu
    printClotureComplete(newCloture, true);

    // Déconnexion automatique après clôture
    setTimeout(() => {
      if (onLogout) {
        onLogout();
      } else {
        store.logout();
        window.location.reload();
      }
    }, isPrinterActive ? 1800 : 3000);
  };

  // Ticket unique : clôture + récap ventes par article (+ achats du jour sur page séparée).
  // Règle d'impression clôture :
  //   - imprimante COCHÉE sur ce poste  -> impression DIRECTE silencieuse ;
  //   - imprimante PAS COCHÉE           -> ouverture de la PAGE D'IMPRESSION
  //     (fenêtre du ticket + boîte de dialogue pour choisir l'imprimante).
  const printClotureComplete = (cloture: typeof clotures[0], isAutoCloture: boolean = false) => {
    const freshVentes = store.getVentes();
    const allArticles = store.getArticles();
    const allLignes = store.getLignesVente();
    const allAchats = store.getAchats();
    const allFournisseurs = store.getFournisseurs();
    const allPersonnel = store.getPersonnel();

    const caissier = allPersonnel.find(p => p.IDPERSONNEL === cloture.IDPERSONNEL) || user;

    // Ventes et récap par article : UNIQUEMENT les ventes rattachées à cette clôture.
    // (Avant : toutes les ventes du jour du caissier → une réimpression intégrait
    // aussi les ventes saisies après la clôture.)
    const ventesJour = freshVentes.filter(
      v => v.IDCLOTURE === cloture.IDCLOTURE && v.STATUT === 'Payée'
    );
    const lignesJour = allLignes.filter(l => ventesJour.some(v => v.IDVENTE === l.IDVENTE));

    // Achats rattachés à cette clôture pour calculer SI+Achat par article
    const achatsCloture = allAchats.filter(a => a.IDCLOTURE === cloture.IDCLOTURE);
    const lignesAchats = store.getLignesAchat();
    const totalAchatsMontant = achatsCloture.reduce((sum, a) => sum + a.TOTAL, 0);

    // Quantité achetée par article pour cette session de clôture
    const qteAcheteeParArt: Record<number, number> = {};
    achatsCloture.forEach(a => {
      lignesAchats.filter(l => l.IDACHAT === a.IDACHAT).forEach(l => {
        qteAcheteeParArt[l.IDARTICLE] = (qteAcheteeParArt[l.IDARTICLE] || 0) + l.QUANTITE;
      });
    });

    // Session d'ouverture du caissier pour retrouver le stock initial (dotation) si disponible pour la date
    const sessionCaissier = store.getOuverturesHistory()
      .filter(o => o.IDPERSONNEL === cloture.IDPERSONNEL && o.DATE_OUVERTURE === cloture.DATE_CLOTURE)
      .sort((a, b) => b.IDOUVERTURE - a.IDOUVERTURE)[0] || store.getOuvertureSession(cloture.IDPERSONNEL);

    const dotationMap: Record<number, number> = {};
    if (sessionCaissier && sessionCaissier.DOTATIONS) {
      sessionCaissier.DOTATIONS.forEach(d => {
        dotationMap[d.IDARTICLE] = d.QUANTITE;
      });
    }

    // Agréger d'abord les ventes par article pour connaître les quantités vendues totales
    const qteVendueParArt: Record<number, number> = {};
    const puParArt: Record<number, number> = {};
    lignesJour.forEach(l => {
      qteVendueParArt[l.IDARTICLE] = (qteVendueParArt[l.IDARTICLE] || 0) + l.QUANTITE;
      if (!puParArt[l.IDARTICLE] && l.PRIX_UNITAIRE) {
        puParArt[l.IDARTICLE] = l.PRIX_UNITAIRE;
      }
    });

    const tcd: Record<number, { nom: string; qte: number; prixUnitaire: number; montant: number; siPlusAchat: number | string; sf: number | string }> = {};
    Object.entries(qteVendueParArt).forEach(([artIdStr, qteVendue]) => {
      const artId = Number(artIdStr);
      const art = allArticles.find(a => a.IDARTICLE === artId);
      const pu = puParArt[artId] || art?.PRIX_VENTE || 0;
      const achatQte = qteAcheteeParArt[artId] || 0;
      const currentStock = art?.STOCK ?? 0;

      let siPlusAchat: number | string;
      let sf: number | string;

      if (art && !art.GERE_STOCK) {
        siPlusAchat = '-';
        sf = '-';
      } else if (dotationMap[artId] !== undefined) {
        // Si une dotation initiale a été enregistrée à l'ouverture :
        // SI = dotation
        // SI+Achat = dotation + achats de la session
        const si = dotationMap[artId];
        siPlusAchat = si + achatQte;
        sf = Math.max(0, siPlusAchat - qteVendue);
      } else {
        // Sans dotation explicite :
        // Le stock actuel dans la base (art.STOCK) est le stock restant ACTUEL (après déduction des ventes).
        // C'est donc le Stock Final (SF).
        // Par conséquent, le Stock Initial + Achats disponible avant ces ventes était :
        // SI + Achats = Stock Final + Ventes = currentStock + qteVendue
        // Et le Stock Final reste :
        // SF = (SI + Achats) - Ventes = currentStock
        siPlusAchat = currentStock + qteVendue;
        sf = currentStock;
      }

      tcd[artId] = {
        nom: art?.NOM || '-',
        qte: qteVendue,
        prixUnitaire: pu,
        montant: qteVendue * pu,
        siPlusAchat,
        sf,
      };
    });

    const artRows = Object.values(tcd)
      .sort((a, b) => b.montant - a.montant)
      .map(r => `<tr>
        <td style="text-align:left; padding-right:4px;">${r.nom}</td>
        <td style="text-align:center; padding:0 4px;">${r.siPlusAchat}</td>
        <td style="text-align:center; padding:0 4px;">${r.qte}</td>
        <td style="text-align:center; padding:0 4px;">${r.sf}</td>
        <td style="text-align:right; padding-left:4px; white-space:nowrap;">${formatAr(r.montant)}</td>
      </tr>`)
      .join('');
    const totalQte = Object.values(tcd).reduce((s, r) => s + r.qte, 0);
    const totalMontant = Object.values(tcd).reduce((s, r) => s + r.montant, 0);

    let achatsSection = '';
    if (achatsCloture.length > 0) {
      const achatsRows = achatsCloture.map(a => {
        const fourn = allFournisseurs.find(f => f.IDFOURNISSEUR === a.IDFOURNISSEUR);
        const nomFourn = fourn ? fourn.NOM : (a.OBSERVATION || 'Direct');
        return `<tr><td>${a.REFERENCE}</td><td>${nomFourn}</td><td class="right bold">${formatAr(a.TOTAL)}</td></tr>`;
      }).join('');
      const recapAchats: Record<number, { nom: string; qte: number; montant: number }> = {};
      achatsCloture.forEach(a => lignesAchats.filter(l => l.IDACHAT === a.IDACHAT).forEach(l => {
        const art = allArticles.find(x => x.IDARTICLE === l.IDARTICLE);
        if (!recapAchats[l.IDARTICLE]) recapAchats[l.IDARTICLE] = { nom: art?.NOM || '-', qte: 0, montant: 0 };
        recapAchats[l.IDARTICLE].qte += l.QUANTITE;
        recapAchats[l.IDARTICLE].montant += l.MONTANT;
      }));
      const recapRows = Object.values(recapAchats).map(r => `<tr><td>${r.nom}</td><td class="right">${r.qte}</td><td class="right">${formatAr(r.montant)}</td></tr>`).join('');

      // En-tête société réutilisé sur la page des achats (même en-tête que le ticket principal)
      const societeHeaderHtml = buildSocieteHeaderHtml();
      achatsSection = `
        <div class="page-break">
          ${societeHeaderHtml}
          <div class="center bold">RÉCAPITULATIF DES ACHATS DU JOUR</div>
          <div class="row"><span>${cloture.DATE_CLOTURE}</span><span>${cloture.HEURE}</span></div>
          <div>Caissier: ${caissier.PRENOM} ${caissier.NOM}</div>
          <div class="line"></div>
          <div class="bold">Bons d'achat (${achatsCloture.length})</div>
          <table><tr><td class="bold">Réf.</td><td class="bold">Fournisseur</td><td class="bold right">Montant</td></tr>${achatsRows}</table>
          <div class="line"></div>
          <div class="bold">Détail par article</div>
          <table><tr><td class="bold">Article</td><td class="bold right">Qté</td><td class="bold right">Montant</td></tr>${recapRows}</table>
          <div class="line"></div>
          <div class="row bold"><span>TOTAL ACHATS</span><span>${formatAr(totalAchatsMontant)}</span></div>
        </div>
      `;
    }

    printClotureTicket(`
      <div class="center bold" style="font-size:15px; margin-bottom:2px;">CLOTURE DE CAISSE</div>
      <div class="row"><span>Date clôture :</span><span>${cloture.DATE_CLOTURE}</span></div>
      <div class="row"><span>Heure ouverture :</span><span>${cloture.HEURE_OUVERTURE || '-'}</span></div>
      <div class="row"><span>Heure fermeture :</span><span>${cloture.HEURE}</span></div>
      <div>Caissier: ${caissier.PRENOM} ${caissier.NOM}</div>
      <div class="line"></div>

      <div class="row"><span>Nombre de ventes</span><span>${cloture.NB_VENTES}</span></div>
      <div class="row"><span>Total ventes</span><span>${formatAr(cloture.TOTAL_VENTES)}</span></div>
      ${cloture.TOTAL_REMISES > 0 ? `<div class="row"><span>Remises accordées</span><span>-${formatAr(cloture.TOTAL_REMISES)}</span></div>` : ''}
      <div class="line"></div>

      <div class="bold">Détail des paiements :</div>
      <div class="row"><span>Espèces</span><span>${formatAr(cloture.TOTAL_ESPECES)}</span></div>
      <div class="row"><span>Mobile Money</span><span>${formatAr(cloture.TOTAL_MOBILE)}</span></div>
      ${cloture.TOTAL_CREDIT > 0 ? `<div class="row"><span>Crédits</span><span>${formatAr(cloture.TOTAL_CREDIT)}</span></div>` : ''}
      ${cloture.TOTAL_REMBOURSEMENTS > 0 ? `<div class="row"><span>Remboursements</span><span>${formatAr(cloture.TOTAL_REMBOURSEMENTS)}</span></div>` : ''}
      ${totalAchatsMontant > 0 ? `<div class="row"><span>Achats du jour</span><span>${formatAr(totalAchatsMontant)}</span></div>` : ''}
      <div class="line"></div>

      <div class="row bold" style="font-size:14px;"><span>ESPÈCES ATTENDUES</span><span>${formatAr(cloture.TOTAL_ESPECES + cloture.TOTAL_REMBOURSEMENTS)}</span></div>
      <div class="line"></div>
      <br/>

      <div class="center bold" style="font-size:13px; margin-bottom:2px;">RÉCAP VENTES PAR ARTICLE</div>
      <div class="line"></div>
      <table>
        <thead>
          <tr>
            <th class="bold" style="text-align:left; padding-right:4px;">Article</th>
            <th class="bold" style="text-align:center; padding:0 3px; white-space:nowrap;">SI+Ach</th>
            <th class="bold" style="text-align:center; padding:0 3px; white-space:nowrap;">Vte</th>
            <th class="bold" style="text-align:center; padding:0 3px; white-space:nowrap;">SF</th>
            <th class="bold" style="text-align:right; padding-left:4px; white-space:nowrap;">Montant</th>
          </tr>
        </thead>
        <tbody>
          ${artRows}
        </tbody>
      </table>
      <div class="line"></div>
      <div class="row"><span>Total articles</span><span>${totalQte}</span></div>
      <div class="row bold" style="font-size:14px;"><span>TOTAL</span><span>${formatAr(totalMontant)}</span></div>
      ${achatsSection}
    `, user.IDPERSONNEL, isAutoCloture);
  };

  // Réutilisé par l'historique admin (même règle : cochée = direct, sinon page d'impression)
  const printCloture = (cloture: typeof clotures[0]) => {
    printClotureComplete(cloture);
  };

  // Admin: Historique des clôtures
  if (isAdmin) {
    return (
      <div className="space-y-6">
        {toast && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50">{toast}</div>}

        <h1 className="text-2xl font-bold text-gray-900">📜 Historique des clôtures</h1>

        {/* Vue mobile des clôtures */}
        <div className="md:hidden space-y-3">
          {clotures.sort((a, b) => b.IDCLOTURE - a.IDCLOTURE).map(c => {
            const caissier = store.getPersonnel().find(p => p.IDPERSONNEL === c.IDPERSONNEL);
            return (
              <div key={c.IDCLOTURE} className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-extrabold text-sm text-gray-900">{caissier?.PRENOM} {caissier?.NOM}</span>
                    <p className="text-xs text-gray-500 font-medium">
                      {c.DATE_CLOTURE} · 🟢 {c.HEURE_OUVERTURE || '-'} ➔ 🔴 {c.HEURE}
                    </p>
                  </div>
                  <button
                    onClick={() => printCloture(c)}
                    className="p-2 min-h-[38px] min-w-[38px] rounded-xl bg-blue-50 text-[#0D47A1] hover:bg-blue-100 flex items-center justify-center active:scale-95"
                    title="Imprimer"
                  >
                    <Printer size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  <div>
                    <span className="text-gray-500">Ventes : </span>
                    <span className="font-bold text-gray-900">{formatAr(c.TOTAL_VENTES)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Espèces : </span>
                    <span className="font-bold text-green-700">{formatAr(c.TOTAL_ESPECES)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Mobile : </span>
                    <span className="font-bold text-blue-700">{formatAr(c.TOTAL_MOBILE)}</span>
                  </div>
                  {c.TOTAL_REMISES > 0 && (
                    <div>
                      <span className="text-gray-500">Remises : </span>
                      <span className="font-bold text-red-600">-{formatAr(c.TOTAL_REMISES)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {clotures.length === 0 && (
            <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-gray-100">
              Aucune clôture
            </div>
          )}
        </div>

        {/* Vue desktop des clôtures */}
        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">Ouverture</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">Fermeture</th>
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
                      <td className="px-4 py-3 text-sm font-medium">{c.DATE_CLOTURE}</td>
                      <td className="px-3 py-3 text-sm font-bold text-green-700 tabular-nums">{c.HEURE_OUVERTURE || '-'}</td>
                      <td className="px-3 py-3 text-sm font-bold text-red-600 tabular-nums">{c.HEURE}</td>
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
                    <td colSpan={10} className="text-center py-8 text-gray-400">
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
      {!alreadyClosed && stats.ouverteDepuis && stats.ouverteDepuis < today() && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
          📅 Caisse ouverte depuis le <b>{stats.ouverteDepuis.split('-').reverse().join('/')}</b> :
          cette clôture regroupe toutes les opérations non clôturées depuis cette date.
        </div>
      )}

      {alreadyClosed ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center space-y-4">
          <Lock size={48} className="mx-auto text-red-600 mb-2" />
          <h2 className="text-xl font-bold text-red-700">Caisse clôturée pour aujourd'hui</h2>
          <p className="text-red-600 font-medium">Vous avez déjà effectué votre clôture de caisse aujourd'hui.</p>
          <p className="text-sm text-red-700 max-w-md mx-auto">
            Accès verrouillé : aucune nouvelle vente ni opération ne peut être saisie sur ce compte aujourd'hui. La caisse pourra être réouverte <b>demain</b>.
          </p>
          {clotures.find(c => c.DATE_CLOTURE === today() && c.IDPERSONNEL === user.IDPERSONNEL) && (
            <button
              onClick={() => {
                const todayCloture = clotures.find(c => c.DATE_CLOTURE === today() && c.IDPERSONNEL === user.IDPERSONNEL);
                if (todayCloture) printClotureComplete(todayCloture);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0D47A1] text-white rounded-xl font-medium shadow-md hover:bg-[#0b3c88] transition-colors mt-2"
            >
              <Printer size={18} />
              Imprimer le ticket de clôture
            </button>
          )}
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

          {/* Horaires de la session de caisse */}
          <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-slate-50 border border-blue-200 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#0D47A1] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Clock size={22} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Horaires de la session de caisse</p>
                  <p className="text-sm sm:text-base font-extrabold text-gray-900">
                    {user.PRENOM} {user.NOM} · {today().split('-').reverse().join('/')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:gap-4">
                <div className="bg-white px-3.5 py-2 rounded-xl border border-blue-100 shadow-2xs">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Heure d'ouverture</span>
                  <span className="text-sm sm:text-base font-black text-green-700 tabular-nums flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse"></span>
                    {stats.heureOuverture}
                  </span>
                </div>

                <div className="bg-white px-3.5 py-2 rounded-xl border border-blue-100 shadow-2xs">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Heure de fermeture</span>
                  <span className="text-sm sm:text-base font-black text-red-600 tabular-nums flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                    {nowTime()}
                  </span>
                </div>
              </div>
            </div>
          </div>

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

            {stats.totalRemises > 0 && (
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Remises accordées</p>
                <p className="text-2xl font-bold text-red-500">-{formatAr(stats.totalRemises)}</p>
              </div>
            )}
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
              
              {stats.totalCredit > 0 && (
                <>
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
                </>
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
                  <span className="text-gray-600">🛒 Achats du jour <span className="text-xs text-amber-600 font-medium">(non déduit du versement)</span></span>
                  <span className="font-semibold text-gray-800">{formatAr(stats.totalAchats)}</span>
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
            const lignesAchats = store.getLignesAchat();
            const lignesJour = allLignes.filter(l => stats.ventesJour.some(v => v.IDVENTE === l.IDVENTE));

            // Achats rattachés à la session courante en attente de clôture (stats.achatsJour)
            const qteAcheteeParArt: Record<number, number> = {};
            stats.achatsJour.forEach(a => {
              lignesAchats.filter(l => l.IDACHAT === a.IDACHAT).forEach(l => {
                qteAcheteeParArt[l.IDARTICLE] = (qteAcheteeParArt[l.IDARTICLE] || 0) + l.QUANTITE;
              });
            });

            // Session d'ouverture active du caissier
            const activeOuverture = store.getOuvertureSession(user.IDPERSONNEL);
            const dotationMap: Record<number, number> = {};
            if (activeOuverture && activeOuverture.DOTATIONS) {
              activeOuverture.DOTATIONS.forEach(d => {
                dotationMap[d.IDARTICLE] = d.QUANTITE;
              });
            }

            // Agréger d'abord les ventes par article pour connaître les quantités vendues totales
            const qteVendueParArt: Record<number, number> = {};
            const puParArt: Record<number, number> = {};
            lignesJour.forEach(l => {
              qteVendueParArt[l.IDARTICLE] = (qteVendueParArt[l.IDARTICLE] || 0) + l.QUANTITE;
              if (!puParArt[l.IDARTICLE] && l.PRIX_UNITAIRE) {
                puParArt[l.IDARTICLE] = l.PRIX_UNITAIRE;
              }
            });

            const tcd: Record<number, { nom: string; emoji: string; qte: number; prixUnitaire: number; montant: number; siPlusAchat: number | string; sf: number | string }> = {};
            Object.entries(qteVendueParArt).forEach(([artIdStr, qteVendue]) => {
              const artId = Number(artIdStr);
              const art = allArticles.find(a => a.IDARTICLE === artId);
              const pu = puParArt[artId] || art?.PRIX_VENTE || 0;
              const achatQte = qteAcheteeParArt[artId] || 0;
              const currentStock = art?.STOCK ?? 0;

              let siPlusAchat: number | string;
              let sf: number | string;

              if (art && !art.GERE_STOCK) {
                siPlusAchat = '-';
                sf = '-';
              } else if (dotationMap[artId] !== undefined) {
                // Si une dotation initiale a été enregistrée à l'ouverture :
                // SI = dotation
                // SI+Achat = dotation + achats de la session
                const si = dotationMap[artId];
                siPlusAchat = si + achatQte;
                sf = Math.max(0, siPlusAchat - qteVendue);
              } else {
                // Sans dotation explicite :
                // Le stock actuel dans la base (art.STOCK) est le stock restant ACTUEL (après déduction des ventes).
                // C'est donc le Stock Final (SF).
                // Par conséquent, le Stock Initial + Achats disponible avant ces ventes était :
                // SI + Achats = Stock Final + Ventes = currentStock + qteVendue
                // Et le Stock Final reste :
                // SF = (SI + Achats) - Ventes = currentStock
                siPlusAchat = currentStock + qteVendue;
                sf = currentStock;
              }

              tcd[artId] = {
                nom: art?.NOM || '-',
                emoji: art?.EMOJI || '📦',
                qte: qteVendue,
                prixUnitaire: pu,
                montant: qteVendue * pu,
                siPlusAchat,
                sf,
              };
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
                        <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 w-24">SI+Achat</th>
                        <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 w-20">Vente</th>
                        <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 w-20">SF</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 w-32">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((r, i) => (
                        <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-sm font-medium">{r.emoji} {r.nom}</td>
                          <td className="px-4 py-2.5 text-center font-semibold text-gray-700">{r.siPlusAchat}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-amber-600">{r.qte}</td>
                          <td className="px-4 py-2.5 text-center font-semibold text-blue-700">{r.sf}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-[#0D47A1]">{formatAr(r.montant)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr className="border-t-2 border-gray-200">
                        <td className="px-4 py-3 font-bold text-sm">TOTAL</td>
                        <td className="px-4 py-3 text-center font-bold text-gray-400">-</td>
                        <td className="px-4 py-3 text-center font-bold text-amber-600">{totalQte}</td>
                        <td className="px-4 py-3 text-center font-bold text-gray-400">-</td>
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
        title="Confirmer la clôture de caisse"
        message={`Voulez-vous vraiment clôturer la caisse ?\n• Horaires : Ouverture à ${stats.heureOuverture} — Fermeture à ${nowTime()}\n• Nombre de ventes : ${stats.nbVentes} (${formatAr(stats.totalVentes)})\n• Espèces attendues : ${formatAr(stats.especesAttendues)}\nCette action est irréversible et verrouille les opérations pour aujourd'hui.`}
        confirmText="Oui, clôturer la caisse"
        cancelText="Annuler"
        onConfirm={handleCloture}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
