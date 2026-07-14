// ============================================
// STORE (LocalStorage) BAR POS v4.2
// ============================================

import { 
  Societe, Personnel, Famille, Article, TableR, Client, 
  Fournisseur, Vente, LigneVente, Paiement, Cloture, 
  Mouvement, Achat, LigneAchat, Inventaire, LigneInventaire, Consommation 
} from './types';
import { today } from './helpers';

const STORAGE_PREFIX = 'barpos_';

// Données initiales
const initialSociete: Societe = {
  NOM: 'Bar POS',
  ADRESSE: 'Antananarivo, Madagascar',
  TELEPHONE: '034 00 000 00',
  EMAIL: 'contact@barpos.mg',
  LOGO_EMOJI: '🍺',
  LOGO_TYPE: 'emoji',
  UTILISER_IMPRIMANTE: true,
};

const initialPersonnel: Personnel[] = [
  { IDPERSONNEL: 1, NOM: 'Admin', PRENOM: 'Super', LOGIN: 'admin', MOT_DE_PASSE: 'admin123', ROLE: 'Administrateur', ACTIF: true },
  { IDPERSONNEL: 2, NOM: 'Gérant', PRENOM: 'Principal', LOGIN: 'gerant', MOT_DE_PASSE: 'gerant123', ROLE: 'Gérant', ACTIF: true },
  { IDPERSONNEL: 3, NOM: 'Caisse', PRENOM: 'Jean', LOGIN: 'caisse1', MOT_DE_PASSE: '1234', ROLE: 'Caissier', ACTIF: true },
  { IDPERSONNEL: 4, NOM: 'Caisse', PRENOM: 'Marie', LOGIN: 'caisse2', MOT_DE_PASSE: '1234', ROLE: 'Caissier', ACTIF: true },
  { IDPERSONNEL: 5, NOM: 'Magasin', PRENOM: 'Paul', LOGIN: 'magasin', MOT_DE_PASSE: '1234', ROLE: 'Magasinier', ACTIF: true },
  { IDPERSONNEL: 6, NOM: 'Serveur', PRENOM: 'Luc', LOGIN: 'serveur', MOT_DE_PASSE: '1234', ROLE: 'Serveur', ACTIF: true },
];

const initialFamilles: Famille[] = [
  { IDFAMILLE: 1, CODE: 'BIE', FAMILLE: 'Bières', COULEUR: '#F59E0B', ORDRE: 1 },
  { IDFAMILLE: 2, CODE: 'SPI', FAMILLE: 'Spiritueux', COULEUR: '#8B5CF6', ORDRE: 2 },
  { IDFAMILLE: 3, CODE: 'SOF', FAMILLE: 'Softs', COULEUR: '#10B981', ORDRE: 3 },
  { IDFAMILLE: 4, CODE: 'SNA', FAMILLE: 'Snacks', COULEUR: '#EC4899', ORDRE: 4 },
];

const initialArticles: Article[] = [
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

const initialTables: TableR[] = [
  { IDTABLE: 1, NUMERO: 1, DESCRIPTION: 'Terrasse 1', PLACES: 4, ETAT: 'Libre' },
  { IDTABLE: 2, NUMERO: 2, DESCRIPTION: 'Terrasse 2', PLACES: 4, ETAT: 'Libre' },
  { IDTABLE: 3, NUMERO: 3, DESCRIPTION: 'Intérieur 1', PLACES: 6, ETAT: 'Libre' },
  { IDTABLE: 4, NUMERO: 4, DESCRIPTION: 'Intérieur 2', PLACES: 6, ETAT: 'Libre' },
  { IDTABLE: 5, NUMERO: 5, DESCRIPTION: 'VIP', PLACES: 8, ETAT: 'Libre' },
];

const initialFournisseurs: Fournisseur[] = [
  { IDFOURNISSEUR: 1, NOM: 'STAR Beverages', ADRESSE: 'Ankorondrano', TELEPHONE: '020 22 000 00' },
  { IDFOURNISSEUR: 2, NOM: 'Dzama Company', ADRESSE: 'Nosy Be', TELEPHONE: '020 86 000 00' },
];

const initialClients: Client[] = [
  { IDCLIENT: 1, NOM_CLIENT: 'Bertrand', TELEPHONE: '038 34 092 61', ADRESSE: '', CREDIT_TOTAL: 0, DATE_CREATION: today() },
];

// Fonctions utilitaires
const getItem = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const setItem = <T>(key: string, value: T): void => {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
};

// Store
export const store = {
  // Société
  getSociete: (): Societe => getItem('societe', initialSociete),
  setSociete: (data: Societe) => setItem('societe', data),

  // Personnel
  getPersonnel: (): Personnel[] => getItem('personnel', initialPersonnel),
  setPersonnel: (data: Personnel[]) => setItem('personnel', data),

  // Familles
  getFamilles: (): Famille[] => getItem('familles', initialFamilles),
  setFamilles: (data: Famille[]) => setItem('familles', data),

  // Articles
  getArticles: (): Article[] => getItem('articles', initialArticles),
  setArticles: (data: Article[]) => setItem('articles', data),

  // Tables
  getTables: (): TableR[] => getItem('tables', initialTables),
  setTables: (data: TableR[]) => setItem('tables', data),

  // Clients
  getClients: (): Client[] => getItem('clients', initialClients),
  setClients: (data: Client[]) => setItem('clients', data),

  // Fournisseurs
  getFournisseurs: (): Fournisseur[] => getItem('fournisseurs', initialFournisseurs),
  setFournisseurs: (data: Fournisseur[]) => setItem('fournisseurs', data),

  // Ventes
  getVentes: (): Vente[] => getItem('ventes', []),
  setVentes: (data: Vente[]) => setItem('ventes', data),

  // Lignes de vente
  getLignesVente: (): LigneVente[] => getItem('lignes_vente', []),
  setLignesVente: (data: LigneVente[]) => setItem('lignes_vente', data),

  // Paiements
  getPaiements: (): Paiement[] => getItem('paiements', []),
  setPaiements: (data: Paiement[]) => setItem('paiements', data),

  // Clôtures
  getClotures: (): Cloture[] => getItem('clotures', []),
  setClotures: (data: Cloture[]) => setItem('clotures', data),

  // Mouvements
  getMouvements: (): Mouvement[] => getItem('mouvements', []),
  setMouvements: (data: Mouvement[]) => setItem('mouvements', data),

  // Achats
  getAchats: (): Achat[] => getItem('achats', []),
  setAchats: (data: Achat[]) => setItem('achats', data),

  // Lignes d'achat
  getLignesAchat: (): LigneAchat[] => getItem('lignes_achat', []),
  setLignesAchat: (data: LigneAchat[]) => setItem('lignes_achat', data),

  // Inventaires
  getInventaires: (): Inventaire[] => getItem('inventaires', []),
  setInventaires: (data: Inventaire[]) => setItem('inventaires', data),

  // Lignes d'inventaire
  getLignesInventaire: (): LigneInventaire[] => getItem('lignes_inventaire', []),
  setLignesInventaire: (data: LigneInventaire[]) => setItem('lignes_inventaire', data),

  // Consommations (tables)
  getConsommations: (): Consommation[] => getItem('consommations', []),
  setConsommations: (data: Consommation[]) => setItem('consommations', data),

  // Session
  getSession: (): Personnel | null => getItem('session', null),
  setSession: (data: Personnel | null) => setItem('session', data),

  // Authentification
  authenticate: (login: string, password: string): Personnel | null => {
    const personnel = getItem<Personnel[]>('personnel', initialPersonnel);
    const user = personnel.find(p => 
      p.LOGIN.toLowerCase() === login.toLowerCase() && 
      p.MOT_DE_PASSE === password && 
      p.ACTIF
    );
    if (user) {
      const updated = personnel.map(p =>
        p.IDPERSONNEL === user.IDPERSONNEL
          ? { ...p, DERNIERE_CONNEXION: new Date().toISOString() }
          : p
      );
      setItem('personnel', updated);
      setItem('session', user);
    }
    return user || null;
  },

  // Logout
  logout: () => {
    localStorage.removeItem(STORAGE_PREFIX + 'session');
  },

  // Stock alerts count
  getStockAlerts: (): number => {
    const articles = getItem<Article[]>('articles', initialArticles);
    return articles.filter(a => a.ACTIF && a.GERE_STOCK && a.STOCK <= a.STOCK_MIN).length;
  },

  // Reset complet
  resetAll: () => {
    const keys = [
      'societe', 'personnel', 'familles', 'articles', 'tables', 'clients',
      'fournisseurs', 'ventes', 'lignes_vente', 'paiements', 'clotures',
      'mouvements', 'achats', 'lignes_achat', 'inventaires', 'lignes_inventaire', 'consommations'
    ];
    keys.forEach(k => localStorage.removeItem(STORAGE_PREFIX + k));
  },

  // Export toutes les données
  exportAll: () => ({
    societe: store.getSociete(),
    personnel: store.getPersonnel(),
    familles: store.getFamilles(),
    articles: store.getArticles(),
    tables: store.getTables(),
    clients: store.getClients(),
    fournisseurs: store.getFournisseurs(),
    ventes: store.getVentes(),
    lignes_vente: store.getLignesVente(),
    paiements: store.getPaiements(),
    clotures: store.getClotures(),
    mouvements: store.getMouvements(),
    achats: store.getAchats(),
    lignes_achat: store.getLignesAchat(),
    inventaires: store.getInventaires(),
    lignes_inventaire: store.getLignesInventaire(),
    consommations: store.getConsommations(),
  }),
};
