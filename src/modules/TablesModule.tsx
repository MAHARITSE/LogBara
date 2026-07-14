import { useState } from 'react';
import { Plus, Users, Trash2, CreditCard, X, Eye } from 'lucide-react';
import { store } from '../store';
import { Personnel, TableR, CartItem } from '../types';
import { formatAr, today, nowTime, nextId, generateFactureNum, capitalize } from '../helpers';
import { printTicket, printPreview } from '../components/PrintTicket';
import ConfirmModal from '../components/ConfirmModal';

interface Props {
  user: Personnel;
}

export default function TablesModule({ user }: Props) {
  const [tables, setTables] = useState(store.getTables());
  const [selectedTable, setSelectedTable] = useState<TableR | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TableR | null>(null);
  const [toast, setToast] = useState('');
  
  // Form
  const [formNumero, setFormNumero] = useState(1);
  const [formDescription, setFormDescription] = useState('');
  const [formPlaces, setFormPlaces] = useState(4);

  // Payment
  const [paymentMode, setPaymentMode] = useState<'Espèces' | 'Mobile Money' | 'Crédit' | 'Mixte'>('Espèces');
  const [_montantRecu, _setMontantRecu] = useState('');
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [remise, setRemise] = useState(0);

  const isAdmin = user.ROLE === 'Administrateur';
  // Serveur ou Admin = lecture seule
void (user.ROLE === 'Serveur' || isAdmin);
  const canEncaisser = user.ROLE === 'Gérant' || user.ROLE === 'Caissier';

  const consommations = store.getConsommations();
  const articles = store.getArticles();
  const clients = store.getClients();
  const personnel = store.getPersonnel();

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const refresh = () => setTables(store.getTables());

  // Consommations de la table sélectionnée
  const getTableItems = (tableId: number): CartItem[] => {
    const tableConsommations = consommations.filter(c => c.IDTABLE === tableId);
    const items: CartItem[] = [];
    tableConsommations.forEach(c => {
      const art = articles.find(a => a.IDARTICLE === c.IDARTICLE);
      if (art) {
        const existing = items.find(i => i.IDARTICLE === c.IDARTICLE);
        if (existing) {
          existing.QUANTITE += c.QUANTITE;
        } else {
          items.push({
            IDARTICLE: c.IDARTICLE,
            NOM: art.NOM,
            EMOJI: art.EMOJI,
            QUANTITE: c.QUANTITE,
            PRIX_UNITAIRE: c.PRIX_UNITAIRE,
            SAISIE_PRIX_VENTE: art.SAISIE_PRIX_VENTE,
          });
        }
      }
    });
    return items;
  };

  const getTableTotal = (tableId: number): number => {
    const items = getTableItems(tableId);
    return items.reduce((s, i) => s + i.QUANTITE * i.PRIX_UNITAIRE, 0);
  };

  // Créer une table (Admin uniquement)
  const handleCreateTable = () => {
    if (!formDescription.trim()) {
      showMsg('Description obligatoire');
      return;
    }
    const newTable: TableR = {
      IDTABLE: nextId(tables, 'IDTABLE'),
      NUMERO: formNumero,
      DESCRIPTION: capitalize(formDescription.trim()),
      PLACES: formPlaces,
      ETAT: 'Libre',
    };
    store.setTables([...tables, newTable]);
    setShowForm(false);
    setFormNumero(tables.length + 1);
    setFormDescription('');
    setFormPlaces(4);
    refresh();
    showMsg('Table créée');
  };

  // Supprimer une table (Admin uniquement)
  const handleDeleteTable = (table: TableR) => {
    if (table.ETAT === 'Occupée') {
      showMsg('Impossible de supprimer une table occupée');
      return;
    }
    store.setTables(tables.filter(t => t.IDTABLE !== table.IDTABLE));
    store.setConsommations(consommations.filter(c => c.IDTABLE !== table.IDTABLE));
    setConfirmDelete(null);
    refresh();
    showMsg('Table supprimée');
  };

  // Encaisser la table
  const handlePayment = () => {
    if (!selectedTable) return;

    const items = getTableItems(selectedTable.IDTABLE);
    if (items.length === 0) return;

    const total = getTableTotal(selectedTable.IDTABLE);
    const netAPayer = total - remise;

    const ventes = store.getVentes();
    const lignesVente = store.getLignesVente();
    const paiements = store.getPaiements();
    const articlesList = store.getArticles();

    const idVente = nextId(ventes, 'IDVENTE');
    const numeroFacture = generateFactureNum('VTE', idVente);

    // Créer la vente
    const newVente = {
      IDVENTE: idVente,
      NUMERO_FACTURE: numeroFacture,
      DATE_VENTE: today(),
      HEURE: nowTime(),
      IDPERSONNEL: user.IDPERSONNEL,
      IDTABLE: selectedTable.IDTABLE,
      TYPE: 'Table' as const,
      STATUT: 'Payée' as const,
      TOTAL: total,
      REMISE: remise,
      CLOTUREE: false,
      IDCLOTURE: null,
    };

    // Lignes de vente
    let idLigne = nextId(lignesVente, 'IDLIGNEVENTE');
    const newLignes = items.map(c => ({
      IDLIGNEVENTE: idLigne++,
      IDVENTE: idVente,
      IDARTICLE: c.IDARTICLE,
      QUANTITE: c.QUANTITE,
      PRIX_UNITAIRE: c.PRIX_UNITAIRE,
      MONTANT: c.QUANTITE * c.PRIX_UNITAIRE,
    }));

    // Paiement
    let idPaiement = nextId(paiements, 'IDPAIEMENT');
    const newPaiements = [{
      IDPAIEMENT: idPaiement,
      DATE_PAIEMENT: today(),
      HEURE: nowTime(),
      IDVENTE: idVente,
      IDPERSONNEL: user.IDPERSONNEL,
      MONTANT: netAPayer,
      MODE_PAIEMENT: paymentMode === 'Crédit' ? 'Crédit' as const : paymentMode as 'Espèces' | 'Mobile Money',
      IDCLIENT: paymentMode === 'Crédit' ? selectedClient || undefined : undefined,
    }];

    // Crédit client
    if (paymentMode === 'Crédit' && selectedClient) {
      const clientsList = store.getClients();
      store.setClients(clientsList.map(c =>
        c.IDCLIENT === selectedClient ? { ...c, CREDIT_TOTAL: c.CREDIT_TOTAL + netAPayer } : c
      ));
    }

    // Mettre à jour le stock
    const updatedArticles = articlesList.map(a => {
      const item = items.find(c => c.IDARTICLE === a.IDARTICLE);
      if (item && a.GERE_STOCK) {
        return { ...a, STOCK: a.STOCK - item.QUANTITE };
      }
      return a;
    });

    // Libérer la table
    const updatedTables = tables.map(t =>
      t.IDTABLE === selectedTable.IDTABLE
        ? { ...t, ETAT: 'Libre' as const, IDCAISSIER: undefined }
        : t
    );

    // Effacer les consommations
    const otherConsommations = consommations.filter(c => c.IDTABLE !== selectedTable.IDTABLE);

    // Sauvegarder
    store.setVentes([...ventes, newVente]);
    store.setLignesVente([...lignesVente, ...newLignes]);
    store.setPaiements([...paiements, ...newPaiements]);
    store.setArticles(updatedArticles);
    store.setTables(updatedTables);
    store.setConsommations(otherConsommations);

    // Imprimer ticket
    const rows = items.map(c =>
      `<tr><td>${c.NOM}</td><td class="right">${c.QUANTITE}</td><td class="right">${formatAr(c.PRIX_UNITAIRE)}</td><td class="right">${formatAr(c.QUANTITE * c.PRIX_UNITAIRE)}</td></tr>`
    ).join('');

    printTicket(`
      <div class="center bold">TICKET TABLE</div>
      <div class="center">${numeroFacture}</div>
      <div class="row"><span>${today()}</span><span>${nowTime()}</span></div>
      <div>Table: ${selectedTable.DESCRIPTION}</div>
      <div>Caissier: ${user.PRENOM} ${user.NOM}</div>
      <div class="line"></div>
      <table>
        <tr><td class="bold">Article</td><td class="bold right">Qté</td><td class="bold right">PU</td><td class="bold right">Mt</td></tr>
        ${rows}
      </table>
      <div class="line"></div>
      <div class="row"><span>Sous-total</span><span>${formatAr(total)}</span></div>
      ${remise > 0 ? `<div class="row"><span>Remise</span><span>-${formatAr(remise)}</span></div>` : ''}
      <div class="row bold"><span>TOTAL</span><span>${formatAr(netAPayer)}</span></div>
    `);

    // Reset
    setShowPayment(false);
    setSelectedTable(null);
    setRemise(0);
    setPaymentMode('Espèces');
    _setMontantRecu('');
    setSelectedClient(null);
    refresh();
    showMsg('Table encaissée !');
  };

  // Aperçu suivi table
  const printTablePreview = (table: TableR) => {
    const items = getTableItems(table.IDTABLE);
    const total = getTableTotal(table.IDTABLE);
    const caissier = personnel.find(p => p.IDPERSONNEL === table.IDCAISSIER);

    const rows = items.map(c =>
      `<tr><td>${c.NOM}</td><td class="right">${c.QUANTITE}</td><td class="right">${formatAr(c.PRIX_UNITAIRE)}</td><td class="right">${formatAr(c.QUANTITE * c.PRIX_UNITAIRE)}</td></tr>`
    ).join('');

    printPreview(`
      <div class="center bold">SUIVI TABLE</div>
      <div class="row"><span>${today()}</span><span>${nowTime()}</span></div>
      <div>Table: ${table.DESCRIPTION}</div>
      ${caissier ? `<div>Serveur: ${caissier.PRENOM}</div>` : ''}
      <div class="line"></div>
      <table>
        <tr><td class="bold">Article</td><td class="bold right">Qté</td><td class="bold right">PU</td><td class="bold right">Mt</td></tr>
        ${rows}
      </table>
      <div class="line"></div>
      <div class="row bold"><span>TOTAL</span><span>${formatAr(total)}</span></div>
    `);
  };

  // Filtrer les tables pour les caissiers
  const visibleTables = tables.filter(t => {
    if (user.ROLE === 'Administrateur' || user.ROLE === 'Gérant' || user.ROLE === 'Serveur') return true;
    // Caissier : ses tables ou tables libres
    return t.ETAT === 'Libre' || t.IDCAISSIER === user.IDPERSONNEL;
  });

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🍽️ Tables</h1>
        {isAdmin && (
          <button
            onClick={() => { setFormNumero(tables.length + 1); setShowForm(true); }}
            className="bg-[#0D47A1] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium hover:bg-[#1565C0]"
          >
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
            <div
              key={table.IDTABLE}
              className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all ${
                isOccupied ? 'border-red-300' : 'border-green-300'
              }`}
            >
              <div className={`px-4 py-3 ${isOccupied ? 'bg-red-50' : 'bg-green-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold">Table {table.NUMERO}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${isOccupied ? 'bg-red-200 text-red-700' : 'bg-green-200 text-green-700'}`}>
                    {table.ETAT}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{table.DESCRIPTION}</p>
              </div>

              <div className="p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                  <Users size={16} />
                  <span>{table.PLACES} places</span>
                </div>

                {isOccupied && (
                  <>
                    <p className="text-xl font-bold text-[#0D47A1] mb-2">{formatAr(total)}</p>
                    {caissier && <p className="text-xs text-gray-400">Par: {caissier.PRENOM}</p>}
                  </>
                )}

                <div className="flex gap-2 mt-3">
                  {isOccupied && (
                    <button
                      onClick={() => printTablePreview(table)}
                      className="flex-1 py-2 px-3 rounded-lg bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 flex items-center justify-center gap-1"
                    >
                      <Eye size={14} />
                    </button>
                  )}
                  
                  {isOccupied && canManage && (
                    <button
                      onClick={() => { setSelectedTable(table); setShowPayment(true); }}
                      className="flex-1 py-2 px-3 rounded-lg bg-green-500 text-white text-sm hover:bg-green-600 flex items-center justify-center gap-1"
                    >
                      <CreditCard size={14} /> Payer
                    </button>
                  )}

                  {isAdmin && !isOccupied && (
                    <button
                      onClick={() => setConfirmDelete(table)}
                      className="flex-1 py-2 px-3 rounded-lg bg-red-100 text-red-600 text-sm hover:bg-red-200 flex items-center justify-center gap-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {visibleTables.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          Aucune table
        </div>
      )}

      {/* Modal création table */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">🍽️ Nouvelle table</h3>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Numéro</label>
                <input
                  type="number"
                  value={formNumero}
                  onChange={e => setFormNumero(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border"
                  min={1}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Description *</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={e => setFormDescription(capitalize(e.target.value))}
                  placeholder="Ex: Terrasse 1, VIP..."
                  className="w-full px-4 py-2.5 rounded-xl border"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Nombre de places</label>
                <input
                  type="number"
                  value={formPlaces}
                  onChange={e => setFormPlaces(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border"
                  min={1}
                />
              </div>

              <button
                onClick={handleCreateTable}
                className="w-full bg-[#0D47A1] text-white py-3 rounded-xl font-bold hover:bg-[#1565C0]"
              >
                Créer la table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal paiement */}
      {showPayment && selectedTable && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPayment(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">💳 Encaisser {selectedTable.DESCRIPTION}</h3>
              <button onClick={() => setShowPayment(false)}><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Liste des consommations */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-medium mb-3">Consommations</h4>
                <div className="space-y-2">
                  {getTableItems(selectedTable.IDTABLE).map(item => (
                    <div key={item.IDARTICLE} className="flex justify-between text-sm">
                      <span>{item.QUANTITE}x {item.NOM}</span>
                      <span className="font-medium">{formatAr(item.QUANTITE * item.PRIX_UNITAIRE)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Remise */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Remise</label>
                <input
                  type="number"
                  value={remise || ''}
                  onChange={e => setRemise(Math.max(0, Number(e.target.value)))}
                  className="w-full px-4 py-2.5 rounded-xl border"
                  placeholder="0"
                />
              </div>

              {/* Total */}
              <div className="bg-[#0D47A1] text-white rounded-xl p-4 text-center">
                <p className="text-sm opacity-80">Net à payer</p>
                <p className="text-3xl font-bold">{formatAr(getTableTotal(selectedTable.IDTABLE) - remise)}</p>
              </div>

              {/* Mode de paiement */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Mode de paiement</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Espèces', 'Mobile Money', 'Crédit', 'Mixte'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setPaymentMode(m)}
                      className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                        paymentMode === m ? 'bg-[#0D47A1] text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Client (Crédit) */}
              {paymentMode === 'Crédit' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Client</label>
                  <select
                    value={selectedClient || ''}
                    onChange={e => setSelectedClient(Number(e.target.value) || null)}
                    className="w-full px-4 py-2.5 rounded-xl border"
                  >
                    <option value="">-- Sélectionner --</option>
                    {clients.map(c => (
                      <option key={c.IDCLIENT} value={c.IDCLIENT}>
                        {c.NOM_CLIENT} ({formatAr(c.CREDIT_TOTAL)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={handlePayment}
                disabled={paymentMode === 'Crédit' && !selectedClient}
                className="w-full bg-green-500 text-white py-4 rounded-xl font-bold hover:bg-green-600 disabled:opacity-50"
              >
                ✅ Valider le paiement
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        type="danger"
        title="Supprimer la table"
        message={`Voulez-vous vraiment supprimer la table "${confirmDelete?.DESCRIPTION}" ?`}
        confirmText="Oui, supprimer"
        cancelText="Non"
        onConfirm={() => confirmDelete && handleDeleteTable(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
