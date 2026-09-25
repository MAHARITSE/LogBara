import { useState, useMemo, useEffect } from 'react';
import { ShoppingCart, Minus, Plus, Trash2, Wallet, Send, X, Search, Edit2, Package, ArrowLeft, AlertTriangle, Printer } from 'lucide-react';
import { store } from '../store';
import { Personnel, CartItem, TableR } from '../types';
import { formatAr, today, nowTime, nextId, generateFactureNum } from '../helpers';
import { printTicket } from '../components/PrintTicket';
import ConfirmModal from '../components/ConfirmModal';
import MoneyInput from '../components/MoneyInput';

interface Props { user: Personnel }
type PaymentMode = 'Espèces' | 'Mobile Money' | 'Mixte';

export default function CaisseModule({ user }: Props) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [remise, setRemise] = useState(0);
  const [selectedFamily, setSelectedFamily] = useState<number | null | 'rupture'>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [mode, setMode] = useState<'comptoir' | 'table'>('comptoir');
  const [selectedTable, setSelectedTable] = useState<TableR | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Espèces');
  const [montantRecu, setMontantRecu] = useState('');
  const [mixteEspeces, setMixteEspeces] = useState(0);
  const [mixteMobile, setMixteMobile] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const [mobileTab, setMobileTab] = useState<'articles' | 'panier'>('articles');
  const [toast, setToast] = useState('');
  const [rk, setRk] = useState(0);
  const [showAlertModal, setShowAlertModal] = useState(false);
  // Impression propre à ce poste (activée ou désactivée directement depuis la caisse)
  const [utiliserImprimante, setUtiliserImprimante] = useState(() => store.isUserPrinterEnabled(user.IDPERSONNEL));

  useEffect(() => {
    setUtiliserImprimante(store.isUserPrinterEnabled(user.IDPERSONNEL));
  }, [user.IDPERSONNEL]);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ userId?: number; enabled?: boolean }>;
      if (!custom.detail || custom.detail.userId === user.IDPERSONNEL) {
        setUtiliserImprimante(store.isUserPrinterEnabled(user.IDPERSONNEL));
      }
    };
    window.addEventListener('barpos-printer-pref-change', handleUpdate);
    return () => window.removeEventListener('barpos-printer-pref-change', handleUpdate);
  }, [user.IDPERSONNEL]);

  const handleToggleImprimante = (checked: boolean) => {
    store.setUserPrinterEnabled(checked, user.IDPERSONNEL);
    setUtiliserImprimante(checked);
    window.dispatchEvent(new CustomEvent('barpos-printer-pref-change', { detail: { userId: user.IDPERSONNEL, enabled: checked } }));
  };

  useEffect(() => {
    const handleUpdate = () => {
      setRk(k => k + 1);
    };
    window.addEventListener('barpos-articles-updated', handleUpdate);
    window.addEventListener('barpos-data-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      window.removeEventListener('barpos-articles-updated', handleUpdate);
      window.removeEventListener('barpos-data-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, []);

  const familles = store.getFamilles();
  const articles = useMemo(() => store.getArticles(), [rk]);
  const tables = useMemo(() => store.getTables(), [rk]);

  const articlesEnAlerte = useMemo(() => {
    return articles.filter(a => a.ACTIF && a.GERE_STOCK && (a.ALERTE_STOCK !== false) && a.STOCK <= a.STOCK_MIN);
  }, [articles]);

  const articlesEnRupture = useMemo(() => {
    return articles.filter(a => a.ACTIF && !a.NE_PLUS_VENDRE && a.GERE_STOCK && a.STOCK <= 0);
  }, [articles]);

  const showMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  // === RÈGLE 1 : Pas de chargement auto des consommations.
  //     L'utilisateur choisit les articles AVANT de sélectionner la table.
  //     Quand il passe en mode table, le panier n'est PAS vidé.
  //     Quand il sélectionne une table occupée, le panier n'est PAS remplacé.

  const filteredArticles = useMemo(() => {
    return articles.filter(a => {
      // Masquer les articles inactifs ou marqués "Ne plus vendre"
      if (!a.ACTIF || a.NE_PLUS_VENDRE) return false;

      if (selectedFamily === 'rupture') {
        // Dans l'onglet Ruptures uniquement : afficher les articles gérés en stock et épuisés
        if (!a.GERE_STOCK || a.STOCK > 0) return false;
      } else {
        // Dans Tous et les catégories par famille : MASQUER les articles en rupture
        if (a.GERE_STOCK && a.STOCK <= 0) return false;

        if (typeof selectedFamily === 'number' && a.IDFAMILLE !== selectedFamily) {
          return false;
        }
      }

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

  // Consommations déjà envoyées (servies) sur la table sélectionnée.
  // Regroupées par article ET prix (un article à prix saisi peut avoir plusieurs prix).
  const tableItems = useMemo((): CartItem[] => {
    if (mode !== 'table' || !selectedTable) return [];
    const items: CartItem[] = [];
    store.getConsommations()
      .filter(c => c.IDTABLE === selectedTable.IDTABLE)
      .forEach(c => {
        const art = articles.find(a => a.IDARTICLE === c.IDARTICLE);
        const ex = items.find(i => i.IDARTICLE === c.IDARTICLE && i.PRIX_UNITAIRE === c.PRIX_UNITAIRE);
        if (ex) ex.QUANTITE += c.QUANTITE;
        else items.push({
          IDARTICLE: c.IDARTICLE, NOM: art?.NOM || 'Article', EMOJI: art?.EMOJI,
          QUANTITE: c.QUANTITE, PRIX_UNITAIRE: c.PRIX_UNITAIRE, SAISIE_PRIX_VENTE: false,
        });
      });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedTable, rk]);
  const tableTotal = tableItems.reduce((s, i) => s + i.QUANTITE * i.PRIX_UNITAIRE, 0);

  // Tout ce qui sera encaissé : consommations de la table + panier en cours
  const itemsAPayer = useMemo((): CartItem[] => {
    const merged: CartItem[] = tableItems.map(i => ({ ...i }));
    cart.forEach(c => {
      const ex = merged.find(m => m.IDARTICLE === c.IDARTICLE && m.PRIX_UNITAIRE === c.PRIX_UNITAIRE);
      if (ex) ex.QUANTITE += c.QUANTITE;
      else merged.push({ ...c });
    });
    return merged;
  }, [tableItems, cart]);
  const rienAPayer = itemsAPayer.length === 0;

  const total = cart.reduce((s, i) => s + i.QUANTITE * i.PRIX_UNITAIRE, 0) + tableTotal;
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

  const openPayment = () => {
    if (rienAPayer) return;
    if (mode === 'table' && !selectedTable) { showMsg('Choisissez une table (ou passez en mode Comptoir)'); return; }
    setMontantRecu(String(Math.max(0, total - remise)));
    setShowPayment(true);
  };

  // Encaissement : panier seul (comptoir) ou consommations de la table + panier (table)
  const handlePayment = () => {
    if (rienAPayer) return;
    const items = itemsAPayer;
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
    const newLignes = items.map(c => ({ IDLIGNEVENTE: idLigne++, IDVENTE: idVente, IDARTICLE: c.IDARTICLE, QUANTITE: c.QUANTITE, PRIX_UNITAIRE: c.PRIX_UNITAIRE, MONTANT: c.QUANTITE * c.PRIX_UNITAIRE }));

    let idPaiement = nextId(paiements, 'IDPAIEMENT');
    const newPaiements: typeof paiements = [];
    const nap = total - remise;

    if (paymentMode === 'Mixte') {
      const partEspeces = Math.min(mixteEspeces, nap);
      const partMobile = Math.max(0, nap - partEspeces);
      if (partEspeces > 0) newPaiements.push({ IDPAIEMENT: idPaiement++, DATE_PAIEMENT: today(), HEURE: nowTime(), IDVENTE: idVente, IDPERSONNEL: user.IDPERSONNEL, MONTANT: partEspeces, MODE_PAIEMENT: 'Espèces' });
      if (partMobile > 0) newPaiements.push({ IDPAIEMENT: idPaiement++, DATE_PAIEMENT: today(), HEURE: nowTime(), IDVENTE: idVente, IDPERSONNEL: user.IDPERSONNEL, MONTANT: partMobile, MODE_PAIEMENT: 'Mobile Money' });
    } else {
      newPaiements.push({ IDPAIEMENT: idPaiement++, DATE_PAIEMENT: today(), HEURE: nowTime(), IDVENTE: idVente, IDPERSONNEL: user.IDPERSONNEL, MONTANT: nap, MODE_PAIEMENT: paymentMode });
    }

    // Sortie de stock pour tout ce qui est encaissé (un même article peut apparaître à plusieurs prix)
    const updatedArticles = articlesList.map(a => {
      if (!a.GERE_STOCK) return a;
      const qte = items.filter(c => c.IDARTICLE === a.IDARTICLE).reduce((s, c) => s + c.QUANTITE, 0);
      return qte > 0 ? { ...a, STOCK: a.STOCK - qte } : a;
    });

    store.setVentes([...ventes, newVente]);
    store.setLignesVente([...lignesVente, ...newLignes]);
    store.setPaiements([...paiements, ...newPaiements]);
    store.setArticles(updatedArticles);

    if (selectedTable) {
      const ft = store.getTables();
      store.setTables(ft.map(t => t.IDTABLE === selectedTable.IDTABLE ? { ...t, ETAT: 'Libre' as const, IDCAISSIER: undefined } : t));
      store.setConsommations(store.getConsommations().filter(c => c.IDTABLE !== selectedTable.IDTABLE));
    }

    const rows = items.map(c => `<tr><td>${c.NOM}</td><td class="right">${c.QUANTITE}</td><td class="right">${formatAr(c.PRIX_UNITAIRE)}</td><td class="right">${formatAr(c.QUANTITE * c.PRIX_UNITAIRE)}</td></tr>`).join('');
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
      ${paymentMode === 'Mixte' ? `<div class="row"><span>Espèces</span><span>${formatAr(mixteEspeces)}</span></div><div class="row"><span>Mobile Money</span><span>${formatAr(mixteMobile)}</span></div>` : ''}
    `, false, user.IDPERSONNEL);

    setCart([]); setRemise(0); setShowPayment(false); setPaymentMode('Espèces'); setMontantRecu(''); setMixteEspeces(0); setMixteMobile(0); setSelectedTable(null); setMode('comptoir'); setRefreshKey(); setMobileTab('articles'); showMsg('Vente enregistrée !');
  };

  const cartTotalQty = cart.reduce((s, c) => s + c.QUANTITE, 0);

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-80px)] gap-3 lg:gap-4">
      {toast && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse font-medium">{toast}</div>}

      {/* Switcher mobile Articles / Panier */}
      <div className="lg:hidden flex bg-gray-200/80 p-1 rounded-xl shrink-0 gap-1">
        <button
          onClick={() => setMobileTab('articles')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all min-h-[42px] ${
            mobileTab === 'articles' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 active:scale-95'
          }`}
        >
          <Package size={16} />
          <span>Articles ({filteredArticles.length})</span>
        </button>
        <button
          onClick={() => setMobileTab('panier')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all min-h-[42px] ${
            mobileTab === 'panier' ? 'bg-[#0D47A1] text-white shadow-sm' : 'text-gray-600 active:scale-95'
          }`}
        >
          <ShoppingCart size={16} />
          <span>Panier</span>
          {!rienAPayer && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
              mobileTab === 'panier' ? 'bg-white text-[#0D47A1]' : 'bg-[#0D47A1] text-white'
            }`}>
              {cartTotalQty} · {formatAr(netAPayer)}
            </span>
          )}
        </button>
      </div>

      {/* Panier */}
      <div className={`w-full lg:w-80 lg:shrink-0 bg-white rounded-2xl shadow-sm border border-gray-100 flex-col ${mobileTab === 'panier' ? 'flex' : 'hidden lg:flex'}`}>
        {/* Header mobile retour articles */}
        <div className="lg:hidden p-3 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between">
          <button 
            onClick={() => setMobileTab('articles')}
            className="text-xs font-bold text-[#0D47A1] flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-white border border-blue-200 shadow-xs active:scale-95 transition-transform"
          >
            <ArrowLeft size={16} />
            Ajouter d'autres articles
          </button>
          <span className="text-xs font-semibold text-gray-600">
            {cartTotalQty} article{cartTotalQty > 1 ? 's' : ''}
          </span>
        </div>

        <div className="p-3.5 sm:p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-[#0D47A1]" size={20} />
              <span className="font-bold text-gray-900">Panier</span>
              {cart.length > 0 && <span className="bg-[#0D47A1] text-white text-xs px-2 py-0.5 rounded-full font-bold">{cartTotalQty}</span>}
            </div>
            {cart.length > 0 && (
              <button 
                onClick={() => setConfirmClear(true)} 
                className="text-red-500 hover:bg-red-50 p-2 rounded-xl flex items-center gap-1 text-xs font-semibold"
                title="Vider le panier"
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline">Vider</span>
              </button>
            )}
          </div>
          {/* Mode */}
          <div className="flex gap-2 mb-3">
            <button onClick={() => { setMode('comptoir'); setSelectedTable(null); }} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[42px] ${mode === 'comptoir' ? 'bg-[#0D47A1] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Comptoir</button>
            <button onClick={() => setMode('table')} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[42px] ${mode === 'table' ? 'bg-[#0D47A1] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Table</button>
          </div>
          {mode === 'table' && (
            <select value={selectedTable?.IDTABLE || ''} onChange={e => { const t = availableTables.find(t => t.IDTABLE === Number(e.target.value)); setSelectedTable(t || null); }} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:ring-2 focus:ring-[#0D47A1]">
              <option value="">-- Choisir une table --</option>
              {availableTables.map(t => <option key={t.IDTABLE} value={t.IDTABLE}>Table {t.NUMERO} - {t.DESCRIPTION} {t.ETAT === 'Occupée' ? '(Occupée)' : ''}</option>)}
            </select>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[220px]">
          {tableItems.length > 0 && (
            <div className="bg-orange-50 rounded-xl p-3 border border-orange-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">Déjà servi sur la table</span>
                <span className="text-xs font-bold text-orange-700 tabular-nums">{formatAr(tableTotal)}</span>
              </div>
              {tableItems.map(item => (
                <div key={`${item.IDARTICLE}-${item.PRIX_UNITAIRE}`} className="flex justify-between text-sm py-0.5">
                  <span className="text-gray-800">{item.EMOJI && <span className="mr-1">{item.EMOJI}</span>}{item.QUANTITE}x {item.NOM}</span>
                  <span className="font-semibold tabular-nums text-gray-900">{formatAr(item.QUANTITE * item.PRIX_UNITAIRE)}</span>
                </div>
              ))}
              <p className="text-[11px] text-orange-600 mt-1.5">Inclus dans le paiement de la table.</p>
            </div>
          )}
          {cart.map(item => (
            <div key={item.IDARTICLE} className="bg-gray-50 rounded-xl p-3 border border-gray-100 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate text-gray-900">{item.EMOJI && <span className="mr-1.5">{item.EMOJI}</span>}{item.NOM}</p>
                  {item.SAISIE_PRIX_VENTE ? (
                    <div className="flex items-center gap-1 mt-1">
                      <Edit2 size={12} className="text-orange-500" />
                      <MoneyInput
                        value={item.PRIX_UNITAIRE}
                        onChange={val => updatePrice(item.IDARTICLE, val)}
                        className="w-24 px-2 py-1 text-xs border rounded-lg text-right font-medium"
                        placeholder="0"
                      />
                      <span className="text-xs text-gray-400">Ar</span>
                    </div>
                  ) : <p className="text-xs text-gray-500 font-medium">{formatAr(item.PRIX_UNITAIRE)}</p>}
                </div>
                <button 
                  onClick={() => removeFromCart(item.IDARTICLE)} 
                  className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50"
                  aria-label="Supprimer article"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-200/60">
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => updateQuantity(item.IDARTICLE, -1)} 
                    className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 text-gray-700 shadow-xs"
                    aria-label="Diminuer quantité"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="font-extrabold text-sm w-9 text-center tabular-nums text-gray-900">{item.QUANTITE}</span>
                  <button 
                    onClick={() => updateQuantity(item.IDARTICLE, 1)} 
                    className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 text-gray-700 shadow-xs"
                    aria-label="Augmenter quantité"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <p className="font-bold text-[#0D47A1] text-base tabular-nums">{formatAr(item.QUANTITE * item.PRIX_UNITAIRE)}</p>
              </div>
            </div>
          ))}
          {cart.length === 0 && tableItems.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <ShoppingCart size={40} className="mx-auto mb-2 opacity-50" />
              <p className="font-medium">Panier vide</p>
              <button
                onClick={() => setMobileTab('articles')}
                className="mt-3 lg:hidden text-xs bg-blue-50 text-[#0D47A1] px-3 py-1.5 rounded-lg font-semibold"
              >
                Parcourir les articles
              </button>
            </div>
          )}
        </div>

        <div className="p-3.5 sm:p-4 border-t border-gray-100 space-y-3 bg-white">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Remise:</span>
            <MoneyInput
              value={remise}
              onChange={val => setRemise(Math.max(0, Math.min(total, val)))}
              className="flex-1 px-3 py-2 rounded-xl border text-sm font-medium focus:ring-2 focus:ring-[#0D47A1]"
              placeholder="0"
            />
            <span className="text-sm text-gray-400">Ar</span>
          </div>
          <div className="bg-[#0D47A1] text-white rounded-xl p-3.5 shadow-sm">
            {remise > 0 && <div className="flex justify-between text-xs opacity-80 mb-1"><span>Remise</span><span>-{formatAr(remise)}</span></div>}
            <div className="flex justify-between text-lg sm:text-xl font-extrabold"><span>Total</span><span>{formatAr(netAPayer)}</span></div>
          </div>
          <div className="flex gap-2">
            {mode === 'table' && selectedTable && (
              <button 
                onClick={handleSendToTable} 
                disabled={cart.length === 0} 
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px] active:scale-[0.98] transition-all"
              >
                <Send size={18} />
                <span>Envoyer</span>
              </button>
            )}
            <button 
              onClick={openPayment} 
              disabled={rienAPayer || (mode === 'table' && !selectedTable)} 
              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px] shadow-sm active:scale-[0.98] transition-all"
            >
              <Wallet size={18} />
              <span>Payer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grille articles */}
      <div className={`flex-1 flex-col min-w-0 ${mobileTab === 'articles' ? 'flex' : 'hidden lg:flex'}`}>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4 mb-3">
          <div className="flex gap-2 sm:gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                placeholder="Rechercher un article..." 
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#0D47A1] focus:border-transparent" 
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                  <X size={16} />
                </button>
              )}
            </div>

            {articlesEnAlerte.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAlertModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 font-bold text-xs shrink-0 transition-colors shadow-xs"
                title="Afficher les articles en alerte de stock"
              >
                <AlertTriangle size={16} className="text-orange-600 shrink-0" />
                <span className="hidden sm:inline">Alertes</span>
                <span className="bg-orange-200/90 text-orange-800 px-1.5 py-0.5 rounded-full text-[11px] font-extrabold">{articlesEnAlerte.length}</span>
              </button>
            )}
          </div>
          <div className="flex gap-2 mt-2.5 pb-1 overflow-x-auto whitespace-nowrap scrollbar-none">
            <button 
              onClick={() => setSelectedFamily(null)} 
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all min-h-[34px] ${!selectedFamily ? 'bg-[#0D47A1] text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Tous ({articles.length})
            </button>
            {articlesEnRupture.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedFamily(selectedFamily === 'rupture' ? null : 'rupture')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all min-h-[34px] flex items-center gap-1.5 cursor-pointer ${
                  selectedFamily === 'rupture'
                    ? 'bg-red-600 text-white shadow-xs ring-2 ring-red-300'
                    : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                }`}
                title="Afficher uniquement les articles en rupture de stock"
              >
                <span>🚫</span>
                <span>Ruptures</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  selectedFamily === 'rupture' ? 'bg-white text-red-700' : 'bg-red-200 text-red-800'
                }`}>
                  {articlesEnRupture.length}
                </span>
              </button>
            )}
            {familles.map(f => (
              <button 
                key={f.IDFAMILLE} 
                onClick={() => setSelectedFamily(f.IDFAMILLE)} 
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all min-h-[34px] ${selectedFamily === f.IDFAMILLE ? 'text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} 
                style={selectedFamily === f.IDFAMILLE ? { backgroundColor: f.COULEUR } : {}}
              >
                {f.FAMILLE}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-24 lg:pb-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {filteredArticles.map(art => {
              const inCart = cart.find(c => c.IDARTICLE === art.IDARTICLE);
              const oos = art.GERE_STOCK && art.STOCK <= 0;
              const isLow = art.GERE_STOCK && art.STOCK > 0 && art.STOCK <= art.STOCK_MIN && (art.ALERTE_STOCK !== false);
              return (
                <button 
                  key={art.IDARTICLE} 
                  onClick={() => addToCart(art.IDARTICLE)} 
                  disabled={oos} 
                  className={`article-card relative rounded-2xl p-3 sm:p-4 text-left active:scale-[0.97] transition-all border ${
                    oos
                      ? 'bg-slate-50/90 border-red-200/90 ring-1 ring-red-300/40 cursor-not-allowed'
                      : inCart 
                        ? 'bg-blue-50/30 border-[#0D47A1] ring-2 ring-[#0D47A1]/20 shadow-xs' 
                        : 'bg-white border-gray-100 hover:border-gray-200 shadow-xs'
                  }`}
                >
                  {/* Badge Rupture ou Stock bas ou Prix libre */}
                  {oos ? (
                    <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-lg bg-red-600 text-white font-black text-[10px] shadow-sm flex items-center gap-1 tracking-wider uppercase">
                      <span>🚫</span>
                      <span>Rupture</span>
                    </div>
                  ) : isLow ? (
                    <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-lg bg-amber-500 text-white font-bold text-[10px] shadow-xs flex items-center gap-0.5">
                      <span>⚡</span>
                      <span>Reste {art.STOCK}</span>
                    </div>
                  ) : art.SAISIE_PRIX_VENTE ? (
                    <div className="absolute top-2 left-2 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md font-semibold">
                      ✏️ Prix libre
                    </div>
                  ) : null}

                  {inCart && (
                    <div className="absolute top-2 right-2 min-w-[22px] h-[22px] px-1 bg-[#0D47A1] text-white rounded-full flex items-center justify-center text-xs font-extrabold shadow-sm z-10">
                      {inCart.QUANTITE}
                    </div>
                  )}

                  <div className="text-center pt-2">
                    <div className="flex items-center justify-center h-14 sm:h-16 mb-1.5 select-none">
                      {art.IMAGE ? (
                        <img
                          src={art.IMAGE}
                          alt={art.NOM}
                          className={`max-h-14 sm:max-h-16 max-w-full object-contain rounded-xl drop-shadow-2xs transition-transform ${
                            oos ? 'grayscale opacity-40 scale-95' : 'group-hover:scale-105'
                          }`}
                          loading="lazy"
                        />
                      ) : (
                        <div className={`text-3xl sm:text-4xl drop-shadow-sm select-none transition-transform ${oos ? 'grayscale opacity-50 scale-95' : ''}`}>
                          {art.EMOJI || '📦'}
                        </div>
                      )}
                    </div>
                    <p className={`font-semibold text-xs sm:text-sm mb-1 line-clamp-2 leading-tight min-h-[2.2rem] flex items-center justify-center ${oos ? 'text-gray-400' : 'text-slate-800'}`}>
                      {art.NOM}
                    </p>
                    <p className={`font-extrabold text-sm sm:text-base tracking-tight tabular-nums ${oos ? 'text-gray-400 line-through' : 'text-amber-600'}`}>
                      {formatAr(art.PRIX_VENTE)}
                    </p>
                    {oos ? (
                      <p className="text-[11px] text-red-600 font-extrabold mt-0.5 tracking-tight">
                        🚫 Épuisé (0 en stock)
                      </p>
                    ) : isLow ? (
                      <p className="text-[10px] text-amber-700 font-bold mt-0.5">
                        Stock bas : {art.STOCK}
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                        {art.GERE_STOCK ? `Stock: ${art.STOCK}` : 'Stock illimité'}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {filteredArticles.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Package size={40} className="mx-auto mb-2 opacity-50" />
              <p>Aucun article trouvé</p>
            </div>
          )}
        </div>

        {/* Barre flottante Panier sur mobile */}
        {!rienAPayer && (
          <div className="lg:hidden fixed bottom-16 left-0 right-0 p-3 bg-gradient-to-t from-gray-100 via-gray-100/95 to-transparent z-30 pointer-events-none">
            <button
              onClick={() => setMobileTab('panier')}
              className="pointer-events-auto w-full bg-[#0D47A1] hover:bg-[#1565C0] text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between font-bold text-sm active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-extrabold">
                  {cartTotalQty}
                </span>
                <span>Voir le Panier</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tabular-nums">{formatAr(netAPayer)}</span>
                <span className="text-xs bg-white/20 px-2.5 py-1 rounded-lg">Payer →</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Modal Paiement */}
      {showPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[92vh] flex flex-col">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
            <div className="bg-[#0D47A1] text-white px-5 py-4 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                <span>💰</span> Encaissement
              </h3>
              <button onClick={() => setShowPayment(false)} className="p-1 rounded-lg hover:bg-white/20">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <div className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-100">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Net à payer</p>
                <p className="text-3xl font-extrabold text-[#0D47A1] mt-1 tabular-nums">{formatAr(netAPayer)}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Mode de paiement</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Espèces', 'Mobile Money', 'Mixte'] as PaymentMode[]).map(m => (
                    <button 
                      key={m} 
                      onClick={() => { setPaymentMode(m); if (m === 'Espèces') setMontantRecu(String(netAPayer)); }} 
                      className={`py-3 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px] ${
                        paymentMode === m ? 'bg-[#0D47A1] text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {paymentMode === 'Espèces' && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">Montant reçu</label>
                  <MoneyInput
                    value={montantRecu}
                    onChange={val => setMontantRecu(String(val))}
                    className="w-full px-4 py-3 rounded-xl border text-xl font-extrabold text-center focus:ring-2 focus:ring-[#0D47A1] focus:border-transparent tabular-nums"
                    placeholder="0"
                  />
                  {Number(montantRecu) >= netAPayer && (
                    <div className="p-2.5 rounded-xl bg-green-50 border border-green-200 mt-2 text-center">
                      <p className="text-green-700 font-extrabold text-sm sm:text-base">Monnaie à rendre : {formatAr(monnaie)}</p>
                    </div>
                  )}
                </div>
              )}
              {paymentMode === 'Mixte' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Montant espèces</label>
                    <MoneyInput
                      value={mixteEspeces}
                      onChange={val => setMixteEspeces(val)}
                      className="w-full px-4 py-2.5 rounded-xl border text-base font-bold text-center focus:ring-2 focus:ring-[#0D47A1]"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Montant Mobile Money</label>
                    <MoneyInput
                      value={mixteMobile}
                      onChange={val => setMixteMobile(val)}
                      className="w-full px-4 py-2.5 rounded-xl border text-base font-bold text-center focus:ring-2 focus:ring-[#0D47A1]"
                      placeholder="0"
                    />
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 border text-xs sm:text-sm text-center">
                    {mixteEspeces + mixteMobile < netAPayer ? (
                      <p className="text-red-500 font-bold">Reste à régler : {formatAr(netAPayer - (mixteEspeces + mixteMobile))}</p>
                    ) : mixteEspeces + mixteMobile > netAPayer ? (
                      <p className="text-green-600 font-extrabold">Monnaie à rendre : {formatAr((mixteEspeces + mixteMobile) - netAPayer)}</p>
                    ) : (
                      <p className="text-green-600 font-bold">✓ Montant complet réglé</p>
                    )}
                  </div>
                </div>
              )}
              {/* Utiliser l'imprimante — propre à ce poste */}
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={utiliserImprimante}
                    onChange={e => handleToggleImprimante(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-[#0D47A1] focus:ring-[#0D47A1] cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-semibold text-xs text-gray-900 flex items-center gap-1.5">
                        <Printer size={13} className="text-[#0D47A1]" />
                        Utiliser l'imprimante
                      </p>
                      <span className="text-[9px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">Ce poste</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-tight mt-0.5">
                      {utiliserImprimante ? 'Impression directe sur ce poste' : 'Désactivée sur ce poste'}
                    </p>
                  </div>
                </label>
              </div>
              <button
                onClick={handlePayment}
                disabled={
                  (paymentMode === 'Espèces' && Number(montantRecu) < netAPayer) ||
                  (paymentMode === 'Mixte' && (mixteEspeces + mixteMobile) < netAPayer)
                }
                className="w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-xl font-extrabold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-md min-h-[48px] active:scale-[0.98] transition-all"
              >
                ✅ Valider le paiement
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Consultation Alertes de Stock (sans tableau de gestion) */}
      {showAlertModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden border border-gray-100">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/20">
                  <AlertTriangle size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg">Articles en alerte de stock</h3>
                  <p className="text-xs text-orange-100">{articlesEnAlerte.length} article{articlesEnAlerte.length > 1 ? 's' : ''} à surveiller</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAlertModal(false)}
                className="p-1.5 rounded-xl hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
                <span className="font-bold">Pour la caisse : </span>
                Cette liste vous permet de connaître les produits en rupture ou bientôt épuisés afin d'en avertir les clients et le magasinier.
              </div>

              <div className="space-y-2">
                {articlesEnAlerte.map(a => {
                  const isZero = a.STOCK <= 0;
                  return (
                    <div
                      key={a.IDARTICLE}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                        isZero ? 'bg-red-50/60 border-red-200' : 'bg-orange-50/60 border-orange-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {a.IMAGE ? (
                          <div className="w-9 h-9 rounded-xl overflow-hidden border border-gray-200 bg-white flex items-center justify-center shrink-0 shadow-2xs">
                            <img src={a.IMAGE} alt={a.NOM} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <span className="text-2xl select-none shrink-0">{a.EMOJI || '📦'}</span>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-gray-900 truncate">{a.NOM}</p>
                          <p className="text-xs text-gray-400 font-mono">{a.CODE}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-base font-extrabold tabular-nums block ${isZero ? 'text-red-600' : 'text-orange-600'}`}>
                          {a.STOCK} en stock
                        </span>
                        <span className="text-[11px] text-gray-500">Seuil min : {a.STOCK_MIN}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowAlertModal(false)}
                className="px-5 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] text-white font-semibold text-sm transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={confirmClear} type="warning" title="Vider le panier" message="Voulez-vous vraiment vider le panier ?" confirmText="Oui, vider" cancelText="Non" onConfirm={clearCart} onCancel={() => setConfirmClear(false)} />
    </div>
  );
}
