import { useMemo, useState } from 'react';
import {
  CreditCard,
  Wallet,
  CheckCircle2,
  Search,
  X,
  Lock,
  Receipt,
  History,
  DollarSign,
  Package,
  User,
  Printer,
  Eye,
  Check,
} from 'lucide-react';
import { store } from '../store';
import { Personnel, Paiement, Client } from '../types';
import { formatAr, nextId, nowTime, today } from '../helpers';
import { printTicket } from '../components/PrintTicket';
import ConfirmModal from '../components/ConfirmModal';
import MoneyInput from '../components/MoneyInput';

interface Props {
  user: Personnel;
}

interface InvoicePaymentItem {
  idPaiement: number;
  date: string;
  heure: string;
  montant: number;
  mode: 'Espèces' | 'Mobile Money';
  caissierNom: string;
  isDirect: boolean;
}

interface UnpaidCreditInvoice {
  idVente: number;
  numeroFacture: string;
  dateVente: string;
  heureVente: string;
  clientId: number;
  clientNom: string;
  clientTelephone: string;
  totalVente: number;
  creditInitial: number;
  totalPaye: number;
  resteAPayer: number;
  type: 'Comptoir' | 'Table';
  tableNumero: number | null;
  caissierNom: string;
  remise: number;
  paiements: InvoicePaymentItem[];
  articles: { nom: string; quantite: number; pu: number; montant: number }[];
}

interface ClientGroup {
  client: Client;
  invoices: UnpaidCreditInvoice[];
  totalReste: number;
}

interface FifoAllocation {
  idVente: number;
  numeroFacture: string;
  dateVente: string;
  resteAvant: number;
  allocated: number;
  resteApres: number;
  isSoldee: boolean;
}

export default function CreditsModule({ user }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'clients' | 'factures'>('clients');

  // Modal d'encaissement de remboursement
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [selectedInvoiceForDirectPayment, setSelectedInvoiceForDirectPayment] = useState<UnpaidCreditInvoice | null>(null);
  const [montant, setMontant] = useState('');
  const [modePaiement, setModePaiement] = useState<'Espèces' | 'Mobile Money'>('Espèces');
  const [showConfirm, setShowConfirm] = useState(false);

  // Modal « Détails de vente » d'un client (remplace l'ancien Replier)
  const [modalClientDetailsId, setModalClientDetailsId] = useState<number | null>(null);
  const [viewingSaleDetail, setViewingSaleDetail] = useState<{ invoice: UnpaidCreditInvoice; tab: 'articles' | 'paiements' } | null>(null);

  // Dépliages dans les modales et listes
  const [expandedInvoices, setExpandedInvoices] = useState<Set<number>>(new Set());
  const [expandedArticles, setExpandedArticles] = useState<Set<number>>(new Set());

  const [toast, setToast] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const isAdmin = user.ROLE === 'Administrateur' || user.ROLE === 'Gérant';

  const clients = useMemo(() => store.getClients(), [refreshKey]);
  const paiements = useMemo(() => store.getPaiements(), [refreshKey]);
  const ventes = useMemo(() => store.getVentes(), [refreshKey]);
  const lignesVente = useMemo(() => store.getLignesVente(), [refreshKey]);
  const articles = useMemo(() => store.getArticles(), [refreshKey]);
  const personnel = useMemo(() => store.getPersonnel(), [refreshKey]);
  const tables = useMemo(() => store.getTables(), [refreshKey]);

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const toggleInvoiceExpand = (idVente: number) => {
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(idVente)) next.delete(idVente);
      else next.add(idVente);
      return next;
    });
  };

  const toggleArticlesExpand = (idVente: number) => {
    setExpandedArticles(prev => {
      const next = new Set(prev);
      if (next.has(idVente)) next.delete(idVente);
      else next.add(idVente);
      return next;
    });
  };

  // ===========================================================================
  // CALCUL DES FACTURES À CRÉDIT IMPAYÉES AVEC HISTORIQUE DE PAIEMENT
  // RÈGLE : NE PAS AFFICHER LES FACTURES ENTIÈREMENT PAYÉES (resteAPayer > 0 seul)
  // ===========================================================================
  const unpaidInvoices = useMemo(() => {
    const list: UnpaidCreditInvoice[] = [];

    clients.forEach(client => {
      // 1. Tous les crédits accordés rattachés à une vente
      const creditPaiements = paiements.filter(
        p => p.IDCLIENT === client.IDCLIENT && p.MODE_PAIEMENT === 'Crédit' && p.IDVENTE
      );

      const creditByVenteId = new Map<number, number>();
      creditPaiements.forEach(p => {
        creditByVenteId.set(p.IDVENTE!, (creditByVenteId.get(p.IDVENTE!) || 0) + p.MONTANT);
      });

      // Ventes ordonnées chronologiquement (FIFO)
      const clientVentes = ventes
        .filter(v => creditByVenteId.has(v.IDVENTE))
        .sort((a, b) => {
          const dtA = `${a.DATE_VENTE} ${a.HEURE}`;
          const dtB = `${b.DATE_VENTE} ${b.HEURE}`;
          return dtA.localeCompare(dtB);
        });

      // 2. Règlements effectués (non-crédit)
      const directPaymentsByVente = new Map<number, Paiement[]>();
      const unlinkedPayments: { paiement: Paiement; restant: number }[] = [];

      paiements
        .filter(p => p.IDCLIENT === client.IDCLIENT && p.MODE_PAIEMENT !== 'Crédit')
        .sort((a, b) => `${a.DATE_PAIEMENT} ${a.HEURE}`.localeCompare(`${b.DATE_PAIEMENT} ${b.HEURE}`))
        .forEach(p => {
          if (p.IDVENTE && creditByVenteId.has(p.IDVENTE)) {
            const arr = directPaymentsByVente.get(p.IDVENTE) || [];
            arr.push(p);
            directPaymentsByVente.set(p.IDVENTE, arr);
          } else {
            unlinkedPayments.push({ paiement: p, restant: p.MONTANT });
          }
        });

      // 3. Calcul pour chaque vente à crédit
      clientVentes.forEach(v => {
        const creditInitial = creditByVenteId.get(v.IDVENTE) || 0;
        const paymentsHistory: InvoicePaymentItem[] = [];
        let totalPayeSurFacture = 0;

        // Règlements directs
        const directs = directPaymentsByVente.get(v.IDVENTE) || [];
        directs.forEach(dp => {
          const caissier = personnel.find(p => p.IDPERSONNEL === dp.IDPERSONNEL);
          totalPayeSurFacture += dp.MONTANT;
          paymentsHistory.push({
            idPaiement: dp.IDPAIEMENT,
            date: dp.DATE_PAIEMENT,
            heure: dp.HEURE,
            montant: dp.MONTANT,
            mode: dp.MODE_PAIEMENT as 'Espèces' | 'Mobile Money',
            caissierNom: caissier ? `${caissier.PRENOM} ${caissier.NOM}` : 'Personnel',
            isDirect: true,
          });
        });

        // Règlements globaux imputés FIFO
        let needed = Math.max(0, creditInitial - totalPayeSurFacture);
        if (needed > 0) {
          for (const u of unlinkedPayments) {
            if (u.restant <= 0) continue;
            const take = Math.min(needed, u.restant);
            u.restant -= take;
            needed -= take;
            totalPayeSurFacture += take;
            const caissier = personnel.find(p => p.IDPERSONNEL === u.paiement.IDPERSONNEL);
            paymentsHistory.push({
              idPaiement: u.paiement.IDPAIEMENT,
              date: u.paiement.DATE_PAIEMENT,
              heure: u.paiement.HEURE,
              montant: take,
              mode: u.paiement.MODE_PAIEMENT as 'Espèces' | 'Mobile Money',
              caissierNom: caissier ? `${caissier.PRENOM} ${caissier.NOM}` : 'Personnel',
              isDirect: false,
            });
            if (needed <= 0) break;
          }
        }

        const resteAPayer = Math.max(0, creditInitial - totalPayeSurFacture);

        // Si resteAPayer <= 0 -> la facture est complètement soldée -> masquée
        if (resteAPayer > 0) {
          const table = v.IDTABLE ? tables.find(t => t.IDTABLE === v.IDTABLE) : null;
          const caissierVente = personnel.find(p => p.IDPERSONNEL === v.IDPERSONNEL);

          const articlesFacture = lignesVente
            .filter(l => l.IDVENTE === v.IDVENTE)
            .map(l => {
              const art = articles.find(a => a.IDARTICLE === l.IDARTICLE);
              return {
                nom: art ? art.NOM : 'Article',
                quantite: l.QUANTITE,
                pu: l.PRIX_UNITAIRE,
                montant: l.MONTANT,
              };
            });

          list.push({
            idVente: v.IDVENTE,
            numeroFacture: v.NUMERO_FACTURE,
            dateVente: v.DATE_VENTE,
            heureVente: v.HEURE,
            clientId: client.IDCLIENT,
            clientNom: client.NOM_CLIENT,
            clientTelephone: client.TELEPHONE,
            totalVente: v.TOTAL,
            creditInitial,
            totalPaye: totalPayeSurFacture,
            resteAPayer,
            type: v.TYPE,
            tableNumero: table ? table.NUMERO : null,
            caissierNom: caissierVente ? `${caissierVente.PRENOM} ${caissierVente.NOM}` : 'Personnel',
            remise: v.REMISE || 0,
            paiements: paymentsHistory,
            articles: articlesFacture,
          });
        }
      });

      // Reliquat sans facture rattachée (solde antérieur manuel)
      const totalResteCalcule = list
        .filter(inv => inv.clientId === client.IDCLIENT)
        .reduce((s, inv) => s + inv.resteAPayer, 0);
      const reliquat = client.CREDIT_TOTAL - totalResteCalcule;
      if (reliquat > 0 && clientVentes.length === 0) {
        list.push({
          idVente: 0,
          numeroFacture: 'Dette initiale / Solde antérieur',
          dateVente: client.DATE_CREATION || today(),
          heureVente: '',
          clientId: client.IDCLIENT,
          clientNom: client.NOM_CLIENT,
          clientTelephone: client.TELEPHONE,
          totalVente: reliquat,
          creditInitial: reliquat,
          totalPaye: 0,
          resteAPayer: reliquat,
          type: 'Comptoir',
          tableNumero: null,
          caissierNom: 'Direction',
          remise: 0,
          paiements: [],
          articles: [],
        });
      }
    });

    return list;
  }, [clients, paiements, ventes, lignesVente, articles, personnel, tables]);

  // ===========================================================================
  // REGROUPEMENT PAR CLIENT (FUSIONNÉ EN UN NOM UNIQUE)
  // ===========================================================================
  const groupedClients = useMemo<ClientGroup[]>(() => {
    const term = searchTerm.toLowerCase().trim();

    return clients
      .map(c => {
        const clientInvs = unpaidInvoices.filter(inv => inv.clientId === c.IDCLIENT);
        const sumInvs = clientInvs.reduce((s, i) => s + i.resteAPayer, 0);
        const totalReste = Math.max(c.CREDIT_TOTAL, sumInvs);
        return {
          client: c,
          invoices: clientInvs,
          totalReste,
        };
      })
      .filter(g => g.totalReste > 0 || g.invoices.length > 0)
      .filter(g => {
        if (!term) return true;
        const matchesClient =
          g.client.NOM_CLIENT.toLowerCase().includes(term) ||
          g.client.TELEPHONE.includes(term);
        const matchesInvoice = g.invoices.some(inv =>
          inv.numeroFacture.toLowerCase().includes(term)
        );
        return matchesClient || matchesInvoice;
      })
      .sort((a, b) => b.totalReste - a.totalReste);
  }, [clients, unpaidInvoices, searchTerm]);

  // Filtrage pour la vue brute par facture
  const filteredInvoices = useMemo(() => {
    if (!searchTerm.trim()) return unpaidInvoices;
    const term = searchTerm.toLowerCase();
    return unpaidInvoices.filter(
      inv =>
        inv.numeroFacture.toLowerCase().includes(term) ||
        inv.clientNom.toLowerCase().includes(term) ||
        inv.clientTelephone.includes(term)
    );
  }, [unpaidInvoices, searchTerm]);

  // Totaux statistiques
  const totalCredits = clients.reduce((s, c) => s + c.CREDIT_TOTAL, 0);
  const totalClientsCredit = clients.filter(c => c.CREDIT_TOTAL > 0).length;
  const remboursementsJour = paiements.filter(
    p => p.DATE_PAIEMENT === today() && p.MODE_PAIEMENT !== 'Crédit' && p.IDCLIENT
  );
  const totalRemboursementsJour = remboursementsJour.reduce((s, p) => s + p.MONTANT, 0);

  const selectedClientObj = clients.find(c => c.IDCLIENT === selectedClient) || null;
  const montantNum = Math.max(0, Number(montant) || 0);

  // Client sélectionné pour le modal « Détails de vente »
  const modalClientGroup = useMemo(() => {
    if (!modalClientDetailsId) return null;
    const found = groupedClients.find(g => g.client.IDCLIENT === modalClientDetailsId);
    if (found) return found;
    const cl = clients.find(c => c.IDCLIENT === modalClientDetailsId);
    if (!cl) return null;
    return {
      client: cl,
      invoices: [],
      totalReste: 0,
    };
  }, [modalClientDetailsId, groupedClients, clients]);

  // ===========================================================================
  // SIMULATION FIFO DE DÉDUCTION AUTOMATIQUE SUR LE MONTANT SAISI
  // Exemple utilisateur : VTE-0777 (12 000 Ar), VTE-0778 (20 000 Ar), VTE-0779 (16 000 Ar)
  // Si montant = 20 000 Ar -> VTE-0777 remboursée à 100% (reste 0), VTE-0778 déduit de 8 000 (reste 12 000)
  // ===========================================================================
  const fifoAllocations = useMemo<FifoAllocation[]>(() => {
    if (!selectedClientObj || montantNum <= 0) return [];

    const clientInvs = unpaidInvoices
      .filter(i => i.clientId === selectedClientObj.IDCLIENT && i.resteAPayer > 0)
      .sort((a, b) => {
        const dtA = `${a.dateVente} ${a.heureVente}`;
        const dtB = `${b.dateVente} ${b.heureVente}`;
        return dtA.localeCompare(dtB);
      });

    let remaining = montantNum;
    const res: FifoAllocation[] = [];

    for (const inv of clientInvs) {
      if (inv.resteAPayer <= 0) continue;
      const take = Math.min(inv.resteAPayer, remaining);
      const resteApres = inv.resteAPayer - take;
      res.push({
        idVente: inv.idVente,
        numeroFacture: inv.numeroFacture,
        dateVente: inv.dateVente,
        resteAvant: inv.resteAPayer,
        allocated: take,
        resteApres,
        isSoldee: resteApres <= 0,
      });
      remaining -= take;
    }

    return res;
  }, [selectedClientObj, montantNum, unpaidInvoices]);

  // Ouverture du modal de remboursement global sur le compte client (imputation FIFO automatique)
  const openRemboursement = (clientId: number) => {
    if (!isAdmin) {
      showMsg("Seul un Administrateur ou Gérant est autorisé à recevoir les paiements de crédit");
      return;
    }
    const c = clients.find(cl => cl.IDCLIENT === clientId);
    if (!c) return;

    setSelectedClient(clientId);
    setSelectedInvoiceForDirectPayment(null);
    setMontant('');
    setModePaiement('Espèces');
  };

  // Ouverture du modal de remboursement spécifique à UNE facture (facture par facture)
  const openRemboursementFacture = (inv: UnpaidCreditInvoice) => {
    if (!isAdmin) {
      showMsg("Seul un Administrateur ou Gérant est autorisé à recevoir les paiements de crédit");
      return;
    }
    const c = clients.find(cl => cl.IDCLIENT === inv.clientId);
    if (!c) return;

    setSelectedClient(inv.clientId);
    setSelectedInvoiceForDirectPayment(inv);
    setMontant(String(inv.resteAPayer));
    setModePaiement('Espèces');
  };

  // Réimpression ticket de caisse original de la vente
  const printVenteTicket = (inv: UnpaidCreditInvoice) => {
    const content = `
      <div class="center bold" style="font-size:15px; margin-bottom:2px;">DUPLICATA TICKET DE VENTE</div>
      <div class="row"><span>${inv.numeroFacture}</span><span>${inv.dateVente} ${inv.heureVente}</span></div>
      <div>Client: <b>${inv.clientNom}</b> ${inv.clientTelephone ? `(${inv.clientTelephone})` : ''}</div>
      ${inv.tableNumero ? `<div>Table: <b>Table ${inv.tableNumero}</b></div>` : '<div>Type: <b>Comptoir</b></div>'}
      <div>Caissier: ${inv.caissierNom}</div>
      <div class="line"></div>
      <div class="bold" style="margin-bottom:4px;">ARTICLES SERVIS :</div>
      ${inv.articles.map(a => `
        <div class="row">
          <span>${a.quantite}x ${a.nom}</span>
          <span>${formatAr(a.montant)}</span>
        </div>
      `).join('')}
      <div class="line"></div>
      <div class="row bold" style="font-size:14px;"><span>TOTAL VENTE</span><span>${formatAr(inv.totalVente)}</span></div>
      <div class="row"><span>Crédit initial</span><span>${formatAr(inv.creditInitial)}</span></div>
      ${inv.totalPaye > 0 ? `<div class="row"><span>Déjà remboursé</span><span>${formatAr(inv.totalPaye)}</span></div>` : ''}
      <div class="row bold" style="color:red;"><span>RESTE À PAYER</span><span>${formatAr(inv.resteAPayer)}</span></div>
    `;
    printTicket(content, true);
  };

  // Enregistrement du remboursement (soit facture ciblée, soit imputation automatique FIFO)
  const handleRemboursement = () => {
    if (!isAdmin) {
      showMsg("Accès refusé : Autorisation requise");
      return;
    }
    if (!selectedClientObj || montantNum <= 0) {
      showMsg('Montant invalide');
      return;
    }

    // CAS 1 : Règlement ciblé sur UNE facture spécifique
    if (selectedInvoiceForDirectPayment) {
      if (montantNum > selectedInvoiceForDirectPayment.resteAPayer) {
        showMsg(`Le montant dépasse le reste dû sur cette facture (${formatAr(selectedInvoiceForDirectPayment.resteAPayer)})`);
        return;
      }

      const newPaiement: Paiement = {
        IDPAIEMENT: nextId(paiements, 'IDPAIEMENT'),
        DATE_PAIEMENT: today(),
        HEURE: nowTime(),
        IDVENTE: selectedInvoiceForDirectPayment.idVente > 0 ? selectedInvoiceForDirectPayment.idVente : null,
        IDPERSONNEL: user.IDPERSONNEL,
        MONTANT: montantNum,
        MODE_PAIEMENT: modePaiement,
        IDCLIENT: selectedClientObj.IDCLIENT,
      };

      const nouveauSoldeClient = Math.max(0, selectedClientObj.CREDIT_TOTAL - montantNum);
      const resteSurFacture = Math.max(0, selectedInvoiceForDirectPayment.resteAPayer - montantNum);

      const updatedClients = clients.map(c =>
        c.IDCLIENT === selectedClientObj.IDCLIENT
          ? { ...c, CREDIT_TOTAL: nouveauSoldeClient }
          : c
      );

      store.setClients(updatedClients);
      store.setPaiements([...paiements, newPaiement]);

      printTicket(`
        <div class="center bold" style="font-size:15px; margin-bottom:2px;">TICKET DE REMBOURSEMENT</div>
        <div class="row"><span>${today()}</span><span>${nowTime()}</span></div>
        <div>Caissier: ${user.PRENOM} ${user.NOM}</div>
        <div class="line"></div>
        <div class="row"><span>Client</span><span class="bold">${selectedClientObj.NOM_CLIENT}</span></div>
        <div class="row"><span>Facture</span><span class="bold">${selectedInvoiceForDirectPayment.numeroFacture}</span></div>
        <div class="row"><span>Mode de paiement</span><span>${modePaiement}</span></div>
        <div class="line"></div>
        <div class="row"><span>Dette facture avant</span><span>${formatAr(selectedInvoiceForDirectPayment.resteAPayer)}</span></div>
        <div class="row bold" style="font-size:14px;"><span>MONTANT VERSÉ</span><span>${formatAr(montantNum)}</span></div>
        <div class="row bold"><span>Reste sur facture</span><span>${formatAr(resteSurFacture)} ${resteSurFacture === 0 ? '(Soldée)' : ''}</span></div>
        <div class="line"></div>
        <div class="row bold" style="font-size:13px;"><span>NOUVEAU SOLDE CLIENT</span><span>${formatAr(nouveauSoldeClient)}</span></div>
      `, true);

      setShowConfirm(false);
      setSelectedClient(null);
      setSelectedInvoiceForDirectPayment(null);
      setMontant('');
      setRefreshKey(k => k + 1);
      showMsg(`Règlement de ${formatAr(montantNum)} enregistré sur ${selectedInvoiceForDirectPayment.numeroFacture} !`);
      return;
    }

    // CAS 2 : Règlement global avec imputation automatique FIFO
    if (montantNum > selectedClientObj.CREDIT_TOTAL) {
      showMsg('Le montant dépasse le crédit total du client');
      return;
    }

    let nextPaiementId = nextId(paiements, 'IDPAIEMENT');
    const newPaymentsList: Paiement[] = [];

    // Création des paiements individualisés par facture selon la cascade FIFO
    const allocationsAvecMontant = fifoAllocations.filter(a => a.allocated > 0);
    allocationsAvecMontant.forEach(alloc => {
      newPaymentsList.push({
        IDPAIEMENT: nextPaiementId++,
        DATE_PAIEMENT: today(),
        HEURE: nowTime(),
        IDVENTE: alloc.idVente > 0 ? alloc.idVente : null,
        IDPERSONNEL: user.IDPERSONNEL,
        MONTANT: alloc.allocated,
        MODE_PAIEMENT: modePaiement,
        IDCLIENT: selectedClientObj.IDCLIENT,
      });
    });

    // Si le montant dépasse la somme des factures existantes (ex: solde débiteur antérieur)
    const totalAllocatedInvoices = allocationsAvecMontant.reduce((s, a) => s + a.allocated, 0);
    const surplus = montantNum - totalAllocatedInvoices;
    if (surplus > 0) {
      newPaymentsList.push({
        IDPAIEMENT: nextPaiementId++,
        DATE_PAIEMENT: today(),
        HEURE: nowTime(),
        IDVENTE: null,
        IDPERSONNEL: user.IDPERSONNEL,
        MONTANT: surplus,
        MODE_PAIEMENT: modePaiement,
        IDCLIENT: selectedClientObj.IDCLIENT,
      });
    }

    const nouveauSoldeClient = Math.max(0, selectedClientObj.CREDIT_TOTAL - montantNum);

    const updatedClients = clients.map(c =>
      c.IDCLIENT === selectedClientObj.IDCLIENT
        ? { ...c, CREDIT_TOTAL: nouveauSoldeClient }
        : c
    );

    store.setClients(updatedClients);
    store.setPaiements([...paiements, ...newPaymentsList]);

    // Impression du ticket de remboursement 80mm
    const imputationLinesHtml = fifoAllocations
      .filter(a => a.allocated > 0)
      .map(
        a => `
        <div class="row" style="font-size:11px;">
          <span>${a.numeroFacture}</span>
          <span>-${formatAr(a.allocated)} ${a.isSoldee ? '<b>(Soldée)</b>' : `(Reste ${formatAr(a.resteApres)})`}</span>
        </div>`
      )
      .join('');

    printTicket(`
      <div class="center bold" style="font-size:15px; margin-bottom:2px;">TICKET DE REMBOURSEMENT</div>
      <div class="row"><span>${today()}</span><span>${nowTime()}</span></div>
      <div>Caissier: ${user.PRENOM} ${user.NOM}</div>
      <div class="line"></div>
      <div class="row"><span>Client</span><span class="bold">${selectedClientObj.NOM_CLIENT}</span></div>
      <div class="row"><span>Mode de paiement</span><span>${modePaiement}</span></div>
      <div class="line"></div>
      <div class="row"><span>Dette avant</span><span>${formatAr(selectedClientObj.CREDIT_TOTAL)}</span></div>
      <div class="row bold" style="font-size:14px;"><span>MONTANT VERSÉ</span><span>${formatAr(montantNum)}</span></div>
      ${imputationLinesHtml ? `
        <div class="line"></div>
        <div class="bold" style="font-size:11px; margin-bottom:2px;">IMPUTATION CHRONOLOGIQUE :</div>
        ${imputationLinesHtml}
      ` : ''}
      <div class="line"></div>
      <div class="row bold" style="font-size:13px;"><span>NOUVEAU SOLDE</span><span>${formatAr(nouveauSoldeClient)}</span></div>
    `, true);

    setShowConfirm(false);
    setSelectedClient(null);
    setSelectedInvoiceForDirectPayment(null);
    setMontant('');
    setRefreshKey(k => k + 1);
    showMsg(`Règlement de ${formatAr(montantNum)} enregistré avec succès !`);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse font-medium">
          {toast}
        </div>
      )}

      {/* Titre et sélecteur de vue */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>💳</span> Crédits clients
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Saisie directe du montant remboursé avec déduction chronologique automatique · Factures soldées masquées
          </p>
        </div>

        {/* Sélecteur de vue */}
        <div className="flex bg-gray-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('clients')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'clients'
                ? 'bg-white text-[#0D47A1] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <User size={15} />
            <span>Par client ({groupedClients.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('factures')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'factures'
                ? 'bg-white text-[#0D47A1] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Receipt size={15} />
            <span>Toutes les factures ({unpaidInvoices.length})</span>
          </button>
        </div>
      </div>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2 font-medium">
          <Lock size={18} className="text-amber-600 shrink-0" />
          <span>
            Consultation uniquement : Seul un Administrateur ou Gérant peut encaisser les remboursements de crédits.
          </span>
        </div>
      )}

      {/* Cartes d'indicateurs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <CreditCard size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase">Crédit total dû</p>
            <p className="text-xl font-extrabold text-red-600 tabular-nums">{formatAr(totalCredits)}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Receipt size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase">Factures impayées</p>
            <p className="text-xl font-extrabold text-amber-700 tabular-nums">{unpaidInvoices.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase">Clients débiteurs</p>
            <p className="text-xl font-extrabold text-gray-900 tabular-nums">{totalClientsCredit}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase">Règlements du jour</p>
            <p className="text-xl font-extrabold text-green-600 tabular-nums">{formatAr(totalRemboursementsJour)}</p>
          </div>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom de client, numéro de facture ou téléphone..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#0D47A1] focus:border-transparent"
          />
        </div>
      </div>

      {/* ===================================================================== */}
      {/* VUE 1 : FUSIONNÉE EN UN SEUL NOM (PAR CLIENT)                          */}
      {/* ===================================================================== */}
      {viewMode === 'clients' && (
        <div className="space-y-4">
          {groupedClients.map(group => {
            const { client, invoices, totalReste } = group;

            return (
              <div
                key={client.IDCLIENT}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 hover:border-gray-300 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Identité du client fusionné */}
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#0D47A1] text-white flex items-center justify-center font-black text-xl shrink-0 shadow-xs">
                      {client.NOM_CLIENT.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-black text-gray-900">
                          {client.NOM_CLIENT}
                        </h2>
                        {client.TELEPHONE && (
                          <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-lg border border-gray-200">
                            📞 {client.TELEPHONE}
                          </span>
                        )}
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                          {invoices.length} facture{invoices.length > 1 ? 's' : ''} impayée{invoices.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Client débiteur · Toutes les factures de crédit sont regroupées sous ce compte
                      </p>
                    </div>
                  </div>

                  {/* Solde restant dû et boutons d'action */}
                  <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100">
                    <div className="text-left md:text-right">
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        Reste total à payer
                      </p>
                      <p className="text-2xl sm:text-3xl font-black text-red-600 tabular-nums">
                        {formatAr(totalReste)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => openRemboursement(client.IDCLIENT)}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer min-h-[42px]"
                          title="Encaisser un montant directement pour ce client"
                        >
                          <DollarSign size={16} />
                          <span>Rembourser</span>
                        </button>
                      ) : (
                        <span className="px-3 py-2 rounded-xl bg-gray-100 text-gray-400 text-xs font-medium flex items-center gap-1">
                          <Lock size={13} /> Admin
                        </span>
                      )}

                      {/* Bouton qui ouvre en modale les détails de vente (remplace l'ancien Replier) */}
                      <button
                        type="button"
                        onClick={() => setModalClientDetailsId(client.IDCLIENT)}
                        className="bg-blue-50 hover:bg-blue-100 text-[#0D47A1] border border-blue-200 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer min-h-[42px]"
                        title="Ouvrir la liste détaillée des ventes et factures en modale"
                      >
                        <Receipt size={16} />
                        <span>Détails des ventes</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {groupedClients.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-gray-400 space-y-2">
              <CheckCircle2 size={40} className="mx-auto text-green-500 opacity-60" />
              <p className="text-base font-bold text-gray-700">Aucun crédit client en attente</p>
              <p className="text-xs text-gray-400">
                Toutes les factures de crédit sont entièrement réglées.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* VUE 2 : TOUTES LES FACTURES IMPAYÉES (LISTE GLOBALE)                  */}
      {/* ===================================================================== */}
      {viewMode === 'factures' && (
        <div className="space-y-4">
          {filteredInvoices.map(inv => {
            const isArticlesExpanded = expandedArticles.has(inv.idVente);
            const isPaymentsExpanded = expandedInvoices.has(inv.idVente);

            return (
              <div
                key={inv.idVente || inv.numeroFacture}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:border-gray-200 transition-all p-4 sm:p-5 space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-[#0D47A1] text-xs font-bold border border-blue-100 whitespace-nowrap font-mono">
                        <Receipt size={14} />
                        {inv.numeroFacture}
                      </span>
                      <span className="font-extrabold text-sm text-gray-900">{inv.clientNom}</span>
                      {inv.clientTelephone && (
                        <span className="text-xs text-gray-500 font-medium">({inv.clientTelephone})</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                      <span>Date : <strong>{inv.dateVente}</strong> {inv.heureVente && `à ${inv.heureVente}`}</span>
                      <span>·</span>
                      <span>Total : <strong>{formatAr(inv.totalVente)}</strong></span>
                      <span>·</span>
                      <span>Crédit : <strong>{formatAr(inv.creditInitial)}</strong></span>
                      {inv.totalPaye > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-green-700 font-semibold">Déjà réglé : {formatAr(inv.totalPaye)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                    <div className="text-left md:text-right">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Reste à payer</p>
                      <p className="text-xl font-black text-red-600 tabular-nums">{formatAr(inv.resteAPayer)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => openRemboursementFacture(inv)}
                          className="bg-green-600 hover:bg-green-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer min-h-[38px]"
                        >
                          <DollarSign size={14} />
                          <span>Rembourser</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleArticlesExpand(inv.idVente)}
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer min-h-[38px] ${
                          isArticlesExpanded
                            ? 'bg-blue-50 text-[#0D47A1] border-blue-200'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                      >
                        <Eye size={14} />
                        <span>Détail vente</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleInvoiceExpand(inv.idVente)}
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer min-h-[38px] ${
                          isPaymentsExpanded
                            ? 'bg-blue-50 text-[#0D47A1] border-blue-200'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                      >
                        <History size={14} />
                        <span>Paiements ({inv.paiements.length})</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section Détail de la vente (articles) */}
                {isArticlesExpanded && inv.articles.length > 0 && (
                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-700 flex items-center gap-1">
                        <Package size={13} className="text-[#0D47A1]" />
                        <span>Consommations de la facture {inv.numeroFacture}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => printVenteTicket(inv)}
                        className="text-xs font-bold text-[#0D47A1] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Printer size={13} />
                        <span>Imprimer ticket</span>
                      </button>
                    </div>
                    <div className="space-y-1">
                      {inv.articles.map((art, aIdx) => (
                        <div key={aIdx} className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                          <span className="text-gray-800 font-medium">{art.quantite}x {art.nom}</span>
                          <span className="text-gray-900 font-semibold tabular-nums">{formatAr(art.montant)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section Historique des paiements de la facture */}
                {isPaymentsExpanded && (
                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-2 animate-in fade-in">
                    <p className="text-xs font-bold text-gray-700 flex items-center gap-1">
                      <History size={13} className="text-[#0D47A1]" />
                      <span>Versements enregistrés sur {inv.numeroFacture} ({inv.paiements.length})</span>
                    </p>
                    {inv.paiements.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">Aucun versement n'a encore été effectué sur cette facture.</p>
                    ) : (
                      <div className="space-y-1 text-xs">
                        {inv.paiements.map((p, pIdx) => (
                          <div key={p.idPaiement || pIdx} className="flex justify-between py-1 border-b border-gray-100 last:border-0">
                            <span>{p.date} {p.heure} ({p.mode}) — reçu par {p.caissierNom}</span>
                            <span className="font-extrabold text-green-700 tabular-nums">+{formatAr(p.montant)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredInvoices.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-gray-400 space-y-2">
              <CheckCircle2 size={36} className="mx-auto text-green-500 opacity-60" />
              <p className="text-base font-bold text-gray-700">Aucune facture impayée trouvée</p>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1 : DÉTAILS DE VENTE D'UN CLIENT (OUVERT PAR LE BOUTON DÉTAILS) */}
      {/* Tableau élargi, épuré et synthétique des factures impayées            */}
      {/* ===================================================================== */}
      {modalClientGroup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-6xl xl:max-w-7xl w-full shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95">
            {/* En-tête de la modale */}
            <div className="bg-[#0D47A1] text-white px-5 sm:px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Receipt size={22} className="text-blue-200" />
                <div>
                  <h3 className="font-bold text-base sm:text-lg">
                    Détails des ventes à crédit — {modalClientGroup.client.NOM_CLIENT}
                  </h3>
                  <p className="text-xs text-blue-100">
                    {modalClientGroup.client.TELEPHONE ? `Tel: ${modalClientGroup.client.TELEPHONE} · ` : ''}
                    {modalClientGroup.invoices.length} facture{modalClientGroup.invoices.length > 1 ? 's' : ''} impayée{modalClientGroup.invoices.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalClientDetailsId(null)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Récapitulatif et bouton d'encaissement global */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-50/70 to-slate-50/50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Reste total à régler</p>
                  <p className="text-2xl sm:text-3xl font-black text-red-600 tabular-nums">
                    {formatAr(modalClientGroup.totalReste)}
                  </p>
                </div>
                <div className="hidden sm:block border-l border-gray-200 pl-5">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Factures impayées</p>
                  <p className="text-xl font-extrabold text-gray-800 tabular-nums">
                    {modalClientGroup.invoices.length}
                  </p>
                </div>
              </div>

              {isAdmin && modalClientGroup.totalReste > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const cId = modalClientGroup.client.IDCLIENT;
                    setModalClientDetailsId(null);
                    openRemboursement(cId);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                  title="Encaisser un montant global automatiquement réparti sur les factures anciennes"
                >
                  <DollarSign size={16} />
                  <span>Rembourser globalement (FIFO)</span>
                </button>
              )}
            </div>

            {/* Tableau élargi, synthétique et épuré des factures impayées */}
            <div className="p-4 sm:p-6 overflow-y-auto">
              {modalClientGroup.invoices.length === 0 ? (
                <div className="text-center py-10 bg-green-50/70 border border-green-200 rounded-2xl text-green-900 space-y-2 p-6">
                  <CheckCircle2 size={40} className="mx-auto text-green-600" />
                  <p className="text-base font-bold">Toutes les factures de crédit sont soldées !</p>
                  <p className="text-xs text-green-700">
                    Ce client n'a plus aucune facture de crédit impayée en attente.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs whitespace-nowrap">
                      <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 whitespace-nowrap">
                        <tr>
                          <th className="text-left px-4 py-3 whitespace-nowrap">N° Facture</th>
                          <th className="text-left px-4 py-3 whitespace-nowrap">Date</th>
                          <th className="text-right px-4 py-3 whitespace-nowrap">Crédit initial</th>
                          <th className="text-right px-4 py-3 whitespace-nowrap">Déjà réglé</th>
                          <th className="text-right px-4 py-3 text-red-600 whitespace-nowrap">Reste à payer</th>
                          <th className="text-center px-4 py-3 whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 whitespace-nowrap">
                        {modalClientGroup.invoices.map(inv => (
                          <tr key={inv.idVente || inv.numeroFacture} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-4 py-3 font-extrabold text-[#0D47A1] whitespace-nowrap">
                              <span className="bg-blue-50 text-[#0D47A1] px-2.5 py-1 rounded-md border border-blue-100 font-mono text-xs font-bold inline-block whitespace-nowrap">
                                {inv.numeroFacture}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-xs">
                              {inv.dateVente}{inv.heureVente ? ` ${inv.heureVente}` : ''}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-gray-800 tabular-nums whitespace-nowrap text-xs">
                              {formatAr(inv.creditInitial)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-green-700 tabular-nums whitespace-nowrap text-xs">
                              {inv.totalPaye > 0 ? formatAr(inv.totalPaye) : <span className="text-gray-400 font-normal">0 Ar</span>}
                            </td>
                            <td className="px-4 py-3 text-right font-black text-red-600 tabular-nums text-sm whitespace-nowrap">
                              {formatAr(inv.resteAPayer)}
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => openRemboursementFacture(inv)}
                                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs inline-flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                                    title={`Rembourser la facture ${inv.numeroFacture}`}
                                  >
                                    <DollarSign size={13} />
                                    <span>Rembourser</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setViewingSaleDetail({ invoice: inv, tab: 'articles' })}
                                  className="bg-blue-50 hover:bg-blue-100 text-[#0D47A1] border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                                  title="Consulter les consommations et le ticket de cette vente"
                                >
                                  <Eye size={13} />
                                  <span>Détail</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50/90 border-t-2 border-gray-200 font-bold whitespace-nowrap">
                        <tr>
                          <td colSpan={2} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                            Total ({modalClientGroup.invoices.length} factures) :
                          </td>
                          <td className="px-4 py-3 text-right text-gray-900 tabular-nums font-extrabold whitespace-nowrap">
                            {formatAr(modalClientGroup.invoices.reduce((s, i) => s + i.creditInitial, 0))}
                          </td>
                          <td className="px-4 py-3 text-right text-green-700 tabular-nums font-extrabold whitespace-nowrap">
                            {formatAr(modalClientGroup.invoices.reduce((s, i) => s + i.totalPaye, 0))}
                          </td>
                          <td className="px-4 py-3 text-right text-red-600 font-black tabular-nums text-sm whitespace-nowrap">
                            {formatAr(modalClientGroup.totalReste)}
                          </td>
                          <td className="whitespace-nowrap"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Pied de page du modal */}
            <div className="p-3.5 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setModalClientDetailsId(null)}
                className="px-5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOUS-MODAL DÉDIÉ : DÉTAIL D'UNE VENTE OU PAIEMENTS (évite d'allonger le tableau principal) */}
      {viewingSaleDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[70] animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in zoom-in-95">
            <div className="bg-[#0D47A1] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-blue-200" />
                <h4 className="font-bold text-sm sm:text-base">
                  Facture {viewingSaleDetail.invoice.numeroFacture}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setViewingSaleDetail(null)}
                className="p-1 rounded-lg hover:bg-white/20 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Onglets Articles / Paiements */}
            <div className="flex border-b border-gray-200 bg-gray-50 px-4 pt-2 shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setViewingSaleDetail({ ...viewingSaleDetail, tab: 'articles' })}
                className={`px-3 py-2 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  viewingSaleDetail.tab === 'articles'
                    ? 'border-[#0D47A1] text-[#0D47A1] bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Package size={14} />
                <span>Articles ({viewingSaleDetail.invoice.articles.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingSaleDetail({ ...viewingSaleDetail, tab: 'paiements' })}
                className={`px-3 py-2 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  viewingSaleDetail.tab === 'paiements'
                    ? 'border-[#0D47A1] text-[#0D47A1] bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <History size={14} />
                <span>Paiements ({viewingSaleDetail.invoice.paiements.length})</span>
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3">
              {viewingSaleDetail.tab === 'articles' ? (
                <>
                  <div className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                    <span>Date : <strong>{viewingSaleDetail.invoice.dateVente}</strong> {viewingSaleDetail.invoice.heureVente && `à ${viewingSaleDetail.invoice.heureVente}`}</span>
                    <span>Caissier : <strong>{viewingSaleDetail.invoice.caissierNom}</strong></span>
                  </div>

                  {viewingSaleDetail.invoice.articles.length === 0 ? (
                    <p className="text-xs text-gray-400 italic text-center py-4">Aucun article enregistré.</p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-600 font-semibold">
                          <tr>
                            <th className="text-left px-3 py-1.5">Article</th>
                            <th className="text-center px-2 py-1.5">Qté</th>
                            <th className="text-right px-3 py-1.5">P.U</th>
                            <th className="text-right px-3 py-1.5">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {viewingSaleDetail.invoice.articles.map((art, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-1.5 text-gray-800">{art.nom}</td>
                              <td className="px-2 py-1.5 text-center font-bold">{art.quantite}</td>
                              <td className="px-3 py-1.5 text-right text-gray-600">{formatAr(art.pu)}</td>
                              <td className="px-3 py-1.5 text-right font-bold text-gray-900">{formatAr(art.montant)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold border-t border-gray-200">
                          <tr>
                            <td colSpan={3} className="px-3 py-1.5">Total vente :</td>
                            <td className="px-3 py-1.5 text-right text-[#0D47A1]">
                              {formatAr(viewingSaleDetail.invoice.totalVente)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => printVenteTicket(viewingSaleDetail.invoice)}
                      className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-[#0D47A1] text-xs font-bold flex items-center gap-1 hover:bg-blue-100 cursor-pointer"
                    >
                      <Printer size={13} />
                      <span>Imprimer duplicata</span>
                    </button>
                    {isAdmin && viewingSaleDetail.invoice.resteAPayer > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const inv = viewingSaleDetail.invoice;
                          setViewingSaleDetail(null);
                          openRemboursementFacture(inv);
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <DollarSign size={13} />
                        <span>Rembourser</span>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {viewingSaleDetail.invoice.paiements.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-xs">
                      Aucun versement n'a encore été effectué sur cette facture.
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-amber-50 text-amber-900 font-semibold">
                          <tr>
                            <th className="text-left px-3 py-1.5">Date & Heure</th>
                            <th className="text-left px-2 py-1.5">Mode</th>
                            <th className="text-right px-3 py-1.5">Montant</th>
                            <th className="text-left px-3 py-1.5">Caissier</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {viewingSaleDetail.invoice.paiements.map((p, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-1.5 text-gray-800">{p.date} {p.heure && `à ${p.heure}`}</td>
                              <td className="px-2 py-1.5 font-semibold">{p.mode}</td>
                              <td className="px-3 py-1.5 text-right font-black text-green-700">{formatAr(p.montant)}</td>
                              <td className="px-3 py-1.5 text-gray-600">{p.caissierNom}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-amber-50 font-bold border-t border-amber-200">
                          <tr>
                            <td colSpan={2} className="px-3 py-1.5 text-amber-900">Total versé :</td>
                            <td className="px-3 py-1.5 text-right text-green-700 font-black">
                              {formatAr(viewingSaleDetail.invoice.totalPaye)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setViewingSaleDetail(null)}
                className="px-4 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-bold hover:bg-gray-100 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2 : ENCAISSEMENT DIRECT DU MONTANT SANS CHOISIR DE FACTURE       */}
      {/* Imputation automatique FIFO en cascade sur les factures les plus     */}
      {/* anciennes jusqu'à épuisement du montant saisi                        */}
      {/* ===================================================================== */}
      {selectedClientObj && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95">
            <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>💵</span>{' '}
                {selectedInvoiceForDirectPayment
                  ? `Rembourser la facture ${selectedInvoiceForDirectPayment.numeroFacture}`
                  : 'Encaisser un règlement de crédit'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedClient(null);
                  setSelectedInvoiceForDirectPayment(null);
                  setMontant('');
                }}
                className="p-1 rounded-lg hover:bg-white/20 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              {/* Infos client et facture */}
              <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-extrabold text-gray-900 text-base">{selectedClientObj.NOM_CLIENT}</p>
                    {selectedInvoiceForDirectPayment && (
                      <span className="text-[11px] font-bold bg-blue-100 text-[#0D47A1] px-2 py-0.5 rounded-md">
                        {selectedInvoiceForDirectPayment.numeroFacture}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 font-medium">
                    {selectedClientObj.TELEPHONE || 'Sans téléphone'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-gray-500 uppercase">
                    {selectedInvoiceForDirectPayment ? 'Reste sur cette facture' : 'Dette totale actuelle'}
                  </p>
                  <p className="text-xl font-black text-red-600 tabular-nums">
                    {formatAr(
                      selectedInvoiceForDirectPayment
                        ? selectedInvoiceForDirectPayment.resteAPayer
                        : selectedClientObj.CREDIT_TOTAL
                    )}
                  </p>
                </div>
              </div>

              {/* Saisie directe du montant */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-800">
                    Saisir le montant versé (Ar) :
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedInvoiceForDirectPayment) {
                        setMontant(String(selectedInvoiceForDirectPayment.resteAPayer));
                      } else {
                        setMontant(String(selectedClientObj.CREDIT_TOTAL));
                      }
                    }}
                    className="text-xs font-bold text-[#0D47A1] hover:underline cursor-pointer"
                  >
                    {selectedInvoiceForDirectPayment
                      ? `Solder la facture (${formatAr(selectedInvoiceForDirectPayment.resteAPayer)})`
                      : `Tout solder (${formatAr(selectedClientObj.CREDIT_TOTAL)})`}
                  </button>
                </div>
                <MoneyInput
                  value={montant}
                  onChange={val => setMontant(val ? String(val) : '')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-center text-2xl font-black focus:ring-2 focus:ring-[#0D47A1] focus:border-transparent tabular-nums"
                  placeholder="0"
                />
              </div>

              {/* Mode de paiement */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                  Mode d'encaissement :
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Espèces', 'Mobile Money'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setModePaiement(mode)}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        modePaiement === mode
                          ? 'bg-[#0D47A1] text-white shadow-xs'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {mode === 'Espèces' ? '💵 Espèces' : '📱 Mobile Money'}
                    </button>
                  ))}
                </div>
              </div>

              {/* SIMULATION VISUELLE EN TEMPS RÉEL */}
              {montantNum > 0 && selectedInvoiceForDirectPayment && (
                <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-blue-900 border-b border-blue-200 pb-1.5">
                    <span>Impact sur la facture {selectedInvoiceForDirectPayment.numeroFacture} :</span>
                    <span className="text-green-700">Versé : {formatAr(montantNum)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Reste dû sur facture après versement :</span>
                    <span className={`font-bold tabular-nums ${montantNum >= selectedInvoiceForDirectPayment.resteAPayer ? 'text-green-700' : 'text-red-600'}`}>
                      {formatAr(Math.max(0, selectedInvoiceForDirectPayment.resteAPayer - montantNum))}{' '}
                      {montantNum >= selectedInvoiceForDirectPayment.resteAPayer && '✅ Soldée'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-blue-200/60">
                    <span className="text-gray-600">Nouveau solde total client :</span>
                    <span className="font-extrabold text-gray-900 tabular-nums">
                      {formatAr(Math.max(0, selectedClientObj.CREDIT_TOTAL - montantNum))}
                    </span>
                  </div>
                </div>
              )}

              {montantNum > 0 && !selectedInvoiceForDirectPayment && (
                <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-blue-900 border-b border-blue-200 pb-1.5">
                    <span>Imputation automatique sur les factures :</span>
                    <span className="text-green-700">Versé : {formatAr(montantNum)}</span>
                  </div>

                  {fifoAllocations.length === 0 ? (
                    <p className="text-gray-500 italic">Déduction directe sur le compte client.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {fifoAllocations.map(alloc => (
                        <div
                          key={alloc.idVente}
                          className={`flex items-center justify-between p-2 rounded-lg ${
                            alloc.isSoldee
                              ? 'bg-green-50 text-green-900 border border-green-200'
                              : alloc.allocated > 0
                              ? 'bg-amber-50 text-amber-900 border border-amber-200'
                              : 'bg-white text-gray-600 border border-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {alloc.isSoldee ? (
                              <Check size={14} className="text-green-600 shrink-0 font-bold" />
                            ) : (
                              <Receipt size={14} className="text-gray-400 shrink-0" />
                            )}
                            <span className="font-bold">{alloc.numeroFacture}</span>
                            <span className="text-[11px] text-gray-500">
                              (Dû : {formatAr(alloc.resteAvant)})
                            </span>
                          </div>

                          <div className="text-right">
                            {alloc.allocated > 0 ? (
                              <span className="font-extrabold text-green-700">
                                -{formatAr(alloc.allocated)}{' '}
                                {alloc.isSoldee ? (
                                  <span className="text-[10px] bg-green-200 text-green-800 px-1 py-0.2 rounded font-bold">
                                    Soldée
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-700 font-semibold">
                                    (Reste {formatAr(alloc.resteApres)})
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-[11px] text-gray-400">Non impactée</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Nouveau solde global */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-blue-200 font-bold">
                    <span className="text-gray-700">Nouveau solde total client :</span>
                    <span className="text-sm text-green-700 tabular-nums">
                      {formatAr(Math.max(0, selectedClientObj.CREDIT_TOTAL - montantNum))}
                    </span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={montantNum <= 0 || montantNum > selectedClientObj.CREDIT_TOTAL}
                className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs transition-all active:scale-[0.98]"
              >
                Confirmer l'encaissement ({formatAr(montantNum)})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation */}
      <ConfirmModal
        open={showConfirm}
        type="success"
        title="Confirmer l'encaissement du crédit"
        message={
          selectedClientObj
            ? selectedInvoiceForDirectPayment
              ? `Enregistrer le règlement de ${formatAr(montantNum)} par ${modePaiement} pour la facture ${selectedInvoiceForDirectPayment.numeroFacture} de ${selectedClientObj.NOM_CLIENT} ?`
              : `Enregistrer le règlement de ${formatAr(montantNum)} par ${modePaiement} pour ${selectedClientObj.NOM_CLIENT} avec déduction chronologique automatique ?`
            : ''
        }
        confirmText="Oui, enregistrer et imprimer ticket"
        cancelText="Annuler"
        onConfirm={handleRemboursement}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
