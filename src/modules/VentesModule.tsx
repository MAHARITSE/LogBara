import { useState, useMemo } from 'react';
import { Search, Eye, Trash2, X, Printer } from 'lucide-react';
import { store } from '../store';
import { Personnel, Vente } from '../types';
import { formatAr, dateLabel, today } from '../helpers';
import { printTicket } from '../components/PrintTicket';
import ConfirmModal from '../components/ConfirmModal';

interface Props {
  user: Personnel;
}

export default function VentesModule({ user }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState(today());
  const [selectedVente, setSelectedVente] = useState<Vente | null>(null);
  const [confirmAnnuler, setConfirmAnnuler] = useState<Vente | null>(null);
  const [toast, setToast] = useState('');

  const ventes = store.getVentes();
  const lignesVente = store.getLignesVente();
  const articles = store.getArticles();
  const personnel = store.getPersonnel();
  void store.getClotures(); // Used for filtering

  const isAdmin = user.ROLE === 'Administrateur';
  const isGerant = user.ROLE === 'Gérant';

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // Filtrer les ventes
  const filteredVentes = useMemo(() => {
    return ventes.filter(v => {
      // Caissier ne voit que ses ventes non clôturées
      if (user.ROLE === 'Caissier') {
        if (v.IDPERSONNEL !== user.IDPERSONNEL) return false;
        if (v.CLOTUREE) return false;
      }
      
      // Filtre date
      if (dateFilter && v.DATE_VENTE !== dateFilter) return false;
      
      // Filtre recherche
      if (searchTerm && !v.NUMERO_FACTURE.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      
      return true;
    }).sort((a, b) => b.IDVENTE - a.IDVENTE);
  }, [ventes, user, dateFilter, searchTerm]);

  // Stats par caissier
  const statsByCaissier = useMemo(() => {
    const ventesJour = ventes.filter(v => v.DATE_VENTE === today() && v.STATUT === 'Payée');
    const stats: Record<number, { nom: string; total: number; nb: number }> = {};
    
    ventesJour.forEach(v => {
      const p = personnel.find(p => p.IDPERSONNEL === v.IDPERSONNEL);
      if (p) {
        if (!stats[v.IDPERSONNEL]) {
          stats[v.IDPERSONNEL] = { nom: `${p.PRENOM} ${p.NOM}`, total: 0, nb: 0 };
        }
        stats[v.IDPERSONNEL].total += v.TOTAL - v.REMISE;
        stats[v.IDPERSONNEL].nb += 1;
      }
    });
    
    return Object.values(stats);
  }, [ventes, personnel]);

  // Annuler une vente (Admin uniquement)
  const handleAnnuler = (vente: Vente) => {
    if (vente.CLOTUREE) {
      showMsg('Impossible d\'annuler une vente clôturée');
      return;
    }

    const updatedVentes = ventes.map(v =>
      v.IDVENTE === vente.IDVENTE ? { ...v, STATUT: 'Annulée' as const } : v
    );

    // Restaurer le stock
    const venteLignes = lignesVente.filter(l => l.IDVENTE === vente.IDVENTE);
    const articlesList = store.getArticles();
    const updatedArticles = articlesList.map(a => {
      const ligne = venteLignes.find(l => l.IDARTICLE === a.IDARTICLE);
      if (ligne && a.GERE_STOCK) {
        return { ...a, STOCK: a.STOCK + ligne.QUANTITE };
      }
      return a;
    });

    store.setVentes(updatedVentes);
    store.setArticles(updatedArticles);
    setConfirmAnnuler(null);
    showMsg('Vente annulée');
  };

  // Imprimer facture
  const printFacture = (vente: Vente) => {
    const lignes = lignesVente.filter(l => l.IDVENTE === vente.IDVENTE);
    const caissier = personnel.find(p => p.IDPERSONNEL === vente.IDPERSONNEL);
    
    const rows = lignes.map(l => {
      const art = articles.find(a => a.IDARTICLE === l.IDARTICLE);
      return `<tr><td>${art?.NOM || '-'}</td><td class="right">${l.QUANTITE}</td><td class="right">${formatAr(l.PRIX_UNITAIRE)}</td><td class="right">${formatAr(l.MONTANT)}</td></tr>`;
    }).join('');

    printTicket(`
      <div class="center bold">FACTURE</div>
      <div class="center">${vente.NUMERO_FACTURE}</div>
      <div class="row"><span>${vente.DATE_VENTE}</span><span>${vente.HEURE}</span></div>
      <div>Caissier: ${caissier?.PRENOM} ${caissier?.NOM}</div>
      <div>Type: ${vente.TYPE}</div>
      <div class="line"></div>
      <table>
        <tr><td class="bold">Article</td><td class="bold right">Qté</td><td class="bold right">PU</td><td class="bold right">Mt</td></tr>
        ${rows}
      </table>
      <div class="line"></div>
      ${vente.REMISE > 0 ? `<div class="row"><span>Remise</span><span>-${formatAr(vente.REMISE)}</span></div>` : ''}
      <div class="row bold"><span>TOTAL</span><span>${formatAr(vente.TOTAL - vente.REMISE)}</span></div>
    `, true);
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🧾 Ventes</h1>
      </div>

      {/* Stats par caissier (Admin/Gérant) */}
      {(isAdmin || isGerant) && statsByCaissier.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {statsByCaissier.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-xs border border-gray-100">
              <p className="text-xs text-gray-500 font-medium truncate">{s.nom}</p>
              <p className="text-lg sm:text-xl font-extrabold text-[#0D47A1] mt-0.5 tabular-nums">{formatAr(s.total)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{s.nb} vente(s)</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-100 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Rechercher par n° facture..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#0D47A1]"
              />
            </div>
          </div>
          <div>
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:ring-2 focus:ring-[#0D47A1]"
            />
          </div>
        </div>
      </div>

      {/* Liste des ventes : Vue Cartes sur Mobile */}
      <div className="md:hidden space-y-3">
        {filteredVentes.map(v => {
          const caissier = personnel.find(p => p.IDPERSONNEL === v.IDPERSONNEL);
          return (
            <div key={v.IDVENTE} className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-gray-900">{v.NUMERO_FACTURE}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                    v.STATUT === 'Payée' ? 'bg-green-100 text-green-700' :
                    v.STATUT === 'Annulée' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {v.STATUT}
                  </span>
                  {v.CLOTUREE && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                      Clôturée
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 font-medium pt-1 border-t border-gray-100">
                <span>{dateLabel(v.DATE_VENTE)} · {v.HEURE}</span>
                <span>{caissier?.PRENOM} ({v.TYPE})</span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-base font-extrabold text-[#0D47A1] tabular-nums">{formatAr(v.TOTAL - v.REMISE)}</span>
                  {v.REMISE > 0 && <span className="ml-1.5 text-xs text-red-500">(-{formatAr(v.REMISE)})</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedVente(v)}
                    className="p-2 min-h-[38px] min-w-[38px] rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center justify-center active:scale-95"
                    title="Voir détails"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => printFacture(v)}
                    className="p-2 min-h-[38px] min-w-[38px] rounded-xl bg-blue-50 text-[#0D47A1] hover:bg-blue-100 flex items-center justify-center active:scale-95"
                    title="Imprimer"
                  >
                    <Printer size={16} />
                  </button>
                  {isAdmin && v.STATUT !== 'Annulée' && !v.CLOTUREE && (
                    <button
                      onClick={() => setConfirmAnnuler(v)}
                      className="p-2 min-h-[38px] min-w-[38px] rounded-xl bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center active:scale-95"
                      title="Annuler"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filteredVentes.length === 0 && (
          <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-gray-100">
            Aucune vente trouvée
          </div>
        )}
      </div>

      {/* Liste des ventes : Tableau sur Tablette / Desktop */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">N° Facture</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Caissier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Remise</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Statut</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVentes.map(v => {
                const caissier = personnel.find(p => p.IDPERSONNEL === v.IDPERSONNEL);
                return (
                  <tr key={v.IDVENTE} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-sm">{v.NUMERO_FACTURE}</td>
                    <td className="px-4 py-3 text-sm">
                      {dateLabel(v.DATE_VENTE)} {v.HEURE}
                    </td>
                    <td className="px-4 py-3 text-sm">{caissier?.PRENOM}</td>
                    <td className="px-4 py-3 text-sm">{v.TYPE}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatAr(v.TOTAL - v.REMISE)}</td>
                    <td className="px-4 py-3 text-right text-red-500">{v.REMISE > 0 ? `-${formatAr(v.REMISE)}` : '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        v.STATUT === 'Payée' ? 'bg-green-100 text-green-700' :
                        v.STATUT === 'Annulée' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {v.STATUT}
                      </span>
                      {v.CLOTUREE && (
                        <span className="ml-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                          Clôturée
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedVente(v)}
                          className="p-1.5 rounded-lg hover:bg-gray-100"
                          title="Voir détails"
                        >
                          <Eye size={16} className="text-gray-500" />
                        </button>
                        <button
                          onClick={() => printFacture(v)}
                          className="p-1.5 rounded-lg hover:bg-gray-100"
                          title="Imprimer"
                        >
                          <Printer size={16} className="text-gray-500" />
                        </button>
                        {isAdmin && v.STATUT !== 'Annulée' && !v.CLOTUREE && (
                          <button
                            onClick={() => setConfirmAnnuler(v)}
                            className="p-1.5 rounded-lg hover:bg-red-50"
                            title="Annuler"
                          >
                            <Trash2 size={16} className="text-red-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredVentes.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400">
                    Aucune vente trouvée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal détails */}
      {selectedVente && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
            <div className="bg-[#0D47A1] text-white px-5 py-4 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base sm:text-lg">🧾 {selectedVente.NUMERO_FACTURE}</h3>
              <button onClick={() => setSelectedVente(null)} className="p-1 rounded-lg hover:bg-white/20"><X size={20} /></button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  <p className="text-gray-500 font-medium">Date & Heure</p>
                  <p className="font-bold text-gray-900 mt-0.5">{dateLabel(selectedVente.DATE_VENTE)} {selectedVente.HEURE}</p>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  <p className="text-gray-500 font-medium">Caissier</p>
                  <p className="font-bold text-gray-900 mt-0.5">
                    {personnel.find(p => p.IDPERSONNEL === selectedVente.IDPERSONNEL)?.PRENOM}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3.5 sm:p-4 border border-gray-100">
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-2.5">Articles</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {lignesVente.filter(l => l.IDVENTE === selectedVente.IDVENTE).map(l => {
                    const art = articles.find(a => a.IDARTICLE === l.IDARTICLE);
                    return (
                      <div key={l.IDLIGNEVENTE} className="flex justify-between text-xs sm:text-sm py-1 border-b border-gray-200/50 last:border-0">
                        <span className="font-medium text-gray-800">{l.QUANTITE}x {art?.NOM}</span>
                        <span className="font-bold text-gray-900 tabular-nums">{formatAr(l.MONTANT)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t pt-3 space-y-1.5">
                {selectedVente.REMISE > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm text-red-500 font-medium">
                    <span>Remise</span>
                    <span>-{formatAr(selectedVente.REMISE)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base sm:text-lg font-extrabold text-[#0D47A1]">
                  <span>Total</span>
                  <span className="tabular-nums">{formatAr(selectedVente.TOTAL - selectedVente.REMISE)}</span>
                </div>
              </div>

              <button
                onClick={() => { printFacture(selectedVente); setSelectedVente(null); }}
                className="w-full bg-[#0D47A1] text-white py-3.5 rounded-xl font-bold hover:bg-[#1565C0] flex items-center justify-center gap-2 min-h-[46px] active:scale-[0.98] shadow-sm transition-all"
              >
                <Printer size={18} />
                Imprimer le ticket
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmAnnuler}
        type="danger"
        title="Annuler la vente"
        message={`Voulez-vous vraiment annuler la vente "${confirmAnnuler?.NUMERO_FACTURE}" ?`}
        confirmText="Oui, annuler"
        cancelText="Non"
        onConfirm={() => confirmAnnuler && handleAnnuler(confirmAnnuler)}
        onCancel={() => setConfirmAnnuler(null)}
      />
    </div>
  );
}
