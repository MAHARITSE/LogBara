import { useState, useMemo } from 'react';
import { ShoppingCart, Minus, Plus, Trash2, CreditCard, Send, X, Search, Edit2, UserPlus } from 'lucide-react';
import { store } from '../store';
import { Personnel, CartItem, TableR, Client } from '../types';
import { formatAr, today, nowTime, nextId, generateFactureNum, capitalize } from '../helpers';
import { printTicket } from '../components/PrintTicket';
import ConfirmModal from '../components/ConfirmModal';
import PhoneInput from '../components/PhoneInput';

interface Props { user: Personnel }
type PaymentMode = 'Espèces' | 'Mobile Money' | 'Crédit' | 'Mixte';

export default function CaisseModule({ user }: Props) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [remise, setRemise] = useState(0);
  const [selectedFamily, setSelectedFamily] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [mode, setMode] = useState<'comptoir' | 'table'>('comptoir');
  const [selectedTable, setSelectedTable] = useState<TableR | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Espèces');
  const [montantRecu, setMontantRecu] = useState('');
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [mixteEspeces, setMixteEspeces] = useState(0);
  const [mixteMobile, setMixteMobile] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const [toast, setToast] = useState('');
  const [rk, setRk] = useState(0);
  // Ajout client inline
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ NOM_CLIENT: '', TELEPHONE: '' });

  const familles = store.getFamilles();
  const articles = store.getArticles();
  const clients = useMemo(() => store.getClients(), [rk]);
  const tables = useMemo(() => store.getTables(), [rk]);

  const showMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  // === RÈGLE 1 : Pas de chargement auto des consommations.
  //     L'utilisateur choisit les articles AVANT de sélectionner la table.
  //     Quand il passe en mode table, le panier n'est PAS vidé.
  //     Quand il sélectionne une table occupée, le panier n'est PAS remplacé.

  const filteredArticles = useMemo(() => {
    return articles.filter(a => {
      if (!a.ACTIF) return false;
      if (selectedFamily && a.IDFAMILLE !== selectedFamily) return false;
      if (searchTerm && !a.NOM.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [articles, selectedFamily, searchTerm]);

  const availableTables = useMemo(() => {
    return tables.filter(t => {
      if (t.ETAT === 'Libre') return true;
      if (user.ROLE === 'Gérant') return true;
      if (t.IDCAISSIER === user.IDPERSONNEL) return true;
      return false;
    });
  }, [tables, user]);

  // Total de la table occupée (consommations déjà envoyées)
  const getTableTotal = (tableId: number) => {
    return store.getConsommations().filter(c => c.IDTABLE === tableId).reduce((s, c) => s + c.QUANTITE * c.PRIX_UNITAIRE, 0);
  };

  const total = cart.reduce((s, i) => s + i.QUANTITE * i.PRIX_UNITAIRE, 0);
  const netAPayer = total - remise;
  const monnaie = Number(montantRecu) - netAPayer;

  const addToCart = (artId: number) => {
    const art = articles.find(a => a.IDARTICLE === artId);
    if (!art) return;
    if (art.GERE_STOCK && art.STOCK <= 0) { showMsg('Stock insuffisant !'); return; }
    const existing = cart.find(c => c.IDARTICLE === artId);
    if (existing) {
      if (art.GERE_STOCK && existing.QUANTITE >= art.STOCK) { showMsg('Stock insuffisant !'); return; }
      setCart(cart.map(c => c.IDARTICLE === artId ? { ...c, QUANTITE: c.QUANTITE + 1 } : c));
    } else {
      setCart([...cart, { IDARTICLE: artId, NOM: art.NOM, EMOJI: art.EMOJI, QUANTITE: 1, PRIX_UNITAIRE: art.PRIX_VENTE, SAISIE_PRIX_VENTE: art.SAISIE_PRIX_VENTE }]);
    }
  };

  const updateQuantity = (artId: number, delta: number) => {
    const art = articles.find(a => a.IDARTICLE === artId);
    setCart(cart.map(c => {
      if (c.IDARTICLE !== artId) return c;
      const nq = c.QUANTITE + delta;
      if (nq <= 0) return c;
      if (art?.GERE_STOCK && nq > art.STOCK) { showMsg('Stock insuffisant !'); return c; }
      return { ...c, QUANTITE: nq };
    }).filter(c => c.QUANTITE > 0));
  };

  const updatePrice = (artId: number, price: number) => { setCart(cart.map(c => c.IDARTICLE === artId ? { ...c, PRIX_UNITAIRE: Math.max(0, price) } : c)); };
  const removeFromCart = (artId: number) => { setCart(cart.filter(c => c.IDARTICLE !== artId)); };
  const clearCart = () => { setCart([]); setRemise(0); setConfirmClear(false); };

  // === RÈGLE 2 : Envoyer = AJOUTER à la table (pas remplacer) ===
  const handleSendToTable = () => {
    if (!selectedTable || cart.length === 0) return;

    const allConso = store.getConsommations();
    let idBase = nextId(allConso, 'IDCONSOMMATION');
    const newConsommations = cart.map(c => ({
      IDCONSOMMATION: idBase++,
      IDTABLE: selectedTable.IDTABLE,
      IDARTICLE: c.IDARTICLE,
      QUANTITE: c.QUANTITE,
      PRIX_UNITAIRE: c.PRIX_UNITAIRE,
      HEURE: nowTime(),
      IDPERSONNEL: user.IDPERSONNEL,
    }));

    // On AJOUTE les consommations (pas remplacement)
    store.setConsommations([...allConso, ...newConsommations]);

    const freshTables = store.getTables();
    store.setTables(freshTables.map(t =>
      t.IDTABLE === selectedTable.IDTABLE
        ? { ...t, ETAT: 'Occupée' as const, IDCAISSIER: user.IDPERSONNEL }
        : t
    ));

    showMsg(`${cart.length} article(s) envoyé(s) à ${selectedTable.DESCRIPTION}`);
    setCart([]);
    setRefreshKey();
  };

  const setRefreshKey = () => setRk(k => k + 1);

  // === Payer une table occupée depuis les consommations ===
  const payTableDirect = (table: TableR) => {
    const consos = store.getConsommations().filter(c => c.IDTABLE === table.IDTABLE);
    if (consos.length === 0) return;
    const items: CartItem[] = [];
    consos.forEach(c => {
      const art = articles.find(a => a.IDARTICLE === c.IDARTICLE);
      if (!art) return;
      const ex = items.find(ci => ci.IDARTICLE === c.IDARTICLE);
      if (ex) { ex.QUANTITE += c.QUANTITE; }
      else { items.push({ IDARTICLE: c.IDARTICLE, NOM: art.NOM, EMOJI: art.EMOJI, QUANTITE: c.QUANTITE, PRIX_UNITAIRE: c.PRIX_UNITAIRE, SAISIE_PRIX_VENTE: art.SAISIE_PRIX_VENTE }); }
    });
    setCart(items);
    setMode('table');
    setSelectedTable(table);
    setRemise(0);
    openPayment();
  };

  // Ajout client inline
  const handleCreateClient = () => {
    if (!newClientForm.NOM_CLIENT.trim()) { showMsg('Nom obligatoire'); return; }
    const list = store.getClients();
    const newC: Client = {
      IDCLIENT: nextId(list, 'IDCLIENT'),
      NOM_CLIENT: capitalize(newClientForm.NOM_CLIENT.trim()),
      TELEPHONE: newClientForm.TELEPHONE,
      ADRESSE: '',
      CREDIT_TOTAL: 0,
      DATE_CREATION: today(),
    };
    store.setClients([...list, newC]);
    setSelectedClient(newC.IDCLIENT);
    setShowNewClient(false);
    setNewClientForm({ NOM_CLIENT: '', TELEPHONE: '' });
    setRefreshKey();
    showMsg('Client créé');
  };

  const openPayment = () => {
    setMontantRecu(String(Math.max(0, total - remise)));
    setShowPayment(true);
  };

  const handlePayment = () => {
    if (cart.length === 0) return;
    const ventes = store.getVentes();
    const lignesVente = store.getLignesVente();
    const paiements = store.getPaiements();
    const articlesList = store.getArticles();

    const idVente = nextId(ventes, 'IDVENTE');
    const numeroFacture = generateFactureNum('VTE', idVente);

    const newVente = {
      IDVENTE: idVente, NUMERO_FACTURE: numeroFacture, DATE_VENTE: today(), HEURE: nowTime(),
      IDPERSONNEL: user.IDPERSONNEL, IDTABLE: selectedTable?.IDTABLE || null,
      TYPE: mode === 'table' ? 'Table' as const : 'Comptoir' as const,
      STATUT: 'Payée' as const, TOTAL: total, REMISE: remise, CLOTUREE: false, IDCLOTURE: null,
    };

    let idLigne = nextId(lignesVente, 'IDLIGNEVENTE');
    const newLignes = cart.map(c => ({ IDLIGNEVENTE: idLigne++, IDVENTE: idVente, IDARTICLE: c.IDARTICLE, QUANTITE: c.QUANTITE, PRIX_UNITAIRE: c.PRIX_UNITAIRE, MONTANT: c.QUANTITE * c.PRIX_UNITAIRE }));

    let idPaiement = nextId(paiements, 'IDPAIEMENT');
    const newPaiements: typeof paiements = [];
    const nap = total - remise;

    if (paymentMode === 'Mixte') {
      if (mixteEspeces > 0) newPaiements.push({ IDPAIEMENT: idPaiement++, DATE_PAIEMENT: today(), HEURE: nowTime(), IDVENTE: idVente, IDPERSONNEL: user.IDPERSONNEL, MONTANT: mixteEspeces, MODE_PAIEMENT: 'Espèces' });
      if (mixteMobile > 0) newPaiements.push({ IDPAIEMENT: idPaiement++, DATE_PAIEMENT: today(), HEURE: nowTime(), IDVENTE: idVente, IDPERSONNEL: user.IDPERSONNEL, MONTANT: mixteMobile, MODE_PAIEMENT: 'Mobile Money' });
      const reste = nap - mixteEspeces - mixteMobile;
      if (reste > 0 && selectedClient) {
        newPaiements.push({ IDPAIEMENT: idPaiement++, DATE_PAIEMENT: today(), HEURE: nowTime(), IDVENTE: idVente, IDPERSONNEL: user.IDPERSONNEL, MONTANT: reste, MODE_PAIEMENT: 'Crédit', IDCLIENT: selectedClient });
        const cl = store.getClients();
        store.setClients(cl.map(c => c.IDCLIENT === selectedClient ? { ...c, CREDIT_TOTAL: c.CREDIT_TOTAL + reste } : c));
      }
    } else {
      newPaiements.push({ IDPAIEMENT: idPaiement++, DATE_PAIEMENT: today(), HEURE: nowTime(), IDVENTE: idVente, IDPERSONNEL: user.IDPERSONNEL, MONTANT: nap, MODE_PAIEMENT: paymentMode === 'Crédit' ? 'Crédit' : paymentMode, IDCLIENT: paymentMode === 'Crédit' ? selectedClient || undefined : undefined });
      if (paymentMode === 'Crédit' && selectedClient) {
        const cl = store.getClients();
        store.setClients(cl.map(c => c.IDCLIENT === selectedClient ? { ...c, CREDIT_TOTAL: c.CREDIT_TOTAL + nap } : c));
      }
    }

    const updatedArticles = articlesList.map(a => { const item = cart.find(c => c.IDARTICLE === a.IDARTICLE); if (item && a.GERE_STOCK) return { ...a, STOCK: a.STOCK - item.QUANTITE }; return a; });

    store.setVentes([...ventes, newVente]);
    store.setLignesVente([...lignesVente, ...newLignes]);
    store.setPaiements([...paiements, ...newPaiements]);
    store.setArticles(updatedArticles);

    if (selectedTable) {
      const ft = store.getTables();
      store.setTables(ft.map(t => t.IDTABLE === selectedTable.IDTABLE ? { ...t, ETAT: 'Libre' as const, IDCAISSIER: undefined } : t));
      store.setConsommations(store.getConsommations().filter(c => c.IDTABLE !== selectedTable.IDTABLE));
    }

    const rows = cart.map(c => `<tr><td>${c.NOM}</td><td class="right">${c.QUANTITE}</td><td class="right">${formatAr(c.PRIX_UNITAIRE)}</td><td class="right">${formatAr(c.QUANTITE * c.PRIX_UNITAIRE)}</td></tr>`).join('');
    printTicket(`
      <div class="center bold">TICKET DE CAISSE</div>
      <div class="center">${numeroFacture}</div>
      <div class="row"><span>${today()}</span><span>${nowTime()}</span></div>
      <div>Caissier: ${user.PRENOM} ${user.NOM}</div>
      ${selectedTable ? `<div>Table: ${selectedTable.DESCRIPTION}</div>` : ''}
      <div class="line"></div>
      <table><tr><td class="bold">Article</td><td class="bold right">Qté</td><td class="bold right">PU</td><td class="bold right">Mt</td></tr>${rows}</table>
      <div class="line"></div>
      ${remise > 0 ? `<div class="row"><span>Remise</span><span>-${formatAr(remise)}</span></div>` : ''}
      <div class="row bold"><span>TOTAL</span><span>${formatAr(nap)}</span></div>
      <div class="line"></div>
      <div class="row"><span>Mode</span><span>${paymentMode}</span></div>
      ${paymentMode === 'Espèces' && Number(montantRecu) > nap ? `<div class="row"><span>Reçu</span><span>${formatAr(Number(montantRecu))}</span></div><div class="row"><span>Monnaie</span><span>${formatAr(monnaie)}</span></div>` : ''}
    `);

    setCart([]); setRemise(0); setShowPayment(false); setPaymentMode('Espèces'); setMontantRecu(''); setSelectedClient(null); setMixteEspeces(0); setMixteMobile(0); setSelectedTable(null); setMode('comptoir'); setRefreshKey(); showMsg('Vente enregistrée !');
  };

  // === RÈGLE 3 : Tables occupées avec total + bouton payer direct ===
  const occupiedTables = useMemo(() => {
    return tables.filter(t => t.ETAT === 'Occupée' && (user.ROLE === 'Gérant' || t.IDCAISSIER === user.IDPERSONNEL));
  }, [tables, user, rk]);

  return (
    <div className="flex h-[calc(100vh-80px)] gap-4">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

      {/* Panier */}
      <div className="w-80 shrink-0 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-[#0D47A1]" size={20} />
              <span className="font-bold">Panier</span>
              {cart.length > 0 && <span className="bg-[#0D47A1] text-white text-xs px-2 py-0.5 rounded-full">{cart.reduce((s, c) => s + c.QUANTITE, 0)}</span>}
            </div>
            {cart.length > 0 && <button onClick={() => setConfirmClear(true)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"><Trash2 size={16} /></button>}
          </div>
          {/* Mode : ne PAS vider le panier au basculement */}
          <div className="flex gap-2 mb-3">
            <button onClick={() => { setMode('comptoir'); setSelectedTable(null); }} className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'comptoir' ? 'bg-[#0D47A1] text-white' : 'bg-gray-100 text-gray-600'}`}>Comptoir</button>
            <button onClick={() => setMode('table')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'table' ? 'bg-[#0D47A1] text-white' : 'bg-gray-100 text-gray-600'}`}>Table</button>
          </div>
          {mode === 'table' && (
            <select value={selectedTable?.IDTABLE || ''} onChange={e => { const t = availableTables.find(t => t.IDTABLE === Number(e.target.value)); setSelectedTable(t || null); }} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
              <option value="">-- Choisir une table --</option>
              {availableTables.map(t => <option key={t.IDTABLE} value={t.IDTABLE}>Table {t.NUMERO} - {t.DESCRIPTION} {t.ETAT === 'Occupée' ? '(Occupée)' : ''}</option>)}
            </select>
          )}

          {/* Tables occupées avec total + payer direct */}
          {occupiedTables.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase">Tables occupées</p>
              {occupiedTables.map(t => {
                const tTotal = getTableTotal(t.IDTABLE);
                return (
                  <div key={t.IDTABLE} className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-bold">T{t.NUMERO} {t.DESCRIPTION}</p>
                      <p className="text-xs text-red-600 font-semibold">{formatAr(tTotal)}</p>
                    </div>
                    <button onClick={() => payTableDirect(t)} className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-600">Payer</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.map(item => (
            <div key={item.IDARTICLE} className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.EMOJI && <span className="mr-1">{item.EMOJI}</span>}{item.NOM}</p>
                  {item.SAISIE_PRIX_VENTE ? (
                    <div className="flex items-center gap-1 mt-1"><Edit2 size={12} className="text-orange-500" /><input type="number" value={item.PRIX_UNITAIRE} onChange={e => updatePrice(item.IDARTICLE, Number(e.target.value))} className="w-20 px-2 py-1 text-xs border rounded" /><span className="text-xs text-gray-400">Ar</span></div>
                  ) : <p className="text-xs text-gray-500">{formatAr(item.PRIX_UNITAIRE)}</p>}
                </div>
                <button onClick={() => removeFromCart(item.IDARTICLE)} className="text-red-400 hover:text-red-600"><X size={16} /></button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQuantity(item.IDARTICLE, -1)} className="w-7 h-7 rounded-lg bg-white border flex items-center justify-center hover:bg-gray-100"><Minus size={14} /></button>
                  <span className="font-bold text-sm w-8 text-center">{item.QUANTITE}</span>
                  <button onClick={() => updateQuantity(item.IDARTICLE, 1)} className="w-7 h-7 rounded-lg bg-white border flex items-center justify-center hover:bg-gray-100"><Plus size={14} /></button>
                </div>
                <p className="font-bold text-[#0D47A1]">{formatAr(item.QUANTITE * item.PRIX_UNITAIRE)}</p>
              </div>
            </div>
          ))}
          {cart.length === 0 && <div className="text-center py-12 text-gray-400"><ShoppingCart size={40} className="mx-auto mb-2 opacity-50" /><p>Panier vide</p></div>}
        </div>
        <div className="p-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center gap-2"><span className="text-sm text-gray-500">Remise:</span><input type="number" value={remise || ''} onChange={e => setRemise(Math.max(0, Math.min(total, Number(e.target.value))))} className="flex-1 px-3 py-2 rounded-lg border text-sm" placeholder="0" /><span className="text-sm text-gray-400">Ar</span></div>
          <div className="bg-[#0D47A1] text-white rounded-xl p-4">
            <div className="flex justify-between text-sm opacity-80"><span>Sous-total</span><span>{formatAr(total)}</span></div>
            {remise > 0 && <div className="flex justify-between text-sm opacity-80"><span>Remise</span><span>-{formatAr(remise)}</span></div>}
            <div className="flex justify-between text-xl font-bold mt-1"><span>Total</span><span>{formatAr(netAPayer)}</span></div>
          </div>
          <div className="flex gap-2">
            {mode === 'table' && selectedTable && <button onClick={handleSendToTable} disabled={cart.length === 0} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"><Send size={18} />Envoyer</button>}
            <button onClick={openPayment} disabled={cart.length === 0} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"><CreditCard size={18} />Payer</button>
          </div>
        </div>
      </div>

      {/* Grille articles */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Rechercher un article..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0D47A1] focus:border-transparent" /></div>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            <button onClick={() => setSelectedFamily(null)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!selectedFamily ? 'bg-[#0D47A1] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Tous</button>
            {familles.map(f => <button key={f.IDFAMILLE} onClick={() => setSelectedFamily(f.IDFAMILLE)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedFamily === f.IDFAMILLE ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} style={selectedFamily === f.IDFAMILLE ? { backgroundColor: f.COULEUR } : {}}>{f.FAMILLE}</button>)}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredArticles.map(art => {
              const inCart = cart.find(c => c.IDARTICLE === art.IDARTICLE);
              const oos = art.GERE_STOCK && art.STOCK <= 0;
              return (
                <button key={art.IDARTICLE} onClick={() => addToCart(art.IDARTICLE)} disabled={oos} className={`relative bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-left transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] ${oos ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {inCart && <div className="absolute -top-2 -right-2 w-7 h-7 bg-[#0D47A1] text-white rounded-full flex items-center justify-center text-xs font-bold shadow">{inCart.QUANTITE}</div>}
                  {art.SAISIE_PRIX_VENTE && <div className="absolute top-2 left-2 text-xs">✏️</div>}
                  <div className="text-center">
                    <div className="text-3xl mb-2">{art.EMOJI || '📦'}</div>
                    <p className="font-semibold text-sm mb-1 truncate">{art.NOM}</p>
                    <p className="text-[#0D47A1] font-bold text-lg">{formatAr(art.PRIX_VENTE)}</p>
                    <p className="text-xs text-gray-400 mt-1">{art.GERE_STOCK ? `Stock: ${art.STOCK}` : '∞'}</p>
                  </div>
                </button>
              );
            })}
          </div>
          {filteredArticles.length === 0 && <div className="text-center py-12 text-gray-400">Aucun article trouvé</div>}
        </div>
      </div>

      {/* Modal Paiement avec ajout client inline */}
      {showPayment && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPayment(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between"><h3 className="font-bold text-lg">💳 Encaissement</h3><button onClick={() => setShowPayment(false)}><X size={20} /></button></div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 text-center"><p className="text-sm text-gray-500">Net à payer</p><p className="text-3xl font-bold text-[#0D47A1]">{formatAr(netAPayer)}</p></div>
              <div><label className="text-sm font-medium text-gray-700 mb-2 block">Mode de paiement</label>
                <div className="grid grid-cols-4 gap-2">{(['Espèces', 'Mobile Money', 'Crédit', 'Mixte'] as PaymentMode[]).map(m => <button key={m} onClick={() => { setPaymentMode(m); if (m === 'Espèces') setMontantRecu(String(netAPayer)); }} className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${paymentMode === m ? 'bg-[#0D47A1] text-white' : 'bg-gray-100 text-gray-600'}`}>{m}</button>)}</div>
              </div>
              {(paymentMode === 'Espèces' || paymentMode === 'Mixte') && (
                <div><label className="text-sm font-medium text-gray-700 mb-2 block">{paymentMode === 'Mixte' ? 'Montant espèces' : 'Montant reçu'}</label>
                  <input type="number" value={paymentMode === 'Mixte' ? mixteEspeces || '' : montantRecu} onChange={e => paymentMode === 'Mixte' ? setMixteEspeces(Number(e.target.value)) : setMontantRecu(e.target.value)} className="w-full px-4 py-3 rounded-xl border text-lg font-bold text-center" placeholder="0" />
                  {paymentMode === 'Espèces' && Number(montantRecu) >= netAPayer && <p className="text-center mt-2 text-green-600 font-bold">Monnaie : {formatAr(monnaie)}</p>}
                </div>
              )}
              {paymentMode === 'Mixte' && <div><label className="text-sm font-medium text-gray-700 mb-2 block">Montant Mobile Money</label><input type="number" value={mixteMobile || ''} onChange={e => setMixteMobile(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border text-lg font-bold text-center" placeholder="0" /></div>}
              {(paymentMode === 'Crédit' || (paymentMode === 'Mixte' && mixteEspeces + mixteMobile < netAPayer)) && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Client (crédit)</label>
                  <div className="flex gap-2">
                    <select value={selectedClient || ''} onChange={e => setSelectedClient(Number(e.target.value) || null)} className="flex-1 px-4 py-2.5 rounded-xl border"><option value="">-- Sélectionner --</option>{clients.map(c => <option key={c.IDCLIENT} value={c.IDCLIENT}>{c.NOM_CLIENT} ({formatAr(c.CREDIT_TOTAL)})</option>)}</select>
                    <button type="button" onClick={() => setShowNewClient(!showNewClient)} className={`p-2.5 rounded-xl border ${showNewClient ? 'bg-green-50 border-green-500 text-green-600' : 'hover:bg-gray-50'}`} title="Nouveau client"><UserPlus size={18} /></button>
                  </div>
                  {showNewClient && (
                    <div className="mt-3 p-4 bg-green-50 rounded-xl border border-green-200 space-y-3">
                      <p className="text-sm font-medium text-green-700 flex items-center gap-2"><UserPlus size={16} /> Nouveau client</p>
                      <input type="text" placeholder="Nom du client *" value={newClientForm.NOM_CLIENT} onChange={e => setNewClientForm({ ...newClientForm, NOM_CLIENT: capitalize(e.target.value) })} className="w-full px-3 py-2 rounded-lg border text-sm" />
                      <PhoneInput value={newClientForm.TELEPHONE} onChange={v => setNewClientForm({ ...newClientForm, TELEPHONE: v })} placeholder="034 00 000 00" className="text-sm py-2" />
                      <button type="button" onClick={handleCreateClient} className="w-full bg-green-500 text-white py-2 rounded-lg font-medium text-sm hover:bg-green-600">Créer le client</button>
                    </div>
                  )}
                </div>
              )}
              <button onClick={handlePayment} disabled={(paymentMode === 'Crédit' && !selectedClient) || (paymentMode === 'Espèces' && Number(montantRecu) < netAPayer)} className="w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed">✅ Valider le paiement</button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal open={confirmClear} type="warning" title="Vider le panier" message="Voulez-vous vraiment vider le panier ?" confirmText="Oui, vider" cancelText="Non" onConfirm={clearCart} onCancel={() => setConfirmClear(false)} />
    </div>
  );
}
