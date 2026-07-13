import { useState } from 'react';
import { UtensilsCrossed, X, CreditCard, Banknote, Smartphone, Users, Printer, RotateCcw } from 'lucide-react';
import { store } from '../store';
import { Personnel, TableR, Client, ConsommationTable } from '../types';
import { formatAr, today, nowTime, nextId, genFactureNum, capitalize } from '../helpers';
import { printDirect, printTicket } from '../components/PrintTicket';
import ConfirmModal from '../components/ConfirmModal';

interface Props { user: Personnel }

export default function Tables({ user }: Props) {
  const [showPayModal, setShowPayModal] = useState<TableR | null>(null);
  const [showReturnModal, setShowReturnModal] = useState<TableR | null>(null);
  const [payMode, setPayMode] = useState<'especes' | 'mobile' | 'credit' | 'mixte'>('especes');
  const [payAmount, setPayAmount] = useState(0);
  const [payMobile, setPayMobile] = useState(0);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [toast, setToast] = useState('');
  const [confirmLiberer, setConfirmLiberer] = useState<TableR | null>(null);
  const [returnItems, setReturnItems] = useState<Record<number, number>>({});

  const tables = store.getTables();
  const consommations = store.getConsommations();
  const articles = store.getArticles();
  const clients = store.getClients();

  const isAdmin = user.ROLE === 'Administrateur';
  const isGerant = user.ROLE === 'Gérant';
  const isCaissier = user.ROLE === 'Caissier';

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // Tables visibles selon le rôle
  const visibleTables = tables.filter(t => {
    if (isAdmin || isGerant) return true;
    if (isCaissier) return t.ETAT === 'Libre' || t.IDCAISSIER === user.IDPERSONNEL;
    return true; // Serveur
  });

  const getTableConsommations = (tableId: number) => {
    return consommations.filter(c => c.IDTABLE === tableId);
  };

  const getTableTotal = (tableId: number) => {
    return getTableConsommations(tableId).reduce((s, c) => s + c.QUANTITE * c.PRIX_UNITAIRE, 0);
  };

  const canEncaisser = (table: TableR) => {
    if (isAdmin) return false;
    if (isGerant) return true;
    if (isCaissier) return table.IDCAISSIER === user.IDPERSONNEL;
    return false;
  };

  // Ouvrir modal paiement
  const openPayModal = (table: TableR) => {
    const total = getTableTotal(table.IDTABLE);
    setPayAmount(total);
    setPayMobile(0);
    setPayMode('especes');
    setSelectedClient(null);
    setShowNewClient(false);
    setShowPayModal(table);
  };

  // Ouvrir modal retour
  const openReturnModal = (table: TableR) => {
    setReturnItems({});
    setShowReturnModal(table);
  };

  // Traiter le retour d'articles
  const handleReturn = () => {
    if (!showReturnModal) return;
    
    const tableConsommations = getTableConsommations(showReturnModal.IDTABLE);
    const allConsommations = store.getConsommations();
    const artList = store.getArticles();
    const mvts = store.getMouvements();

    let mvtId = nextId(mvts, 'IDMOUVEMENT');
    const newMvts = [...mvts];
    const updatedArts = [...artList];
    let updatedConsommations = [...allConsommations];

    let totalReturned = 0;

    Object.entries(returnItems).forEach(([consommationId, returnQty]) => {
      if (returnQty <= 0) return;

      const consommation = tableConsommations.find(c => c.IDCONSOMMATION === Number(consommationId));
      if (!consommation) return;

      const article = artList.find(a => a.IDARTICLE === consommation.IDARTICLE);
      if (!article) return;

      // Mettre à jour la consommation
      const consIdx = updatedConsommations.findIndex(c => c.IDCONSOMMATION === consommation.IDCONSOMMATION);
      if (consIdx >= 0) {
        const newQty = updatedConsommations[consIdx].QUANTITE - returnQty;
        if (newQty <= 0) {
          // Supprimer la consommation
          updatedConsommations = updatedConsommations.filter(c => c.IDCONSOMMATION !== consommation.IDCONSOMMATION);
        } else {
          updatedConsommations[consIdx] = {
            ...updatedConsommations[consIdx],
            QUANTITE: newQty,
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

        // Mouvement de retour
        newMvts.push({
          IDMOUVEMENT: mvtId++,
          DATE_MOUVEMENT: today(),
          HEURE: nowTime(),
          IDARTICLE: article.IDARTICLE,
          TYPE: 'Entrée' as const,
          QUANTITE: returnQty,
          REFERENCE: `Retour Table ${showReturnModal.NUMERO} — ${user.PRENOM} ${user.NOM}`,
        });
      }

      totalReturned += returnQty * consommation.PRIX_UNITAIRE;
    });

    store.setConsommations(updatedConsommations);
    store.setArticles(updatedArts);
    store.setMouvements(newMvts);

    // Si plus de consommations, libérer la table
    const remainingConsommations = updatedConsommations.filter(c => c.IDTABLE === showReturnModal.IDTABLE);
    if (remainingConsommations.length === 0) {
      const updatedTables = tables.map(t =>
        t.IDTABLE === showReturnModal.IDTABLE
          ? { ...t, ETAT: 'Libre' as const, IDCAISSIER: undefined }
          : t
      );
      store.setTables(updatedTables);
    }

    setShowReturnModal(null);
    setReturnItems({});
    showMsg(`Retour effectué: ${formatAr(totalReturned)} déduit`);
  };

  // Créer client
  const handleCreateClient = () => {
    if (!newClientName.trim() || !newClientPhone.trim()) {
      showMsg('Nom et téléphone obligatoires');
      return;
    }
    const allClients = store.getClients();
    const newClient: Client = {
      IDCLIENT: nextId(allClients, 'IDCLIENT'),
      NOM_CLIENT: capitalize(newClientName.trim()),
      TELEPHONE: newClientPhone.trim(),
      CREDIT_TOTAL: 0,
      DATE_CREATION: today(),
    };
    store.setClients([...allClients, newClient]);
    setSelectedClient(newClient);
    setShowNewClient(false);
    setNewClientName('');
    setNewClientPhone('');
    showMsg('Client créé');
  };

  // Paiement table
  const handlePayment = () => {
    if (!showPayModal) return;

    const tableConsommations = getTableConsommations(showPayModal.IDTABLE);
    const total = getTableTotal(showPayModal.IDTABLE);

    const ventes = store.getVentes();
    const lignes = store.getLignesVente();
    const paiements = store.getPaiements();
    const allConsommations = store.getConsommations();
    const allClients = store.getClients();

    const idVente = nextId(ventes, 'IDVENTE');
    const numFacture = genFactureNum('VTE', idVente);

    // Créer la vente
    const newVente = {
      IDVENTE: idVente,
      NUMERO_FACTURE: numFacture,
      DATE_VENTE: today(),
      HEURE: nowTime(),
      IDPERSONNEL: user.IDPERSONNEL,
      IDTABLE: showPayModal.IDTABLE,
      TYPE: 'Table' as const,
      STATUT: 'Payée' as const,
      TOTAL: total,
      REMISE: 0,
      CLOTUREE: false,
      IDCLOTURE: null,
    };

    // Lignes de vente (agrégées par article)
    const articlesAgr: Record<number, { qty: number; prix: number }> = {};
    tableConsommations.forEach(c => {
      if (!articlesAgr[c.IDARTICLE]) {
        articlesAgr[c.IDARTICLE] = { qty: 0, prix: c.PRIX_UNITAIRE };
      }
      articlesAgr[c.IDARTICLE].qty += c.QUANTITE;
    });

    let ligneId = nextId(lignes, 'IDLIGNEVENTE');
    const newLignes = Object.entries(articlesAgr).map(([artId, data]) => ({
      IDLIGNEVENTE: ligneId++,
      IDVENTE: idVente,
      IDARTICLE: Number(artId),
      QUANTITE: data.qty,
      PRIX_UNITAIRE: data.prix,
      MONTANT: data.qty * data.prix,
    }));

    // Paiements
    let paiementId = nextId(paiements, 'IDPAIEMENT');
    const newPaiements: any[] = [];

    if (payMode === 'especes') {
      newPaiements.push({
        IDPAIEMENT: paiementId++,
        DATE_PAIEMENT: today(),
        HEURE: nowTime(),
        IDVENTE: idVente,
        IDPERSONNEL: user.IDPERSONNEL,
        MONTANT: total,
        MODE_PAIEMENT: 'Espèces' as const,
      });
    } else if (payMode === 'mobile') {
      newPaiements.push({
        IDPAIEMENT: paiementId++,
        DATE_PAIEMENT: today(),
        HEURE: nowTime(),
        IDVENTE: idVente,
        IDPERSONNEL: user.IDPERSONNEL,
        MONTANT: total,
        MODE_PAIEMENT: 'Mobile Money' as const,
      });
    } else if (payMode === 'credit') {
      if (!selectedClient) {
        showMsg('Sélectionnez un client');
        return;
      }
      newPaiements.push({
        IDPAIEMENT: paiementId++,
        DATE_PAIEMENT: today(),
        HEURE: nowTime(),
        IDVENTE: idVente,
        IDPERSONNEL: user.IDPERSONNEL,
        MONTANT: total,
        MODE_PAIEMENT: 'Crédit' as const,
        IDCLIENT: selectedClient.IDCLIENT,
      });
      const updatedClients = allClients.map(c =>
        c.IDCLIENT === selectedClient.IDCLIENT
          ? { ...c, CREDIT_TOTAL: c.CREDIT_TOTAL + total }
          : c
      );
      store.setClients(updatedClients);
    } else if (payMode === 'mixte') {
      const resteCredit = total - payAmount - payMobile;
      if (payAmount > 0) {
        newPaiements.push({
          IDPAIEMENT: paiementId++,
          DATE_PAIEMENT: today(),
          HEURE: nowTime(),
          IDVENTE: idVente,
          IDPERSONNEL: user.IDPERSONNEL,
          MONTANT: payAmount,
          MODE_PAIEMENT: 'Espèces' as const,
        });
      }
      if (payMobile > 0) {
        newPaiements.push({
          IDPAIEMENT: paiementId++,
          DATE_PAIEMENT: today(),
          HEURE: nowTime(),
          IDVENTE: idVente,
          IDPERSONNEL: user.IDPERSONNEL,
          MONTANT: payMobile,
          MODE_PAIEMENT: 'Mobile Money' as const,
        });
      }
      if (resteCredit > 0) {
        if (!selectedClient) {
          showMsg('Sélectionnez un client pour le crédit');
          return;
        }
        newPaiements.push({
          IDPAIEMENT: paiementId++,
          DATE_PAIEMENT: today(),
          HEURE: nowTime(),
          IDVENTE: idVente,
          IDPERSONNEL: user.IDPERSONNEL,
          MONTANT: resteCredit,
          MODE_PAIEMENT: 'Crédit' as const,
          IDCLIENT: selectedClient.IDCLIENT,
        });
        const updatedClients = allClients.map(c =>
          c.IDCLIENT === selectedClient.IDCLIENT
            ? { ...c, CREDIT_TOTAL: c.CREDIT_TOTAL + resteCredit }
            : c
        );
        store.setClients(updatedClients);
      }
    }

    store.setVentes([...ventes, newVente]);
    store.setLignesVente([...lignes, ...newLignes]);
    store.setPaiements([...paiements, ...newPaiements]);

    // Supprimer les consommations de cette table
    store.setConsommations(allConsommations.filter(c => c.IDTABLE !== showPayModal.IDTABLE));

    // Libérer la table
    const updatedTables = tables.map(t =>
      t.IDTABLE === showPayModal.IDTABLE
        ? { ...t, ETAT: 'Libre' as const, IDCAISSIER: undefined }
        : t
    );
    store.setTables(updatedTables);

    // Impression
    printTableReceipt(showPayModal, tableConsommations, total, numFacture);

    setShowPayModal(null);
    showMsg('Table encaissée !');
  };

  const printTableReceipt = (table: TableR, consommations: ConsommationTable[], total: number, numFacture: string) => {
    const rows = consommations.map(c => {
      const art = articles.find(a => a.IDARTICLE === c.IDARTICLE);
      return `<tr><td>${art?.NOM || '-'}</td><td style="text-align:right">${c.QUANTITE}</td><td style="text-align:right">${formatAr(c.PRIX_UNITAIRE)}</td><td style="text-align:right">${formatAr(c.QUANTITE * c.PRIX_UNITAIRE)}</td></tr>`;
    }).join('');

    const rendu = payMode === 'especes' && payAmount > total ? payAmount - total : 0;

    printDirect(`
      <div class="center bold">ENCAISSEMENT TABLE</div>
      <div class="center">${numFacture}</div>
      <div class="row"><span>${today()}</span><span>${nowTime()}</span></div>
      <div>Table: ${table.DESCRIPTION}</div>
      <div>Caissier: ${user.PRENOM} ${user.NOM}</div>
      <div class="line"></div>
      <table>
        <tr><td class="bold">Article</td><td class="bold right">Qté</td><td class="bold right">PU</td><td class="bold right">Mt</td></tr>
        ${rows}
      </table>
      <div class="line"></div>
      <div class="row bold"><span>TOTAL</span><span>${formatAr(total)}</span></div>
      ${payMode === 'especes' ? `
        <div class="row"><span>Payé</span><span>${formatAr(payAmount)}</span></div>
        <div class="row"><span>Rendu</span><span>${formatAr(rendu)}</span></div>
      ` : ''}
    `);
  };

  // Impression suivi table (APERÇU)
  const printSuivi = (table: TableR) => {
    const tableConsommations = getTableConsommations(table.IDTABLE);
    const total = getTableTotal(table.IDTABLE);

    const rows = tableConsommations.map(c => {
      const art = articles.find(a => a.IDARTICLE === c.IDARTICLE);
      return `<tr><td>${c.HEURE}</td><td>${art?.NOM || '-'}</td><td style="text-align:right">${c.QUANTITE}</td><td style="text-align:right">${formatAr(c.QUANTITE * c.PRIX_UNITAIRE)}</td></tr>`;
    }).join('');

    printTicket(`
      <div class="center bold">SUIVI TABLE</div>
      <div class="center">${table.DESCRIPTION}</div>
      <div class="row"><span>${today()}</span><span>${nowTime()}</span></div>
      <div class="line"></div>
      <table>
        <tr><td class="bold">Heure</td><td class="bold">Article</td><td class="bold right">Qté</td><td class="bold right">Mt</td></tr>
        ${rows}
      </table>
      <div class="line"></div>
      <div class="row bold"><span>TOTAL</span><span>${formatAr(total)}</span></div>
    `, 'Suivi Table');
  };

  const rendu = payMode === 'especes' && showPayModal && payAmount > getTableTotal(showPayModal.IDTABLE) 
    ? payAmount - getTableTotal(showPayModal.IDTABLE) 
    : 0;
  const resteCredit = payMode === 'mixte' && showPayModal
    ? Math.max(0, getTableTotal(showPayModal.IDTABLE) - payAmount - payMobile)
    : 0;

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-[60] animate-pulse">{toast}</div>}

      <h1 className="text-2xl font-bold text-gray-900">🍽️ Tables</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {visibleTables.map(table => {
          const tableConsommations = getTableConsommations(table.IDTABLE);
          const total = getTableTotal(table.IDTABLE);
          const isOccupied = table.ETAT === 'Occupée';

          return (
            <div
              key={table.IDTABLE}
              className={`bg-white rounded-2xl shadow-sm overflow-hidden border-2 transition-all ${
                isOccupied ? 'border-orange-300' : 'border-green-300'
              }`}
            >
              {/* Header */}
              <div className={`px-4 py-3 ${isOccupied ? 'bg-orange-50' : 'bg-green-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed size={20} className={isOccupied ? 'text-orange-600' : 'text-green-600'} />
                    <span className="font-bold">{table.DESCRIPTION}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    isOccupied ? 'bg-orange-200 text-orange-700' : 'bg-green-200 text-green-700'
                  }`}>
                    {table.ETAT}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{table.PLACES} places</p>
              </div>

              {/* Content */}
              <div className="p-4">
                {isOccupied ? (
                  <>
                    <div className="text-center mb-4">
                      <p className="text-sm text-gray-500">Total</p>
                      <p className="text-2xl font-bold text-[#0D47A1]">{formatAr(total)}</p>
                      <p className="text-xs text-gray-400">{tableConsommations.length} article(s)</p>
                    </div>

                    {isAdmin ? (
                      <p className="text-center text-sm text-gray-400 italic">Admin: lecture seule</p>
                    ) : canEncaisser(table) ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openPayModal(table)}
                            className="flex-1 bg-green-500 text-white py-2 rounded-xl font-medium hover:bg-green-600 flex items-center justify-center gap-1"
                          >
                            <CreditCard size={16} /> Encaisser
                          </button>
                          <button
                            onClick={() => printSuivi(table)}
                            className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200"
                            title="Imprimer suivi"
                          >
                            <Printer size={16} />
                          </button>
                        </div>
                        <button
                          onClick={() => openReturnModal(table)}
                          className="w-full bg-orange-100 text-orange-700 py-2 rounded-xl font-medium hover:bg-orange-200 flex items-center justify-center gap-1"
                        >
                          <RotateCcw size={16} /> Retour article
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => printSuivi(table)}
                        className="w-full bg-gray-100 text-gray-600 py-2 rounded-xl font-medium hover:bg-gray-200 flex items-center justify-center gap-1"
                      >
                        <Printer size={16} /> Voir suivi
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4 text-gray-400">
                    <UtensilsCrossed size={32} className="mx-auto mb-2 opacity-50" />
                    <p>Table libre</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Paiement */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPayModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">💳 Encaissement - {showPayModal.DESCRIPTION}</h3>
              <button onClick={() => setShowPayModal(null)}><X size={20} /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Total */}
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500">Total à payer</p>
                <p className="text-3xl font-bold text-[#0D47A1]">{formatAr(getTableTotal(showPayModal.IDTABLE))}</p>
              </div>

              {/* Mode de paiement */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPayMode('especes')}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                    payMode === 'especes' ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}
                >
                  <Banknote size={24} className="text-green-600" />
                  <span className="font-medium">Espèces</span>
                </button>
                <button
                  onClick={() => setPayMode('mobile')}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                    payMode === 'mobile' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <Smartphone size={24} className="text-blue-600" />
                  <span className="font-medium">Mobile Money</span>
                </button>
                <button
                  onClick={() => setPayMode('credit')}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                    payMode === 'credit' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                  }`}
                >
                  <Users size={24} className="text-orange-600" />
                  <span className="font-medium">Crédit</span>
                </button>
                <button
                  onClick={() => setPayMode('mixte')}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                    payMode === 'mixte' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                  }`}
                >
                  <CreditCard size={24} className="text-purple-600" />
                  <span className="font-medium">Mixte</span>
                </button>
              </div>

              {/* Espèces */}
              {payMode === 'especes' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Montant reçu</label>
                    <input
                      type="number"
                      value={payAmount}
                      onChange={e => setPayAmount(Number(e.target.value))}
                      className="w-full mt-1 px-4 py-3 border rounded-xl text-lg font-bold text-center focus:ring-2 focus:ring-[#0D47A1]"
                    />
                  </div>
                  {rendu > 0 && (
                    <div className="bg-green-50 rounded-xl p-4 text-center">
                      <p className="text-sm text-green-600">Rendu</p>
                      <p className="text-2xl font-bold text-green-600">{formatAr(rendu)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Crédit */}
              {payMode === 'credit' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Client</label>
                    <select
                      value={selectedClient?.IDCLIENT || ''}
                      onChange={e => setSelectedClient(clients.find(c => c.IDCLIENT === Number(e.target.value)) || null)}
                      className="w-full mt-1 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#0D47A1]"
                    >
                      <option value="">-- Sélectionner --</option>
                      {clients.map(c => (
                        <option key={c.IDCLIENT} value={c.IDCLIENT}>{c.NOM_CLIENT} - {c.TELEPHONE}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => setShowNewClient(!showNewClient)}
                    className="w-full py-2 text-[#0D47A1] font-medium hover:underline"
                  >
                    + Nouveau client
                  </button>
                  {showNewClient && (
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <input
                        type="text"
                        placeholder="Nom du client"
                        value={newClientName}
                        onChange={e => setNewClientName(capitalize(e.target.value))}
                        className="w-full px-4 py-2 border rounded-xl"
                      />
                      <input
                        type="tel"
                        placeholder="Téléphone"
                        value={newClientPhone}
                        onChange={e => setNewClientPhone(e.target.value)}
                        className="w-full px-4 py-2 border rounded-xl"
                      />
                      <button
                        onClick={handleCreateClient}
                        className="w-full bg-[#0D47A1] text-white py-2 rounded-xl font-medium"
                      >
                        Créer le client
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mixte */}
              {payMode === 'mixte' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Espèces</label>
                    <input
                      type="number"
                      value={payAmount}
                      onChange={e => setPayAmount(Number(e.target.value))}
                      className="w-full mt-1 px-4 py-3 border rounded-xl font-bold focus:ring-2 focus:ring-[#0D47A1]"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Mobile Money</label>
                    <input
                      type="number"
                      value={payMobile}
                      onChange={e => setPayMobile(Number(e.target.value))}
                      className="w-full mt-1 px-4 py-3 border rounded-xl font-bold focus:ring-2 focus:ring-[#0D47A1]"
                    />
                  </div>
                  {resteCredit > 0 && (
                    <>
                      <div className="bg-orange-50 rounded-xl p-3 text-center">
                        <p className="text-sm text-orange-600">Reste en crédit: <span className="font-bold">{formatAr(resteCredit)}</span></p>
                      </div>
                      <select
                        value={selectedClient?.IDCLIENT || ''}
                        onChange={e => setSelectedClient(clients.find(c => c.IDCLIENT === Number(e.target.value)) || null)}
                        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#0D47A1]"
                      >
                        <option value="">-- Client pour le crédit --</option>
                        {clients.map(c => (
                          <option key={c.IDCLIENT} value={c.IDCLIENT}>{c.NOM_CLIENT}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              )}

              <button
                onClick={handlePayment}
                className="w-full bg-green-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-600"
              >
                Valider le paiement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Retour Article */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowReturnModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-orange-500 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <RotateCcw size={20} /> Retour Article - {showReturnModal.DESCRIPTION}
              </h3>
              <button onClick={() => setShowReturnModal(null)}><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {getTableConsommations(showReturnModal.IDTABLE).map(consommation => {
                const article = articles.find(a => a.IDARTICLE === consommation.IDARTICLE);
                const currentReturn = returnItems[consommation.IDCONSOMMATION] || 0;

                return (
                  <div key={consommation.IDCONSOMMATION} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">{article?.EMOJI} {article?.NOM}</p>
                        <p className="text-sm text-gray-500">
                          {consommation.QUANTITE} x {formatAr(consommation.PRIX_UNITAIRE)}
                        </p>
                      </div>
                      <p className="font-bold text-[#0D47A1]">
                        {formatAr(consommation.QUANTITE * consommation.PRIX_UNITAIRE)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">Retourner:</span>
                      <input
                        type="number"
                        min="0"
                        max={consommation.QUANTITE}
                        value={currentReturn}
                        onChange={e => setReturnItems({
                          ...returnItems,
                          [consommation.IDCONSOMMATION]: Math.min(
                            Math.max(0, Number(e.target.value)),
                            consommation.QUANTITE
                          )
                        })}
                        className="w-20 text-center border rounded-lg px-2 py-1"
                      />
                      <span className="text-sm text-gray-400">/ {consommation.QUANTITE}</span>
                    </div>
                  </div>
                );
              })}

              {Object.values(returnItems).some(v => v > 0) && (
                <div className="bg-orange-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-orange-600">Montant à déduire</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatAr(
                      Object.entries(returnItems).reduce((sum, [consId, qty]) => {
                        const cons = consommations.find(c => c.IDCONSOMMATION === Number(consId));
                        return sum + (cons ? qty * cons.PRIX_UNITAIRE : 0);
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
    </div>
  );
}
