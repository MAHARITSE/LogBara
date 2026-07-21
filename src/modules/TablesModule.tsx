import { useState, useMemo } from 'react';
import { Plus, Users, Trash2, CreditCard, X, Eye, UserPlus, Minus, RotateCcw } from 'lucide-react';
import { store } from '../store';
import { Personnel, TableR, CartItem, Client } from '../types';
import { formatAr, today, nowTime, nextId, generateFactureNum, capitalize } from '../helpers';
import { printTicket, printPreview } from '../components/PrintTicket';
import ConfirmModal from '../components/ConfirmModal';
import PhoneInput from '../components/PhoneInput';

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

  const [paymentMode, setPaymentMode] = useState<'Espèces' | 'Mobile Money' | 'Crédit' | 'Mixte'>('Espèces');
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [remise, setRemise] = useState(0);

  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ NOM_CLIENT: '', TELEPHONE: '' });

  const isAdmin = user.ROLE === 'Administrateur';
  const canEncaisser = user.ROLE === 'Gérant' || user.ROLE === 'Caissier';

  const consommations = useMemo(() => store.getConsommations(), [rk]);
  const articles = store.getArticles();
  const clients = useMemo(() => store.getClients(), [rk]);
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
    setRemise(0); setPaymentMode('Espèces'); setSelectedClient(null); setShowNewClient(false);
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

  const handleCreateClient = () => {
    if (!newClientForm.NOM_CLIENT.trim()) { showMsg('Nom obligatoire'); return; }
    const list = store.getClients();
    const newC: Client = {
      IDCLIENT: nextId(list, 'IDCLIENT'),
      NOM_CLIENT: capitalize(newClientForm.NOM_CLIENT.trim()),
      TELEPHONE: newClientForm.TELEPHONE, ADRESSE: '', CREDIT_TOTAL: 0, DATE_CREATION: today(),
    };
    store.setClients([...list, newC]);
    setSelectedClient(newC.IDCLIENT);
    setShowNewClient(false); setNewClientForm({ NOM_CLIENT: '', TELEPHONE: '' });
    refresh(); showMsg('Client créé');
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
      MODE_PAIEMENT: paymentMode === 'Crédit' ? 'Crédit' as const : paymentMode as 'Espèces' | 'Mobile Money',
      IDCLIENT: paymentMode === 'Crédit' ? selectedClient || undefined : undefined,
    }];

    if (paymentMode === 'Crédit' && selectedClient) {
      const cl = store.getClients();
      store.setClients(cl.map(c => c.IDCLIENT === selectedClient ? { ...c, CREDIT_TOTAL: c.CREDIT_TOTAL + netAPayer } : c));
    }

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
    `);

    setShowPayment(false); setSelectedTable(null); setRemise(0); setPaymentMode('Espèces'); setSelectedClient(null); setShowNewClient(false);
    refresh(); showMsg('Table encaissée !');
  };

  const printTablePreview = (table: TableR) => {
    const items = getTableItems(table.IDTABLE);
    const total = getTableTotal(table.IDTABLE);
    const caissier = personnel.find(p => p.IDPERSONNEL === table.IDCAISSIER);
    const rows = items.map(c => `<tr><td>${c.NOM}</td><td class="right">${c.QUANTITE}</td><td class="right">${formatAr(c.PRIX_UNITAIRE)}</td><td class="right">${formatAr(c.QUANTITE * c.PRIX_UNITAIRE)}</td></tr>`).join('');
    printPreview(`
      <div class="center bold">SUIVI TABLE</div>
      <div class="row"><span>${today()}</span><span>${nowTime()}</span></div>
      <div>Table: ${table.DESCRIPTION}</div>
      ${caissier ? `<div>Serveur: ${caissier.PRENOM}</div>` : ''}
      <div class="line"></div>
      <table><tr><td class="bold">Article</td><td class="bold right">Qte</td><td class="bold right">PU</td><td class="bold right">Mt</td></tr>${rows}</table>
      <div class="line"></div>
      <div class="row bold"><span>TOTAL</span><span>${formatAr(total)}</span></div>
    `);
  };

  const visibleTables = tables.filter(t => {
    if (isAdmin || user.ROLE === 'Gérant' || user.ROLE === 'Serveur') return true;
    return t.ETAT === 'Libre' || t.IDCAISSIER === user.IDPERSONNEL;
  });

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🍽️ Tables</h1>
        {isAdmin && (
          <button onClick={() => { setFormNumero(tables.length + 1); setShowForm(true); }} className="bg-[#0D47A1] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium hover:bg-[#1565C0]">
            <Plus size={18} /> Ajouter table
          </button>
        )}
      </div>

      {/* Grille des tables */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {visibleTables.map(table => {
          const total = getTableTotal(table.IDTABLE);
          const caissier = personnel.find(p => p.IDPERSONNEL === table.IDCAISSIER);
          const isOccupied = table.ETAT === 'Occupée';
          const canManage = canEncaisser && (user.ROLE === 'Gérant' || table.IDCAISSIER === user.IDPERSONNEL);

          return (
            <div key={table.IDTABLE} className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all ${isOccupied ? 'border-red-300' : 'border-green-300'}`}>
              <div className={`px-4 py-3 ${isOccupied ? 'bg-red-50' : 'bg-green-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold">Table {table.NUMERO}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${isOccupied ? 'bg-red-200 text-red-700' : 'bg-green-200 text-green-700'}`}>{table.ETAT}</span>
                </div>
                <p className="text-sm text-gray-500">{table.DESCRIPTION}</p>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3"><Users size={16} /><span>{table.PLACES} places</span></div>
                {isOccupied && (
                  <>
                    <p className="text-xl font-bold text-[#0D47A1] mb-2">{formatAr(total)}</p>
                    {caissier && <p className="text-xs text-gray-400 mb-2">Par: {caissier.PRENOM}</p>}
                  </>
                )}
                <div className="flex gap-2 mt-2">
                  {isOccupied && (
                    <button onClick={() => printTablePreview(table)} className="py-2 px-3 rounded-lg bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 flex items-center justify-center" title="Aperçu">
                      <Eye size={14} />
                    </button>
                  )}
                  {/* Bouton RETOUR sur la carte de table */}
                  {isOccupied && canManage && (
                    <button onClick={() => openReturn(table)} className="py-2 px-3 rounded-lg bg-orange-100 text-orange-600 text-sm hover:bg-orange-200 flex items-center justify-center gap-1" title="Retour articles">
                      <RotateCcw size={14} />
                    </button>
                  )}
                  {isOccupied && canManage && (
                    <button onClick={() => openPayment(table)} className="flex-1 py-2 px-3 rounded-lg bg-green-500 text-white text-sm hover:bg-green-600 flex items-center justify-center gap-1">
                      <CreditCard size={14} /> Payer
                    </button>
                  )}
                  {isAdmin && !isOccupied && (
                    <button onClick={() => setConfirmDelete(table)} className="flex-1 py-2 px-3 rounded-lg bg-red-100 text-red-600 text-sm hover:bg-red-200 flex items-center justify-center gap-1">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {visibleTables.length === 0 && <div className="text-center py-12 text-gray-400">Aucune table</div>}

      {/* ===== MODAL RETOUR D'ARTICLES ===== */}
      {showReturn && returnTable && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowReturn(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-orange-500 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2"><RotateCcw size={20} /> Retour — {returnTable.DESCRIPTION}</h3>
              <button onClick={() => setShowReturn(false)}><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">Sélectionnez les articles à retourner. Le stock ne sera pas affecté (les articles n'avaient pas encore été facturés).</p>
              <div className="space-y-3">
                {returnItems.map(item => (
                  <div key={item.IDARTICLE} className={`flex items-center justify-between p-3 rounded-xl border ${item.QUANTITE_RETOUR > 0 ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xl">{item.EMOJI || '📦'}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{item.NOM}</p>
                        <p className="text-xs text-gray-400">Servi: {item.QUANTITE_ACTUELLE}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => updateReturnQty(item.IDARTICLE, -1)} disabled={item.QUANTITE_RETOUR === 0} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-gray-100 disabled:opacity-30"><Minus size={14} /></button>
                      <span className={`font-bold w-8 text-center text-lg ${item.QUANTITE_RETOUR > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{item.QUANTITE_RETOUR}</span>
                      <button onClick={() => updateReturnQty(item.IDARTICLE, 1)} disabled={item.QUANTITE_RETOUR >= item.QUANTITE_ACTUELLE} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-gray-100 disabled:opacity-30"><Plus size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>

              {returnItems.some(i => i.QUANTITE_RETOUR > 0) && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                  <p className="text-sm font-semibold text-orange-700 mb-1">Résumé des retours :</p>
                  {returnItems.filter(i => i.QUANTITE_RETOUR > 0).map(i => (
                    <p key={i.IDARTICLE} className="text-sm text-orange-600">↩ {i.QUANTITE_RETOUR}x {i.NOM}</p>
                  ))}
                </div>
              )}

              <button
                onClick={confirmReturn}
                disabled={!returnItems.some(i => i.QUANTITE_RETOUR > 0)}
                className="w-full bg-orange-500 text-white py-3.5 rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between"><h3 className="font-bold text-lg">🍽️ Nouvelle table</h3><button onClick={() => setShowForm(false)}><X size={20} /></button></div>
            <div className="p-6 space-y-4">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Numéro</label><input type="number" value={formNumero} onChange={e => setFormNumero(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border" min={1} /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Description *</label><input type="text" value={formDescription} onChange={e => setFormDescription(capitalize(e.target.value))} placeholder="Ex: Terrasse 1, VIP..." className="w-full px-4 py-2.5 rounded-xl border" /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Nombre de places</label><input type="number" value={formPlaces} onChange={e => setFormPlaces(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border" min={1} /></div>
              <button onClick={handleCreateTable} className="w-full bg-[#0D47A1] text-white py-3 rounded-xl font-bold hover:bg-[#1565C0]">Créer la table</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL PAIEMENT (simple) + ajout client ===== */}
      {showPayment && selectedTable && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPayment(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">💳 Encaisser {selectedTable.DESCRIPTION}</h3>
              <button onClick={() => setShowPayment(false)}><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-medium mb-3">Consommations</h4>
                <div className="space-y-2">
                  {getTableItems(selectedTable.IDTABLE).map(item => (
                    <div key={item.IDARTICLE} className="flex justify-between text-sm">
                      <span>{item.EMOJI} {item.QUANTITE}x {item.NOM}</span>
                      <span className="font-medium">{formatAr(item.QUANTITE * item.PRIX_UNITAIRE)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Remise</label><input type="number" value={remise || ''} onChange={e => setRemise(Math.max(0, Number(e.target.value)))} className="w-full px-4 py-2.5 rounded-xl border" placeholder="0" /></div>

              <div className="bg-[#0D47A1] text-white rounded-xl p-4 text-center">
                <p className="text-sm opacity-80">Net à payer</p>
                <p className="text-3xl font-bold">{formatAr(getTableTotal(selectedTable.IDTABLE) - remise)}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Mode de paiement</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Espèces', 'Mobile Money', 'Crédit', 'Mixte'] as const).map(m => (
                    <button key={m} onClick={() => setPaymentMode(m)} className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${paymentMode === m ? 'bg-[#0D47A1] text-white' : 'bg-gray-100 text-gray-600'}`}>{m}</button>
                  ))}
                </div>
              </div>

              {paymentMode === 'Crédit' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Client</label>
                  <div className="flex gap-2">
                    <select value={selectedClient || ''} onChange={e => setSelectedClient(Number(e.target.value) || null)} className="flex-1 px-4 py-2.5 rounded-xl border">
                      <option value="">-- Sélectionner --</option>
                      {clients.map(c => <option key={c.IDCLIENT} value={c.IDCLIENT}>{c.NOM_CLIENT} ({formatAr(c.CREDIT_TOTAL)})</option>)}
                    </select>
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

              <button onClick={handlePayment} disabled={(paymentMode === 'Crédit' && !selectedClient)} className="w-full bg-green-500 text-white py-4 rounded-xl font-bold hover:bg-green-600 disabled:opacity-50">✅ Valider le paiement</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={!!confirmDelete} type="danger" title="Supprimer la table" message={`Voulez-vous vraiment supprimer la table "${confirmDelete?.DESCRIPTION}" ?`} confirmText="Oui, supprimer" cancelText="Non" onConfirm={() => confirmDelete && handleDeleteTable(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
    </div>
  );
}
