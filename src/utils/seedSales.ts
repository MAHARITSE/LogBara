/**
 * Générateur de données de ventes et d'achats aléatoires et réalistes sur 3 mois
 * Développeur: MAHARITSE Hiacinthe Bertrand
 */

import { store } from '../store';
import { Vente, LigneVente, Paiement, Article, Personnel, TableR, Achat, LigneAchat } from '../types';

/**
 * Génère un historique de ventes et d'achats réalistes pour une période de 3 mois (90 jours)
 * @param months Nombre de mois (par défaut 3 = 90 jours)
 * @param append Si true, ajoute aux données existantes ; si false, remplace l'historique
 */
export function generateRandomSales(months = 3, append = false): {
  countVentes: number;
  totalCa: number;
  countAchats: number;
  totalAchats: number;
} {
  const articles: Article[] = store.getArticles().filter(a => a.ACTIF);
  const personnel: Personnel[] = store.getPersonnel().filter(p => p.ACTIF);
  const tables: TableR[] = store.getTables();
  const fournisseurs = store.getFournisseurs();

  if (articles.length === 0 || personnel.length === 0) {
    return { countVentes: 0, totalCa: 0, countAchats: 0, totalAchats: 0 };
  }

  const existingVentes = append ? store.getVentes() : [];
  const existingLignes = append ? store.getLignesVente() : [];
  const existingPaiements = append ? store.getPaiements() : [];
  const existingAchats = append ? store.getAchats() : [];
  const existingLignesAchat = append ? store.getLignesAchat() : [];

  let startVenteId = existingVentes.length > 0 ? Math.max(...existingVentes.map(v => v.IDVENTE)) + 1 : 1;
  let startLigneId = existingLignes.length > 0 ? Math.max(...existingLignes.map(l => l.IDLIGNEVENTE)) + 1 : 1;
  let startPaiementId = existingPaiements.length > 0 ? Math.max(...existingPaiements.map(p => p.IDPAIEMENT)) + 1 : 1;
  let startAchatId = existingAchats.length > 0 ? Math.max(...existingAchats.map(a => a.IDACHAT)) + 1 : 1;
  let startLigneAchatId = existingLignesAchat.length > 0 ? Math.max(...existingLignesAchat.map(l => l.IDLIGNEACHAT)) + 1 : 1;

  const newVentes: Vente[] = [];
  const newLignes: LigneVente[] = [];
  const newPaiements: Paiement[] = [];
  const newAchats: Achat[] = [];
  const newLignesAchat: LigneAchat[] = [];

  const now = new Date();
  const totalDays = months * 30; // ~90 jours

  const modesPaiement: Array<'Espèces' | 'Mobile Money' | 'Crédit'> = ['Espèces', 'Mobile Money', 'Crédit'];
  const modeWeights = [0.70, 0.25, 0.05];

  const pickMode = (): 'Espèces' | 'Mobile Money' | 'Crédit' => {
    const r = Math.random();
    if (r < modeWeights[0]) return 'Espèces';
    if (r < modeWeights[0] + modeWeights[1]) return 'Mobile Money';
    return 'Crédit';
  };

  let globalCa = 0;
  let globalAchats = 0;

  // Boucle jour par jour depuis (aujourd'hui - 90 jours) jusqu'à aujourd'hui
  for (let dayOffset = totalDays; dayOffset >= 0; dayOffset--) {
    const currentDay = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const dateStr = currentDay.toISOString().split('T')[0];
    const dayOfWeek = currentDay.getDay();

    // === 1. GÉNÉRATION DES VENTES DU JOUR ===
    let nbVentesJour: number;
    if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
      nbVentesJour = Math.floor(Math.random() * 10) + 7; // Week-end : 7-16
    } else {
      nbVentesJour = Math.floor(Math.random() * 6) + 3;  // Semaine : 3-8
    }

    for (let i = 0; i < nbVentesJour; i++) {
      const hourNum = Math.floor(Math.random() * 14) + 10;
      const minNum = Math.floor(Math.random() * 60);
      const secNum = Math.floor(Math.random() * 60);
      const heureStr = `${String(hourNum).padStart(2, '0')}:${String(minNum).padStart(2, '0')}:${String(secNum).padStart(2, '0')}`;

      const randomCaissier = personnel[Math.floor(Math.random() * personnel.length)];
      const isTable = Math.random() > 0.4 && tables.length > 0;
      const selectedTable = isTable ? tables[Math.floor(Math.random() * tables.length)] : null;
      const typeVente: 'Comptoir' | 'Table' = selectedTable ? 'Table' : 'Comptoir';

      const nbArticlesInSale = Math.min(articles.length, Math.floor(Math.random() * 4) + 1);
      const shuffledArticles = [...articles].sort(() => 0.5 - Math.random());
      const selectedArticles = shuffledArticles.slice(0, nbArticlesInSale);

      let totalBrut = 0;
      const lignesDeCetteVente: LigneVente[] = [];

      for (const art of selectedArticles) {
        const qty = Math.floor(Math.random() * 3) + 1;
        const pu = art.PRIX_VENTE || 3000;
        const montantLigne = qty * pu;
        totalBrut += montantLigne;

        lignesDeCetteVente.push({
          IDLIGNEVENTE: startLigneId++,
          IDVENTE: startVenteId,
          IDARTICLE: art.IDARTICLE,
          QUANTITE: qty,
          PRIX_UNITAIRE: pu,
          MONTANT: montantLigne,
        });
      }

      let remise = 0;
      if (Math.random() < 0.12 && totalBrut > 10000) {
        const pct = Math.random() > 0.5 ? 0.05 : 0.10;
        remise = Math.round((totalBrut * pct) / 500) * 500;
      }

      const totalNet = Math.max(0, totalBrut - remise);
      const factureDateNum = dateStr.replace(/-/g, '');
      const numFacture = `FAC-${factureDateNum}-${String(startVenteId).padStart(4, '0')}`;

      const vente: Vente = {
        IDVENTE: startVenteId,
        NUMERO_FACTURE: numFacture,
        DATE_VENTE: dateStr,
        HEURE: heureStr,
        IDPERSONNEL: randomCaissier.IDPERSONNEL,
        IDTABLE: selectedTable ? selectedTable.IDTABLE : null,
        TYPE: typeVente,
        STATUT: 'Payée',
        TOTAL: totalNet,
        REMISE: remise,
        CLOTUREE: dayOffset > 0,
        IDCLOTURE: null,
      };

      const mode = pickMode();
      const paiement: Paiement = {
        IDPAIEMENT: startPaiementId++,
        DATE_PAIEMENT: dateStr,
        HEURE: heureStr,
        IDVENTE: startVenteId,
        IDPERSONNEL: randomCaissier.IDPERSONNEL,
        MONTANT: totalNet,
        MODE_PAIEMENT: mode,
      };

      newVentes.push(vente);
      newLignes.push(...lignesDeCetteVente);
      newPaiements.push(paiement);

      globalCa += totalNet;
      startVenteId++;
    }

    // === 2. GÉNÉRATION DES ACHATS DU JOUR (2 à 3 fois par semaine) ===
    if (dayOfWeek === 1 || dayOfWeek === 4 || Math.random() < 0.15) {
      const fourn = fournisseurs[Math.floor(Math.random() * fournisseurs.length)] || { IDFOURNISSEUR: 1 };
      const randomAcheteur = personnel[Math.floor(Math.random() * personnel.length)];
      
      const nbArticlesAchat = Math.floor(Math.random() * 3) + 2;
      const shuffledAchatArticles = [...articles].sort(() => 0.5 - Math.random()).slice(0, nbArticlesAchat);

      let totalAchatBrut = 0;
      const lignesDeCetAchat: LigneAchat[] = [];

      for (const art of shuffledAchatArticles) {
        const qtyAchat = Math.floor(Math.random() * 40) + 10; // 10 à 50 unités
        const paUnit = art.PRIX_ACHAT || Math.round(art.PRIX_VENTE * 0.65);
        const totalLigne = qtyAchat * paUnit;
        totalAchatBrut += totalLigne;

        lignesDeCetAchat.push({
          IDLIGNEACHAT: startLigneAchatId++,
          IDACHAT: startAchatId,
          IDARTICLE: art.IDARTICLE,
          QUANTITE: qtyAchat,
          PRIX_ACHAT: paUnit,
          PRIX_VENTE: art.PRIX_VENTE,
        });
      }

      const achatRef = `ACH-${dateStr.replace(/-/g, '')}-${String(startAchatId).padStart(3, '0')}`;
      const achat: Achat = {
        IDACHAT: startAchatId,
        DATE_ACHAT: dateStr,
        REFERENCE: achatRef,
        IDFOURNISSEUR: fourn.IDFOURNISSEUR,
        TOTAL: totalAchatBrut,
        OBSERVATION: 'Réapprovisionnement stock boissons & produits',
        IDPERSONNEL: randomAcheteur.IDPERSONNEL,
        CLOTUREE: dayOffset > 0,
      };

      newAchats.push(achat);
      newLignesAchat.push(...lignesDeCetAchat);
      globalAchats += totalAchatBrut;
      startAchatId++;
    }
  }

  // Enregistrement dans le store
  const allVentes = append ? [...existingVentes, ...newVentes] : newVentes;
  const allLignes = append ? [...existingLignes, ...newLignes] : newLignes;
  const allPaiements = append ? [...existingPaiements, ...newPaiements] : newPaiements;
  const allAchats = append ? [...existingAchats, ...newAchats] : newAchats;
  const allLignesAchat = append ? [...existingLignesAchat, ...newLignesAchat] : newLignesAchat;

  store.setVentes(allVentes);
  store.setLignesVente(allLignes);
  store.setPaiements(allPaiements);
  store.setAchats(allAchats);
  store.setLignesAchat(allLignesAchat);

  return {
    countVentes: newVentes.length,
    totalCa: globalCa,
    countAchats: newAchats.length,
    totalAchats: globalAchats,
  };
}
