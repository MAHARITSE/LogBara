// Store localStorage pour l'application POS
import { Societe, Personnel, Famille, Article, TableR, Client, Fournisseur, Vente, LigneVente, Paiement, Mouvement, Achat, LigneAchat, Inventaire, LigneInventaire, Cloture, ConsommationTable } from './types';
import { today } from './helpers';

const KEYS = {
  SOCIETE: 'pos_societe',
  PERSONNEL: 'pos_personnel',
  FAMILLES: 'pos_familles',
  ARTICLES: 'pos_articles',
  TABLES: 'pos_tables',
  CLIENTS: 'pos_clients',
  FOURNISSEURS: 'pos_fournisseurs',
  VENTES: 'pos_ventes',
  LIGNES_VENTE: 'pos_lignes_vente',
  PAIEMENTS: 'pos_paiements',
  MOUVEMENTS: 'pos_mouvements',
  ACHATS: 'pos_achats',
  LIGNES_ACHAT: 'pos_lignes_achat',
  INVENTAIRES: 'pos_inventaires',
  LIGNES_INVENTAIRE: 'pos_lignes_inventaire',
  CLOTURES: 'pos_clotures',
  CONSOMMATIONS: 'pos_consommations',
  SESSION: 'pos_session',
};

// Données initiales
const initSociete: Societe = {
  NOM: 'Bar POS',
  ADRESSE: 'Antananarivo, Madagascar',
  TELEPHONE: '034 00 000 00',
  EMAIL: 'contact@barpos.mg',
  LOGO_EMOJI: '🍺',
  LOGO_TYPE: 'emoji',
  UTILISER_IMPRIMANTE: true,
};

const initPersonnel: Personnel[] = [
  { IDPERSONNEL: 1, NOM: 'Admin', PRENOM: 'Super', LOGIN: 'admin', MOT_DE_PASSE: 'admin123', ROLE: 'Administrateur', ACTIF: true },
  { IDPERSONNEL: 2, NOM: 'Gérant', PRENOM: 'Principal', LOGIN: 'gerant', MOT_DE_PASSE: 'gerant123', ROLE: 'Gérant', ACTIF: true },
  { IDPERSONNEL: 3, NOM: 'Caisse', PRENOM: 'Jean', LOGIN: 'caisse1', MOT_DE_PASSE: '1234', ROLE: 'Caissier', ACTIF: true },
  { IDPERSONNEL: 4, NOM: 'Caisse', PRENOM: 'Marie', LOGIN: 'caisse2', MOT_DE_PASSE: '1234', ROLE: 'Caissier', ACTIF: true },
  { IDPERSONNEL: 5, NOM: 'Magasin', PRENOM: 'Paul', LOGIN: 'magasin', MOT_DE_PASSE: '1234', ROLE: 'Magasinier', ACTIF: true },
  { IDPERSONNEL: 6, NOM: 'Serveur', PRENOM: 'Luc', LOGIN: 'serveur', MOT_DE_PASSE: '1234', ROLE: 'Serveur', ACTIF: true },
];

const initFamilles: Famille[] = [
  { IDFAMILLE: 1, CODE: 'BIE', FAMILLE: 'Bières', COULEUR: '#F59E0B', ORDRE: 1 },
  { IDFAMILLE: 2, CODE: 'SPI', FAMILLE: 'Spiritueux', COULEUR: '#8B5CF6', ORDRE: 2 },
  { IDFAMILLE: 3, CODE: 'SOF', FAMILLE: 'Softs', COULEUR: '#10B981', ORDRE: 3 },
  { IDFAMILLE: 4, CODE: 'SNA', FAMILLE: 'Snacks', COULEUR: '#EC4899', ORDRE: 4 },
];

const initArticles: Article[] = [
  { IDARTICLE: 1, CODE: 'BIE001', NOM: 'THB Pilsener', IDFAMILLE: 1, EMOJI: '🍺', PRIX_ACHAT: 3000, PRIX_VENTE: 4000, STOCK: 50, STOCK_MIN: 10, ACTIF: true, GERE_STOCK: true, SAISIE_PRIX_VENTE: false },
  { IDARTICLE: 2, CODE: 'BIE002', NOM: 'Gold', IDFAMILLE: 1, EMOJI: '🍺', PRIX_ACHAT: 3500, PRIX_VENTE: 5000, STOCK: 40, STOCK_MIN: 10, ACTIF: true, GERE_STOCK: true, SAISIE_PRIX_VENTE: false },
  { IDARTICLE: 3, CODE: 'SPI001', NOM: 'Rhum Dzama', IDFAMILLE: 2, EMOJI: '🥃', PRIX_ACHAT: 8000, PRIX_VENTE: 12000, STOCK: 20, STOCK_MIN: 5, ACTIF: true, GERE_STOCK: true, SAISIE_PRIX_VENTE: false },
  { IDARTICLE: 4, CODE: 'SPI002', NOM: 'Whisky', IDFAMILLE: 2, EMOJI: '🥃', PRIX_ACHAT: 18000, PRIX_VENTE: 25000, STOCK: 15, STOCK_MIN: 3, ACTIF: true, GERE_STOCK: true, SAISIE_PRIX_VENTE: false },
  { IDARTICLE: 5, CODE: 'SOF001', NOM: 'Coca-Cola', IDFAMILLE: 3, EMOJI: '🥤', PRIX_ACHAT: 2000, PRIX_VENTE: 3000, STOCK: 60, STOCK_MIN: 15, ACTIF: true, GERE_STOCK: true, SAISIE_PRIX_VENTE: false },
  { IDARTICLE: 6, CODE: 'SOF002', NOM: 'Eau Vive', IDFAMILLE: 3, EMOJI: '💧', PRIX_ACHAT: 800, PRIX_VENTE: 1500, STOCK: 100, STOCK_MIN: 20, ACTIF: true, GERE_STOCK: true, SAISIE_PRIX_VENTE: false },
  { IDARTICLE: 7, CODE: 'SNA001', NOM: 'Cacahuètes', IDFAMILLE: 4, EMOJI: '🥜', PRIX_ACHAT: 1000, PRIX_VENTE: 2000, STOCK: 30, STOCK_MIN: 10, ACTIF: true, GERE_STOCK: true, SAISIE_PRIX_VENTE: false },
  { IDARTICLE: 8, CODE: 'SNA002', NOM: 'Chips', IDFAMILLE: 4, EMOJI: '🍟', PRIX_ACHAT: 2000, PRIX_VENTE: 3000, STOCK: 25, STOCK_MIN: 8, ACTIF: true, GERE_STOCK: true, SAISIE_PRIX_VENTE: false },
  { IDARTICLE: 9, CODE: 'SNA003', NOM: 'Brochettes', IDFAMILLE: 4, EMOJI: '🍢', PRIX_ACHAT: 3000, PRIX_VENTE: 5000, STOCK: 0, STOCK_MIN: 0, ACTIF: true, GERE_STOCK: false, SAISIE_PRIX_VENTE: true },
  { IDARTICLE: 10, CODE: 'SNA004', NOM: 'Poulet grillé', IDFAMILLE: 4, EMOJI: '🍗', PRIX_ACHAT: 7000, PRIX_VENTE: 10000, STOCK: 0, STOCK_MIN: 0, ACTIF: true, GERE_STOCK: false, SAISIE_PRIX_VENTE: true },
];

const initTables: TableR[] = [
  { IDTABLE: 1, NUMERO: 1, DESCRIPTION: 'Terrasse 1', PLACES: 4, ETAT: 'Libre' },
  { IDTABLE: 2, NUMERO: 2, DESCRIPTION: 'Terrasse 2', PLACES: 4, ETAT: 'Libre' },
  { IDTABLE: 3, NUMERO: 3, DESCRIPTION: 'Intérieur 1', PLACES: 6, ETAT: 'Libre' },
  { IDTABLE: 4, NUMERO: 4, DESCRIPTION: 'Intérieur 2', PLACES: 6, ETAT: 'Libre' },
  { IDTABLE: 5, NUMERO: 5, DESCRIPTION: 'VIP', PLACES: 8, ETAT: 'Libre' },
];

const initFournisseurs: Fournisseur[] = [
  { IDFOURNISSEUR: 1, NOM: 'STAR Beverages', ADRESSE: 'Ankorondrano', TELEPHONE: '020 22 000 00' },
  { IDFOURNISSEUR: 2, NOM: 'Dzama Company', ADRESSE: 'Nosy Be', TELEPHONE: '020 86 000 00' },
];

const initClients: Client[] = [
  { IDCLIENT: 1, NOM_CLIENT: 'Bertrand', TELEPHONE: '038 34 092 61', CREDIT_TOTAL: 0, DATE_CREATION: today() },
];

// Helpers
const get = <T>(key: string, init: T): T => {
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return init;
    }
  }
  return init;
};

const set = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Store API
export const store = {
  isMySQL: false,

  // Société
  getSociete: (): Societe => get(KEYS.SOCIETE, initSociete),
  setSociete: (data: Societe) => set(KEYS.SOCIETE, data),

  // Personnel
  getPersonnel: (): Personnel[] => get(KEYS.PERSONNEL, initPersonnel),
  setPersonnel: (data: Personnel[]) => set(KEYS.PERSONNEL, data),

  // Familles
  getFamilles: (): Famille[] => get(KEYS.FAMILLES, initFamilles),
  setFamilles: (data: Famille[]) => set(KEYS.FAMILLES, data),

  // Articles
  getArticles: (): Article[] => get(KEYS.ARTICLES, initArticles),
  setArticles: (data: Article[]) => set(KEYS.ARTICLES, data),

  // Tables
  getTables: (): TableR[] => get(KEYS.TABLES, initTables),
  setTables: (data: TableR[]) => set(KEYS.TABLES, data),

  // Clients
  getClients: (): Client[] => get(KEYS.CLIENTS, initClients),
  setClients: (data: Client[]) => set(KEYS.CLIENTS, data),

  // Fournisseurs
  getFournisseurs: (): Fournisseur[] => get(KEYS.FOURNISSEURS, initFournisseurs),
  setFournisseurs: (data: Fournisseur[]) => set(KEYS.FOURNISSEURS, data),

  // Ventes
  getVentes: (): Vente[] => get(KEYS.VENTES, []),
  setVentes: (data: Vente[]) => set(KEYS.VENTES, data),

  // Lignes de vente
  getLignesVente: (): LigneVente[] => get(KEYS.LIGNES_VENTE, []),
  setLignesVente: (data: LigneVente[]) => set(KEYS.LIGNES_VENTE, data),

  // Paiements
  getPaiements: (): Paiement[] => get(KEYS.PAIEMENTS, []),
  setPaiements: (data: Paiement[]) => set(KEYS.PAIEMENTS, data),

  // Mouvements stock
  getMouvements: (): Mouvement[] => get(KEYS.MOUVEMENTS, []),
  setMouvements: (data: Mouvement[]) => set(KEYS.MOUVEMENTS, data),

  // Achats
  getAchats: (): Achat[] => get(KEYS.ACHATS, []),
  setAchats: (data: Achat[]) => set(KEYS.ACHATS, data),

  // Lignes d'achat
  getLignesAchat: (): LigneAchat[] => get(KEYS.LIGNES_ACHAT, []),
  setLignesAchat: (data: LigneAchat[]) => set(KEYS.LIGNES_ACHAT, data),

  // Inventaires
  getInventaires: (): Inventaire[] => get(KEYS.INVENTAIRES, []),
  setInventaires: (data: Inventaire[]) => set(KEYS.INVENTAIRES, data),

  // Lignes d'inventaire
  getLignesInventaire: (): LigneInventaire[] => get(KEYS.LIGNES_INVENTAIRE, []),
  setLignesInventaire: (data: LigneInventaire[]) => set(KEYS.LIGNES_INVENTAIRE, data),

  // Clôtures
  getClotures: (): Cloture[] => get(KEYS.CLOTURES, []),
  setClotures: (data: Cloture[]) => set(KEYS.CLOTURES, data),

  // Consommations tables
  getConsommations: (): ConsommationTable[] => get(KEYS.CONSOMMATIONS, []),
  setConsommations: (data: ConsommationTable[]) => set(KEYS.CONSOMMATIONS, data),

  // Session
  getSession: (): Personnel | null => get(KEYS.SESSION, null),
  setSession: (data: Personnel | null) => set(KEYS.SESSION, data),

  // Authentification
  authenticate: (login: string, password: string): Personnel | null => {
    const personnel = get<Personnel[]>(KEYS.PERSONNEL, initPersonnel);
    const user = personnel.find(p => p.LOGIN === login && p.MOT_DE_PASSE === password && p.ACTIF);
    if (user) {
      const updated = personnel.map(p => p.IDPERSONNEL === user.IDPERSONNEL ? { ...p, DERNIERE_CONNEXION: new Date().toISOString() } : p);
      set(KEYS.PERSONNEL, updated);
      set(KEYS.SESSION, user);
    }
    return user || null;
  },

  // Logout
  logout: () => {
    localStorage.removeItem(KEYS.SESSION);
  },

  // Export toutes les données
  exportAll: () => {
    return {
      societe: get(KEYS.SOCIETE, initSociete),
      personnel: get(KEYS.PERSONNEL, initPersonnel),
      familles: get(KEYS.FAMILLES, initFamilles),
      articles: get(KEYS.ARTICLES, initArticles),
      tables: get(KEYS.TABLES, initTables),
      clients: get(KEYS.CLIENTS, initClients),
      fournisseurs: get(KEYS.FOURNISSEURS, initFournisseurs),
      ventes: get(KEYS.VENTES, []),
      lignesVente: get(KEYS.LIGNES_VENTE, []),
      paiements: get(KEYS.PAIEMENTS, []),
      mouvements: get(KEYS.MOUVEMENTS, []),
      achats: get(KEYS.ACHATS, []),
      lignesAchat: get(KEYS.LIGNES_ACHAT, []),
      inventaires: get(KEYS.INVENTAIRES, []),
      lignesInventaire: get(KEYS.LIGNES_INVENTAIRE, []),
      clotures: get(KEYS.CLOTURES, []),
      consommations: get(KEYS.CONSOMMATIONS, []),
    };
  },

  // Import toutes les données
  importAll: (data: ReturnType<typeof store.exportAll>) => {
    if (data.societe) set(KEYS.SOCIETE, data.societe);
    if (data.personnel) set(KEYS.PERSONNEL, data.personnel);
    if (data.familles) set(KEYS.FAMILLES, data.familles);
    if (data.articles) set(KEYS.ARTICLES, data.articles);
    if (data.tables) set(KEYS.TABLES, data.tables);
    if (data.clients) set(KEYS.CLIENTS, data.clients);
    if (data.fournisseurs) set(KEYS.FOURNISSEURS, data.fournisseurs);
    if (data.ventes) set(KEYS.VENTES, data.ventes);
    if (data.lignesVente) set(KEYS.LIGNES_VENTE, data.lignesVente);
    if (data.paiements) set(KEYS.PAIEMENTS, data.paiements);
    if (data.mouvements) set(KEYS.MOUVEMENTS, data.mouvements);
    if (data.achats) set(KEYS.ACHATS, data.achats);
    if (data.lignesAchat) set(KEYS.LIGNES_ACHAT, data.lignesAchat);
    if (data.inventaires) set(KEYS.INVENTAIRES, data.inventaires);
    if (data.lignesInventaire) set(KEYS.LIGNES_INVENTAIRE, data.lignesInventaire);
    if (data.clotures) set(KEYS.CLOTURES, data.clotures);
    if (data.consommations) set(KEYS.CONSOMMATIONS, data.consommations);
  },

  // Compteurs pour stats
  getStockAlerts: (): number => {
    const articles = get<Article[]>(KEYS.ARTICLES, initArticles);
    return articles.filter(a => a.ACTIF && a.GERE_STOCK && a.STOCK <= a.STOCK_MIN).length;
  },

  getTotalRecords: (): number => {
    const articles = get<Article[]>(KEYS.ARTICLES, initArticles);
    const personnel = get<Personnel[]>(KEYS.PERSONNEL, initPersonnel);
    const familles = get<Famille[]>(KEYS.FAMILLES, initFamilles);
    const tables = get<TableR[]>(KEYS.TABLES, initTables);
    const clients = get<Client[]>(KEYS.CLIENTS, initClients);
    const fournisseurs = get<Fournisseur[]>(KEYS.FOURNISSEURS, initFournisseurs);
    const ventes = get<Vente[]>(KEYS.VENTES, []);
    const lignesVente = get<LigneVente[]>(KEYS.LIGNES_VENTE, []);
    const paiements = get<Paiement[]>(KEYS.PAIEMENTS, []);
    const mouvements = get<Mouvement[]>(KEYS.MOUVEMENTS, []);
    const achats = get<Achat[]>(KEYS.ACHATS, []);
    const lignesAchat = get<LigneAchat[]>(KEYS.LIGNES_ACHAT, []);
    const inventaires = get<Inventaire[]>(KEYS.INVENTAIRES, []);
    const lignesInventaire = get<LigneInventaire[]>(KEYS.LIGNES_INVENTAIRE, []);
    const clotures = get<Cloture[]>(KEYS.CLOTURES, []);
    const consommations = get<ConsommationTable[]>(KEYS.CONSOMMATIONS, []);
    return (
      personnel.length +
      familles.length +
      articles.length +
      tables.length +
      clients.length +
      fournisseurs.length +
      ventes.length +
      lignesVente.length +
      paiements.length +
      mouvements.length +
      achats.length +
      lignesAchat.length +
      inventaires.length +
      lignesInventaire.length +
      clotures.length +
      consommations.length
    );
  },
};
