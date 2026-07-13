import { useState } from 'react';
import { Plus, Edit2, Trash2, Search, Check, X, Package, Tag, Warehouse, ArrowDownCircle, ArrowUpCircle, Truck, Users, UserCircle, Building2, ToggleLeft, ToggleRight, CreditCard, Calculator, Printer, ClipboardList, HardDrive, Download, Upload, FileJson, Database } from 'lucide-react';
import { store } from '../store';
import { Personnel, Article, Famille, Fournisseur, Client, Mouvement, Inventaire, LigneInventaire, Cloture } from '../types';
import { formatAr, today, nowTime, nextId, dateLabel, capitalize, roleColors, logoEmojis } from '../helpers';
import { printTicket } from '../components/PrintTicket';
import ConfirmModal from '../components/ConfirmModal';
import * as XLSX from 'xlsx';

interface Props { user: Personnel }

// ============== ARTICLES ==============
export function ArticlesModule({ user }: Props) {
  const [articles, setArticles] = useState(store.getArticles());
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Article | null>(null);
  const [search, setSearch] = useState('');
  const [confirmDel, setConfirmDel] = useState<Article | null>(null);
  const [toast, setToast] = useState('');
  
  const [form, setForm] = useState({
    CODE: '', NOM: '', IDFAMILLE: 0, EMOJI: '📦',
    PRIX_ACHAT: 0, PRIX_VENTE: 0, STOCK: 0, STOCK_MIN: 5,
    GERE_STOCK: true, SAISIE_PRIX_VENTE: false
  });

  const familles = store.getFamilles();
  const isAdmin = user.ROLE === 'Administrateur';

  const showMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };
  const refresh = () => setArticles(store.getArticles());

  const filtered = articles.filter(a => 
    a.NOM.toLowerCase().includes(search.toLowerCase()) ||
    a.CODE.toLowerCase().includes(search.toLowerCase())
  );

  const openForm = (art?: Article) => {
    if (art) {
      setEditItem(art);
      setForm({
        CODE: art.CODE, NOM: art.NOM, IDFAMILLE: art.IDFAMILLE, EMOJI: art.EMOJI || '📦',
        PRIX_ACHAT: art.PRIX_ACHAT, PRIX_VENTE: art.PRIX_VENTE,
        STOCK: art.STOCK, STOCK_MIN: art.STOCK_MIN,
        GERE_STOCK: art.GERE_STOCK, SAISIE_PRIX_VENTE: art.SAISIE_PRIX_VENTE
      });
    } else {
      setEditItem(null);
      setForm({ CODE: '', NOM: '', IDFAMILLE: familles[0]?.IDFAMILLE || 0, EMOJI: '📦', PRIX_ACHAT: 0, PRIX_VENTE: 0, STOCK: 0, STOCK_MIN: 5, GERE_STOCK: true, SAISIE_PRIX_VENTE: false });
    }
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.CODE || !form.NOM) { showMsg('Code et nom obligatoires'); return; }
    const list = store.getArticles();
    if (editItem) {
      store.setArticles(list.map(a => a.IDARTICLE === editItem.IDARTICLE ? { ...a, ...form, ACTIF: true } : a));
      showMsg('Article modifié');
    } else {
      const newArt: Article = { IDARTICLE: nextId(list, 'IDARTICLE'), ...form, ACTIF: true, CODE_BARRE: '' };
      store.setArticles([...list, newArt]);
      showMsg('Article créé');
    }
    setShowForm(false);
    refresh();
  };

  const handleDelete = () => {
    if (!confirmDel) return;
    store.setArticles(store.getArticles().filter(a => a.IDARTICLE !== confirmDel.IDARTICLE));
    setConfirmDel(null);
    refresh();
    showMsg('Article supprimé');
  };

  const toggleGereStock = (art: Article) => {
    const mvts = store.getMouvements();
    const newMvts = [...mvts];
    let mvtId = nextId(mvts, 'IDMOUVEMENT');
    
    if (art.GERE_STOCK && art.STOCK > 0) {
      // Passage vers non géré : mouvement de sortie
      newMvts.push({
        IDMOUVEMENT: mvtId,
        DATE_MOUVEMENT: today(),
        HEURE: nowTime(),
        IDARTICLE: art.IDARTICLE,
        TYPE: 'Sortie' as const,
        QUANTITE: art.STOCK,
        REFERENCE: `Passage en vente libre — ${user.PRENOM} ${user.NOM}`,
      });
    }
    
    const updated = store.getArticles().map(a => 
      a.IDARTICLE === art.IDARTICLE 
        ? { ...a, GERE_STOCK: !a.GERE_STOCK, STOCK: !a.GERE_STOCK ? 0 : a.STOCK } 
        : a
    );
    store.setArticles(updated);
    store.setMouvements(newMvts);
    refresh();
    showMsg(art.GERE_STOCK ? 'Article en vente libre' : 'Article géré en stock');
  };

  const toggleSaisiePrix = (art: Article) => {
    const updated = store.getArticles().map(a => 
      a.IDARTICLE === art.IDARTICLE ? { ...a, SAISIE_PRIX_VENTE: !a.SAISIE_PRIX_VENTE } : a
    );
    store.setArticles(updated);
    refresh();
    showMsg(art.SAISIE_PRIX_VENTE ? 'Prix fixe' : 'Prix libre activé');
  };

  const alerts = articles.filter(a => a.ACTIF && a.GERE_STOCK && a.STOCK <= a.STOCK_MIN).length;
  const libres = articles.filter(a => a.ACTIF && !a.GERE_STOCK).length;

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-[60] animate-pulse">{toast}</div>}
      
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0D47A1] to-[#1976D2] flex items-center justify-center">
            <Package size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Articles</h1>
            <p className="text-sm text-gray-500">{articles.length} articles • {alerts} alertes • {libres} libres</p>
          </div>
        </div>
        <button onClick={() => openForm()} className="bg-[#0D47A1] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium">
          <Plus size={18} /> Ajouter
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border rounded-xl"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Article</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Famille</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">PA</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">PV</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stocké</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Prix libre</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stock</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const fam = familles.find(f => f.IDFAMILLE === a.IDFAMILLE);
                const lowStock = a.GERE_STOCK && a.STOCK <= a.STOCK_MIN;
                return (
                  <tr key={a.IDARTICLE} className={`border-t border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-3 text-sm font-mono">{a.CODE}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{a.EMOJI || '📦'}</span>
                        <span className="font-medium text-sm">{a.NOM}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: fam?.COULEUR + '18', color: fam?.COULEUR }}>
                        {fam?.FAMILLE}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">{formatAr(a.PRIX_ACHAT)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#0D47A1] text-sm">{formatAr(a.PRIX_VENTE)}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleGereStock(a)} className={`p-1 rounded ${a.GERE_STOCK ? 'text-green-600' : 'text-gray-400'}`}>
                        {a.GERE_STOCK ? <Check size={18} /> : <X size={18} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleSaisiePrix(a)} className={`p-1 rounded ${a.SAISIE_PRIX_VENTE ? 'text-amber-600' : 'text-gray-400'}`}>
                        {a.SAISIE_PRIX_VENTE ? <Check size={18} /> : <X size={18} />}
                      </button>
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold text-sm ${lowStock ? 'text-red-500' : ''}`}>
                      {a.GERE_STOCK ? a.STOCK : '∞'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openForm(a)} className="p-1.5 rounded-lg hover:bg-gray-100"><Edit2 size={16} className="text-gray-500" /></button>
                        {isAdmin && <button onClick={() => setConfirmDel(a)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={16} className="text-red-500" /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold">{editItem ? 'Modifier' : 'Nouvel'} article</h3>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Code *</label>
                  <input value={form.CODE} onChange={e => setForm({ ...form, CODE: e.target.value.toUpperCase() })} className="w-full mt-1 px-4 py-2 border rounded-xl" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Emoji</label>
                  <select value={form.EMOJI} onChange={e => setForm({ ...form, EMOJI: e.target.value })} className="w-full mt-1 px-4 py-2 border rounded-xl text-xl">
                    {['📦', '🍺', '🍻', '🥃', '🍷', '🥤', '💧', '🥜', '🍟', '🍢', '🍗', '☕', '🍕', '🍔'].map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Nom *</label>
                <input value={form.NOM} onChange={e => setForm({ ...form, NOM: capitalize(e.target.value) })} className="w-full mt-1 px-4 py-2 border rounded-xl" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Famille</label>
                <select value={form.IDFAMILLE} onChange={e => setForm({ ...form, IDFAMILLE: Number(e.target.value) })} className="w-full mt-1 px-4 py-2 border rounded-xl">
                  {familles.map(f => <option key={f.IDFAMILLE} value={f.IDFAMILLE}>{f.FAMILLE}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Prix Achat</label>
                  <input type="number" value={form.PRIX_ACHAT} onChange={e => setForm({ ...form, PRIX_ACHAT: Number(e.target.value) })} className="w-full mt-1 px-4 py-2 border rounded-xl" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Prix Vente</label>
                  <input type="number" value={form.PRIX_VENTE} onChange={e => setForm({ ...form, PRIX_VENTE: Number(e.target.value) })} className="w-full mt-1 px-4 py-2 border rounded-xl" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.GERE_STOCK} onChange={e => setForm({ ...form, GERE_STOCK: e.target.checked })} className="w-4 h-4 rounded" />
                  <span className="text-sm">Gérer en stock</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.SAISIE_PRIX_VENTE} onChange={e => setForm({ ...form, SAISIE_PRIX_VENTE: e.target.checked })} className="w-4 h-4 rounded" />
                  <span className="text-sm">Prix libre</span>
                </label>
              </div>
              {form.GERE_STOCK && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Stock initial</label>
                    <input type="number" value={form.STOCK} onChange={e => setForm({ ...form, STOCK: Number(e.target.value) })} className="w-full mt-1 px-4 py-2 border rounded-xl" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Stock min</label>
                    <input type="number" value={form.STOCK_MIN} onChange={e => setForm({ ...form, STOCK_MIN: Number(e.target.value) })} className="w-full mt-1 px-4 py-2 border rounded-xl" />
                  </div>
                </div>
              )}
              <button onClick={handleSave} className="w-full bg-[#0D47A1] text-white py-3 rounded-xl font-bold">
                {editItem ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={!!confirmDel} type="danger" title="Supprimer l'article" message={`Supprimer "${confirmDel?.NOM}" ?`} onConfirm={handleDelete} onCancel={() => setConfirmDel(null)} />
    </div>
  );
}

// ============== FAMILLES ==============
export function FamillesModule({ user }: Props) {
  const [familles, setFamilles] = useState(store.getFamilles());
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Famille | null>(null);
  const [confirmDel, setConfirmDel] = useState<Famille | null>(null);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ CODE: '', FAMILLE: '', COULEUR: '#0D47A1' });

  const showMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };
  const refresh = () => setFamilles(store.getFamilles());

  const openForm = (fam?: Famille) => {
    if (fam) {
      setEditItem(fam);
      setForm({ CODE: fam.CODE, FAMILLE: fam.FAMILLE, COULEUR: fam.COULEUR });
    } else {
      setEditItem(null);
      setForm({ CODE: '', FAMILLE: '', COULEUR: '#0D47A1' });
    }
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.CODE || !form.FAMILLE) { showMsg('Code et nom obligatoires'); return; }
    const list = store.getFamilles();
    if (editItem) {
      store.setFamilles(list.map(f => f.IDFAMILLE === editItem.IDFAMILLE ? { ...f, ...form } : f));
    } else {
      store.setFamilles([...list, { IDFAMILLE: nextId(list, 'IDFAMILLE'), ...form, ORDRE: list.length + 1 }]);
    }
    setShowForm(false);
    refresh();
    showMsg(editItem ? 'Famille modifiée' : 'Famille créée');
  };

  const handleDelete = () => {
    if (!confirmDel) return;
    const arts = store.getArticles().filter(a => a.IDFAMILLE === confirmDel.IDFAMILLE);
    if (arts.length > 0) { showMsg('Famille utilisée par des articles'); setConfirmDel(null); return; }
    store.setFamilles(store.getFamilles().filter(f => f.IDFAMILLE !== confirmDel.IDFAMILLE));
    setConfirmDel(null);
    refresh();
    showMsg('Famille supprimée');
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-[60] animate-pulse">{toast}</div>}
      
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🏷️ Familles</h1>
        <button onClick={() => openForm()} className="bg-[#0D47A1] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium">
          <Plus size={18} /> Ajouter
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {familles.map(f => (
          <div key={f.IDFAMILLE} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="h-2" style={{ backgroundColor: f.COULEUR }} />
            <div className="p-4">
              <p className="font-mono text-xs text-gray-400">{f.CODE}</p>
              <p className="font-bold text-lg" style={{ color: f.COULEUR }}>{f.FAMILLE}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => openForm(f)} className="flex-1 py-2 bg-gray-100 rounded-xl text-sm hover:bg-gray-200">Modifier</button>
                <button onClick={() => setConfirmDel(f)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4"><h3 className="font-bold">{editItem ? 'Modifier' : 'Nouvelle'} famille</h3></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium">Code *</label>
                <input value={form.CODE} onChange={e => setForm({ ...form, CODE: e.target.value.toUpperCase() })} className="w-full mt-1 px-4 py-2 border rounded-xl" />
              </div>
              <div>
                <label className="text-sm font-medium">Nom *</label>
                <input value={form.FAMILLE} onChange={e => setForm({ ...form, FAMILLE: capitalize(e.target.value) })} className="w-full mt-1 px-4 py-2 border rounded-xl" />
              </div>
              <div>
                <label className="text-sm font-medium">Couleur</label>
                <input type="color" value={form.COULEUR} onChange={e => setForm({ ...form, COULEUR: e.target.value })} className="w-full h-12 mt-1 border rounded-xl cursor-pointer" />
              </div>
              <button onClick={handleSave} className="w-full bg-[#0D47A1] text-white py-3 rounded-xl font-bold">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={!!confirmDel} type="danger" title="Supprimer" message={`Supprimer "${confirmDel?.FAMILLE}" ?`} onConfirm={handleDelete} onCancel={() => setConfirmDel(null)} />
    </div>
  );
}

// ============== STOCK ==============
export function StockModule({ user }: Props) {
  const [mouvements, setMouvements] = useState(store.getMouvements());
  const [showModal, setShowModal] = useState<'entree' | 'sortie' | null>(null);
  const [selectedArt, setSelectedArt] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [motif, setMotif] = useState('');
  const [toast, setToast] = useState('');

  const articles = store.getArticles().filter(a => a.ACTIF && a.GERE_STOCK);
  const showMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };
  const refresh = () => setMouvements(store.getMouvements());

  const motifsEntree = ['Réapprovisionnement', 'Retour client', 'Correction inventaire', 'Don reçu', 'Transfert reçu'];
  const motifsSortie = ['Casse/Périmé', 'Perte', 'Consommation interne', 'Don', 'Transfert envoyé', 'Vol constaté', 'Dégât'];

  const handleSave = () => {
    if (!selectedArt || qty <= 0 || !motif) { showMsg('Tous les champs sont obligatoires'); return; }
    
    const art = articles.find(a => a.IDARTICLE === selectedArt);
    if (!art) return;

    if (showModal === 'sortie' && qty > art.STOCK) { showMsg('Stock insuffisant'); return; }

    const mvts = store.getMouvements();
    const artList = store.getArticles();

    const newMvt: Mouvement = {
      IDMOUVEMENT: nextId(mvts, 'IDMOUVEMENT'),
      DATE_MOUVEMENT: today(),
      HEURE: nowTime(),
      IDARTICLE: selectedArt,
      TYPE: showModal === 'entree' ? 'Entrée' : 'Sortie',
      QUANTITE: qty,
      REFERENCE: `${motif} — ${user.PRENOM} ${user.NOM}`,
    };

    const updatedArts = artList.map(a => 
      a.IDARTICLE === selectedArt 
        ? { ...a, STOCK: showModal === 'entree' ? a.STOCK + qty : a.STOCK - qty }
        : a
    );

    store.setMouvements([...mvts, newMvt]);
    store.setArticles(updatedArts);
    
    setShowModal(null);
    setSelectedArt(null);
    setQty(1);
    setMotif('');
    refresh();
    showMsg(`${showModal === 'entree' ? 'Entrée' : 'Sortie'} enregistrée`);
  };

  const printStock = () => {
    const rows = articles.map(a => {
      const fam = store.getFamilles().find(f => f.IDFAMILLE === a.IDFAMILLE);
      const status = a.STOCK <= a.STOCK_MIN ? '⚠️' : '✓';
      return `<tr><td>${a.NOM}</td><td>${fam?.FAMILLE || '-'}</td><td style="text-align:right">${a.STOCK}</td><td style="text-align:right">${a.STOCK_MIN}</td><td>${status}</td></tr>`;
    }).join('');

    printTicket(`
      <div class="center bold">ÉTAT DU STOCK</div>
      <div class="row"><span>${today()}</span><span>${nowTime()}</span></div>
      <div class="line"></div>
      <table>
        <tr><td class="bold">Article</td><td class="bold">Famille</td><td class="bold right">Stock</td><td class="bold right">Min</td><td class="bold">St</td></tr>
        ${rows}
      </table>
    `, 'État Stock');
  };

  const motifs = showModal === 'entree' ? motifsEntree : motifsSortie;

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-[60] animate-pulse">{toast}</div>}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-900">📦 Stock</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowModal('entree')} className="bg-green-500 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium hover:bg-green-600">
            <ArrowDownCircle size={18} /> Entrée
          </button>
          <button onClick={() => setShowModal('sortie')} className="bg-red-500 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium hover:bg-red-600">
            <ArrowUpCircle size={18} /> Sortie
          </button>
          <button onClick={printStock} className="bg-gray-100 px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium hover:bg-gray-200">
            <Printer size={18} /> Imprimer
          </button>
        </div>
      </div>

      {/* Alertes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {articles.filter(a => a.STOCK <= a.STOCK_MIN).map(a => (
          <div key={a.IDARTICLE} className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">{a.EMOJI}</span>
              <span className="font-medium text-red-700">{a.NOM}</span>
            </div>
            <p className="text-red-600 font-bold mt-1">Stock: {a.STOCK} / Min: {a.STOCK_MIN}</p>
          </div>
        ))}
      </div>

      {/* Historique */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Article</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Qté</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Référence</th>
              </tr>
            </thead>
            <tbody>
              {mouvements.sort((a, b) => b.IDMOUVEMENT - a.IDMOUVEMENT).slice(0, 50).map(m => {
                const art = store.getArticles().find(a => a.IDARTICLE === m.IDARTICLE);
                const colors = { 'Entrée': 'bg-green-100 text-green-700', 'Sortie': 'bg-red-100 text-red-700', 'Ajustement': 'bg-orange-100 text-orange-700' };
                return (
                  <tr key={m.IDMOUVEMENT} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{dateLabel(m.DATE_MOUVEMENT)} {m.HEURE}</td>
                    <td className="px-4 py-3 text-sm font-medium">{art?.NOM || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full ${colors[m.TYPE]}`}>{m.TYPE}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{m.QUANTITE}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{m.REFERENCE}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Mouvement */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className={`px-6 py-4 flex items-center justify-between ${showModal === 'entree' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
              <h3 className="font-bold flex items-center gap-2">
                {showModal === 'entree' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
                {showModal === 'entree' ? 'Entrée' : 'Sortie'} de stock
              </h3>
              <button onClick={() => setShowModal(null)}><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Article *</label>
                <select value={selectedArt || ''} onChange={e => setSelectedArt(Number(e.target.value))} className="w-full mt-1 px-4 py-2.5 border rounded-xl">
                  <option value="">-- Sélectionner --</option>
                  {articles.map(a => <option key={a.IDARTICLE} value={a.IDARTICLE}>{a.NOM} (Stock: {a.STOCK})</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Quantité *</label>
                <input type="number" min="1" value={qty} onChange={e => setQty(Number(e.target.value))} className="w-full mt-1 px-4 py-2.5 border rounded-xl" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Motif *</label>
                <input value={motif} onChange={e => setMotif(e.target.value)} placeholder="Saisir ou sélectionner..." className="w-full mt-1 px-4 py-2.5 border rounded-xl" />
                <div className="flex flex-wrap gap-2 mt-2">
                  {motifs.map(m => (
                    <button key={m} onClick={() => setMotif(m)} className={`text-xs px-3 py-1.5 rounded-full border-2 transition ${motif === m ? (showModal === 'entree' ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700') : 'border-gray-200 hover:border-gray-300'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleSave} className={`w-full py-3 rounded-xl font-bold text-white ${showModal === 'entree' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== FOURNISSEURS ==============
export function FournisseursModule({ user }: Props) {
  const [fournisseurs, setFournisseurs] = useState(store.getFournisseurs());
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Fournisseur | null>(null);
  const [confirmDel, setConfirmDel] = useState<Fournisseur | null>(null);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ NOM: '', ADRESSE: '', TELEPHONE: '', EMAIL: '' });

  const showMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };
  const refresh = () => setFournisseurs(store.getFournisseurs());

  const openForm = (f?: Fournisseur) => {
    if (f) {
      setEditItem(f);
      setForm({ NOM: f.NOM, ADRESSE: f.ADRESSE || '', TELEPHONE: f.TELEPHONE || '', EMAIL: f.EMAIL || '' });
    } else {
      setEditItem(null);
      setForm({ NOM: '', ADRESSE: '', TELEPHONE: '', EMAIL: '' });
    }
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.NOM) { showMsg('Nom obligatoire'); return; }
    const list = store.getFournisseurs();
    if (editItem) {
      store.setFournisseurs(list.map(f => f.IDFOURNISSEUR === editItem.IDFOURNISSEUR ? { ...f, ...form } : f));
    } else {
      store.setFournisseurs([...list, { IDFOURNISSEUR: nextId(list, 'IDFOURNISSEUR'), ...form }]);
    }
    setShowForm(false);
    refresh();
    showMsg(editItem ? 'Fournisseur modifié' : 'Fournisseur créé');
  };

  const handleDelete = () => {
    if (!confirmDel) return;
    const achats = store.getAchats().filter(a => a.IDFOURNISSEUR === confirmDel.IDFOURNISSEUR);
    if (achats.length > 0) { showMsg('Fournisseur lié à des achats'); setConfirmDel(null); return; }
    store.setFournisseurs(store.getFournisseurs().filter(f => f.IDFOURNISSEUR !== confirmDel.IDFOURNISSEUR));
    setConfirmDel(null);
    refresh();
    showMsg('Fournisseur supprimé');
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-[60] animate-pulse">{toast}</div>}
      
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🚚 Fournisseurs</h1>
        <button onClick={() => openForm()} className="bg-[#0D47A1] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium">
          <Plus size={18} /> Ajouter
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {fournisseurs.map(f => (
          <div key={f.IDFOURNISSEUR} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Truck size={20} />
              </div>
              <div>
                <p className="font-bold">{f.NOM}</p>
                <p className="text-xs text-gray-400">{f.TELEPHONE}</p>
              </div>
            </div>
            {f.ADRESSE && <p className="text-sm text-gray-500 mb-2">{f.ADRESSE}</p>}
            <div className="flex gap-2">
              <button onClick={() => openForm(f)} className="flex-1 py-2 bg-gray-100 rounded-xl text-sm hover:bg-gray-200">Modifier</button>
              <button onClick={() => setConfirmDel(f)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4"><h3 className="font-bold">{editItem ? 'Modifier' : 'Nouveau'} fournisseur</h3></div>
            <div className="p-6 space-y-4">
              <div><label className="text-sm font-medium">Nom *</label><input value={form.NOM} onChange={e => setForm({ ...form, NOM: capitalize(e.target.value) })} className="w-full mt-1 px-4 py-2 border rounded-xl" /></div>
              <div><label className="text-sm font-medium">Adresse</label><input value={form.ADRESSE} onChange={e => setForm({ ...form, ADRESSE: e.target.value })} className="w-full mt-1 px-4 py-2 border rounded-xl" /></div>
              <div><label className="text-sm font-medium">Téléphone</label><input value={form.TELEPHONE} onChange={e => setForm({ ...form, TELEPHONE: e.target.value })} className="w-full mt-1 px-4 py-2 border rounded-xl" /></div>
              <div><label className="text-sm font-medium">Email</label><input value={form.EMAIL} onChange={e => setForm({ ...form, EMAIL: e.target.value })} className="w-full mt-1 px-4 py-2 border rounded-xl" /></div>
              <button onClick={handleSave} className="w-full bg-[#0D47A1] text-white py-3 rounded-xl font-bold">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={!!confirmDel} type="danger" title="Supprimer" message={`Supprimer "${confirmDel?.NOM}" ?`} onConfirm={handleDelete} onCancel={() => setConfirmDel(null)} />
    </div>
  );
}

// ============== PERSONNEL ==============
export function PersonnelModule({ user }: Props) {
  const [personnel, setPersonnel] = useState(store.getPersonnel());
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Personnel | null>(null);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ NOM: '', PRENOM: '', LOGIN: '', MOT_DE_PASSE: '', ROLE: 'Caissier' as Personnel['ROLE'] });

  const showMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };
  const refresh = () => setPersonnel(store.getPersonnel());

  const openForm = (p?: Personnel) => {
    if (p) {
      setEditItem(p);
      setForm({ NOM: p.NOM, PRENOM: p.PRENOM, LOGIN: p.LOGIN, MOT_DE_PASSE: p.MOT_DE_PASSE, ROLE: p.ROLE });
    } else {
      setEditItem(null);
      setForm({ NOM: '', PRENOM: '', LOGIN: '', MOT_DE_PASSE: '', ROLE: 'Caissier' });
    }
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.NOM || !form.LOGIN || !form.MOT_DE_PASSE) { showMsg('Champs obligatoires manquants'); return; }
    const list = store.getPersonnel();
    if (editItem) {
      store.setPersonnel(list.map(p => p.IDPERSONNEL === editItem.IDPERSONNEL ? { ...p, ...form } : p));
    } else {
      store.setPersonnel([...list, { IDPERSONNEL: nextId(list, 'IDPERSONNEL'), ...form, ACTIF: true }]);
    }
    setShowForm(false);
    refresh();
    showMsg(editItem ? 'Personnel modifié' : 'Personnel créé');
  };

  const toggleActif = (p: Personnel) => {
    store.setPersonnel(store.getPersonnel().map(x => x.IDPERSONNEL === p.IDPERSONNEL ? { ...x, ACTIF: !x.ACTIF } : x));
    refresh();
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-[60] animate-pulse">{toast}</div>}
      
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">👥 Personnel</h1>
        <button onClick={() => openForm()} className="bg-[#0D47A1] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium">
          <Plus size={18} /> Ajouter
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Nom</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Login</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Rôle</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Actif</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {personnel.map(p => (
              <tr key={p.IDPERSONNEL} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{p.PRENOM} {p.NOM}</td>
                <td className="px-4 py-3 text-sm font-mono">{p.LOGIN}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-1 rounded-full ${roleColors[p.ROLE]}`}>{p.ROLE}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleActif(p)} className={p.ACTIF ? 'text-green-600' : 'text-gray-400'}>
                    {p.ACTIF ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => openForm(p)} className="p-1.5 rounded-lg hover:bg-gray-100"><Edit2 size={16} className="text-gray-500" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4"><h3 className="font-bold">{editItem ? 'Modifier' : 'Nouveau'} personnel</h3></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Prénom</label><input value={form.PRENOM} onChange={e => setForm({ ...form, PRENOM: capitalize(e.target.value) })} className="w-full mt-1 px-4 py-2 border rounded-xl" /></div>
                <div><label className="text-sm font-medium">Nom *</label><input value={form.NOM} onChange={e => setForm({ ...form, NOM: capitalize(e.target.value) })} className="w-full mt-1 px-4 py-2 border rounded-xl" /></div>
              </div>
              <div><label className="text-sm font-medium">Login *</label><input value={form.LOGIN} onChange={e => setForm({ ...form, LOGIN: e.target.value })} className="w-full mt-1 px-4 py-2 border rounded-xl" /></div>
              <div><label className="text-sm font-medium">Mot de passe *</label><input type="password" value={form.MOT_DE_PASSE} onChange={e => setForm({ ...form, MOT_DE_PASSE: e.target.value })} className="w-full mt-1 px-4 py-2 border rounded-xl" /></div>
              <div>
                <label className="text-sm font-medium">Rôle</label>
                <select value={form.ROLE} onChange={e => setForm({ ...form, ROLE: e.target.value as Personnel['ROLE'] })} className="w-full mt-1 px-4 py-2 border rounded-xl">
                  {['Administrateur', 'Gérant', 'Caissier', 'Serveur', 'Magasinier'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <button onClick={handleSave} className="w-full bg-[#0D47A1] text-white py-3 rounded-xl font-bold">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== CLIENTS ==============
export function ClientsModule({ user }: Props) {
  const [clients, setClients] = useState(store.getClients());
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Client | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ NOM_CLIENT: '', TELEPHONE: '', ADRESSE: '' });

  const showMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };
  const refresh = () => setClients(store.getClients());

  const filtered = clients.filter(c => 
    c.NOM_CLIENT.toLowerCase().includes(search.toLowerCase()) ||
    c.TELEPHONE.includes(search)
  );

  const openForm = (c?: Client) => {
    if (c) {
      setEditItem(c);
      setForm({ NOM_CLIENT: c.NOM_CLIENT, TELEPHONE: c.TELEPHONE, ADRESSE: c.ADRESSE || '' });
    } else {
      setEditItem(null);
      setForm({ NOM_CLIENT: '', TELEPHONE: '', ADRESSE: '' });
    }
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.NOM_CLIENT || !form.TELEPHONE) { showMsg('Nom et téléphone obligatoires'); return; }
    const list = store.getClients();
    if (editItem) {
      store.setClients(list.map(c => c.IDCLIENT === editItem.IDCLIENT ? { ...c, ...form } : c));
    } else {
      store.setClients([...list, { IDCLIENT: nextId(list, 'IDCLIENT'), ...form, CREDIT_TOTAL: 0, DATE_CREATION: today() }]);
    }
    setShowForm(false);
    refresh();
    showMsg(editItem ? 'Client modifié' : 'Client créé');
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-[60] animate-pulse">{toast}</div>}
      
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-900">👤 Clients</h1>
        <button onClick={() => openForm()} className="bg-[#0D47A1] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium">
          <Plus size={18} /> Ajouter
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border rounded-xl" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Nom</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Téléphone</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Crédit</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.IDCLIENT} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.NOM_CLIENT}</td>
                <td className="px-4 py-3 text-sm">{c.TELEPHONE}</td>
                <td className={`px-4 py-3 text-right font-semibold ${c.CREDIT_TOTAL > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {formatAr(c.CREDIT_TOTAL)}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => openForm(c)} className="p-1.5 rounded-lg hover:bg-gray-100"><Edit2 size={16} className="text-gray-500" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4"><h3 className="font-bold">{editItem ? 'Modifier' : 'Nouveau'} client</h3></div>
            <div className="p-6 space-y-4">
              <div><label className="text-sm font-medium">Nom *</label><input value={form.NOM_CLIENT} onChange={e => setForm({ ...form, NOM_CLIENT: capitalize(e.target.value) })} className="w-full mt-1 px-4 py-2 border rounded-xl" /></div>
              <div><label className="text-sm font-medium">Téléphone *</label><input value={form.TELEPHONE} onChange={e => setForm({ ...form, TELEPHONE: e.target.value })} className="w-full mt-1 px-4 py-2 border rounded-xl" /></div>
              <div><label className="text-sm font-medium">Adresse</label><input value={form.ADRESSE} onChange={e => setForm({ ...form, ADRESSE: e.target.value })} className="w-full mt-1 px-4 py-2 border rounded-xl" /></div>
              <button onClick={handleSave} className="w-full bg-[#0D47A1] text-white py-3 rounded-xl font-bold">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== CRÉDITS ==============
export function CreditsModule({ user }: Props) {
  const [clients, setClients] = useState(store.getClients().filter(c => c.CREDIT_TOTAL > 0));
  const [showPayModal, setShowPayModal] = useState<Client | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState<'Espèces' | 'Mobile Money'>('Espèces');
  const [toast, setToast] = useState('');

  const paiements = store.getPaiements();
  const personnel = store.getPersonnel();

  const showMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };
  const refresh = () => setClients(store.getClients().filter(c => c.CREDIT_TOTAL > 0));

  const totalCredits = clients.reduce((s, c) => s + c.CREDIT_TOTAL, 0);

  const openPayModal = (client: Client) => {
    setPayAmount(client.CREDIT_TOTAL);
    setPayMode('Espèces');
    setShowPayModal(client);
  };

  const handlePayment = () => {
    if (!showPayModal || payAmount <= 0) return;
    
    const allPaiements = store.getPaiements();
    const allClients = store.getClients();

    const newPaiement = {
      IDPAIEMENT: nextId(allPaiements, 'IDPAIEMENT'),
      DATE_PAIEMENT: today(),
      HEURE: nowTime(),
      IDVENTE: 0, // Remboursement crédit
      IDPERSONNEL: user.IDPERSONNEL,
      MONTANT: payAmount,
      MODE_PAIEMENT: payMode as 'Espèces' | 'Mobile Money',
      IDCLIENT: showPayModal.IDCLIENT,
    };

    const updatedClients = allClients.map(c =>
      c.IDCLIENT === showPayModal.IDCLIENT
        ? { ...c, CREDIT_TOTAL: Math.max(0, c.CREDIT_TOTAL - payAmount) }
        : c
    );

    store.setPaiements([...allPaiements, newPaiement]);
    store.setClients(updatedClients);
    
    setShowPayModal(null);
    refresh();
    showMsg('Paiement enregistré');
  };

  const getClientHistory = (clientId: number) => {
    return paiements.filter(p => p.IDCLIENT === clientId).sort((a, b) => b.IDPAIEMENT - a.IDPAIEMENT);
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-[60] animate-pulse">{toast}</div>}
      
      <h1 className="text-2xl font-bold text-gray-900">💳 Crédits</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Clients avec crédit</p>
              <p className="text-xl font-bold text-gray-900">{clients.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
              <CreditCard size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total crédits</p>
              <p className="text-xl font-bold text-red-600">{formatAr(totalCredits)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {clients.map(c => (
          <div key={c.IDCLIENT} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold">{c.NOM_CLIENT}</p>
                <p className="text-sm text-gray-500">{c.TELEPHONE}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Crédit</p>
                <p className="text-xl font-bold text-red-600">{formatAr(c.CREDIT_TOTAL)}</p>
              </div>
            </div>
            
            {/* Historique */}
            <div className="border-t border-gray-100 pt-3 mb-3">
              <p className="text-xs text-gray-500 mb-2">Derniers paiements</p>
              {getClientHistory(c.IDCLIENT).slice(0, 3).map(p => {
                const caissier = personnel.find(x => x.IDPERSONNEL === p.IDPERSONNEL);
                return (
                  <div key={p.IDPAIEMENT} className="flex items-center justify-between text-sm py-1">
                    <span className="text-gray-500">{dateLabel(p.DATE_PAIEMENT)} - {caissier?.PRENOM || '-'}</span>
                    <span className="font-medium text-green-600">+{formatAr(p.MONTANT)}</span>
                  </div>
                );
              })}
            </div>

            <button onClick={() => openPayModal(c)} className="w-full bg-green-500 text-white py-2 rounded-xl font-medium hover:bg-green-600">
              Recevoir un paiement
            </button>
          </div>
        ))}

        {clients.length === 0 && (
          <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400">
            Aucun client avec crédit
          </div>
        )}
      </div>

      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPayModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-green-500 text-white px-6 py-4">
              <h3 className="font-bold">Paiement - {showPayModal.NOM_CLIENT}</h3>
              <p className="text-green-100 text-sm">Crédit: {formatAr(showPayModal.CREDIT_TOTAL)}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium">Montant</label>
                <input type="number" value={payAmount} onChange={e => setPayAmount(Number(e.target.value))} className="w-full mt-1 px-4 py-3 border rounded-xl text-lg font-bold text-center" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPayMode('Espèces')} className={`flex-1 py-3 rounded-xl border-2 font-medium ${payMode === 'Espèces' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200'}`}>
                  Espèces
                </button>
                <button onClick={() => setPayMode('Mobile Money')} className={`flex-1 py-3 rounded-xl border-2 font-medium ${payMode === 'Mobile Money' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200'}`}>
                  Mobile Money
                </button>
              </div>
              <button onClick={handlePayment} className="w-full bg-green-500 text-white py-3 rounded-xl font-bold">
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== SOCIÉTÉ ==============
export function SocieteModule({ user }: Props) {
  const [societe, setSociete] = useState(store.getSociete());
  const [toast, setToast] = useState('');

  const showMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const handleSave = () => {
    store.setSociete(societe);
    showMsg('Paramètres enregistrés');
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-[60] animate-pulse">{toast}</div>}
      
      <h1 className="text-2xl font-bold text-gray-900">🏢 Société</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* Logo */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Logo</label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#0D47A1] to-[#1976D2] flex items-center justify-center">
              {societe.LOGO_TYPE === 'emoji' && <span className="text-4xl">{societe.LOGO_EMOJI}</span>}
              {societe.LOGO_TYPE === 'image' && societe.LOGO_IMAGE && <img src={societe.LOGO_IMAGE} className="w-16 h-16 object-contain" />}
              {societe.LOGO_TYPE === 'none' && <span className="text-2xl font-bold text-white">{societe.NOM.charAt(0)}</span>}
            </div>
            <div className="flex-1 space-y-2">
              <select value={societe.LOGO_TYPE} onChange={e => setSociete({ ...societe, LOGO_TYPE: e.target.value as any })} className="w-full px-4 py-2 border rounded-xl">
                <option value="emoji">Emoji</option>
                <option value="image">Image</option>
                <option value="none">Aucun (initiale)</option>
              </select>
              {societe.LOGO_TYPE === 'emoji' && (
                <div className="flex flex-wrap gap-2">
                  {logoEmojis.map(e => (
                    <button key={e} onClick={() => setSociete({ ...societe, LOGO_EMOJI: e })} className={`text-2xl p-2 rounded-lg ${societe.LOGO_EMOJI === e ? 'bg-blue-100 ring-2 ring-[#0D47A1]' : 'hover:bg-gray-100'}`}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="text-sm font-medium">Nom *</label><input value={societe.NOM} onChange={e => setSociete({ ...societe, NOM: e.target.value })} className="w-full mt-1 px-4 py-2 border rounded-xl" /></div>
          <div><label className="text-sm font-medium">Téléphone *</label><input value={societe.TELEPHONE} onChange={e => setSociete({ ...societe, TELEPHONE: e.target.value })} className="w-full mt-1 px-4 py-2 border rounded-xl" /></div>
          <div className="md:col-span-2"><label className="text-sm font-medium">Adresse *</label><input value={societe.ADRESSE} onChange={e => setSociete({ ...societe, ADRESSE: e.target.value })} className="w-full mt-1 px-4 py-2 border rounded-xl" /></div>
          <div><label className="text-sm font-medium">Email</label><input value={societe.EMAIL || ''} onChange={e => setSociete({ ...societe, EMAIL: e.target.value })} className="w-full mt-1 px-4 py-2 border rounded-xl" /></div>
          <div><label className="text-sm font-medium">NIF</label><input value={societe.NIF || ''} onChange={e => setSociete({ ...societe, NIF: e.target.value })} className="w-full mt-1 px-4 py-2 border rounded-xl" /></div>
          <div><label className="text-sm font-medium">STAT</label><input value={societe.STAT || ''} onChange={e => setSociete({ ...societe, STAT: e.target.value })} className="w-full mt-1 px-4 py-2 border rounded-xl" /></div>
        </div>

        {/* Impression */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`w-12 h-6 rounded-full transition-colors ${societe.UTILISER_IMPRIMANTE ? 'bg-green-500' : 'bg-gray-300'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-0.5 ${societe.UTILISER_IMPRIMANTE ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </div>
            <span className="font-medium">Activer l'impression</span>
          </label>
          <div className={`mt-3 p-4 rounded-xl ${societe.UTILISER_IMPRIMANTE ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
            {societe.UTILISER_IMPRIMANTE ? (
              <div className="text-sm text-green-700">
                <p className="font-medium mb-1">✓ Impression activée</p>
                <p>• Caisse POS & Encaissement Table → Impression directe</p>
                <p>• Autres documents → Aperçu avec bouton imprimer</p>
              </div>
            ) : (
              <p className="text-sm text-orange-700">⚠️ Aucun ticket ne sera imprimé</p>
            )}
          </div>
        </div>

        <button onClick={handleSave} className="w-full bg-[#0D47A1] text-white py-3 rounded-xl font-bold">
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// ============== CLÔTURE ==============
export function ClotureModule({ user }: Props) {
  const [clotures, setClotures] = useState(store.getClotures());
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState('');

  const ventes = store.getVentes();
  const paiements = store.getPaiements();
  const lignesVente = store.getLignesVente();
  const articles = store.getArticles();
  const clients = store.getClients();
  const tables = store.getTables();
  const consommations = store.getConsommations();
  const personnel = store.getPersonnel();

  const isAdmin = user.ROLE === 'Administrateur';
  const isGerant = user.ROLE === 'Gérant';
  const isCaissier = user.ROLE === 'Caissier';

  const showMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };
  const refresh = () => setClotures(store.getClotures());

  // Vérifier si déjà clôturé aujourd'hui
  const todayCloture = clotures.find(c => c.DATE_CLOTURE === today() && c.IDPERSONNEL === user.IDPERSONNEL);

  // Tables non payées du caissier
  const unpaidTables = tables.filter(t => {
    if (isCaissier) return t.IDCAISSIER === user.IDPERSONNEL && t.ETAT === 'Occupée';
    return t.ETAT === 'Occupée';
  });

  // Ventes non clôturées
  const ventesNonCloturees = ventes.filter(v => {
    if (isCaissier) return v.IDPERSONNEL === user.IDPERSONNEL && v.STATUT === 'Payée' && !v.CLOTUREE;
    return v.STATUT === 'Payée' && !v.CLOTUREE && v.DATE_VENTE === today();
  });

  // Calculs
  const totalVentes = ventesNonCloturees.reduce((s, v) => s + v.TOTAL - v.REMISE, 0);
  const paiementsJour = paiements.filter(p => {
    const vente = ventes.find(v => v.IDVENTE === p.IDVENTE);
    if (isCaissier) {
      return vente && ventesNonCloturees.some(v => v.IDVENTE === p.IDVENTE);
    }
    return p.DATE_PAIEMENT === today() && vente && !vente.CLOTUREE;
  });

  const totalEspeces = paiementsJour.filter(p => p.MODE_PAIEMENT === 'Espèces').reduce((s, p) => s + p.MONTANT, 0);
  const totalMobile = paiementsJour.filter(p => p.MODE_PAIEMENT === 'Mobile Money').reduce((s, p) => s + p.MONTANT, 0);
  const totalCredit = paiementsJour.filter(p => p.MODE_PAIEMENT === 'Crédit').reduce((s, p) => s + p.MONTANT, 0);

  // Remboursements crédit reçus
  const remboursements = paiements.filter(p => p.IDVENTE === 0 && p.DATE_PAIEMENT === today() && p.IDPERSONNEL === user.IDPERSONNEL);
  const totalRemboursements = remboursements.reduce((s, p) => s + p.MONTANT, 0);

  // Détail articles vendus
  const articlesVendus: Record<number, { nom: string; qty: number; montant: number }> = {};
  ventesNonCloturees.forEach(v => {
    const lignes = lignesVente.filter(l => l.IDVENTE === v.IDVENTE);
    lignes.forEach(l => {
      const art = articles.find(a => a.IDARTICLE === l.IDARTICLE);
      if (!articlesVendus[l.IDARTICLE]) {
        articlesVendus[l.IDARTICLE] = { nom: art?.NOM || '-', qty: 0, montant: 0 };
      }
      articlesVendus[l.IDARTICLE].qty += l.QUANTITE;
      articlesVendus[l.IDARTICLE].montant += l.MONTANT;
    });
  });

  const handleCloture = () => {
    if (unpaidTables.length > 0) {
      showMsg('Tables non payées en attente');
      setShowConfirm(false);
      return;
    }

    const allClotures = store.getClotures();
    const newCloture: Cloture = {
      IDCLOTURE: nextId(allClotures, 'IDCLOTURE'),
      DATE_CLOTURE: today(),
      HEURE: nowTime(),
      IDPERSONNEL: user.IDPERSONNEL,
      TOTAL_VENTES: totalVentes,
      TOTAL_ESPECES: totalEspeces + totalRemboursements,
      TOTAL_MOBILE: totalMobile,
      TOTAL_CREDIT: totalCredit,
      FOND_CAISSE: 0,
      ECART: 0,
      NB_VENTES: ventesNonCloturees.length,
    };

    // Marquer les ventes comme clôturées
    const updatedVentes = ventes.map(v => {
      if (ventesNonCloturees.some(nc => nc.IDVENTE === v.IDVENTE)) {
        return { ...v, CLOTUREE: true, IDCLOTURE: newCloture.IDCLOTURE };
      }
      return v;
    });

    store.setClotures([...allClotures, newCloture]);
    store.setVentes(updatedVentes);
    
    setShowConfirm(false);
    refresh();
    showMsg('Clôture effectuée');

    // Imprimer
    printCloture(newCloture);
  };

  const printCloture = (cloture: Cloture) => {
    const caissier = personnel.find(p => p.IDPERSONNEL === cloture.IDPERSONNEL);
    
    const artRows = Object.values(articlesVendus).map(a => 
      `<tr><td>${a.nom}</td><td style="text-align:right">${a.qty}</td><td style="text-align:right">${formatAr(a.montant)}</td></tr>`
    ).join('');

    // Crédits
    const creditRows = paiementsJour.filter(p => p.MODE_PAIEMENT === 'Crédit').map(p => {
      const client = clients.find(c => c.IDCLIENT === p.IDCLIENT);
      return `<div>${client?.NOM_CLIENT || '-'}: ${formatAr(p.MONTANT)}</div>`;
    }).join('');

    printTicket(`
      <div class="center bold">CLÔTURE DE CAISSE</div>
      <div class="row"><span>${cloture.DATE_CLOTURE}</span><span>${cloture.HEURE}</span></div>
      <div>Caissier: ${caissier?.PRENOM} ${caissier?.NOM}</div>
      <div class="line"></div>
      <div class="bold">Détail des ventes</div>
      <table>
        <tr><td class="bold">Article</td><td class="bold right">Qté</td><td class="bold right">Mt</td></tr>
        ${artRows}
      </table>
      <div class="line"></div>
      <div class="row"><span>Total ventes</span><span class="bold">${formatAr(cloture.TOTAL_VENTES)}</span></div>
      <div class="row"><span>Nb tickets</span><span>${cloture.NB_VENTES}</span></div>
      <div class="line"></div>
      <div class="row"><span>Espèces</span><span>${formatAr(cloture.TOTAL_ESPECES)}</span></div>
      <div class="row"><span>Mobile Money</span><span>${formatAr(cloture.TOTAL_MOBILE)}</span></div>
      <div class="row"><span>Crédit</span><span>${formatAr(cloture.TOTAL_CREDIT)}</span></div>
      ${creditRows ? `<div class="small">${creditRows}</div>` : ''}
    `, 'Clôture');
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-[60] animate-pulse">{toast}</div>}
      
      <h1 className="text-2xl font-bold text-gray-900">📊 Clôture de caisse</h1>

      {todayCloture && isCaissier && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-700 font-medium">✓ Clôture effectuée aujourd'hui à {todayCloture.HEURE}</p>
        </div>
      )}

      {unpaidTables.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700 font-medium">⚠️ {unpaidTables.length} table(s) non payée(s)</p>
        </div>
      )}

      {/* Résumé */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Total ventes</p>
          <p className="text-xl font-bold text-[#0D47A1]">{formatAr(totalVentes)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Espèces</p>
          <p className="text-xl font-bold text-green-600">{formatAr(totalEspeces)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Mobile Money</p>
          <p className="text-xl font-bold text-blue-600">{formatAr(totalMobile)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Crédit</p>
          <p className="text-xl font-bold text-orange-600">{formatAr(totalCredit)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Remb. crédit reçus</p>
          <p className="text-xl font-bold text-purple-600">{formatAr(totalRemboursements)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Espèces attendues</p>
          <p className="text-xl font-bold text-emerald-600">{formatAr(totalEspeces + totalRemboursements)}</p>
        </div>
      </div>

      {/* Articles vendus */}
      {Object.keys(articlesVendus).length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h3 className="font-bold mb-3">Détail des articles vendus</h3>
          <div className="space-y-2">
            {Object.values(articlesVendus).map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span>{a.nom}</span>
                <span className="font-medium">{a.qty} x = {formatAr(a.montant)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bouton clôture */}
      {(!todayCloture || !isCaissier) && ventesNonCloturees.length > 0 && (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={unpaidTables.length > 0}
          className="w-full bg-[#0D47A1] text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50"
        >
          <Calculator className="inline mr-2" size={20} />
          Clôturer la caisse
        </button>
      )}

      {/* Historique (Admin/Gérant) */}
      {(isAdmin || isGerant) && clotures.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b font-semibold">Historique des clôtures</div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs text-gray-500">Date</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500">Caissier</th>
                <th className="text-right px-4 py-2 text-xs text-gray-500">Total</th>
                <th className="text-center px-4 py-2 text-xs text-gray-500">Tickets</th>
              </tr>
            </thead>
            <tbody>
              {clotures.sort((a, b) => b.IDCLOTURE - a.IDCLOTURE).slice(0, 20).map(c => {
                const caissier = personnel.find(p => p.IDPERSONNEL === c.IDPERSONNEL);
                return (
                  <tr key={c.IDCLOTURE} className="border-t border-gray-50">
                    <td className="px-4 py-2 text-sm">{dateLabel(c.DATE_CLOTURE)} {c.HEURE}</td>
                    <td className="px-4 py-2 text-sm">{caissier?.PRENOM}</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatAr(c.TOTAL_VENTES)}</td>
                    <td className="px-4 py-2 text-center">{c.NB_VENTES}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={showConfirm}
        type="warning"
        title="Clôturer la caisse"
        message={`Clôturer ${ventesNonCloturees.length} vente(s) pour un total de ${formatAr(totalVentes)} ?`}
        confirmText="Oui, clôturer"
        cancelText="Annuler"
        onConfirm={handleCloture}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}

// ============== INVENTAIRE ==============
export function InventaireModule({ user }: Props) {
  const [toast, setToast] = useState('');
  
  const showMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  // TODO: Implement full inventory module
  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-[60] animate-pulse">{toast}</div>}
      <h1 className="text-2xl font-bold text-gray-900">📋 Inventaire</h1>
      <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400">
        Module inventaire en développement
      </div>
    </div>
  );
}

// ============== SAUVEGARDE ==============
export function SauvegardeModule({ user }: Props) {
  const [toast, setToast] = useState('');
  const [confirmRestore, setConfirmRestore] = useState(false);

  const showMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const totalRecords = store.getTotalRecords();

  const exportJSON = () => {
    const data = store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barpos_backup_${today()}.json`;
    a.click();
    showMsg('Export JSON effectué');
  };

  const exportExcel = () => {
    const data = store.exportAll();
    const wb = XLSX.utils.book_new();
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.articles), 'Articles');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.familles), 'Familles');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.clients), 'Clients');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.fournisseurs), 'Fournisseurs');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.ventes), 'Ventes');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.achats), 'Achats');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.mouvements), 'Mouvements');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.clotures), 'Clotures');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.personnel), 'Personnel');

    XLSX.writeFile(wb, `barpos_export_${today()}.xlsx`);
    showMsg('Export Excel effectué');
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        store.importAll(data);
        showMsg('Restauration effectuée');
        window.location.reload();
      } catch {
        showMsg('Fichier invalide');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-[60] animate-pulse">{toast}</div>}

      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0D47A1] to-[#1976D2] flex items-center justify-center">
          <HardDrive size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sauvegarde & Export</h1>
          <p className="text-sm text-gray-500">{totalRecords} enregistrements au total</p>
        </div>
      </div>

      <button onClick={exportExcel} className="w-full bg-green-500 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-green-600">
        <Download size={20} /> Tout exporter Excel
      </button>

      {/* Sauvegarde & Restauration */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <FileJson className="text-blue-600" size={20} /> Sauvegarde & Restauration
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={exportJSON} className="p-4 bg-blue-50 rounded-xl hover:bg-blue-100 flex flex-col items-center gap-2">
            <FileJson size={24} className="text-blue-600" />
            <span className="font-medium">Sauvegarder JSON</span>
          </button>
          <label className="p-4 bg-orange-50 rounded-xl hover:bg-orange-100 flex flex-col items-center gap-2 cursor-pointer border-2 border-dashed border-orange-200">
            <Upload size={24} className="text-orange-600" />
            <span className="font-medium">Restaurer JSON</span>
            <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
}
