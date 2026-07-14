import { useState, useMemo } from 'react';
import { Search, Eye, Trash2, X, Printer } from 'lucide-react';
import { store } from '../store';
import { Personnel, Vente } from '../types';
import { formatAr, dateLabel, today } from '../helpers';
import { printPreview } from '../components/PrintTicket';
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

    printPreview(`
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
      <div class="row"><span>Sous-total</span><span>${formatAr(vente.TOTAL)}</span></div>
      ${vente.REMISE > 0 ? `<div class="row"><span>Remise</span><span>-${formatAr(vente.REMISE)}</span></div>` : ''}
      <div class="row bold"><span>NET À PAYER</span><span>${formatAr(vente.TOTAL - vente.REMISE)}</span></div>
    `);
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🧾 Ventes</h1>
      </div>

      {/* Stats par caissier (Admin/Gérant) */}
      {(isAdmin || isGerant) && statsByCaissier.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statsByCaissier.map((s, i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">{s.nom}</p>
              <p className="text-xl font-bold text-[#0D47A1]">{formatAr(s.total)}</p>
              <p className="text-xs text-gray-400">{s.nb} vente(s)</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Rechercher par n° facture..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-[#0D47A1]"
              />
            </div>
          </div>
          <div>
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border"
            />
          </div>
        </div>
      </div>

      {/* Liste des ventes */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedVente(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">🧾 {selectedVente.NUMERO_FACTURE}</h3>
              <button onClick={() => setSelectedVente(null)}><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Date</p>
                  <p className="font-medium">{dateLabel(selectedVente.DATE_VENTE)} {selectedVente.HEURE}</p>
                </div>
                <div>
                  <p className="text-gray-500">Caissier</p>
                  <p className="font-medium">
                    {personnel.find(p => p.IDPERSONNEL === selectedVente.IDPERSONNEL)?.PRENOM}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-medium mb-3">Articles</h4>
                <div className="space-y-2">
                  {lignesVente.filter(l => l.IDVENTE === selectedVente.IDVENTE).map(l => {
                    const art = articles.find(a => a.IDARTICLE === l.IDARTICLE);
                    return (
                      <div key={l.IDLIGNEVENTE} className="flex justify-between text-sm">
                        <span>{l.QUANTITE}x {art?.NOM}</span>
                        <span className="font-medium">{formatAr(l.MONTANT)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Sous-total</span>
                  <span className="font-medium">{formatAr(selectedVente.TOTAL)}</span>
                </div>
                {selectedVente.REMISE > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>Remise</span>
                    <span>-{formatAr(selectedVente.REMISE)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-[#0D47A1]">{formatAr(selectedVente.TOTAL - selectedVente.REMISE)}</span>
                </div>
              </div>
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
