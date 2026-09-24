import { useState, useMemo } from 'react';
import { Search, Calendar, Filter, Eye, Printer, X, Wallet, DollarSign, Smartphone, CreditCard, ArrowDownRight } from 'lucide-react';
import { store } from '../store';
import { Personnel, Paiement, Vente } from '../types';
import { formatAr, dateLabel, today } from '../helpers';
import { printTicket } from '../components/PrintTicket';

interface Props {
  user: Personnel;
}

export default function PaiementsModule({ user }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<string>(today());
  const [modeFilter, setModeFilter] = useState<string>('Tous');
  const [caissierFilter, setCaissierFilter] = useState<string>('Tous');
  const [selectedPaiement, setSelectedPaiement] = useState<Paiement | null>(null);

  const paiements = store.getPaiements();
  const ventes = store.getVentes();
  const personnel = store.getPersonnel();
  const clients = store.getClients();
  const articles = store.getArticles();
  const lignesVente = store.getLignesVente();

  // Caissier ne voit que ses paiements non clôturés sauf s'il est Admin/Gérant
  const isPrivileged = user.ROLE === 'Administrateur' || user.ROLE === 'Gérant';

  // Liste filtrée
  const filteredPaiements = useMemo(() => {
    return paiements.filter(p => {
      // Restriction rôle caissier
      if (!isPrivileged && p.IDPERSONNEL !== user.IDPERSONNEL) {
        return false;
      }

      // Filtre date
      if (dateFilter && p.DATE_PAIEMENT !== dateFilter) {
        return false;
      }

      // Filtre mode de paiement
      if (modeFilter !== 'Tous' && p.MODE_PAIEMENT !== modeFilter) {
        return false;
      }

      // Filtre caissier
      if (caissierFilter !== 'Tous' && p.IDPERSONNEL !== Number(caissierFilter)) {
        return false;
      }

      // Recherche par N° Facture ou Nom Client
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const vente = p.IDVENTE ? ventes.find(v => v.IDVENTE === p.IDVENTE) : null;
        const client = p.IDCLIENT ? clients.find(c => c.IDCLIENT === p.IDCLIENT) : null;

        const numFacture = vente?.NUMERO_FACTURE.toLowerCase() || '';
        const nomClient = client?.NOM_CLIENT.toLowerCase() || '';
        const mode = p.MODE_PAIEMENT.toLowerCase();

        if (!numFacture.includes(term) && !nomClient.includes(term) && !mode.includes(term)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => b.IDPAIEMENT - a.IDPAIEMENT);
  }, [paiements, ventes, clients, dateFilter, modeFilter, caissierFilter, searchTerm, user, isPrivileged]);

  // Statistiques calculées à partir des éléments filtrés
  const stats = useMemo(() => {
    const totalEncaisse = filteredPaiements.reduce((sum, p) => sum + p.MONTANT, 0);
    const totalEspeces = filteredPaiements.filter(p => p.MODE_PAIEMENT === 'Espèces').reduce((sum, p) => sum + p.MONTANT, 0);
    const totalMobile = filteredPaiements.filter(p => p.MODE_PAIEMENT === 'Mobile Money').reduce((sum, p) => sum + p.MONTANT, 0);
    const totalCredit = filteredPaiements.filter(p => p.MODE_PAIEMENT === 'Crédit').reduce((sum, p) => sum + p.MONTANT, 0);
    const count = filteredPaiements.length;

    return { totalEncaisse, totalEspeces, totalMobile, totalCredit, count };
  }, [filteredPaiements]);

  // Informations de la vente associée si applicable
  const getVenteInfo = (idVente: number | null): Vente | undefined => {
    if (!idVente) return undefined;
    return ventes.find(v => v.IDVENTE === idVente);
  };

  // Nom du client associé
  const getClientNom = (idPaiement: Paiement): string => {
    if (idPaiement.IDCLIENT) {
      const client = clients.find(c => c.IDCLIENT === idPaiement.IDCLIENT);
      if (client) return client.NOM_CLIENT;
    }
    return '-';
  };

  // Impression d'un reçu de paiement
  const printPaiementReceipt = (p: Paiement) => {
    const caissier = personnel.find(pers => pers.IDPERSONNEL === p.IDPERSONNEL);
    const clientNom = getClientNom(p);
    const vente = getVenteInfo(p.IDVENTE);

    let htmlContent = `
      <div class="center bold">REÇU DE PAIEMENT</div>
      <div class="center">Ref: PAY-#${p.IDPAIEMENT}</div>
      <div class="line"></div>
      <div class="row"><span>Date &amp; Heure:</span><span>${p.DATE_PAIEMENT} ${p.HEURE}</span></div>
      <div class="row"><span>Caissier:</span><span>${caissier ? `${caissier.PRENOM} ${caissier.NOM}` : '-'}</span></div>
      <div class="row"><span>Mode de paiement:</span><span class="bold">${p.MODE_PAIEMENT}</span></div>
    `;

    if (vente) {
      htmlContent += `<div class="row"><span>N° Facture:</span><span>${vente.NUMERO_FACTURE}</span></div>`;
    } else {
      htmlContent += `<div class="row"><span>Type:</span><span>Remboursement de crédit</span></div>`;
    }

    if (clientNom !== '-') {
      htmlContent += `<div class="row"><span>Client:</span><span>${clientNom}</span></div>`;
    }

    htmlContent += `
      <div class="line"></div>
      <div class="row bold"><span>MONTANT RÉGLÉ</span><span>${formatAr(p.MONTANT)}</span></div>
      <div class="line"></div>
      <div class="center italic mt-2">Merci pour votre confiance !</div>
    `;

    printTicket(htmlContent, true);
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="text-[#0D47A1]" size={28} />
            Historique des Paiements
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Consultation et suivi détaillé de tous les encaissements effectués
          </p>
        </div>

        {filteredPaiements.length > 0 && (
          <button
            onClick={() => {
              const listRows = filteredPaiements.map(p => {
                const caissier = personnel.find(pers => pers.IDPERSONNEL === p.IDPERSONNEL);
                const vente = getVenteInfo(p.IDVENTE);
                const client = getClientNom(p);
                return `<tr>
                  <td>${p.DATE_PAIEMENT} ${p.HEURE}</td>
                  <td>${caissier?.PRENOM || '-'}</td>
                  <td>${vente?.NUMERO_FACTURE || 'Remboursement'}</td>
                  <td>${client}</td>
                  <td>${p.MODE_PAIEMENT}</td>
                  <td class="right bold">${formatAr(p.MONTANT)}</td>
                </tr>`;
              }).join('');

              printTicket(`
                <div class="center bold">RAPPORT DES PAIEMENTS</div>
                <div class="center">${dateFilter ? `Date: ${dateFilter}` : 'Toutes les dates'} - Mode: ${modeFilter}</div>
                <div class="line"></div>
                <table>
                  <tr><td class="bold">Date/Heure</td><td class="bold">Caissier</td><td class="bold">Facture</td><td class="bold">Client</td><td class="bold">Mode</td><td class="bold right">Montant</td></tr>
                  ${listRows}
                </table>
                <div class="line"></div>
                <div class="row bold"><span>TOTAL ENCAISSÉ</span><span>${formatAr(stats.totalEncaisse)}</span></div>
              `, true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl font-medium text-gray-700 shadow-sm transition-all"
          >
            <Printer size={18} />
            Imprimer le rapport
          </button>
        )}
      </div>

      {/* Cartes récapitulatives */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0D47A1] flex items-center justify-center font-bold">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Encaissements</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{formatAr(stats.totalEncaisse)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{stats.count} transaction{stats.count > 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Espèces</p>
            <p className="text-2xl font-bold text-emerald-600 mt-0.5">{formatAr(stats.totalEspeces)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Paiements comptant</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Smartphone size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile Money</p>
            <p className="text-2xl font-bold text-purple-600 mt-0.5">{formatAr(stats.totalMobile)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Mvola, Orange Money, Airtel</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <CreditCard size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Crédits Accordés</p>
            <p className="text-2xl font-bold text-amber-600 mt-0.5">{formatAr(stats.totalCredit)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Ventes à crédit</p>
          </div>
        </div>
      </div>

      {/* Barre de filtres */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Filter size={18} className="text-[#0D47A1]" />
          Filtres de recherche
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Recherche textuelle */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="N° Facture, Nom client..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0D47A1] outline-none text-sm"
            />
          </div>

          {/* Filtre par date */}
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-gray-400 shrink-0" />
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0D47A1] outline-none text-sm"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                title="Toutes les dates"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filtre mode de paiement */}
          <div>
            <select
              value={modeFilter}
              onChange={e => setModeFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0D47A1] outline-none text-sm bg-white"
            >
              <option value="Tous">Tous les modes de paiement</option>
              <option value="Espèces">💵 Espèces</option>
              <option value="Mobile Money">📱 Mobile Money</option>
              <option value="Crédit">📝 Crédit</option>
            </select>
          </div>

          {/* Filtre caissier (si privilèges) */}
          <div>
            <select
              value={caissierFilter}
              onChange={e => setCaissierFilter(e.target.value)}
              disabled={!isPrivileged}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0D47A1] outline-none text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="Tous">Tous les caissiers</option>
              {personnel.map(p => (
                <option key={p.IDPERSONNEL} value={p.IDPERSONNEL}>
                  {p.PRENOM} {p.NOM} ({p.ROLE})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tableau des paiements */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">Réf.</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">Date &amp; Heure</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">Caissier</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">Origine / N° Facture</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">Client</th>
                <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500">Mode de paiement</th>
                <th className="text-right px-4 py-3.5 text-xs font-semibold text-gray-500">Montant</th>
                <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPaiements.map(p => {
                const caissier = personnel.find(pers => pers.IDPERSONNEL === p.IDPERSONNEL);
                const vente = getVenteInfo(p.IDVENTE);
                const clientNom = getClientNom(p);

                return (
                  <tr key={p.IDPAIEMENT} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-xs text-gray-500 font-medium">
                      #{p.IDPAIEMENT}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-800 whitespace-nowrap">
                      {dateLabel(p.DATE_PAIEMENT)} <span className="text-xs text-gray-400 ml-1">{p.HEURE}</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700 font-medium">
                      {caissier?.PRENOM} {caissier?.NOM?.charAt(0)}.
                    </td>
                    <td className="px-4 py-3.5 text-sm font-medium">
                      {vente ? (
                        <span className="inline-flex items-center gap-1.5 text-[#0D47A1]">
                          {vente.NUMERO_FACTURE}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full text-xs">
                          <ArrowDownRight size={12} />
                          Remboursement crédit
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600">
                      {clientNom}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                        p.MODE_PAIEMENT === 'Espèces' ? 'bg-emerald-100 text-emerald-800' :
                        p.MODE_PAIEMENT === 'Mobile Money' ? 'bg-purple-100 text-purple-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {p.MODE_PAIEMENT === 'Espèces' && '💵'}
                        {p.MODE_PAIEMENT === 'Mobile Money' && '📱'}
                        {p.MODE_PAIEMENT === 'Crédit' && '📝'}
                        {p.MODE_PAIEMENT}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-gray-900 text-base">
                      {formatAr(p.MONTANT)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedPaiement(p)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                          title="Voir détails"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => printPaiementReceipt(p)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                          title="Imprimer ticket"
                        >
                          <Printer size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredPaiements.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    <Wallet size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium text-gray-600">Aucun paiement trouvé</p>
                    <p className="text-xs text-gray-400 mt-1">Essayez de modifier les critères de filtrage</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Détails du Paiement */}
      {selectedPaiement && (() => {
        const p = selectedPaiement;
        const caissier = personnel.find(pers => pers.IDPERSONNEL === p.IDPERSONNEL);
        const vente = getVenteInfo(p.IDVENTE);
        const clientNom = getClientNom(p);

        return (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">Paiement #{p.IDPAIEMENT}</h3>
                  <p className="text-xs text-blue-100">{p.DATE_PAIEMENT} à {p.HEURE}</p>
                </div>
                <button onClick={() => setSelectedPaiement(null)} className="hover:bg-white/10 p-1.5 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-medium">Caissier</p>
                    <p className="font-semibold text-gray-900 mt-0.5">{caissier?.PRENOM} {caissier?.NOM}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-medium">Mode de paiement</p>
                    <p className="font-semibold text-gray-900 mt-0.5">{p.MODE_PAIEMENT}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-medium">Origine</p>
                    <p className="font-semibold text-[#0D47A1] mt-0.5">
                      {vente ? vente.NUMERO_FACTURE : 'Remboursement crédit'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-medium">Client</p>
                    <p className="font-semibold text-gray-900 mt-0.5">{clientNom}</p>
                  </div>
                </div>

                {/* Si lié à une vente, afficher le détail des articles */}
                {vente && (() => {
                  const venteLignes = lignesVente.filter(l => l.IDVENTE === vente.IDVENTE);
                  return (
                    <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Détail des articles de la vente
                      </p>
                      <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto pr-1">
                        {venteLignes.map(l => {
                          const art = articles.find(a => a.IDARTICLE === l.IDARTICLE);
                          return (
                            <div key={l.IDLIGNEVENTE} className="py-2 flex justify-between text-sm">
                              <span className="text-gray-700">{l.QUANTITE}x {art?.NOM || '-'}</span>
                              <span className="font-medium text-gray-900">{formatAr(l.MONTANT)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="bg-[#0D47A1]/5 border border-[#0D47A1]/20 rounded-xl p-4 flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">Montant total réglé</span>
                  <span className="text-xl font-bold text-[#0D47A1]">{formatAr(p.MONTANT)}</span>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => printPaiementReceipt(p)}
                    className="w-full bg-[#0D47A1] hover:bg-[#0b3c88] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Printer size={18} />
                    Imprimer le reçu
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
