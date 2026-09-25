import * as XLSX from 'xlsx';
import { store } from '../store';
import { formatAr, dateLabel, today } from '../helpers';

export interface DateRange {
  debut: string;
  fin: string;
  label: string;
}

/**
 * Calcule les dates de début et de fin selon la période sélectionnée
 */
export function getPresetDateRange(preset: 'today' | 'this_month' | 'last_month' | 'last_7_days' | 'all'): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case 'today': {
      const d = today();
      return { debut: d, fin: d, label: `Aujourd'hui (${dateLabel(d)})` };
    }
    case 'last_7_days': {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      const debut = past.toISOString().slice(0, 10);
      const fin = today();
      return { debut, fin, label: `7 derniers jours (${debut} au ${fin})` };
    }
    case 'this_month': {
      const debut = new Date(y, m, 1).toISOString().slice(0, 10);
      const fin = new Date(y, m + 1, 0).toISOString().slice(0, 10);
      const monthName = new Date(y, m, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      return { debut, fin, label: `Ce mois-ci (${monthName})` };
    }
    case 'last_month': {
      const debut = new Date(y, m - 1, 1).toISOString().slice(0, 10);
      const fin = new Date(y, m, 0).toISOString().slice(0, 10);
      const monthName = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      return { debut, fin, label: `Mois précédent (${monthName})` };
    }
    case 'all':
    default: {
      return { debut: '2020-01-01', fin: '2099-12-31', label: 'Toutes les dates' };
    }
  }
}

/**
 * 1. EXPORT DES VENTES EN EXCEL :
 * - Colonnes : Date du jour, Caissier, Article vendu, Nombre, Montant, Remise, Total
 * - Regroupé jour par jour avec sous-totaux par journée et total général
 */
export function exportVentesToExcel(dateDebut: string, dateFin: string, customFilename?: string): void {
  const ventes = store.getVentes();
  const lignesVente = store.getLignesVente();
  const articles = store.getArticles();
  const personnel = store.getPersonnel();
  const familles = store.getFamilles();
  const paiements = store.getPaiements();
  const societe = store.getSociete();

  // Filtrer les ventes payées sur la période
  const filteredVentes = ventes.filter(v => 
    v.STATUT === 'Payée' && v.DATE_VENTE >= dateDebut && v.DATE_VENTE <= dateFin
  ).sort((a, b) => a.DATE_VENTE.localeCompare(b.DATE_VENTE) || a.IDVENTE - b.IDVENTE);

  const wb = XLSX.utils.book_new();

  const sheetData: (string | number)[][] = [];

  // En-tête de document
  sheetData.push([`RAPPORT DÉTAILLÉ DES VENTES - ${societe.NOM || 'BAR POS'}`]);
  sheetData.push([`Période du ${dateDebut} au ${dateFin} | Édité le ${today()} à ${new Date().toLocaleTimeString('fr-FR')}`]);
  sheetData.push([]); // Ligne vide

  // En-têtes de colonnes uniques
  sheetData.push([
    'Date du jour',
    'Caissier',
    'N° Facture',
    'Heure',
    'Article vendu',
    'Famille',
    'Prix Unitaire (Ar)',
    'Nombre',
    'Montant Brut (Ar)',
    'Remise (Ar)',
    'Total Net (Ar)',
    'Mode Paiement',
  ]);

  let totalQtyGlobal = 0;
  let totalBrutGlobal = 0;
  let totalRemiseGlobal = 0;
  let totalNetGlobal = 0;

  if (filteredVentes.length === 0) {
    sheetData.push(['Aucune vente enregistrée sur cette période']);
  }

  // Liste continue de toutes les ventes sans coupure ni répétition d'en-têtes
  filteredVentes.forEach(vente => {
    const caissier = personnel.find(p => p.IDPERSONNEL === vente.IDPERSONNEL);
    const caissierNom = caissier ? `${caissier.PRENOM} ${caissier.NOM}`.trim() : 'Inconnu';
    const lignesDeVente = lignesVente.filter(l => l.IDVENTE === vente.IDVENTE);
    const ventePaiements = paiements.filter(p => p.IDVENTE === vente.IDVENTE);
    const modePaiement = ventePaiements.map(p => p.MODE_PAIEMENT).join(', ') || 'Espèces';

    const brutVente = lignesDeVente.reduce((s, l) => s + l.QUANTITE * l.PRIX_UNITAIRE, 0);
    const remiseVente = vente.REMISE || 0;

    if (lignesDeVente.length === 0) {
      // Vente sans lignes détaillées
      const net = vente.TOTAL - remiseVente;
      sheetData.push([
        vente.DATE_VENTE,
        caissierNom,
        vente.NUMERO_FACTURE,
        vente.HEURE,
        'Vente directe',
        '-',
        vente.TOTAL,
        1,
        vente.TOTAL,
        remiseVente,
        net,
        modePaiement,
      ]);
      totalQtyGlobal += 1;
      totalBrutGlobal += vente.TOTAL;
      totalRemiseGlobal += remiseVente;
      totalNetGlobal += net;
    } else {
      lignesDeVente.forEach(ligne => {
        const article = articles.find(a => a.IDARTICLE === ligne.IDARTICLE);
        const famille = article ? familles.find(f => f.IDFAMILLE === article.IDFAMILLE) : null;
        const ligneBrut = ligne.QUANTITE * ligne.PRIX_UNITAIRE;
        // Part de remise proportionnelle
        const ligneRemise = brutVente > 0 ? Math.round((ligneBrut / brutVente) * remiseVente) : 0;
        const ligneNet = ligneBrut - ligneRemise;

        sheetData.push([
          vente.DATE_VENTE,
          caissierNom,
          vente.NUMERO_FACTURE,
          vente.HEURE,
          article?.NOM || `Article #${ligne.IDARTICLE}`,
          famille?.FAMILLE || 'Divers',
          ligne.PRIX_UNITAIRE,
          ligne.QUANTITE,
          ligneBrut,
          ligneRemise,
          ligneNet,
          modePaiement,
        ]);

        totalQtyGlobal += ligne.QUANTITE;
        totalBrutGlobal += ligneBrut;
        totalRemiseGlobal += ligneRemise;
        totalNetGlobal += ligneNet;
      });
    }
  });

  // Ligne vide puis LIGNE TOTAL GÉNÉRAL
  sheetData.push([]);
  sheetData.push([
    'TOTAL GÉNÉRAL',
    '',
    '',
    '',
    '',
    '',
    '',
    totalQtyGlobal,
    totalBrutGlobal,
    totalRemiseGlobal,
    totalNetGlobal,
    '',
  ]);

  const wsVentes = XLSX.utils.aoa_to_sheet(sheetData);

  // Définir la largeur des colonnes
  wsVentes['!cols'] = [
    { wch: 14 }, // Date
    { wch: 20 }, // Caissier
    { wch: 16 }, // N° Facture
    { wch: 10 }, // Heure
    { wch: 28 }, // Article
    { wch: 16 }, // Famille
    { wch: 16 }, // PU
    { wch: 10 }, // Nombre
    { wch: 16 }, // Montant
    { wch: 14 }, // Remise
    { wch: 16 }, // Total Net
    { wch: 16 }, // Mode Paiement
  ];

  XLSX.utils.book_append_sheet(wb, wsVentes, 'Ventes Détaillées');

  // FEUILLE 2 : SYNTHÈSE PAR CAISSIER
  const syntheseCaissierData: (string | number)[][] = [
    [`SYNTHÈSE DES VENTES PAR CAISSIER (${dateDebut} au ${dateFin})`],
    [],
    ['Caissier / Agent', 'Rôle', 'Nb Ventes', 'Quantité Articles', 'CA Brut (Ar)', 'Remises (Ar)', 'CA Net (Ar)', '% du CA Net'],
  ];

  const ventesParCaissier: Record<number, {
    nom: string;
    role: string;
    nbVentes: number;
    qtyArticles: number;
    brut: number;
    remise: number;
    net: number;
  }> = {};

  filteredVentes.forEach(v => {
    const p = personnel.find(item => item.IDPERSONNEL === v.IDPERSONNEL);
    const pId = v.IDPERSONNEL || 0;
    const pNom = p ? `${p.PRENOM} ${p.NOM}`.trim() : 'Inconnu / Caisse';
    const pRole = p?.ROLE || 'Caissier';

    if (!ventesParCaissier[pId]) {
      ventesParCaissier[pId] = {
        nom: pNom,
        role: pRole,
        nbVentes: 0,
        qtyArticles: 0,
        brut: 0,
        remise: 0,
        net: 0,
      };
    }

    const lV = lignesVente.filter(l => l.IDVENTE === v.IDVENTE);
    const brutV = lV.length > 0 ? lV.reduce((s, l) => s + l.QUANTITE * l.PRIX_UNITAIRE, 0) : v.TOTAL;
    const remV = v.REMISE || 0;
    const qV = lV.length > 0 ? lV.reduce((s, l) => s + l.QUANTITE, 0) : 1;
    const netV = Math.max(0, brutV - remV);

    ventesParCaissier[pId].nbVentes += 1;
    ventesParCaissier[pId].qtyArticles += qV;
    ventesParCaissier[pId].brut += brutV;
    ventesParCaissier[pId].remise += remV;
    ventesParCaissier[pId].net += netV;
  });

  Object.values(ventesParCaissier)
    .sort((a, b) => b.net - a.net)
    .forEach(c => {
      const pct = totalNetGlobal > 0 ? ((c.net / totalNetGlobal) * 100).toFixed(1) + ' %' : '0 %';
      syntheseCaissierData.push([
        c.nom,
        c.role,
        c.nbVentes,
        c.qtyArticles,
        c.brut,
        c.remise,
        c.net,
        pct,
      ]);
    });

  syntheseCaissierData.push([]);
  syntheseCaissierData.push([
    'TOTAL GÉNÉRAL',
    '',
    filteredVentes.length,
    totalQtyGlobal,
    totalBrutGlobal,
    totalRemiseGlobal,
    totalNetGlobal,
    '100 %',
  ]);

  const wsSyntheseCaissier = XLSX.utils.aoa_to_sheet(syntheseCaissierData);
  wsSyntheseCaissier['!cols'] = [
    { wch: 25 },
    { wch: 18 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSyntheseCaissier, 'Synthèse par Caissier');

  // FEUILLE 2 : SYNTHÈSE DES VENTES PAR ARTICLE
  const syntheseArticles: Record<number, { nom: string; famille: string; qty: number; totalBrut: number; totalNet: number }> = {};
  filteredVentes.forEach(vente => {
    const lignes = lignesVente.filter(l => l.IDVENTE === vente.IDVENTE);
    const brutVente = lignes.reduce((s, l) => s + l.QUANTITE * l.PRIX_UNITAIRE, 0);
    lignes.forEach(l => {
      if (!syntheseArticles[l.IDARTICLE]) {
        const art = articles.find(a => a.IDARTICLE === l.IDARTICLE);
        const fam = art ? familles.find(f => f.IDFAMILLE === art.IDFAMILLE) : null;
        syntheseArticles[l.IDARTICLE] = {
          nom: art?.NOM || `Article #${l.IDARTICLE}`,
          famille: fam?.FAMILLE || 'Divers',
          qty: 0,
          totalBrut: 0,
          totalNet: 0,
        };
      }
      const brut = l.QUANTITE * l.PRIX_UNITAIRE;
      const remise = brutVente > 0 ? (brut / brutVente) * (vente.REMISE || 0) : 0;
      syntheseArticles[l.IDARTICLE].qty += l.QUANTITE;
      syntheseArticles[l.IDARTICLE].totalBrut += brut;
      syntheseArticles[l.IDARTICLE].totalNet += (brut - remise);
    });
  });

  const syntheseData: (string | number)[][] = [
    [`SYNTHÈSE DES ARTICLES VENDUS (${dateDebut} au ${dateFin})`],
    [],
    ['Article', 'Famille', 'Quantité Vendue', 'Chiffre d’Affaires Brut (Ar)', 'Chiffre d’Affaires Net (Ar)', '% du CA Total'],
  ];

  Object.values(syntheseArticles)
    .sort((a, b) => b.totalNet - a.totalNet)
    .forEach(item => {
      const pct = totalNetGlobal > 0 ? ((item.totalNet / totalNetGlobal) * 100).toFixed(1) + ' %' : '0 %';
      syntheseData.push([
        item.nom,
        item.famille,
        item.qty,
        item.totalBrut,
        Math.round(item.totalNet),
        pct,
      ]);
    });

  const wsSynthese = XLSX.utils.aoa_to_sheet(syntheseData);
  wsSynthese['!cols'] = [
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
    { wch: 22 },
    { wch: 22 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSynthese, 'Synthèse Articles');

  const filename = customFilename || `barpos-ventes-${dateDebut}_au_${dateFin}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * 2. EXPORT DES ACHATS EN EXCEL :
 * - Colonnes : Date, Caissier/Acheteur, Fournisseurs, Articles, Prix unitaires, Quantités, Montants
 * - Identifier le meilleur prix fournisseur pour chaque article (avec mention explicite & mise en avant)
 * - Feuille d'analyse comparative des fournisseurs pour aider la gestion
 */
export function exportAchatsToExcel(dateDebut: string, dateFin: string, customFilename?: string): void {
  const achats = store.getAchats();
  const lignesAchat = store.getLignesAchat();
  const articles = store.getArticles();
  const fournisseurs = store.getFournisseurs();
  const personnel = store.getPersonnel();
  const familles = store.getFamilles();
  const societe = store.getSociete();

  // Filtrer les achats sur la période
  const filteredAchats = achats.filter(a => 
    a.DATE_ACHAT >= dateDebut && a.DATE_ACHAT <= dateFin
  ).sort((a, b) => a.DATE_ACHAT.localeCompare(b.DATE_ACHAT) || a.IDACHAT - b.IDACHAT);

  const wb = XLSX.utils.book_new();

  // 1. Déterminer le MEILLEUR PRIX UNITAIRE (le plus bas) pour chaque article parmi tous les achats
  const statsPrixArticle: Record<number, {
    nom: string;
    famille: string;
    meilleurPrix: number;
    fournisseurMoinsCher: string;
    pirePrix: number;
    fournisseurPlusCher: string;
    tousLesPrix: { fournisseur: string; pu: number; date: string }[];
  }> = {};

  filteredAchats.forEach(achat => {
    const lignes = lignesAchat.filter(l => l.IDACHAT === achat.IDACHAT);
    const fourn = fournisseurs.find(f => f.IDFOURNISSEUR === achat.IDFOURNISSEUR);
    const fournNom = fourn?.NOM || 'Fournisseur divers';

    lignes.forEach(ligne => {
      const art = articles.find(a => a.IDARTICLE === ligne.IDARTICLE);
      const fam = art ? familles.find(f => f.IDFAMILLE === art.IDFAMILLE) : null;
      const nomArt = art?.NOM || `Article #${ligne.IDARTICLE}`;
      const famNom = fam?.FAMILLE || 'Divers';

      if (!statsPrixArticle[ligne.IDARTICLE]) {
        statsPrixArticle[ligne.IDARTICLE] = {
          nom: nomArt,
          famille: famNom,
          meilleurPrix: ligne.PRIX_ACHAT,
          fournisseurMoinsCher: fournNom,
          pirePrix: ligne.PRIX_ACHAT,
          fournisseurPlusCher: fournNom,
          tousLesPrix: [],
        };
      }

      const st = statsPrixArticle[ligne.IDARTICLE];
      st.tousLesPrix.push({ fournisseur: fournNom, pu: ligne.PRIX_ACHAT, date: achat.DATE_ACHAT });

      if (ligne.PRIX_ACHAT < st.meilleurPrix) {
        st.meilleurPrix = ligne.PRIX_ACHAT;
        st.fournisseurMoinsCher = fournNom;
      }
      if (ligne.PRIX_ACHAT > st.pirePrix) {
        st.pirePrix = ligne.PRIX_ACHAT;
        st.fournisseurPlusCher = fournNom;
      }
    });
  });

  // FEUILLE 1 : DÉTAIL DES ACHATS
  const sheetData: (string | number)[][] = [];

  sheetData.push([`RAPPORT DÉTAILLÉ DES ACHATS - ${societe.NOM || 'BAR POS'}`]);
  sheetData.push([`Période du ${dateDebut} au ${dateFin} | Comparatif Meilleurs Prix Fournisseurs`]);
  sheetData.push([]);

  // En-têtes demandées :
  // Date , Caissier , Fournisseurs , Articles , Prix unitaires , Quantités , Montants
  sheetData.push([
    'Date',
    'Heure',
    'Réf. Achat',
    'Caissier / Acheteur',
    'Fournisseur',
    'Article',
    'Famille',
    'Prix Unitaire (Ar)',
    'Quantités',
    'Montants (Ar)',
    'Évaluation Prix Fournisseur',
  ]);

  let totalQtyGlobal = 0;
  let totalMontantGlobal = 0;

  filteredAchats.forEach(achat => {
    const acheteur = personnel.find(p => p.IDPERSONNEL === achat.IDPERSONNEL);
    const acheteurNom = acheteur ? `${acheteur.PRENOM} ${acheteur.NOM}`.trim() : 'Inconnu';
    const fourn = fournisseurs.find(f => f.IDFOURNISSEUR === achat.IDFOURNISSEUR);
    const fournNom = fourn?.NOM || 'Fournisseur direct';
    const lignes = lignesAchat.filter(l => l.IDACHAT === achat.IDACHAT);

    if (lignes.length === 0) {
      sheetData.push([
        achat.DATE_ACHAT,
        '12:00',
        achat.REFERENCE || `ACH-${achat.IDACHAT}`,
        acheteurNom,
        fournNom,
        achat.OBSERVATION || 'Achat global',
        '-',
        achat.TOTAL || 0,
        1,
        achat.TOTAL || 0,
        '-',
      ]);
      totalQtyGlobal += 1;
      totalMontantGlobal += (achat.TOTAL || 0);
    } else {
      lignes.forEach(ligne => {
        const art = articles.find(a => a.IDARTICLE === ligne.IDARTICLE);
        const fam = art ? familles.find(f => f.IDFAMILLE === art.IDFAMILLE) : null;
        const montantLigne = ligne.QUANTITE * ligne.PRIX_ACHAT;

        const statArt = statsPrixArticle[ligne.IDARTICLE];
        const isMeilleurPrix = statArt && ligne.PRIX_ACHAT <= statArt.meilleurPrix;

        const evalPrix = isMeilleurPrix 
          ? `★ MEILLEUR PRIX (${formatAr(ligne.PRIX_ACHAT)})`
          : `Prix supérieur (+${formatAr(ligne.PRIX_ACHAT - (statArt?.meilleurPrix || 0))})`;

        sheetData.push([
          achat.DATE_ACHAT,
          '12:00',
          achat.REFERENCE || `ACH-${achat.IDACHAT}`,
          acheteurNom,
          isMeilleurPrix ? `★ ${fournNom} [MEILLEUR PRIX]` : fournNom,
          art?.NOM || `Article #${ligne.IDARTICLE}`,
          fam?.FAMILLE || 'Divers',
          ligne.PRIX_ACHAT,
          ligne.QUANTITE,
          montantLigne,
          evalPrix,
        ]);

        totalQtyGlobal += ligne.QUANTITE;
        totalMontantGlobal += montantLigne;
      });
    }
  });

  // LIGNE TOTAL ACHATS
  sheetData.push([]);
  sheetData.push([
    '*** TOTAL DES ACHATS DE LA PÉRIODE ***',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    totalQtyGlobal,
    totalMontantGlobal,
    '',
  ]);

  const wsAchats = XLSX.utils.aoa_to_sheet(sheetData);
  wsAchats['!cols'] = [
    { wch: 14 }, // Date
    { wch: 10 }, // Heure
    { wch: 16 }, // Réf Achat
    { wch: 20 }, // Caissier / Acheteur
    { wch: 28 }, // Fournisseur
    { wch: 26 }, // Article
    { wch: 16 }, // Famille
    { wch: 16 }, // Prix Unitaire
    { wch: 12 }, // Quantités
    { wch: 18 }, // Montants
    { wch: 32 }, // Évaluation Prix
  ];

  XLSX.utils.book_append_sheet(wb, wsAchats, 'Détail Achats');

  // FEUILLE 2 : COMPARATIF DES MEILLEURS FOURNISSEURS PAR ARTICLE
  const comparatifData: (string | number)[][] = [
    ['COMPARATIF DES FOURNISSEURS - PALMARÈS DES MEILLEURS PRIX D\'ACHAT'],
    [`Période analysée du ${dateDebut} au ${dateFin}`],
    [],
    [
      'Article',
      'Famille',
      'Meilleur Fournisseur (Moins Cher)',
      'Meilleur Prix d\'Achat (Ar)',
      'Fournisseur le Plus Cher',
      'Prix d\'Achat Max (Ar)',
      'Écart / Économie Potentielle par Unité (Ar)',
      'Recommandation Négociation / Achat',
    ],
  ];

  Object.values(statsPrixArticle)
    .sort((a, b) => a.nom.localeCompare(b.nom))
    .forEach(item => {
      const ecart = item.pirePrix - item.meilleurPrix;
      const recommandation = ecart > 0
        ? `Acheter prioritairement chez ${item.fournisseurMoinsCher} (gain de ${formatAr(ecart)} / unité)`
        : `Prix unique constaté (${item.fournisseurMoinsCher})`;

      comparatifData.push([
        item.nom,
        item.famille,
        `✓ ${item.fournisseurMoinsCher}`,
        item.meilleurPrix,
        ecart > 0 ? item.fournisseurPlusCher : '-',
        item.pirePrix,
        ecart,
        recommandation,
      ]);
    });

  const wsComparatif = XLSX.utils.aoa_to_sheet(comparatifData);
  wsComparatif['!cols'] = [
    { wch: 28 }, // Article
    { wch: 16 }, // Famille
    { wch: 32 }, // Meilleur Fournisseur
    { wch: 22 }, // Meilleur Prix
    { wch: 30 }, // Fournisseur Plus Cher
    { wch: 20 }, // Prix Max
    { wch: 24 }, // Écart
    { wch: 50 }, // Recommandation
  ];

  XLSX.utils.book_append_sheet(wb, wsComparatif, 'Comparatif Fournisseurs');

  const filename = customFilename || `barpos-achats-fournisseurs-${dateDebut}_au_${dateFin}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * 3. EXPORT PACK COMPLET (VENTES + ACHATS DANS UN SEUL WORKBOOK EXCEL)
 */
export function exportPackCompletToExcel(dateDebut: string, dateFin: string): void {
  // Exporte ventes et achats combinés
  exportVentesToExcel(dateDebut, dateFin, `barpos-rapport-ventes-${dateDebut}_au_${dateFin}.xlsx`);
  setTimeout(() => {
    exportAchatsToExcel(dateDebut, dateFin, `barpos-rapport-achats-fournisseurs-${dateDebut}_au_${dateFin}.xlsx`);
  }, 400);
}
