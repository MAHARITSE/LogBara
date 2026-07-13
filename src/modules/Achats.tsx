import { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Printer, Search, X, Trash2, Keyboard, Edit2 } from 'lucide-react';
import { store } from '../store';
import { Personnel, LigneAchat, Achat } from '../types';
import { formatAr, today, nowTime, nextId, dateLabel } from '../helpers';
import { printTicket } from '../components/PrintTicket';
import ConfirmModal from '../components/ConfirmModal';

interface Props { user: Personnel }

interface LigneForm {
  IDARTICLE: number;
  QUANTITE: number;
  PRIX_ACHAT: number;
  PRIX_VENTE: number;
}

export default function AchatsModule({ user }: Props) {
  const [achats, setAchats] = useState(store.getAchats());
  const [showForm, setShowForm] = useState(false);
  const [editAchat, setEditAchat] = useState<Achat | null>(null);
  const [fournisseur, setFournisseur] = useState<number | null>(null);
  const [observation, setObservation] = useState('');
  const [lignes, setLignes] = useState<LigneForm[]>([]);
  const [searchArt, setSearchArt] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIdx, setSuggestionIdx] = useState(0);
  const [confirmDel, setConfirmDel] = useState<{ id: number; ref: string } | null>(null);
  const [toast, setToast] = useState('');

  const searchRef = useRef<HTMLInputElement>(null);
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const paRefs = useRef<(HTMLInputElement | null)[]>([]);
  const pvRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isAdmin = user.ROLE === 'Administrateur';

  const articles = store.getArticles();
  const fournisseurs = store.getFournisseurs();
  const lignesAchat = store.getLignesAchat();

  const refresh = () => setAchats(store.getAchats());

  const filteredArt = articles.filter(a =>
    a.ACTIF &&
    a.NOM.toLowerCase().includes(searchArt.toLowerCase()) &&
    !lignes.some(l => l.IDARTICLE === a.IDARTICLE)
  ).slice(0, 8);

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // Navigation clavier dans les suggestions
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filteredArt.length === 0) {
      if (e.key === 'ArrowDown' && searchArt) {
        setShowSuggestions(true);
        setSuggestionIdx(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSuggestionIdx(prev => (prev + 1) % filteredArt.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSuggestionIdx(prev => (prev - 1 + filteredArt.length) % filteredArt.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredArt[suggestionIdx]) {
          addLigne(filteredArt[suggestionIdx].IDARTICLE);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setSearchArt('');
        break;
    }
  }, [showSuggestions, filteredArt, suggestionIdx, searchArt]);

  // Navigation clavier dans la grille
  const handleGridKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colName: 'qty' | 'pa' | 'pv') => {
    const getRef = (col: 'qty' | 'pa' | 'pv', row: number) => {
      switch (col) {
        case 'qty': return qtyRefs.current[row];
        case 'pa': return paRefs.current[row];
        case 'pv': return pvRefs.current[row];
      }
    };

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (rowIdx < lignes.length - 1) {
          getRef(colName, rowIdx + 1)?.focus();
          getRef(colName, rowIdx + 1)?.select();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (rowIdx > 0) {
          getRef(colName, rowIdx - 1)?.focus();
          getRef(colName, rowIdx - 1)?.select();
        } else {
          searchRef.current?.focus();
        }
        break;
      case 'Tab':
        if (!e.shiftKey) {
          if (colName === 'qty') {
            e.preventDefault();
            getRef('pa', rowIdx)?.focus();
            getRef('pa', rowIdx)?.select();
          } else if (colName === 'pa') {
            e.preventDefault();
            getRef('pv', rowIdx)?.focus();
            getRef('pv', rowIdx)?.select();
          } else if (colName === 'pv') {
            if (rowIdx < lignes.length - 1) {
              e.preventDefault();
              getRef('qty', rowIdx + 1)?.focus();
              getRef('qty', rowIdx + 1)?.select();
            } else {
              e.preventDefault();
              searchRef.current?.focus();
            }
          }
        } else {
          if (colName === 'pv') {
            e.preventDefault();
            getRef('pa', rowIdx)?.focus();
            getRef('pa', rowIdx)?.select();
          } else if (colName === 'pa') {
            e.preventDefault();
            getRef('qty', rowIdx)?.focus();
            getRef('qty', rowIdx)?.select();
          } else if (colName === 'qty') {
            if (rowIdx > 0) {
              e.preventDefault();
              getRef('pv', rowIdx - 1)?.focus();
              getRef('pv', rowIdx - 1)?.select();
            } else {
              e.preventDefault();
              searchRef.current?.focus();
            }
          }
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (rowIdx < lignes.length - 1) {
          getRef(colName, rowIdx + 1)?.focus();
          getRef(colName, rowIdx + 1)?.select();
        } else {
          searchRef.current?.focus();
        }
        break;
      case 'Delete':
        if (e.ctrlKey) {
          e.preventDefault();
          removeLigne(rowIdx);
          showMsg('Ligne supprimée');
        }
        break;
    }
  }, [lignes.length]);

  // Focus la quantité après ajout d'une ligne
  useEffect(() => {
    if (lignes.length > 0 && showForm) {
      const lastIdx = lignes.length - 1;
      setTimeout(() => {
        qtyRefs.current[lastIdx]?.focus();
        qtyRefs.current[lastIdx]?.select();
      }, 50);
    }
  }, [lignes.length, showForm]);

  const addLigne = (artId: number) => {
    const art = articles.find(a => a.IDARTICLE === artId);
    if (!art) return;
    if (lignes.some(l => l.IDARTICLE === artId)) {
      showMsg('Article déjà dans la liste');
      return;
    }
    setLignes([...lignes, { IDARTICLE: artId, QUANTITE: 1, PRIX_ACHAT: art.PRIX_ACHAT, PRIX_VENTE: art.PRIX_VENTE }]);
    setSearchArt('');
    setShowSuggestions(false);
    setSuggestionIdx(0);
  };

  const updateLigne = (idx: number, field: string, value: number) => {
    setLignes(lignes.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const removeLigne = (idx: number) => {
    setLignes(lignes.filter((_, i) => i !== idx));
  };

  const total = lignes.reduce((s, l) => s + l.QUANTITE * l.PRIX_ACHAT, 0);

  const openNewForm = () => {
    setEditAchat(null);
    setLignes([]);
    setFournisseur(null);
    setObservation('');
    setShowForm(true);
  };

  const openEditForm = (achat: Achat) => {
    const achatLignes = lignesAchat.filter(l => l.IDACHAT === achat.IDACHAT);
    setEditAchat(achat);
    setFournisseur(achat.IDFOURNISSEUR);
    setObservation(achat.OBSERVATION || '');
    setLignes(achatLignes.map(l => ({
      IDARTICLE: l.IDARTICLE,
      QUANTITE: l.QUANTITE,
      PRIX_ACHAT: l.PRIX_ACHAT,
      PRIX_VENTE: l.PRIX_VENTE,
    })));
    setShowForm(true);
  };

  const handleSave = () => {
    if (!fournisseur) { showMsg('Fournisseur obligatoire !'); return; }
    if (lignes.length === 0) { showMsg('Ajoutez au moins un article !'); return; }

    const achatsList = store.getAchats();
    const lignesList = store.getLignesAchat();
    const artList = store.getArticles();
    const mvts = store.getMouvements();

    if (editAchat) {
      // Mode édition - annuler l'ancien puis recréer
      const oldLignes = lignesList.filter(l => l.IDACHAT === editAchat.IDACHAT);
      
      // Restaurer le stock des anciennes lignes
      let updatedArts = [...artList];
      oldLignes.forEach(ol => {
        const idx = updatedArts.findIndex(a => a.IDARTICLE === ol.IDARTICLE);
        if (idx >= 0 && updatedArts[idx].GERE_STOCK) {
          updatedArts[idx] = { ...updatedArts[idx], STOCK: updatedArts[idx].STOCK - ol.QUANTITE };
        }
      });

      // Supprimer les anciennes lignes
      const newLignesList = lignesList.filter(l => l.IDACHAT !== editAchat.IDACHAT);

      // Ajouter les nouvelles lignes et mettre à jour le stock
      let ligneIdBase = nextId(newLignesList, 'IDLIGNEACHAT');
      let mvtIdBase = nextId(mvts, 'IDMOUVEMENT');
      const newLignes: LigneAchat[] = [];
      const newMvts = [...mvts];

      lignes.forEach(l => {
        newLignes.push({
          IDLIGNEACHAT: ligneIdBase++,
          IDACHAT: editAchat.IDACHAT,
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
          REFERENCE: `Modif ${editAchat.REFERENCE}`,
          IDFOURNISSEUR: fournisseur,
        });
      });

      // Mettre à jour l'achat
      const updatedAchats = achatsList.map(a =>
        a.IDACHAT === editAchat.IDACHAT
          ? { ...a, IDFOURNISSEUR: fournisseur, TOTAL: total, OBSERVATION: observation }
          : a
      );

      store.setAchats(updatedAchats);
      store.setLignesAchat([...newLignesList, ...newLignes]);
      store.setArticles(updatedArts);
      store.setMouvements(newMvts);

      showMsg('Achat modifié avec succès !');
    } else {
      // Nouveau achat
      const idAchat = nextId(achatsList, 'IDACHAT');
      const ref = `ACH-${today().replace(/-/g, '')}-${String(idAchat).padStart(4, '0')}`;

      const newAchat = {
        IDACHAT: idAchat,
        DATE_ACHAT: today(),
        REFERENCE: ref,
        IDFOURNISSEUR: fournisseur,
        TOTAL: total,
        OBSERVATION: observation,
      };

      let ligneIdBase = nextId(lignesList, 'IDLIGNEACHAT');
      let mvtIdBase = nextId(mvts, 'IDMOUVEMENT');
      const newLignes: LigneAchat[] = [];
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

      showMsg('Achat enregistré avec succès !');
    }

    setShowForm(false);
    setEditAchat(null);
    setFournisseur(null);
    setObservation('');
    setLignes([]);
    refresh();
  };

  const handleDeleteAchat = (id: number) => {
    const achatsList = store.getAchats();
    const lignesList = store.getLignesAchat();
    store.setAchats(achatsList.filter(a => a.IDACHAT !== id));
    store.setLignesAchat(lignesList.filter(l => l.IDACHAT !== id));
    setConfirmDel(null);
    refresh();
    showMsg('Achat supprimé');
  };

  const printAchat = (idAchat: number) => {
    const achat = achats.find(a => a.IDACHAT === idAchat);
    if (!achat) return;
    const ligs = lignesAchat.filter(l => l.IDACHAT === idAchat);
    const fourn = fournisseurs.find(f => f.IDFOURNISSEUR === achat.IDFOURNISSEUR);

    const rows = ligs.map(l => {
      const art = articles.find(a => a.IDARTICLE === l.IDARTICLE);
      return `<tr><td>${art?.NOM || '-'}</td><td style="text-align:right">${l.QUANTITE}</td><td style="text-align:right">${formatAr(l.PRIX_ACHAT)}</td><td style="text-align:right">${formatAr(l.MONTANT)}</td></tr>`;
    }).join('');

    printTicket(`
      <div class="center bold">BON D'ACHAT</div>
      <div class="center">${achat.REFERENCE}</div>
      <div class="row"><span>${achat.DATE_ACHAT}</span></div>
      <div>Fournisseur: ${fourn?.NOM || '-'}</div>
      <div class="line"></div>
      <table>
        <tr><td class="bold">Article</td><td class="bold right">Qté</td><td class="bold right">PA</td><td class="bold right">Mt</td></tr>
        ${rows}
      </table>
      <div class="line"></div>
      <div class="row bold"><span>TOTAL</span><span>${formatAr(achat.TOTAL)}</span></div>
      ${achat.OBSERVATION ? `<div>Obs: ${achat.OBSERVATION}</div>` : ''}
    `);
  };

  return (
    <div className="space-y-6 relative">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-[60] animate-pulse">{toast}</div>}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🛒 Achats</h1>
        <button onClick={openNewForm} className="bg-[#0D47A1] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium hover:bg-[#1565C0]">
          <Plus size={18} /> Nouvel achat
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Référence</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Fournisseur</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {achats.sort((a, b) => b.IDACHAT - a.IDACHAT).map(a => {
                const fourn = fournisseurs.find(f => f.IDFOURNISSEUR === a.IDFOURNISSEUR);
                return (
                  <tr key={a.IDACHAT} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-sm">{a.REFERENCE}</td>
                    <td className="px-4 py-3 text-sm">{dateLabel(a.DATE_ACHAT)}</td>
                    <td className="px-4 py-3 text-sm">{fourn?.NOM || '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatAr(a.TOTAL)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEditForm(a)} className="p-1.5 rounded-lg hover:bg-blue-50" title="Modifier">
                          <Edit2 size={16} className="text-blue-500" />
                        </button>
                        <button onClick={() => printAchat(a.IDACHAT)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Imprimer">
                          <Printer size={16} className="text-gray-500" />
                        </button>
                        {isAdmin && (
                          <button onClick={() => setConfirmDel({ id: a.IDACHAT, ref: a.REFERENCE })} className="p-1.5 rounded-lg hover:bg-red-50" title="Supprimer">
                            <Trash2 size={16} className="text-red-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {achats.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">Aucun achat</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center overflow-y-auto py-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                🛒 {editAchat ? 'Modifier' : 'Nouvel'} achat
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs bg-white/20 px-3 py-1 rounded-full flex items-center gap-1"><Keyboard size={12} /> ↑↓ Enter Tab</span>
                <button onClick={() => setShowForm(false)}><X size={20} /></button>
              </div>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Fournisseur + Obs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Fournisseur *</label>
                  <select value={fournisseur || ''} onChange={e => setFournisseur(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border mt-1 focus:ring-2 focus:ring-[#0D47A1] focus:border-transparent">
                    <option value="">-- Sélectionner un fournisseur --</option>
                    {fournisseurs.map(f => <option key={f.IDFOURNISSEUR} value={f.IDFOURNISSEUR}>{f.NOM}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Observation</label>
                  <input value={observation} onChange={e => setObservation(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border mt-1" placeholder="Note optionnelle..." />
                </div>
              </div>

              {/* Recherche article */}
              <div className="relative">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Search size={14} /> Rechercher et ajouter un article
                </label>
                <input
                  ref={searchRef}
                  value={searchArt}
                  onChange={e => { setSearchArt(e.target.value); setShowSuggestions(true); setSuggestionIdx(0); }}
                  onFocus={() => { if (searchArt) setShowSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Tapez le nom de l'article puis ↓ et Entrée..."
                  className="w-full px-4 py-3 rounded-xl border mt-1 focus:ring-2 focus:ring-[#0D47A1] focus:border-transparent text-sm"
                  autoComplete="off"
                />
                
                {showSuggestions && searchArt.length > 0 && filteredArt.length > 0 && (
                  <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-64 overflow-y-auto">
                    {filteredArt.map((a, idx) => {
                      const fam = store.getFamilles().find(f => f.IDFAMILLE === a.IDFAMILLE);
                      return (
                        <button
                          key={a.IDARTICLE}
                          onClick={() => addLigne(a.IDARTICLE)}
                          onMouseEnter={() => setSuggestionIdx(idx)}
                          className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm transition ${
                            idx === suggestionIdx ? 'bg-[#0D47A1] text-white' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{a.EMOJI || '📦'}</span>
                            <div>
                              <p className="font-medium">{a.NOM}</p>
                              <p className={`text-xs ${idx === suggestionIdx ? 'text-blue-200' : 'text-gray-400'}`}>
                                {fam?.FAMILLE} • Stock: {a.STOCK}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatAr(a.PRIX_ACHAT)}</p>
                            <p className={`text-xs ${idx === suggestionIdx ? 'text-blue-200' : 'text-gray-400'}`}>PA</p>
                          </div>
                        </button>
                      );
                    })}
                    <div className="px-4 py-2 text-xs border-t text-gray-400 bg-gray-50">
                      ↑↓ naviguer • Entrée sélectionner • Échap fermer
                    </div>
                  </div>
                )}
              </div>

              {/* Grille des lignes */}
              {lignes.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Article</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 w-24">Qté</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 w-32">Prix Achat</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 w-32">Prix Vente</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 w-28">Total</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.map((l, i) => {
                        const art = articles.find(a => a.IDARTICLE === l.IDARTICLE);
                        const lineTotal = l.QUANTITE * l.PRIX_ACHAT;
                        const marge = l.PRIX_VENTE - l.PRIX_ACHAT;
                        return (
                          <tr key={l.IDARTICLE} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{art?.EMOJI || '📦'}</span>
                                <div>
                                  <p className="text-sm font-medium">{art?.NOM}</p>
                                  <p className="text-[10px] text-gray-400">Stock: {art?.STOCK} • Marge: {formatAr(marge)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <input
                                ref={el => { qtyRefs.current[i] = el; }}
                                type="number"
                                min="1"
                                value={l.QUANTITE}
                                onChange={e => updateLigne(i, 'QUANTITE', Math.max(1, Number(e.target.value)))}
                                onKeyDown={e => handleGridKeyDown(e, i, 'qty')}
                                onFocus={e => e.target.select()}
                                className="w-full text-center border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-[#0D47A1] focus:border-transparent"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                ref={el => { paRefs.current[i] = el; }}
                                type="number"
                                min="0"
                                value={l.PRIX_ACHAT}
                                onChange={e => updateLigne(i, 'PRIX_ACHAT', Number(e.target.value))}
                                onKeyDown={e => handleGridKeyDown(e, i, 'pa')}
                                onFocus={e => e.target.select()}
                                className="w-full text-right border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#0D47A1] focus:border-transparent"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                ref={el => { pvRefs.current[i] = el; }}
                                type="number"
                                min="0"
                                value={l.PRIX_VENTE}
                                onChange={e => updateLigne(i, 'PRIX_VENTE', Number(e.target.value))}
                                onKeyDown={e => handleGridKeyDown(e, i, 'pv')}
                                onFocus={e => e.target.select()}
                                className="w-full text-right border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#0D47A1] focus:border-transparent"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-sm text-[#0D47A1]">{formatAr(lineTotal)}</td>
                            <td className="px-2 py-2">
                              <button onClick={() => removeLigne(i)} className="p-1 rounded hover:bg-red-100 text-red-500" title="Ctrl+Suppr">
                                <X size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex items-center justify-between">
                    <div className="text-xs text-gray-500 flex items-center gap-4">
                      <span>{lignes.length} article(s)</span>
                      <span>Qté totale: {lignes.reduce((s, l) => s + l.QUANTITE, 0)}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Total achat</p>
                      <p className="text-xl font-bold text-[#0D47A1]">{formatAr(total)}</p>
                    </div>
                  </div>
                </div>
              )}

              {lignes.length === 0 && (
                <div className="bg-gray-50 rounded-xl p-8 text-center">
                  <Search size={40} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500">Tapez le nom d'un article ci-dessus pour commencer</p>
                  <p className="text-xs text-gray-400 mt-1">Utilisez ↑↓ pour naviguer et Entrée pour sélectionner</p>
                </div>
              )}

              {/* Raccourcis clavier */}
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                <p className="text-xs text-blue-700 font-medium mb-1">⌨️ Raccourcis clavier</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-blue-600">
                  <span>↑↓ Naviguer suggestions</span>
                  <span>Entrée: Sélectionner / Ligne suivante</span>
                  <span>Tab: Colonne suivante</span>
                  <span>Ctrl+Suppr: Supprimer ligne</span>
                </div>
              </div>

              {/* Boutons */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border border-gray-200 font-medium text-gray-600 hover:bg-gray-50">
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={!fournisseur || lignes.length === 0}
                  className="flex-1 bg-[#0D47A1] text-white py-3 rounded-xl font-bold hover:bg-[#1565C0] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {editAchat ? 'Modifier' : 'Enregistrer'} l'achat ({formatAr(total)})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDel}
        type="danger"
        title="Supprimer l'achat"
        message={`Voulez-vous vraiment supprimer l'achat "${confirmDel?.ref}" ?`}
        confirmText="Oui, supprimer"
        cancelText="Non"
        onConfirm={() => confirmDel && handleDeleteAchat(confirmDel.id)}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
