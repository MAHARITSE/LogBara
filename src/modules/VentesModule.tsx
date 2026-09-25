import { useState, useMemo } from 'react';
import { Search, Eye, Trash2, X, Printer, UtensilsCrossed } from 'lucide-react';
import { store } from '../store';
import { Personnel, Vente, CartItem } from '../types';
import { formatAr, dateLabel, today } from '../helpers';
import { printTicket } from '../components/PrintTicket';
import ConfirmModal from '../components/ConfirmModal';

interface Props {
  user: Personnel;
}

/**
 * Table dont les consommations ne sont PAS encore encaissées :
 * ce n'est pas encore une vente (pas de n° de facture) mais on doit la voir
 * ici pour savoir ce qui reste à payer à la caisse.
 */
interface TableEnCours {
  IDTABLE: number;
  NUMERO: number;
  DESCRIPTION: string;
  TOTAL: number;
  NB_ARTICLES: number;
  HEURE: string;
  IDCAISSIER?: number;
  items: CartItem[];
}

export default function VentesModule({ user }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  // Caissier : par défaut TOUTES ses ventes non clôturées (la caisse peut rester
  // ouverte plusieurs jours). Admin / Gérant : ventes du jour par défaut.
  const [dateFilter, setDateFilter] = useState(user.ROLE === 'Caissier' ? '' : today());
  const [selectedVente, setSelectedVente] = useState<Vente | null>(null);
  const [selectedTableEnCours, setSelectedTableEnCours] = useState<TableEnCours | null>(null);
  const [confirmAnnuler, setConfirmAnnuler] = useState<Vente | null>(null);
  const [toast, setToast] = useState('');

  const ventes = store.getVentes();
  const lignesVente = store.getLignesVente();
  const articles = store.getArticles();
  const personnel = store.getPersonnel();
  const tables = store.getTables();
  const consommations = store.getConsommations();
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
      // RÈGLE ABSOLUE : une vente clôturée n'est JAMAIS affichée dans ce module.
      // Elle est archivée dans l'historique du module Clôture (avec son ticket).
      if (v.CLOTUREE || v.IDCLOTURE) return false;

      // Caissier : uniquement ses propres ventes en cours
      if (user.ROLE === 'Caissier' && v.IDPERSONNEL !== user.IDPERSONNEL) return false;

      // Filtre date
      if (dateFilter && v.DATE_VENTE !== dateFilter) return false;

      // Filtre recherche
      if (searchTerm && !v.NUMERO_FACTURE.toLowerCase().includes(searchTerm.toLowerCase())) return false;

      return true;
    }).sort((a, b) => b.IDVENTE - a.IDVENTE);
  }, [ventes, user, dateFilter, searchTerm]);

  /**
   * Libellé de la colonne « Type » :
   * - vente sur table → le NUMÉRO de la table (ex. « Table 5 »)
   * - vente au comptoir → « Comptoir »
   */
  const typeLabel = (vente: Vente): { texte: string; surTable: boolean } => {
    if (vente.TYPE !== 'Table') return { texte: 'Comptoir', surTable: false };
    const table = tables.find(t => t.IDTABLE === vente.IDTABLE);
    if (!table) return { texte: 'Table supprimée', surTable: true };
    return { texte: `Table ${table.NUMERO}`, surTable: true };
  };

  // ===========================================================================
  // TABLES EN COURS (non encore payées à la caisse)
  // Les consommations servies sur une table ne deviennent une vente qu'au
  // moment de l'encaissement. On les affiche ici pour voir ce qui reste à
  // encaisser, avec le n° de table, sans en faire de fausses ventes.
  // ===========================================================================
  const tablesEnCours = useMemo((): TableEnCours[] => {
    const groupes = new Map<number, typeof consommations>();
    consommations.forEach(c => {
      const liste = groupes.get(c.IDTABLE);
      if (liste) liste.push(c);
      else groupes.set(c.IDTABLE, [c]);
    });

    const resultat: TableEnCours[] = [];
    groupes.forEach((consos, idTable) => {
      const table = tables.find(t => t.IDTABLE === idTable);
      if (!table) return; // consommations orphelines (table supprimée)

      // Regroupement par article ET prix (un article à prix libre peut avoir plusieurs prix)
      const items: CartItem[] = [];
      consos.forEach(c => {
        const art = articles.find(a => a.IDARTICLE === c.IDARTICLE);
        const existant = items.find(i => i.IDARTICLE === c.IDARTICLE && i.PRIX_UNITAIRE === c.PRIX_UNITAIRE);
        if (existant) existant.QUANTITE += c.QUANTITE;
        else items.push({
          IDARTICLE: c.IDARTICLE, NOM: art?.NOM || 'Article', EMOJI: art?.EMOJI,
          QUANTITE: c.QUANTITE, PRIX_UNITAIRE: c.PRIX_UNITAIRE,
          SAISIE_PRIX_VENTE: !!art?.SAISIE_PRIX_VENTE,
        });
      });

      const heures = consos.map(c => c.HEURE).filter(Boolean).sort();

      resultat.push({
        IDTABLE: table.IDTABLE,
        NUMERO: table.NUMERO,
        DESCRIPTION: table.DESCRIPTION,
        TOTAL: items.reduce((s, i) => s + i.QUANTITE * i.PRIX_UNITAIRE, 0),
        NB_ARTICLES: items.reduce((s, i) => s + i.QUANTITE, 0),
        HEURE: heures[0] || '',
        IDCAISSIER: table.IDCAISSIER,
        items,
      });
    });

    return resultat.sort((a, b) => a.NUMERO - b.NUMERO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consommations, tables, articles]);

  // Les tables en cours n'ont pas de date : on ne les montre que si le filtre
  // porte sur aujourd'hui (ou sur toutes les dates).
  const dateOkPourEnCours = !dateFilter || dateFilter === today();

  const tablesEnCoursAffichees = useMemo(() => {
    if (!dateOkPourEnCours) return [];
    if (!searchTerm.trim()) return tablesEnCours;
    const terme = searchTerm.trim().toLowerCase();
    return tablesEnCours.filter(t =>
      `table ${t.NUMERO}`.includes(terme) ||
      t.DESCRIPTION.toLowerCase().includes(terme) ||
      t.items.some(i => i.NOM.toLowerCase().includes(terme))
    );
  }, [tablesEnCours, dateOkPourEnCours, searchTerm]);

  const totalEnCours = tablesEnCoursAffichees.reduce((s, t) => s + t.TOTAL, 0);
  const nbArticlesEnCours = tablesEnCoursAffichees.reduce((s, t) => s + t.NB_ARTICLES, 0);

  // Tables en cours masquées par le filtre de date (elles n'ont pas de date de vente)
  const tablesEnCoursMasquees = !dateOkPourEnCours && tablesEnCours.length > 0;

  // Total des ventes non clôturées actuellement affichées
  const totalVentesAffichees = filteredVentes
    .filter(v => v.STATUT === 'Payée')
    .reduce((s, v) => s + v.TOTAL - v.REMISE, 0);

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
      <div>Type: ${typeLabel(vente).texte}</div>
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

  // Imprimer le bon de la table en cours (non payée) — pour contrôle / suivi
  const printTableEnCours = (t: TableEnCours) => {
    const serveur = personnel.find(p => p.IDPERSONNEL === t.IDCAISSIER);
    const rows = t.items.map(i =>
      `<tr><td>${i.NOM}</td><td class="right">${i.QUANTITE}</td><td class="right">${formatAr(i.PRIX_UNITAIRE)}</td><td class="right">${formatAr(i.QUANTITE * i.PRIX_UNITAIRE)}</td></tr>`
    ).join('');

    printTicket(`
      <div class="center bold">COMMANDE TABLE</div>
      <div class="center bold">*** NON PAYEE ***</div>
      <div>Table: ${t.NUMERO} - ${t.DESCRIPTION}</div>
      <div class="row"><span>${today()}</span><span>${t.HEURE}</span></div>
      ${serveur ? `<div>Serveur: ${serveur.PRENOM} ${serveur.NOM}</div>` : ''}
      <div class="line"></div>
      <table>
        <tr><td class="bold">Article</td><td class="bold right">Qté</td><td class="bold right">PU</td><td class="bold right">Mt</td></tr>
        ${rows}
      </table>
      <div class="line"></div>
      <div class="row"><span>Total articles</span><span>${t.NB_ARTICLES}</span></div>
      <div class="row bold"><span>TOTAL A PAYER</span><span>${formatAr(t.TOTAL)}</span></div>
    `, true);
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🧾 Ventes</h1>
      </div>

      {/* KPI : ce qui reste à encaisser + ventes non clôturées affichées */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-xs border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Ventes affichées (non clôturées)</p>
          <p className="text-lg sm:text-xl font-extrabold text-[#0D47A1] mt-0.5 tabular-nums">{formatAr(totalVentesAffichees)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{filteredVentes.length} vente(s)</p>
        </div>
        <div className={`rounded-2xl p-3.5 sm:p-4 shadow-xs border ${
          tablesEnCours.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'
        }`}>
          <p className={`text-xs font-medium ${tablesEnCours.length > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
            Tables en cours — à encaisser
          </p>
          <p className={`text-lg sm:text-xl font-extrabold mt-0.5 tabular-nums ${
            tablesEnCours.length > 0 ? 'text-amber-700' : 'text-gray-400'
          }`}>
            {formatAr(tablesEnCours.reduce((s, t) => s + t.TOTAL, 0))}
          </p>
          <p className={`text-[11px] mt-0.5 font-medium ${tablesEnCours.length > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
            {tablesEnCours.length} table{tablesEnCours.length > 1 ? 's' : ''} · {tablesEnCours.reduce((s, t) => s + t.NB_ARTICLES, 0)} article{tablesEnCours.reduce((s, t) => s + t.NB_ARTICLES, 0) > 1 ? 's' : ''}
          </p>
        </div>
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
                placeholder="Rechercher par n° facture ou n° de table..."
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
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              title="Afficher toutes les dates"
            >
              Toutes les dates
            </button>
          )}
        </div>
      </div>

      {/* Tables en cours masquées par le filtre de date */}
      {tablesEnCoursMasquees && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-800 font-medium">
            ⏳ {tablesEnCours.length} table{tablesEnCours.length > 1 ? 's' : ''} en cours non payée{tablesEnCours.length > 1 ? 's' : ''}
            {' '}(<b className="tabular-nums">{formatAr(tablesEnCours.reduce((s, t) => s + t.TOTAL, 0))}</b>)
            — masquée{tablesEnCours.length > 1 ? 's' : ''} par le filtre de date.
          </p>
          <button
            onClick={() => setDateFilter(today())}
            className="shrink-0 text-xs font-bold px-3 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 active:scale-95 transition-transform"
          >
            Voir aujourd'hui
          </button>
        </div>
      )}

      {/* Bandeau : tables en cours non encaissées */}
      {tablesEnCoursAffichees.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 sm:p-4 flex items-start gap-3">
          <UtensilsCrossed className="text-amber-600 shrink-0 mt-0.5" size={20} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-amber-800 text-sm">
              {tablesEnCoursAffichees.length} table{tablesEnCoursAffichees.length > 1 ? 's' : ''} en cours — pas encore payée{tablesEnCoursAffichees.length > 1 ? 's' : ''} à la caisse
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              ⏳ {nbArticlesEnCours} article{nbArticlesEnCours > 1 ? 's' : ''} servi{nbArticlesEnCours > 1 ? 's' : ''} ·
              en attente d'encaissement : <b className="tabular-nums">{formatAr(totalEnCours)}</b>
            </p>
            <p className="text-[11px] text-amber-600 mt-1">
              L'encaissement se fait depuis le module <b>Tables</b> ou la <b>Caisse POS</b>.
            </p>
          </div>
        </div>
      )}

      {/* Liste des ventes : Vue Cartes sur Mobile */}
      <div className="md:hidden space-y-3">
        {/* Tables en cours (non payées) */}
        {tablesEnCoursAffichees.map(t => {
          const serveur = personnel.find(p => p.IDPERSONNEL === t.IDCAISSIER);
          return (
            <div key={`m-encours-${t.IDTABLE}`} className="bg-amber-50 rounded-2xl p-3.5 border border-amber-200 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-amber-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Table {t.NUMERO}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-200 text-amber-800">
                  Non payée
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-amber-700 font-medium pt-1 border-t border-amber-200/70">
                <span>{t.HEURE ? `Depuis ${t.HEURE}` : 'En cours'} · {t.NB_ARTICLES} article{t.NB_ARTICLES > 1 ? 's' : ''}</span>
                <span>{serveur ? serveur.PRENOM : t.DESCRIPTION}</span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-base font-extrabold text-amber-900 tabular-nums">{formatAr(t.TOTAL)}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedTableEnCours(t)}
                    className="p-2 min-h-[38px] min-w-[38px] rounded-xl bg-white text-amber-800 border border-amber-200 hover:bg-amber-100 flex items-center justify-center active:scale-95"
                    title="Voir les articles servis"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => printTableEnCours(t)}
                    className="p-2 min-h-[38px] min-w-[38px] rounded-xl bg-white text-amber-800 border border-amber-200 hover:bg-amber-100 flex items-center justify-center active:scale-95"
                    title="Imprimer la commande"
                  >
                    <Printer size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

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
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 font-medium pt-1 border-t border-gray-100">
                <span>{dateLabel(v.DATE_VENTE)} · {v.HEURE}</span>
                <span>{caissier?.PRENOM} ({typeLabel(v).texte})</span>
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
        {filteredVentes.length === 0 && tablesEnCoursAffichees.length === 0 && (
          <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-gray-100">
            <p className="font-medium">Aucune vente trouvée</p>
            <p className="text-xs mt-1">Les ventes clôturées sont archivées dans le module Clôture</p>
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
              {/* Tables en cours : pas encore encaissées → pas de n° de facture */}
              {tablesEnCoursAffichees.map(t => {
                const serveur = personnel.find(p => p.IDPERSONNEL === t.IDCAISSIER);
                return (
                  <tr key={`encours-${t.IDTABLE}`} className="border-t border-amber-100 bg-amber-50/70 hover:bg-amber-50">
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center gap-1.5 font-bold text-amber-800 text-xs">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        En cours
                      </span>
                      <p className="text-[11px] text-amber-600 font-medium mt-0.5">Non facturée</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-amber-800 font-medium">
                      {t.HEURE ? `Aujourd'hui ${t.HEURE}` : "Aujourd'hui"}
                    </td>
                    <td className="px-4 py-3 text-sm text-amber-800">
                      {serveur?.PRENOM || '-'}
                      {user.ROLE === 'Caissier' && t.IDCAISSIER !== user.IDPERSONNEL && (
                        <span className="block text-[10px] text-amber-600 font-medium">autre caissier</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-200 text-amber-900">
                        <UtensilsCrossed size={13} />
                        Table {t.NUMERO}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-amber-900 tabular-nums">{formatAr(t.TOTAL)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">-</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-200 text-amber-900 font-bold">Non payée</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedTableEnCours(t)}
                          className="p-1.5 rounded-lg hover:bg-amber-100"
                          title="Voir les articles servis"
                        >
                          <Eye size={16} className="text-amber-700" />
                        </button>
                        <button
                          onClick={() => printTableEnCours(t)}
                          className="p-1.5 rounded-lg hover:bg-amber-100"
                          title="Imprimer la commande (non payée)"
                        >
                          <Printer size={16} className="text-amber-700" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredVentes.map(v => {
                const caissier = personnel.find(p => p.IDPERSONNEL === v.IDPERSONNEL);
                return (
                  <tr key={v.IDVENTE} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-sm">{v.NUMERO_FACTURE}</td>
                    <td className="px-4 py-3 text-sm">
                      {dateLabel(v.DATE_VENTE)} {v.HEURE}
                    </td>
                    <td className="px-4 py-3 text-sm">{caissier?.PRENOM}</td>
                    <td className="px-4 py-3 text-sm">
                      {(() => {
                        const t = typeLabel(v);
                        return t.surTable ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-[#0D47A1]">
                            <UtensilsCrossed size={13} />
                            {t.texte}
                          </span>
                        ) : (
                          <span className="text-gray-600 font-medium">{t.texte}</span>
                        );
                      })()}
                    </td>
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
              {filteredVentes.length === 0 && tablesEnCoursAffichees.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400">
                    <p className="font-medium">Aucune vente trouvée</p>
                    <p className="text-xs mt-1">Les ventes clôturées sont archivées dans le module Clôture</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal détails : table en cours (non payée) */}
      {selectedTableEnCours && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
            <div className="bg-amber-500 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                <UtensilsCrossed size={18} /> Table {selectedTableEnCours.NUMERO} — {selectedTableEnCours.DESCRIPTION}
              </h3>
              <button onClick={() => setSelectedTableEnCours(null)} className="p-1 rounded-lg hover:bg-white/20">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">⏳ Pas encore payée à la caisse</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  {selectedTableEnCours.HEURE ? `Servie depuis ${selectedTableEnCours.HEURE} · ` : ''}
                  {selectedTableEnCours.NB_ARTICLES} article{selectedTableEnCours.NB_ARTICLES > 1 ? 's' : ''}
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-3.5 sm:p-4 border border-gray-100">
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-2.5">Articles servis</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedTableEnCours.items.map((i, idx) => (
                    <div key={`${i.IDARTICLE}-${i.PRIX_UNITAIRE}-${idx}`} className="flex justify-between items-center text-xs sm:text-sm py-1 border-b border-gray-200/50 last:border-0">
                      <span className="font-medium text-gray-800">
                        {i.EMOJI && <span className="mr-1">{i.EMOJI}</span>}
                        {i.QUANTITE}x {i.NOM}
                        <span className="text-gray-400 ml-1">({formatAr(i.PRIX_UNITAIRE)})</span>
                      </span>
                      <span className="font-bold text-gray-900 tabular-nums">{formatAr(i.QUANTITE * i.PRIX_UNITAIRE)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-3 flex justify-between text-base sm:text-lg font-extrabold text-amber-700">
                <span>Total à payer</span>
                <span className="tabular-nums">{formatAr(selectedTableEnCours.TOTAL)}</span>
              </div>

              <p className="text-[11px] text-gray-500 text-center">
                Pour encaisser cette table, utilisez le module <b>Tables</b> ou la <b>Caisse POS</b>.
              </p>

              <button
                onClick={() => printTableEnCours(selectedTableEnCours)}
                className="w-full bg-amber-500 text-white py-3.5 rounded-xl font-bold hover:bg-amber-600 flex items-center justify-center gap-2 min-h-[46px] active:scale-[0.98] shadow-sm transition-all"
              >
                <Printer size={18} />
                Imprimer la commande
              </button>
            </div>
          </div>
        </div>
      )}

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

              <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs sm:text-sm ${
                typeLabel(selectedVente).surTable
                  ? 'bg-blue-50 border-blue-100'
                  : 'bg-gray-50 border-gray-100'
              }`}>
                <UtensilsCrossed size={15} className={typeLabel(selectedVente).surTable ? 'text-[#0D47A1]' : 'text-gray-400'} />
                <span className="text-gray-500 font-medium">Type :</span>
                <span className={`font-bold ${typeLabel(selectedVente).surTable ? 'text-[#0D47A1]' : 'text-gray-700'}`}>
                  {typeLabel(selectedVente).texte}
                </span>
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
