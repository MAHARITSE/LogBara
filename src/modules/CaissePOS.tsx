import { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, X, Search, CreditCard, Banknote, Smartphone, Users, Trash2, Send, ShoppingBag } from 'lucide-react';
import { store } from '../store';
import { Personnel, Article, CartItem, TableR, Client } from '../types';
import { formatAr, today, nowTime, nextId, genFactureNum, capitalize } from '../helpers';
import { printDirect } from '../components/PrintTicket';
import ConfirmModal from '../components/ConfirmModal';

interface Props { user: Personnel }

export default function CaissePOS({ user }: Props) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [mode, setMode] = useState<'comptoir' | 'table'>('comptoir');
  const [selectedTable, setSelectedTable] = useState<TableR | null>(null);
  const [search, setSearch] = useState('');
  const [familleFilter, setFamilleFilter] = useState<number | null>(null);
  const [remise, setRemise] = useState(0);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showAchatModal, setShowAchatModal] = useState(false);
  const [payMode, setPayMode] = useState<'especes' | 'mobile' | 'credit' | 'mixte'>('especes');
  const [payAmount, setPayAmount] = useState(0);
  const [payMobile, setPayMobile] = useState(0);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [toast, setToast] = useState('');
  const [confirmSend, setConfirmSend] = useState(false);

  const articles = store.getArticles().filter(a => a.ACTIF);
  const familles = store.getFamilles();
  const tables = store.getTables();
  const clients = store.getClients();
  const consommations = store.getConsommations();

  // Tables disponibles pour ce caissier
  const availableTables = tables.filter(t => 
    t.ETAT === 'Libre' || t.IDCAISSIER === user.IDPERSONNEL
  );

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const filteredArticles = articles.filter(a => {
    const matchSearch = a.NOM.toLowerCase().includes(search.toLowerCase()) || 
                       a.CODE.toLowerCase().includes(search.toLowerCase());
    const matchFamille = familleFilter === null || a.IDFAMILLE === familleFilter;
    return matchSearch && matchFamille;
  });

  const addToCart = (article: Article) => {
    // Vérifier stock si géré
    if (article.GERE_STOCK && article.STOCK <= 0) {
      showMsg('Stock épuisé !');
      return;
    }

    const existing = cart.find(c => c.article.IDARTICLE === article.IDARTICLE);
    if (existing) {
      if (article.GERE_STOCK && existing.quantite >= article.STOCK) {
        showMsg('Stock insuffisant !');
        return;
      }
      setCart(cart.map(c => 
        c.article.IDARTICLE === article.IDARTICLE 
          ? { ...c, quantite: c.quantite + 1 }
          : c
      ));
    } else {
      setCart([...cart, { article, quantite: 1, prix_unitaire: article.PRIX_VENTE }]);
    }
  };

  const updateQty = (artId: number, delta: number) => {
    setCart(cart.map(c => {
      if (c.article.IDARTICLE === artId) {
        const newQty = c.quantite + delta;
        if (newQty <= 0) return c;
        if (c.article.GERE_STOCK && newQty > c.article.STOCK) {
          showMsg('Stock insuffisant !');
          return c;
        }
        return { ...c, quantite: newQty };
      }
      return c;
    }));
  };

  const updatePrice = (artId: number, price: number) => {
    setCart(cart.map(c => 
      c.article.IDARTICLE === artId ? { ...c, prix_unitaire: price } : c
    ));
  };

  const removeFromCart = (artId: number) => {
    setCart(cart.filter(c => c.article.IDARTICLE !== artId));
  };

  const total = cart.reduce((s, c) => s + c.quantite * c.prix_unitaire, 0);
  const totalNet = total - remise;

  // Envoi commande à une table (sans paiement)
  const handleSendToTable = () => {
    if (!selectedTable) {
      showMsg('Sélectionnez une table');
      return;
    }
    if (cart.length === 0) {
      showMsg('Panier vide !');
      return;
    }

    const allConsommations = store.getConsommations();
    let idBase = nextId(allConsommations, 'IDCONSOMMATION');

    const newConsommations = cart.map(c => ({
      IDCONSOMMATION: idBase++,
      IDTABLE: selectedTable.IDTABLE,
      IDARTICLE: c.article.IDARTICLE,
      QUANTITE: c.quantite,
      PRIX_UNITAIRE: c.prix_unitaire,
      HEURE: nowTime(),
      IDPERSONNEL: user.IDPERSONNEL,
    }));

    // Mise à jour stock
    const artList = store.getArticles();
    const mvts = store.getMouvements();
    let mvtId = nextId(mvts, 'IDMOUVEMENT');
    const newMvts = [...mvts];
    const updatedArts = artList.map(a => {
      const cartItem = cart.find(c => c.article.IDARTICLE === a.IDARTICLE);
      if (cartItem && a.GERE_STOCK) {
        newMvts.push({
          IDMOUVEMENT: mvtId++,
          DATE_MOUVEMENT: today(),
          HEURE: nowTime(),
          IDARTICLE: a.IDARTICLE,
          TYPE: 'Sortie' as const,
          QUANTITE: cartItem.quantite,
          REFERENCE: `Table ${selectedTable.NUMERO} — ${user.PRENOM} ${user.NOM}`,
        });
        return { ...a, STOCK: a.STOCK - cartItem.quantite };
      }
      return a;
    });

    store.setArticles(updatedArts);
    store.setMouvements(newMvts);
    store.setConsommations([...allConsommations, ...newConsommations]);

    // Marquer table occupée
    const updatedTables = tables.map(t => 
      t.IDTABLE === selectedTable.IDTABLE 
        ? { ...t, ETAT: 'Occupée' as const, IDCAISSIER: user.IDPERSONNEL }
        : t
    );
    store.setTables(updatedTables);

    showMsg(`Commande envoyée à ${selectedTable.DESCRIPTION}`);
    setCart([]);
    setSelectedTable(null);
    setRemise(0);
    setConfirmSend(false);
  };

  // Paiement
  const openPayModal = () => {
    if (cart.length === 0) {
      showMsg('Panier vide !');
      return;
    }
    setPayAmount(totalNet);
    setPayMobile(0);
    setPayMode('especes');
    setSelectedClient(null);
    setShowNewClient(false);
    setShowPayModal(true);
  };

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

  const handlePayment = () => {
    const ventes = store.getVentes();
    const lignes = store.getLignesVente();
    const paiements = store.getPaiements();
    const artList = store.getArticles();
    const mvts = store.getMouvements();
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
      IDTABLE: mode === 'table' && selectedTable ? selectedTable.IDTABLE : null,
      TYPE: mode === 'comptoir' ? 'Comptoir' as const : 'Table' as const,
      STATUT: 'Payée' as const,
      TOTAL: total,
      REMISE: remise,
      CLOTUREE: false,
      IDCLOTURE: null,
    };

    // Lignes de vente
    let ligneId = nextId(lignes, 'IDLIGNEVENTE');
    const newLignes = cart.map(c => ({
      IDLIGNEVENTE: ligneId++,
      IDVENTE: idVente,
      IDARTICLE: c.article.IDARTICLE,
      QUANTITE: c.quantite,
      PRIX_UNITAIRE: c.prix_unitaire,
      MONTANT: c.quantite * c.prix_unitaire,
    }));

    // Paiements
    let paiementId = nextId(paiements, 'IDPAIEMENT');
    const newPaiements = [];

    if (payMode === 'especes') {
      newPaiements.push({
        IDPAIEMENT: paiementId++,
        DATE_PAIEMENT: today(),
        HEURE: nowTime(),
        IDVENTE: idVente,
        IDPERSONNEL: user.IDPERSONNEL,
        MONTANT: totalNet,
        MODE_PAIEMENT: 'Espèces' as const,
      });
    } else if (payMode === 'mobile') {
      newPaiements.push({
        IDPAIEMENT: paiementId++,
        DATE_PAIEMENT: today(),
        HEURE: nowTime(),
        IDVENTE: idVente,
        IDPERSONNEL: user.IDPERSONNEL,
        MONTANT: totalNet,
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
        MONTANT: totalNet,
        MODE_PAIEMENT: 'Crédit' as const,
        IDCLIENT: selectedClient.IDCLIENT,
      });
      // Mettre à jour crédit client
      const updatedClients = allClients.map(c => 
        c.IDCLIENT === selectedClient.IDCLIENT 
          ? { ...c, CREDIT_TOTAL: c.CREDIT_TOTAL + totalNet }
          : c
      );
      store.setClients(updatedClients);
    } else if (payMode === 'mixte') {
      const resteCredit = totalNet - payAmount - payMobile;
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

    // Mise à jour stock (mode comptoir seulement, table déjà fait à l'envoi)
    if (mode === 'comptoir') {
      let mvtId = nextId(mvts, 'IDMOUVEMENT');
      const newMvts = [...mvts];
      const updatedArts = artList.map(a => {
        const cartItem = cart.find(c => c.article.IDARTICLE === a.IDARTICLE);
        if (cartItem && a.GERE_STOCK) {
          newMvts.push({
            IDMOUVEMENT: mvtId++,
            DATE_MOUVEMENT: today(),
            HEURE: nowTime(),
            IDARTICLE: a.IDARTICLE,
            TYPE: 'Sortie' as const,
            QUANTITE: cartItem.quantite,
            REFERENCE: `${numFacture} — ${user.PRENOM} ${user.NOM}`,
          });
          return { ...a, STOCK: a.STOCK - cartItem.quantite };
        }
        return a;
      });
      store.setArticles(updatedArts);
      store.setMouvements(newMvts);
    }

    store.setVentes([...ventes, newVente]);
    store.setLignesVente([...lignes, ...newLignes]);
    store.setPaiements([...paiements, ...newPaiements]);

    // Impression
    printReceipt(numFacture, newVente, cart);

    setShowPayModal(false);
    setCart([]);
    setRemise(0);
    setSelectedTable(null);
    showMsg('Vente enregistrée !');
  };

  const printReceipt = (numFacture: string, vente: any, items: CartItem[]) => {
    const rows = items.map(c => 
      `<tr><td>${c.article.NOM}</td><td style="text-align:right">${c.quantite}</td><td style="text-align:right">${formatAr(c.prix_unitaire)}</td><td style="text-align:right">${formatAr(c.quantite * c.prix_unitaire)}</td></tr>`
    ).join('');

    const rendu = payMode === 'especes' && payAmount > totalNet ? payAmount - totalNet : 0;

    printDirect(`
      <div class="center bold">TICKET DE CAISSE</div>
      <div class="center">${numFacture}</div>
      <div class="row"><span>${vente.DATE_VENTE}</span><span>${vente.HEURE}</span></div>
      <div>Caissier: ${user.PRENOM} ${user.NOM}</div>
      ${vente.TYPE === 'Table' ? `<div>Table: ${selectedTable?.DESCRIPTION}</div>` : ''}
      <div class="line"></div>
      <table>
        <tr><td class="bold">Article</td><td class="bold right">Qté</td><td class="bold right">PU</td><td class="bold right">Mt</td></tr>
        ${rows}
      </table>
      <div class="line"></div>
      <div class="row"><span>Sous-total</span><span>${formatAr(total)}</span></div>
      ${remise > 0 ? `<div class="row"><span>Remise</span><span>-${formatAr(remise)}</span></div>` : ''}
      <div class="row bold"><span>TOTAL</span><span>${formatAr(totalNet)}</span></div>
      ${payMode === 'especes' ? `
        <div class="row"><span>Payé</span><span>${formatAr(payAmount)}</span></div>
        <div class="row"><span>Rendu</span><span>${formatAr(rendu)}</span></div>
      ` : ''}
    `);
  };

  const rendu = payMode === 'especes' && payAmount > totalNet ? payAmount - totalNet : 0;
  const resteCredit = payMode === 'mixte' ? Math.max(0, totalNet - payAmount - payMobile) : 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] lg:h-screen gap-4">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-[60] animate-pulse">{toast}</div>}

      {/* Panier */}
      <div className="w-80 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
        {/* Mode toggle */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex gap-2">
            <button
              onClick={() => { setMode('comptoir'); setSelectedTable(null); }}
              className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${
                mode === 'comptoir' 
                  ? 'bg-[#0D47A1] text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Comptoir
            </button>
            <button
              onClick={() => setMode('table')}
              className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${
                mode === 'table' 
                  ? 'bg-[#0D47A1] text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Table
            </button>
          </div>

          {mode === 'table' && (
            <select
              value={selectedTable?.IDTABLE || ''}
              onChange={e => setSelectedTable(tables.find(t => t.IDTABLE === Number(e.target.value)) || null)}
              className="w-full mt-3 px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-[#0D47A1]"
            >
              <option value="">-- Sélectionner une table --</option>
              {availableTables.map(t => (
                <option key={t.IDTABLE} value={t.IDTABLE}>
                  {t.DESCRIPTION} ({t.ETAT})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ShoppingCart size={48} className="mb-2" />
              <p>Panier vide</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map(c => (
                <div key={c.article.IDARTICLE} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{c.article.NOM}</p>
                      {c.article.SAISIE_PRIX_VENTE && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">✏️ Prix libre</span>
                      )}
                    </div>
                    <button onClick={() => removeFromCart(c.article.IDARTICLE)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => updateQty(c.article.IDARTICLE, -1)}
                        className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center font-semibold">{c.quantite}</span>
                      <button 
                        onClick={() => updateQty(c.article.IDARTICLE, 1)}
                        className="w-7 h-7 rounded-full bg-[#0D47A1] text-white flex items-center justify-center hover:bg-[#1565C0]"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    {c.article.SAISIE_PRIX_VENTE ? (
                      <input
                        type="number"
                        value={c.prix_unitaire}
                        onChange={e => updatePrice(c.article.IDARTICLE, Number(e.target.value))}
                        className="w-24 text-right px-2 py-1 border rounded-lg text-sm font-semibold"
                      />
                    ) : (
                      <span className="text-sm text-gray-500">{formatAr(c.prix_unitaire)}</span>
                    )}
                  </div>
                  <div className="text-right mt-1 font-bold text-[#0D47A1] text-sm">
                    {formatAr(c.quantite * c.prix_unitaire)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Remise & Total */}
        <div className="p-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Remise:</span>
            <input
              type="number"
              value={remise}
              onChange={e => setRemise(Math.max(0, Number(e.target.value)))}
              className="flex-1 px-3 py-2 border rounded-lg text-sm"
              placeholder="0"
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold">Total:</span>
            <span className="text-xl font-bold text-[#0D47A1]">{formatAr(totalNet)}</span>
          </div>

          {/* Boutons */}
          <div className="flex gap-2">
            {mode === 'table' && (
              <button
                onClick={() => setConfirmSend(true)}
                disabled={cart.length === 0 || !selectedTable}
                className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send size={18} /> Envoyer
              </button>
            )}
            <button
              onClick={openPayModal}
              disabled={cart.length === 0}
              className={`${mode === 'table' ? 'flex-1' : 'w-full'} bg-green-500 text-white py-3 rounded-xl font-bold hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              <CreditCard size={18} /> Payer
            </button>
          </div>

          {/* Bouton Achats pour Caissier */}
          {user.ROLE === 'Caissier' && (
            <button
              onClick={() => setShowAchatModal(true)}
              className="w-full bg-blue-100 text-blue-700 py-2.5 rounded-xl font-medium hover:bg-blue-200 flex items-center justify-center gap-2"
            >
              <ShoppingBag size={18} /> Saisir un achat
            </button>
          )}
        </div>
      </div>

      {/* Articles Grid */}
      <div className="flex-1 flex flex-col">
        {/* Search & Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un article..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-[#0D47A1]"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            <button
              onClick={() => setFamilleFilter(null)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                familleFilter === null ? 'bg-[#0D47A1] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Tous
            </button>
            {familles.map(f => (
              <button
                key={f.IDFAMILLE}
                onClick={() => setFamilleFilter(f.IDFAMILLE)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  familleFilter === f.IDFAMILLE 
                    ? 'text-white' 
                    : 'text-gray-600 hover:opacity-80'
                }`}
                style={{ 
                  backgroundColor: familleFilter === f.IDFAMILLE ? f.COULEUR : f.COULEUR + '20',
                  color: familleFilter === f.IDFAMILLE ? 'white' : f.COULEUR
                }}
              >
                {f.FAMILLE}
              </button>
            ))}
          </div>
        </div>

        {/* Articles */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredArticles.map(a => {
              const famille = familles.find(f => f.IDFAMILLE === a.IDFAMILLE);
              const inCart = cart.find(c => c.article.IDARTICLE === a.IDARTICLE);
              const lowStock = a.GERE_STOCK && a.STOCK <= a.STOCK_MIN;

              return (
                <button
                  key={a.IDARTICLE}
                  onClick={() => addToCart(a)}
                  disabled={a.GERE_STOCK && a.STOCK <= 0}
                  className={`relative h-36 bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex flex-col items-center justify-center transition-all hover:shadow-md hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed ${
                    lowStock ? 'border-red-200' : ''
                  }`}
                >
                  {inCart && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#0D47A1] text-white text-xs flex items-center justify-center font-bold">
                      {inCart.quantite}
                    </div>
                  )}
                  {a.SAISIE_PRIX_VENTE && (
                    <div className="absolute top-2 left-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                      ✏️
                    </div>
                  )}
                  <span className="text-3xl mb-2">{a.IMAGE ? <img src={a.IMAGE} className="w-10 h-10 object-contain" /> : a.EMOJI || '📦'}</span>
                  <p className="font-medium text-sm text-center line-clamp-2">{a.NOM}</p>
                  <p className="text-[#0D47A1] font-bold text-sm">{formatAr(a.PRIX_VENTE)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span 
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: famille?.COULEUR + '18', color: famille?.COULEUR }}
                    >
                      {famille?.FAMILLE}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${lowStock ? 'text-red-500' : 'text-gray-400'}`}>
                    {a.GERE_STOCK ? `Stock: ${a.STOCK}` : '∞ Libre'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal Paiement */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPayModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">💳 Paiement</h3>
              <button onClick={() => setShowPayModal(false)}><X size={20} /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Total */}
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500">Total à payer</p>
                <p className="text-3xl font-bold text-[#0D47A1]">{formatAr(totalNet)}</p>
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

      {/* Modal Achats rapide */}
      {showAchatModal && (
        <AchatRapideModal 
          user={user} 
          onClose={() => setShowAchatModal(false)} 
          onSuccess={() => { setShowAchatModal(false); showMsg('Achat enregistré !'); }} 
        />
      )}

      {/* Confirmation envoi table */}
      <ConfirmModal
        open={confirmSend}
        type="info"
        title="Envoyer la commande"
        message={`Envoyer ${cart.length} article(s) à ${selectedTable?.DESCRIPTION || ''} sans encaissement ?`}
        confirmText="Oui, envoyer"
        cancelText="Annuler"
        onConfirm={handleSendToTable}
        onCancel={() => setConfirmSend(false)}
      />
    </div>
  );
}

// Composant Achat Rapide pour Caissier
function AchatRapideModal({ user, onClose, onSuccess }: { user: Personnel; onClose: () => void; onSuccess: () => void }) {
  const [fournisseur, setFournisseur] = useState<number | null>(null);
  const [searchArt, setSearchArt] = useState('');
  const [lignes, setLignes] = useState<{ IDARTICLE: number; QUANTITE: number; PRIX_ACHAT: number; PRIX_VENTE: number }[]>([]);

  const articles = store.getArticles();
  const fournisseurs = store.getFournisseurs();

  const filteredArt = articles.filter(a =>
    a.ACTIF &&
    a.NOM.toLowerCase().includes(searchArt.toLowerCase()) &&
    !lignes.some(l => l.IDARTICLE === a.IDARTICLE)
  ).slice(0, 6);

  const addLigne = (art: Article) => {
    setLignes([...lignes, { 
      IDARTICLE: art.IDARTICLE, 
      QUANTITE: 1, 
      PRIX_ACHAT: art.PRIX_ACHAT, 
      PRIX_VENTE: art.PRIX_VENTE 
    }]);
    setSearchArt('');
  };

  const total = lignes.reduce((s, l) => s + l.QUANTITE * l.PRIX_ACHAT, 0);

  const handleSave = () => {
    if (!fournisseur || lignes.length === 0) return;

    const achatsList = store.getAchats();
    const lignesList = store.getLignesAchat();
    const artList = store.getArticles();
    const mvts = store.getMouvements();

    const idAchat = nextId(achatsList, 'IDACHAT');
    const ref = `ACH-${today().replace(/-/g, '')}-${String(idAchat).padStart(4, '0')}`;

    const newAchat = {
      IDACHAT: idAchat,
      DATE_ACHAT: today(),
      REFERENCE: ref,
      IDFOURNISSEUR: fournisseur,
      TOTAL: total,
      OBSERVATION: `Saisie par ${user.PRENOM} ${user.NOM}`,
    };

    let ligneIdBase = nextId(lignesList, 'IDLIGNEACHAT');
    let mvtIdBase = nextId(mvts, 'IDMOUVEMENT');
    const newLignes: any[] = [];
    const newMvts = [...mvts];
    const updatedArts = [...artList];

    lignes.forEach(l => {
      newLignes.push({
        IDLIGNEACHAT: ligneIdBase++,
        IDACHAT: idAchat,
        IDARTICLE: l.IDARTICLE,
        QUANTITE: l.QUANTITE,
        PRIX_ACHAT: l.PRIX_ACHAT,
        PRIX_VENTE: l.PRIX_VENTE,
        MONTANT: l.QUANTITE * l.PRIX_ACHAT,
      });

      const idx = updatedArts.findIndex(a => a.IDARTICLE === l.IDARTICLE);
      if (idx >= 0) {
        updatedArts[idx] = {
          ...updatedArts[idx],
          STOCK: updatedArts[idx].STOCK + l.QUANTITE,
          PRIX_ACHAT: l.PRIX_ACHAT,
          PRIX_VENTE: l.PRIX_VENTE,
        };
      }

      newMvts.push({
        IDMOUVEMENT: mvtIdBase++,
        DATE_MOUVEMENT: today(),
        HEURE: nowTime(),
        IDARTICLE: l.IDARTICLE,
        TYPE: 'Entrée' as const,
        QUANTITE: l.QUANTITE,
        REFERENCE: ref,
        IDFOURNISSEUR: fournisseur,
      });
    });

    store.setAchats([...achatsList, newAchat]);
    store.setLignesAchat([...lignesList, ...newLignes]);
    store.setArticles(updatedArts);
    store.setMouvements(newMvts);

    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2"><ShoppingBag size={20} /> Saisie Achat Rapide</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-sm font-medium text-gray-700">Fournisseur *</label>
            <select
              value={fournisseur || ''}
              onChange={e => setFournisseur(Number(e.target.value))}
              className="w-full mt-1 px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-[#0D47A1]"
            >
              <option value="">-- Sélectionner --</option>
              {fournisseurs.map(f => <option key={f.IDFOURNISSEUR} value={f.IDFOURNISSEUR}>{f.NOM}</option>)}
            </select>
          </div>

          <div className="relative">
            <label className="text-sm font-medium text-gray-700">Ajouter un article</label>
            <input
              type="text"
              value={searchArt}
              onChange={e => setSearchArt(e.target.value)}
              placeholder="Rechercher..."
              className="w-full mt-1 px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-[#0D47A1]"
            />
            {searchArt && filteredArt.length > 0 && (
              <div className="absolute z-10 w-full bg-white border rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                {filteredArt.map(a => (
                  <button
                    key={a.IDARTICLE}
                    onClick={() => addLigne(a)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span>{a.EMOJI || '📦'}</span>
                    <span>{a.NOM}</span>
                    <span className="ml-auto text-sm text-gray-500">{formatAr(a.PRIX_ACHAT)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lignes.length > 0 && (
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">Article</th>
                    <th className="text-center px-3 py-2 w-20">Qté</th>
                    <th className="text-right px-3 py-2 w-24">PA</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => {
                    const art = articles.find(a => a.IDARTICLE === l.IDARTICLE);
                    return (
                      <tr key={l.IDARTICLE} className="border-t">
                        <td className="px-3 py-2">{art?.NOM}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="1"
                            value={l.QUANTITE}
                            onChange={e => setLignes(lignes.map((x, j) => j === i ? { ...x, QUANTITE: Number(e.target.value) } : x))}
                            className="w-full text-center border rounded px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={l.PRIX_ACHAT}
                            onChange={e => setLignes(lignes.map((x, j) => j === i ? { ...x, PRIX_ACHAT: Number(e.target.value) } : x))}
                            className="w-full text-right border rounded px-2 py-1"
                          />
                        </td>
                        <td className="px-2">
                          <button onClick={() => setLignes(lignes.filter((_, j) => j !== i))} className="text-red-500">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="bg-gray-50 px-4 py-3 text-right font-bold text-[#0D47A1]">
                Total: {formatAr(total)}
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!fournisseur || lignes.length === 0}
            className="w-full bg-[#0D47A1] text-white py-3 rounded-xl font-bold disabled:opacity-50"
          >
            Enregistrer l'achat
          </button>
        </div>
      </div>
    </div>
  );
}
