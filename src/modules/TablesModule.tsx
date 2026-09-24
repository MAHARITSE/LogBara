import { useState, useMemo } from 'react';
import { Plus, Users, Trash2, Wallet, X, Eye, Minus, RotateCcw } from 'lucide-react';
import { store } from '../store';
import { Personnel, TableR, CartItem } from '../types';
import { formatAr, today, nowTime, nextId, generateFactureNum, capitalize } from '../helpers';
import { printTicket } from '../components/PrintTicket';
import ConfirmModal from '../components/ConfirmModal';
import MoneyInput from '../components/MoneyInput';

interface Props { user: Personnel }

interface ReturnItem {
  IDARTICLE: number;
  NOM: string;
  EMOJI?: string;
  QUANTITE_ACTUELLE: number;
  QUANTITE_RETOUR: number;
}

export default function TablesModule({ user }: Props) {
  const [rk, setRk] = useState(0);
  const tables = useMemo(() => store.getTables(), [rk]);
  const [selectedTable, setSelectedTable] = useState<TableR | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [returnTable, setReturnTable] = useState<TableR | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<TableR | null>(null);
  const [toast, setToast] = useState('');

  const [formNumero, setFormNumero] = useState(1);
  const [formDescription, setFormDescription] = useState('');
  const [formPlaces, setFormPlaces] = useState(4);

  const [paymentMode, setPaymentMode] = useState<'Espèces' | 'Mobile Money' | 'Mixte'>('Espèces');
  const [remise, setRemise] = useState(0);
  const [tableFilter, setTableFilter] = useState<'all' | 'occupee' | 'libre'>('all');

  const isAdmin = user.ROLE === 'Administrateur';
  const canEncaisser = user.ROLE === 'Gérant' || user.ROLE === 'Caissier';

  const consommations = useMemo(() => store.getConsommations(), [rk]);
  const articles = store.getArticles();
  const personnel = store.getPersonnel();

  const showMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };
  const refresh = () => setRk(k => k + 1);

  const getTableItems = (tableId: number): CartItem[] => {
    const tc = consommations.filter(c => c.IDTABLE === tableId);
    const items: CartItem[] = [];
    tc.forEach(c => {
      const art = articles.find(a => a.IDARTICLE === c.IDARTICLE);
      if (art) {
        const ex = items.find(i => i.IDARTICLE === c.IDARTICLE);
        if (ex) ex.QUANTITE += c.QUANTITE;
        else items.push({ IDARTICLE: c.IDARTICLE, NOM: art.NOM, EMOJI: art.EMOJI, QUANTITE: c.QUANTITE, PRIX_UNITAIRE: c.PRIX_UNITAIRE, SAISIE_PRIX_VENTE: art.SAISIE_PRIX_VENTE });
      }
    });
    return items;
  };

  const getTableTotal = (tableId: number): number => getTableItems(tableId).reduce((s, i) => s + i.QUANTITE * i.PRIX_UNITAIRE, 0);

  // ========= RETOUR D'ARTICLES =========
  const openReturn = (table: TableR) => {
    const items = getTableItems(table.IDTABLE);
    setReturnItems(items.map(i => ({
      IDARTICLE: i.IDARTICLE, NOM: i.NOM, EMOJI: i.EMOJI,
      QUANTITE_ACTUELLE: i.QUANTITE, QUANTITE_RETOUR: 0,
    })));
    setReturnTable(table);
    setShowReturn(true);
  };

  const updateReturnQty = (artId: number, delta: number) => {
    setReturnItems(prev => prev.map(i => {
      if (i.IDARTICLE !== artId) return i;
      const nq = Math.max(0, Math.min(i.QUANTITE_ACTUELLE, i.QUANTITE_RETOUR + delta));
      return { ...i, QUANTITE_RETOUR: nq };
    }));
  };

  const confirmReturn = () => {
    if (!returnTable) return;
    const toReturn = returnItems.filter(i => i.QUANTITE_RETOUR > 0);
    if (toReturn.length === 0) { showMsg('Aucun retour sélectionné'); return; }

    // Mettre à jour les consommations : réduire les quantités
    let allConso = store.getConsommations();
    toReturn.forEach(ret => {
      let remaining = ret.QUANTITE_RETOUR;
      // Parcourir les consommations de cette table pour cet article et déduire
      allConso = allConso.map(c => {
        if (c.IDTABLE !== returnTable.IDTABLE || c.IDARTICLE !== ret.IDARTICLE || remaining <= 0) return c;
        const deduct = Math.min(c.QUANTITE, remaining);
        remaining -= deduct;
        return { ...c, QUANTITE: c.QUANTITE - deduct };
      }).filter(c => c.QUANTITE > 0); // supprimer les lignes à 0
    });
    store.setConsommations(allConso);

    // Si la table n'a plus de consommations, la libérer
    const remaining = allConso.filter(c => c.IDTABLE === returnTable.IDTABLE);
    if (remaining.length === 0) {
      store.setTables(store.getTables().map(t =>
        t.IDTABLE === returnTable.IDTABLE ? { ...t, ETAT: 'Libre' as const, IDCAISSIER: undefined } : t
      ));
    }

    const detail = toReturn.map(i => `${i.QUANTITE_RETOUR}x ${i.NOM}`).join(', ');
    setShowReturn(false); setReturnTable(null); setReturnItems([]);
    refresh();
    showMsg(`Retour effectué : ${detail}`);
  };

  // ========= PAIEMENT (simple, sans retour) =========
  const openPayment = (table: TableR) => {
    setSelectedTable(table);
    setRemise(0); setPaymentMode('Espèces');
    setShowPayment(true);
  };

  const handleCreateTable = () => {
    if (!formDescription.trim()) { showMsg('Description obligatoire'); return; }
    const newTable: TableR = {
      IDTABLE: nextId(tables, 'IDTABLE'), NUMERO: formNumero,
      DESCRIPTION: capitalize(formDescription.trim()), PLACES: formPlaces, ETAT: 'Libre',
    };
    store.setTables([...tables, newTable]);
    setShowForm(false); setFormNumero(tables.length + 1); setFormDescription(''); setFormPlaces(4);
    refresh(); showMsg('Table créée');
  };

  const handleDeleteTable = (table: TableR) => {
    if (table.ETAT === 'Occupée') { showMsg('Impossible de supprimer une table occupée'); return; }
    store.setTables(tables.filter(t => t.IDTABLE !== table.IDTABLE));
    store.setConsommations(consommations.filter(c => c.IDTABLE !== table.IDTABLE));
    setConfirmDelete(null); refresh(); showMsg('Table supprimée');
  };

  const handlePayment = () => {
    if (!selectedTable) return;
    const items = getTableItems(selectedTable.IDTABLE);
    if (items.length === 0) { showMsg('Aucun article à payer'); return; }

    const total = getTableTotal(selectedTable.IDTABLE);
    const netAPayer = total - remise;

    const ventes = store.getVentes();
    const lignesVente = store.getLignesVente();
    const paiements = store.getPaiements();
    const articlesList = store.getArticles();

    const idVente = nextId(ventes, 'IDVENTE');
    const numeroFacture = generateFactureNum('VTE', idVente);

    const newVente = {
      IDVENTE: idVente, NUMERO_FACTURE: numeroFacture, DATE_VENTE: today(), HEURE: nowTime(),
      IDPERSONNEL: user.IDPERSONNEL, IDTABLE: selectedTable.IDTABLE,
      TYPE: 'Table' as const, STATUT: 'Payée' as const, TOTAL: total, REMISE: remise,
      CLOTUREE: false, IDCLOTURE: null,
    };

    let idLigne = nextId(lignesVente, 'IDLIGNEVENTE');
    const newLignes = items.map(c => ({ IDLIGNEVENTE: idLigne++, IDVENTE: idVente, IDARTICLE: c.IDARTICLE, QUANTITE: c.QUANTITE, PRIX_UNITAIRE: c.PRIX_UNITAIRE, MONTANT: c.QUANTITE * c.PRIX_UNITAIRE }));

    let idPaiement = nextId(paiements, 'IDPAIEMENT');
    const newPaiements = [{
      IDPAIEMENT: idPaiement, DATE_PAIEMENT: today(), HEURE: nowTime(), IDVENTE: idVente,
      IDPERSONNEL: user.IDPERSONNEL, MONTANT: netAPayer,
      MODE_PAIEMENT: paymentMode as 'Espèces' | 'Mobile Money' | 'Mixte',
    }];

    const updatedArticles = articlesList.map(a => {
      const item = items.find(c => c.IDARTICLE === a.IDARTICLE);
      if (item && a.GERE_STOCK) return { ...a, STOCK: a.STOCK - item.QUANTITE };
      return a;
    });

    store.setTables(store.getTables().map(t => t.IDTABLE === selectedTable.IDTABLE ? { ...t, ETAT: 'Libre' as const, IDCAISSIER: undefined } : t));
    store.setConsommations(store.getConsommations().filter(c => c.IDTABLE !== selectedTable.IDTABLE));
    store.setVentes([...ventes, newVente]);
    store.setLignesVente([...lignesVente, ...newLignes]);
    store.setPaiements([...paiements, ...newPaiements]);
    store.setArticles(updatedArticles);

    const rows = items.map(c => `<tr><td>${c.NOM}</td><td class="right">${c.QUANTITE}</td><td class="right">${formatAr(c.PRIX_UNITAIRE)}</td><td class="right">${formatAr(c.QUANTITE * c.PRIX_UNITAIRE)}</td></tr>`).join('');
    printTicket(`
      <div class="center bold">TICKET TABLE</div>
      <div class="center">${numeroFacture}</div>
      <div class="row"><span>${today()}</span><span>${nowTime()}</span></div>
      <div>Table: ${selectedTable.DESCRIPTION}</div>
      <div>Caissier: ${user.PRENOM} ${user.NOM}</div>
      <div class="line"></div>
      <table><tr><td class="bold">Article</td><td class="bold right">Qte</td><td class="bold right">PU</td><td class="bold right">Mt</td></tr>${rows}</table>
      <div class="line"></div>
      ${remise > 0 ? `<div class="row"><span>Remise</span><span>-${formatAr(remise)}</span></div>` : ''}
      <div class="row bold"><span>TOTAL</span><span>${formatAr(netAPayer)}</span></div>
    `, false, user.IDPERSONNEL);

    setShowPayment(false); setSelectedTable(null); setRemise(0); setPaymentMode('Espèces');
    refresh(); showMsg('Table encaissée !');
  };

  const printTablePreview = (table: TableR) => {
    const items = getTableItems(table.IDTABLE);
    const total = getTableTotal(table.IDTABLE);
    const caissier = personnel.find(p => p.IDPERSONNEL === table.IDCAISSIER);
    const rows = items.map(c => `<tr><td>${c.NOM}</td><td class="right">${c.QUANTITE}</td><td class="right">${formatAr(c.PRIX_UNITAIRE)}</td><td class="right">${formatAr(c.QUANTITE * c.PRIX_UNITAIRE)}</td></tr>`).join('');
    printTicket(`
      <div class="center bold">SUIVI TABLE</div>
      <div class="row"><span>${today()}</span><span>${nowTime()}</span></div>
      <div>Table: ${table.DESCRIPTION}</div>
      ${caissier ? `<div>Serveur: ${caissier.PRENOM}</div>` : ''}
      <div class="line"></div>
      <table><tr><td class="bold">Article</td><td class="bold right">Qte</td><td class="bold right">PU</td><td class="bold right">Mt</td></tr>${rows}</table>
      <div class="line"></div>
      <div class="row bold"><span>TOTAL</span><span>${formatAr(total)}</span></div>
    `, true);
  };

  const visibleTables = tables.filter(t => {
    if (isAdmin || user.ROLE === 'Gérant' || user.ROLE === 'Serveur') return true;
    return t.ETAT === 'Libre' || t.IDCAISSIER === user.IDPERSONNEL;
  });

  const filteredTables = visibleTables.filter(t => {
    if (tableFilter === 'occupee') return t.ETAT === 'Occupée';
    if (tableFilter === 'libre') return t.ETAT === 'Libre';
    return true;
  });

  const countOccupees = visibleTables.filter(t => t.ETAT === 'Occupée').length;
  const countLibres = visibleTables.filter(t => t.ETAT === 'Libre').length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {toast && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse font-medium">{toast}</div>}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">🍽️ Tables</h1>
          <p className="text-xs text-gray-500 mt-0.5">Gestion du service en salle & encaissement</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setFormNumero(tables.length + 1); setShowForm(true); }} className="bg-[#0D47A1] text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 font-semibold hover:bg-[#1565C0] min-h-[44px] active:scale-95 transition-transform shadow-xs">
            <Plus size={18} /> Ajouter une table
          </button>
        )}
      </div>

      {/* Filtres de statut de table */}
      <div className="flex gap-2 pb-1 overflow-x-auto whitespace-nowrap scrollbar-none">
        <button 
          onClick={() => setTableFilter('all')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[40px] ${
            tableFilter === 'all' ? 'bg-[#0D47A1] text-white shadow-xs' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Toutes ({visibleTables.length})
        </button>
        <button 
          onClick={() => setTableFilter('occupee')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[40px] flex items-center gap-1.5 ${
            tableFilter === 'occupee' ? 'bg-red-600 text-white shadow-xs' : 'bg-white text-red-600 hover:bg-red-50 border border-red-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Occupées ({countOccupees})
        </button>
        <button 
          onClick={() => setTableFilter('libre')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[40px] flex items-center gap-1.5 ${
            tableFilter === 'libre' ? 'bg-green-600 text-white shadow-xs' : 'bg-white text-green-700 hover:bg-green-50 border border-green-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Libres ({countLibres})
        </button>
      </div>

      {/* Grille des tables */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {filteredTables.map(table => {
          const total = getTableTotal(table.IDTABLE);
          const caissier = personnel.find(p => p.IDPERSONNEL === table.IDCAISSIER);
          const isOccupied = table.ETAT === 'Occupée';
          const canManage = canEncaisser && (user.ROLE === 'Gérant' || table.IDCAISSIER === user.IDPERSONNEL);

          return (
            <div key={table.IDTABLE} className={`bg-white rounded-2xl shadow-xs border-2 overflow-hidden transition-all ${isOccupied ? 'border-red-300' : 'border-green-300'}`}>
              <div className={`px-4 py-3 ${isOccupied ? 'bg-red-50' : 'bg-green-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-base text-gray-900">Table {table.NUMERO}</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${isOccupied ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'}`}>{table.ETAT}</span>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 font-medium truncate mt-0.5">{table.DESCRIPTION}</p>
              </div>
              <div className="p-3.5 sm:p-4">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-500 mb-2 font-medium">
                  <Users size={16} />
                  <span>{table.PLACES} places</span>
                </div>
                {isOccupied && (
                  <div className="mb-2">
                    <p className="text-xl sm:text-2xl font-extrabold text-[#0D47A1] tabular-nums">{formatAr(total)}</p>
                    {caissier && <p className="text-xs text-gray-500 font-medium mt-0.5">Par : {caissier.PRENOM}</p>}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-gray-100">
                  {isOccupied && (
                    <button 
                      onClick={() => printTablePreview(table)} 
                      className="py-2.5 px-3 min-h-[44px] min-w-[44px] rounded-xl bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 flex items-center justify-center active:scale-95 transition-transform" 
                      title="Aperçu ticket"
                      aria-label="Aperçu ticket"
                    >
                      <Eye size={18} />
                    </button>
                  )}
                  {/* Bouton RETOUR sur la carte de table */}
                  {isOccupied && canManage && (
                    <button 
                      onClick={() => openReturn(table)} 
                      className="py-2.5 px-3 min-h-[44px] min-w-[44px] rounded-xl bg-orange-100 text-orange-700 text-sm hover:bg-orange-200 flex items-center justify-center gap-1 active:scale-95 transition-transform" 
                      title="Retour articles"
                      aria-label="Retour articles"
                    >
                      <RotateCcw size={18} />
                    </button>
                  )}
                  {isOccupied && canManage && (
                    <button 
                      onClick={() => openPayment(table)} 
                      className="flex-1 py-2.5 px-3 min-h-[44px] rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform"
                    >
                      <Wallet size={16} />
                      <span>Payer</span>
                    </button>
                  )}
                  {isAdmin && !isOccupied && (
                    <button 
                      onClick={() => setConfirmDelete(table)} 
                      className="flex-1 py-2.5 px-3 min-h-[44px] rounded-xl bg-red-50 text-red-600 font-semibold text-xs hover:bg-red-100 flex items-center justify-center gap-1 active:scale-95"
                    >
                      <Trash2 size={16} />
                      <span>Supprimer</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {filteredTables.length === 0 && (
        <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <p className="font-medium">Aucune table dans cette catégorie</p>
        </div>
      )}

      {/* ===== MODAL RETOUR D'ARTICLES ===== */}
      {showReturn && returnTable && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
            <div className="bg-orange-500 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base sm:text-lg flex items-center gap-2"><RotateCcw size={20} /> Retour — {returnTable.DESCRIPTION}</h3>
              <button onClick={() => setShowReturn(false)} className="p-1 rounded-lg hover:bg-white/20"><X size={20} /></button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              <p className="text-xs sm:text-sm text-gray-500">Sélectionnez les articles à retourner. Le stock ne sera pas affecté (les articles n'avaient pas encore été facturés).</p>
              <div className="space-y-2.5">
                {returnItems.map(item => (
                  <div key={item.IDARTICLE} className={`flex items-center justify-between p-3 rounded-xl border ${item.QUANTITE_RETOUR > 0 ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <span className="text-xl shrink-0">{item.EMOJI || '📦'}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate text-gray-900">{item.NOM}</p>
                        <p className="text-xs text-gray-500 font-medium">Servi : {item.QUANTITE_ACTUELLE}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => updateReturnQty(item.IDARTICLE, -1)} disabled={item.QUANTITE_RETOUR === 0} className="w-9 h-9 rounded-xl border bg-white flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 active:scale-95 shadow-xs"><Minus size={16} /></button>
                      <span className={`font-bold w-7 text-center text-base tabular-nums ${item.QUANTITE_RETOUR > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{item.QUANTITE_RETOUR}</span>
                      <button onClick={() => updateReturnQty(item.IDARTICLE, 1)} disabled={item.QUANTITE_RETOUR >= item.QUANTITE_ACTUELLE} className="w-9 h-9 rounded-xl border bg-white flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 active:scale-95 shadow-xs"><Plus size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>

              {returnItems.some(i => i.QUANTITE_RETOUR > 0) && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                  <p className="text-xs sm:text-sm font-bold text-orange-800 mb-1">Résumé des retours :</p>
                  {returnItems.filter(i => i.QUANTITE_RETOUR > 0).map(i => (
                    <p key={i.IDARTICLE} className="text-xs sm:text-sm text-orange-700 font-medium">↩ {i.QUANTITE_RETOUR}x {i.NOM}</p>
                  ))}
                </div>
              )}

              <button
                onClick={confirmReturn}
                disabled={!returnItems.some(i => i.QUANTITE_RETOUR > 0)}
                className="w-full bg-orange-500 text-white py-3.5 rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[48px] active:scale-[0.98] shadow-sm transition-all"
              >
                <RotateCcw size={18} />
                Confirmer le retour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL CRÉATION TABLE ===== */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
            <div className="bg-[#0D47A1] text-white px-5 py-4 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base sm:text-lg">🍽️ Nouvelle table</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-white/20"><X size={20} /></button>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1 block">Numéro</label>
                <input type="number" value={formNumero} onChange={e => setFormNumero(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-[#0D47A1]" min={1} />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1 block">Description *</label>
                <input type="text" value={formDescription} onChange={e => setFormDescription(capitalize(e.target.value))} placeholder="Ex: Salle 1, Terrasse VIP..." className="w-full px-4 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-[#0D47A1]" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1 block">Nombre de places</label>
                <input type="number" value={formPlaces} onChange={e => setFormPlaces(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-[#0D47A1]" min={1} />
              </div>
              <button onClick={handleCreateTable} className="w-full bg-[#0D47A1] text-white py-3.5 rounded-xl font-bold hover:bg-[#1565C0] min-h-[48px] active:scale-[0.98] shadow-sm transition-all">Créer la table</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL PAIEMENT (simple) ===== */}
      {showPayment && selectedTable && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
            <div className="bg-[#0D47A1] text-white px-5 py-4 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base sm:text-lg">💰 Encaisser {selectedTable.DESCRIPTION}</h3>
              <button onClick={() => setShowPayment(false)} className="p-1 rounded-lg hover:bg-white/20"><X size={20} /></button>
            </div>
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <h4 className="font-semibold text-xs text-gray-500 uppercase tracking-wider mb-2">Consommations en cours</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {getTableItems(selectedTable.IDTABLE).map(item => (
                    <div key={item.IDARTICLE} className="flex justify-between text-sm py-1 border-b border-gray-200/50 last:border-0">
                      <span className="font-medium text-gray-800">{item.EMOJI} {item.QUANTITE}x {item.NOM}</span>
                      <span className="font-bold tabular-nums text-gray-900">{formatAr(item.QUANTITE * item.PRIX_UNITAIRE)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1 block">Remise</label>
                <MoneyInput
                  value={remise}
                  onChange={val => setRemise(Math.max(0, val))}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm font-medium focus:ring-2 focus:ring-[#0D47A1]"
                  placeholder="0"
                />
              </div>

              <div className="bg-[#0D47A1] text-white rounded-xl p-4 text-center shadow-xs">
                <p className="text-xs uppercase tracking-wider opacity-80">Net à payer</p>
                <p className="text-2xl sm:text-3xl font-extrabold mt-0.5 tabular-nums">{formatAr(getTableTotal(selectedTable.IDTABLE) - remise)}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Mode de paiement</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Espèces', 'Mobile Money', 'Mixte'] as const).map(m => (
                    <button 
                      key={m} 
                      onClick={() => setPaymentMode(m)} 
                      className={`py-3 px-2 rounded-xl text-xs sm:text-sm font-bold min-h-[44px] transition-all ${
                        paymentMode === m ? 'bg-[#0D47A1] text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={handlePayment} 
                className="w-full bg-green-600 text-white py-4 rounded-xl font-extrabold text-base hover:bg-green-700 transition-colors min-h-[48px] active:scale-[0.98] shadow-md"
              >
                ✅ Valider le paiement
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={!!confirmDelete} type="danger" title="Supprimer la table" message={`Voulez-vous vraiment supprimer la table "${confirmDelete?.DESCRIPTION}" ?`} confirmText="Oui, supprimer" cancelText="Non" onConfirm={() => confirmDelete && handleDeleteTable(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
    </div>
  );
}
