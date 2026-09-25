// ============================================
// STORE MYSQL BAR POS v4.3
// L'API PHP/XML est la source de vérité. Le mode local n'est autorisé
// qu'en développement Vite ; le build WAMP refuse tout repli silencieux.
// ============================================

import {
  Societe, Personnel, Famille, Article, TableR, Client,
  Fournisseur, Vente, LigneVente, Paiement, Cloture,
  Mouvement, Achat, LigneAchat, Inventaire, LigneInventaire, Consommation,
} from './types';
import { globalToast } from './utils/globalToast';

type Row = Record<string, unknown>;
type DatasetName =
  | 'societe' | 'personnel' | 'familles' | 'articles' | 'tables'
  | 'clients' | 'fournisseurs' | 'ventes' | 'lignes_vente'
  | 'paiements' | 'clotures' | 'mouvements' | 'achats'
  | 'lignes_achat' | 'inventaires' | 'lignes_inventaire'
  | 'consommations';

const API_URL = new URL('api/index.php', document.baseURI).toString();
const ALLOW_LOCAL_FALLBACK = import.meta.env.DEV;

const SEED_SOCIETE: Societe = {
  NOM: 'Bar POS',
  ADRESSE: 'Antananarivo, Madagascar',
  TELEPHONE: '034 00 000 00',
  EMAIL: 'contact@barpos.mg',
  LOGO_EMOJI: '🍺',
  LOGO_TYPE: 'emoji',
  UTILISER_IMPRIMANTE: true,
};

const SEED_PERSONNEL: Personnel[] = [
  { IDPERSONNEL: 1, NOM: 'Admin', PRENOM: 'Super', LOGIN: 'admin', MOT_DE_PASSE: 'admin123', ROLE: 'Administrateur', ACTIF: true },
  { IDPERSONNEL: 2, NOM: 'Gérant', PRENOM: 'Principal', LOGIN: 'gerant', MOT_DE_PASSE: 'gerant123', ROLE: 'Gérant', ACTIF: true },
  { IDPERSONNEL: 3, NOM: 'Caisse', PRENOM: 'Jean', LOGIN: 'caisse1', MOT_DE_PASSE: '1234', ROLE: 'Caissier', ACTIF: true },
  { IDPERSONNEL: 4, NOM: 'Caisse', PRENOM: 'Marie', LOGIN: 'caisse2', MOT_DE_PASSE: '1234', ROLE: 'Caissier', ACTIF: true },
  { IDPERSONNEL: 5, NOM: 'Magasin', PRENOM: 'Paul', LOGIN: 'magasin', MOT_DE_PASSE: '1234', ROLE: 'Magasinier', ACTIF: true },
  { IDPERSONNEL: 6, NOM: 'Serveur', PRENOM: 'Luc', LOGIN: 'serveur', MOT_DE_PASSE: '1234', ROLE: 'Serveur', ACTIF: true },
];

const SEED_FAMILLES: Famille[] = [
  { IDFAMILLE: 1, CODE: 'BIE', FAMILLE: 'Bières', COULEUR: '#F59E0B', ORDRE: 1 },
  { IDFAMILLE: 2, CODE: 'SPI', FAMILLE: 'Spiritueux', COULEUR: '#8B5CF6', ORDRE: 2 },
  { IDFAMILLE: 3, CODE: 'SOF', FAMILLE: 'Softs', COULEUR: '#10B981', ORDRE: 3 },
  { IDFAMILLE: 4, CODE: 'SNA', FAMILLE: 'Snacks', COULEUR: '#EC4899', ORDRE: 4 },
];

const SEED_ARTICLES: Article[] = [
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

const SEED_TABLES: TableR[] = [
  { IDTABLE: 1, NUMERO: 1, DESCRIPTION: 'Terrasse 1', PLACES: 4, ETAT: 'Libre' },
  { IDTABLE: 2, NUMERO: 2, DESCRIPTION: 'Terrasse 2', PLACES: 4, ETAT: 'Libre' },
  { IDTABLE: 3, NUMERO: 3, DESCRIPTION: 'Intérieur 1', PLACES: 6, ETAT: 'Libre' },
  { IDTABLE: 4, NUMERO: 4, DESCRIPTION: 'Intérieur 2', PLACES: 6, ETAT: 'Libre' },
  { IDTABLE: 5, NUMERO: 5, DESCRIPTION: 'VIP', PLACES: 8, ETAT: 'Libre' },
];

const SEED_FOURNISSEURS: Fournisseur[] = [
  { IDFOURNISSEUR: 1, NOM: 'STAR Beverages', ADRESSE: 'Ankorondrano', TELEPHONE: '020 22 000 00' },
  { IDFOURNISSEUR: 2, NOM: 'Dzama Company', ADRESSE: 'Nosy Be', TELEPHONE: '020 86 000 00' },
];

const SEED_CLIENTS: Client[] = [
  { IDCLIENT: 1, NOM_CLIENT: 'Bertrand', TELEPHONE: '038 34 092 61', ADRESSE: 'Antananarivo', CREDIT_TOTAL: 0, DATE_CREATION: '2025-01-01' },
];

let lastError = '';

// Helper local storage
function getLocalDataset<T>(name: DatasetName, seed: T[]): T[] {
  try {
    const raw = localStorage.getItem(`barpos_${name}`);
    if (raw) return JSON.parse(raw) as T[];
    localStorage.setItem(`barpos_${name}`, JSON.stringify(seed));
    return seed;
  } catch {
    return seed;
  }
}

function setLocalDataset<T>(name: DatasetName, data: T[]): void {
  try {
    localStorage.setItem(`barpos_${name}`, JSON.stringify(data));
  } catch (e) {
    console.error('Erreur sauvegarde locale barpos:', e);
  }
}

const escapeXml = (value: unknown): string => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Erreur de communication avec MySQL';

const rowsToXml = (rows: Row[]): string => rows.map(row => {
  const fields = Object.entries(row).map(([name, value]) => {
    if (value === null || value === undefined) {
      return `<field name="${escapeXml(name)}" null="1"/>`;
    }
    const type = typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string';
    const content = type === 'boolean' ? (value ? '1' : '0') : escapeXml(value);
    return `<field name="${escapeXml(name)}" type="${type}">${content}</field>`;
  }).join('');
  return `<row>${fields}</row>`;
}).join('');

const parseRows = (root: Element): Row[] => {
  const rowsContainer = Array.from(root.children).find(child => child.tagName === 'rows');
  if (!rowsContainer) return [];

  return Array.from(rowsContainer.children)
    .filter(child => child.tagName === 'row')
    .map(rowElement => {
      const row: Row = {};
      Array.from(rowElement.children)
        .filter(child => child.tagName === 'field')
        .forEach(field => {
          const name = field.getAttribute('name');
          if (!name) return;
          if (field.getAttribute('null') === '1') {
            row[name] = null;
            return;
          }
          const type = field.getAttribute('type');
          const value = field.textContent || '';
          if (type === 'number') row[name] = Number(value);
          else if (type === 'boolean') row[name] = value === '1';
          else row[name] = value;
        });
      return row;
    });
};

const sendXml = (xml: string): Element => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', API_URL, false);
  xhr.withCredentials = true;
  xhr.setRequestHeader('Content-Type', 'application/xml; charset=UTF-8');
  xhr.setRequestHeader('X-BarPOS-Request', '1');

  try {
    xhr.send(xml);
  } catch {
    throw new Error('API PHP inaccessible. Ouvrez Bar POS depuis http://localhost/logbara/ et non depuis un fichier local.');
  }

  if (xhr.status < 200 || xhr.status >= 300) {
    throw new Error(`API PHP indisponible (HTTP ${xhr.status || 0}). Vérifiez Apache et le dossier logbara.`);
  }

  const documentXml = xhr.responseXML || new DOMParser().parseFromString(xhr.responseText, 'application/xml');
  if (documentXml.querySelector('parsererror')) {
    throw new Error('Réponse XML invalide reçue depuis l’API PHP.');
  }

  const root = documentXml.documentElement;
  if (!root || root.tagName !== 'response') {
    throw new Error('Réponse inattendue reçue depuis l’API PHP.');
  }
  if (root.getAttribute('success') !== '1') {
    const message = Array.from(root.children).find(child => child.tagName === 'message')?.textContent;
    throw new Error(message || 'La requête MySQL a échoué.');
  }

  lastError = '';
  return root;
};

const request = (action: string, dataset?: DatasetName, rows?: Row[], params?: Record<string, unknown>): Row[] => {
  const datasetAttribute = dataset ? ` dataset="${escapeXml(dataset)}"` : '';
  const parameters = params
    ? Object.entries(params).map(([name, value]) => `<param name="${escapeXml(name)}">${escapeXml(value)}</param>`).join('')
    : '';
  const rowsXml = rows ? `<rows>${rowsToXml(rows)}</rows>` : '';
  const root = sendXml(`<request action="${escapeXml(action)}"${datasetAttribute}><params>${parameters}</params>${rowsXml}</request>`);
  return parseRows(root);
};

const getDefaultSeedForDataset = (dataset: DatasetName): any[] => {
  switch (dataset) {
    case 'societe': return [SEED_SOCIETE];
    case 'personnel': return SEED_PERSONNEL;
    case 'familles': return SEED_FAMILLES;
    case 'articles': return SEED_ARTICLES;
    case 'tables': return SEED_TABLES;
    case 'fournisseurs': return SEED_FOURNISSEURS;
    case 'clients': return SEED_CLIENTS;
    default: return [];
  }
};

const safeRead = <T>(dataset: DatasetName, fallback: T[]): T[] => {
  try {
    const res = request('read', dataset) as T[];
    lastError = '';
    return res;
  } catch (error) {
    lastError = errorMessage(error);
    if (!ALLOW_LOCAL_FALLBACK) {
      throw error;
    }
    const seed = fallback.length > 0 ? fallback : (getDefaultSeedForDataset(dataset) as T[]);
    return getLocalDataset<T>(dataset, seed);
  }
};

const sync = <T>(dataset: DatasetName, data: T[]): void => {
  // Le build WAMP ne persiste jamais les données métier dans le navigateur.
  // Le stockage local ne sert qu'au confort du serveur Vite de développement.
  if (ALLOW_LOCAL_FALLBACK) {
    setLocalDataset(dataset, data);
  }

  try {
    request('sync', dataset, data as Row[]);
  } catch (error) {
    lastError = errorMessage(error);
    if (!ALLOW_LOCAL_FALLBACK) {
      globalToast(`Enregistrement MySQL impossible : ${lastError}`, 'error', 6000);
      throw error;
    }
  }
};

const exportAll = () => ({
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
});

export const store = {
  getLastError: (): string => lastError,

  getSociete: (): Societe => {
    const societe = safeRead<Societe>('societe', [SEED_SOCIETE])[0];
    if (societe) return societe;
    if (ALLOW_LOCAL_FALLBACK) return SEED_SOCIETE;
    throw new Error('La table societe est vide. Importez sql/barpos.sql dans barpos_db.');
  },
  setSociete: (data: Societe): void => sync('societe', [data]),

  /**
   * Multi-poste / par utilisateur :
   * Détermine si l'impression directe des tickets est activée pour un utilisateur spécifique ou ce poste.
   * Ne modifie pas la base de données partagée pour ne pas impacter les autres postes/caissiers.
   */
  isUserPrinterEnabled: (userId?: number): boolean => {
    try {
      const uid = userId || store.getSession()?.IDPERSONNEL;
      if (uid) {
        const userPref = localStorage.getItem(`barpos_printer_user_${uid}`);
        if (userPref !== null) {
          return userPref === 'true';
        }
      }
      const localPref = localStorage.getItem('barpos_printer_local');
      if (localPref !== null) {
        return localPref === 'true';
      }
    } catch (_) { /* ignore */ }
    return store.getSociete().UTILISER_IMPRIMANTE ?? true;
  },

  setUserPrinterEnabled: (enabled: boolean, userId?: number): void => {
    try {
      const uid = userId || store.getSession()?.IDPERSONNEL;
      if (uid) {
        localStorage.setItem(`barpos_printer_user_${uid}`, String(enabled));
      }
      localStorage.setItem('barpos_printer_local', String(enabled));
    } catch (_) { /* ignore */ }
  },

  getPersonnel: (): Personnel[] => safeRead<Personnel>('personnel', SEED_PERSONNEL),
  setPersonnel: (data: Personnel[]): void => sync('personnel', data),

  getFamilles: (): Famille[] => safeRead<Famille>('familles', SEED_FAMILLES),
  setFamilles: (data: Famille[]): void => sync('familles', data),

  getArticles: (): Article[] => safeRead<Article>('articles', SEED_ARTICLES),
  setArticles: (data: Article[]): void => sync('articles', data),

  getTables: (): TableR[] => safeRead<TableR>('tables', SEED_TABLES),
  setTables: (data: TableR[]): void => sync('tables', data),

  getClients: (): Client[] => safeRead<Client>('clients', SEED_CLIENTS),
  setClients: (data: Client[]): void => sync('clients', data),

  getFournisseurs: (): Fournisseur[] => safeRead<Fournisseur>('fournisseurs', SEED_FOURNISSEURS),
  setFournisseurs: (data: Fournisseur[]): void => sync('fournisseurs', data),

  getVentes: (): Vente[] => safeRead<Vente>('ventes', []),
  setVentes: (data: Vente[]): void => sync('ventes', data),

  getLignesVente: (): LigneVente[] => safeRead<LigneVente>('lignes_vente', []),
  setLignesVente: (data: LigneVente[]): void => sync('lignes_vente', data),

  getPaiements: (): Paiement[] => safeRead<Paiement>('paiements', []),
  setPaiements: (data: Paiement[]): void => sync('paiements', data),

  getClotures: (): Cloture[] => safeRead<Cloture>('clotures', []),
  setClotures: (data: Cloture[]): void => sync('clotures', data),

  getMouvements: (): Mouvement[] => safeRead<Mouvement>('mouvements', []),
  setMouvements: (data: Mouvement[]): void => sync('mouvements', data),

  getAchats: (): Achat[] => safeRead<Achat>('achats', []),
  setAchats: (data: Achat[]): void => sync('achats', data),

  getLignesAchat: (): LigneAchat[] => safeRead<LigneAchat>('lignes_achat', []),
  setLignesAchat: (data: LigneAchat[]): void => sync('lignes_achat', data),

  getInventaires: (): Inventaire[] => safeRead<Inventaire>('inventaires', []),
  setInventaires: (data: Inventaire[]): void => sync('inventaires', data),

  getLignesInventaire: (): LigneInventaire[] => safeRead<LigneInventaire>('lignes_inventaire', []),
  setLignesInventaire: (data: LigneInventaire[]): void => sync('lignes_inventaire', data),

  getConsommations: (): Consommation[] => safeRead<Consommation>('consommations', []),
  setConsommations: (data: Consommation[]): void => sync('consommations', data),

  getSession: (): Personnel | null => {
    try {
      const rows = request('session');
      if (rows.length > 0) return rows[0] as unknown as Personnel;
      if (!ALLOW_LOCAL_FALLBACK) return null;
    } catch (error) {
      lastError = errorMessage(error);
      if (!ALLOW_LOCAL_FALLBACK) {
        throw error;
      }
      // Le serveur Vite peut fonctionner sans Apache/PHP pendant le développement.
    }

    try {
      const saved = localStorage.getItem('barpos_session');
      return saved ? (JSON.parse(saved) as Personnel) : null;
    } catch {
      return null;
    }
  },

  setSession: (data: Personnel | null): void => {
    if (!ALLOW_LOCAL_FALLBACK) return;
    try {
      if (data) localStorage.setItem('barpos_session', JSON.stringify(data));
      else localStorage.removeItem('barpos_session');
    } catch (_) { /* ignore */ }
  },

  authenticate: (login: string, password: string): Personnel | null => {
    try {
      const rows = request('authenticate', undefined, undefined, { login, password });
      // Une réponse vide est une authentification réellement refusée : elle ne
      // doit jamais être remplacée par un compte de démonstration en production.
      if (rows.length > 0) return rows[0] as unknown as Personnel;
      if (!ALLOW_LOCAL_FALLBACK) return null;
    } catch (error) {
      lastError = errorMessage(error);
      if (!ALLOW_LOCAL_FALLBACK) {
        throw error;
      }
      // Fallback de démonstration uniquement avec le serveur Vite.
    }

    const allPersonnel = store.getPersonnel();
    const user = allPersonnel.find(
      p => p.LOGIN.toLowerCase() === login.trim().toLowerCase() && p.ACTIF
    );

    if (!user) return null;

    // Check default or plain password matches
    const validPasswords = ['admin123', 'gerant123', '1234', 'admin', 'gerant', user.MOT_DE_PASSE];
    if (validPasswords.includes(password.trim()) || user.MOT_DE_PASSE.includes(password.trim())) {
      store.setSession(user);
      return user;
    }

    return null;
  },

  logout: (): void => {
    try {
      request('logout');
    } catch {
      // ignore
    }
    store.setSession(null);
  },

  getStockAlerts: (): number => store.getArticles()
    .filter(article => article.ACTIF && article.GERE_STOCK && article.STOCK <= article.STOCK_MIN).length,

  resetAll: (): void => {
    try {
      request('reset');
    } catch (error) {
      lastError = errorMessage(error);
      if (!ALLOW_LOCAL_FALLBACK) {
        throw error;
      }
    }
    if (!ALLOW_LOCAL_FALLBACK) return;

    const datasets: DatasetName[] = [
      'societe', 'personnel', 'familles', 'articles', 'tables',
      'clients', 'fournisseurs', 'ventes', 'lignes_vente',
      'paiements', 'clotures', 'mouvements', 'achats',
      'lignes_achat', 'inventaires', 'lignes_inventaire', 'consommations'
    ];
    datasets.forEach(d => {
      try { localStorage.removeItem(`barpos_${d}`); } catch (_) {}
    });
    store.getSociete();
    store.getPersonnel();
    store.getFamilles();
    store.getArticles();
    store.getTables();
    store.getFournisseurs();
    store.getClients();
  },

  exportAll,
  exportSQL: (): string => {
    try {
      const root = sendXml('<request action="backup"><params/></request>');
      return Array.from(root.children).find(child => child.tagName === 'content')?.textContent || '';
    } catch (error) {
      lastError = errorMessage(error);
      if (!ALLOW_LOCAL_FALLBACK) {
        throw error;
      }
      return JSON.stringify(exportAll(), null, 2);
    }
  },
};
