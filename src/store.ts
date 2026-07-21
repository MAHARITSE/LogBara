// ============================================
// STORE BAR POS v4.2 — Hybride MySQL / Offline Demo
// - Tente MySQL via API PHP/XML (WAMP)
// - Fallback automatique vers localStorage / mock si API indisponible
//   → évite écran blanc au lancement hors WAMP
// ============================================

import {
  Societe, Personnel, Famille, Article, TableR, Client,
  Fournisseur, Vente, LigneVente, Paiement, Cloture,
  Mouvement, Achat, LigneAchat, Inventaire, LigneInventaire, Consommation,
} from './types';

type Row = Record<string, unknown>;
type DatasetName =
  | 'societe' | 'personnel' | 'familles' | 'articles' | 'tables'
  | 'clients' | 'fournisseurs' | 'ventes' | 'lignes_vente'
  | 'paiements' | 'clotures' | 'mouvements' | 'achats'
  | 'lignes_achat' | 'inventaires' | 'lignes_inventaire'
  | 'consommations';

const API_URL = (() => {
  try {
    return new URL('api/index.php', document.baseURI).toString();
  } catch {
    return '/api/index.php';
  }
})();

const LS_PREFIX = 'barpos_';
const LS_SESSION = LS_PREFIX + 'session';
const LS_FLAG_OFFLINE = LS_PREFIX + 'offline_mode';

let lastError = '';
let offlineMode = false;
let offlineReason = '';

// ---------------- Mock de secours pour démo / dev sans WAMP ----------------
const MOCK_SOCIETE: Societe = {
  NOM: 'Bar POS (Démo Offline)',
  ADRESSE: 'Antananarivo, Madagascar',
  TELEPHONE: '034 00 000 00',
  EMAIL: 'contact@barpos.mg',
  LOGO_EMOJI: '🍺',
  LOGO_TYPE: 'emoji',
  UTILISER_IMPRIMANTE: false,
};

const MOCK_PERSONNEL: Personnel[] = [
  { IDPERSONNEL: 1, NOM: 'Admin', PRENOM: 'Super', LOGIN: 'admin', MOT_DE_PASSE: 'admin123', ROLE: 'Administrateur', ACTIF: true },
  { IDPERSONNEL: 2, NOM: 'Rakoto', PRENOM: 'Gérant', LOGIN: 'gerant', MOT_DE_PASSE: 'gerant123', ROLE: 'Gérant', ACTIF: true },
  { IDPERSONNEL: 3, NOM: 'Caisse', PRENOM: 'Un', LOGIN: 'caisse1', MOT_DE_PASSE: '1234', ROLE: 'Caissier', ACTIF: true },
  { IDPERSONNEL: 4, NOM: 'Caisse', PRENOM: 'Deux', LOGIN: 'caisse2', MOT_DE_PASSE: '1234', ROLE: 'Caissier', ACTIF: true },
  { IDPERSONNEL: 5, NOM: 'Magasin', PRENOM: 'Chef', LOGIN: 'magasin', MOT_DE_PASSE: '1234', ROLE: 'Magasinier', ACTIF: true },
  { IDPERSONNEL: 6, NOM: 'Serveur', PRENOM: 'Un', LOGIN: 'serveur', MOT_DE_PASSE: '1234', ROLE: 'Serveur', ACTIF: true },
];

const MOCK_FAMILLES: Famille[] = [
  { IDFAMILLE: 1, CODE: 'B', FAMILLE: 'Bières', COULEUR: '#f59e0b', ORDRE: 1 },
  { IDFAMILLE: 2, CODE: 'S', FAMILLE: 'Softs', COULEUR: '#0ea5e9', ORDRE: 2 },
  { IDFAMILLE: 3, CODE: 'L', FAMILLE: 'Spiritueux', COULEUR: '#8b5cf6', ORDRE: 3 },
  { IDFAMILLE: 4, CODE: 'SNK', FAMILLE: 'Snacks', COULEUR: '#10b981', ORDRE: 4 },
];

const MOCK_ARTICLES: Article[] = [
  { IDARTICLE: 1, CODE: 'THB33', NOM: 'THB 33cl', IDFAMILLE: 1, EMOJI: '🍺', PRIX_ACHAT: 1500, PRIX_VENTE: 3000, STOCK: 120, STOCK_MIN: 24, ACTIF: true, GERE_STOCK: true, SAISIE_PRIX_VENTE: false },
  { IDARTICLE: 2, CODE: 'THB65', NOM: 'THB 65cl', IDFAMILLE: 1, EMOJI: '🍺', PRIX_ACHAT: 2500, PRIX_VENTE: 5000, STOCK: 80, STOCK_MIN: 12, ACTIF: true, GERE_STOCK: true, SAISIE_PRIX_VENTE: false },
  { IDARTICLE: 3, CODE: 'COCA', NOM: 'Coca 33cl', IDFAMILLE: 2, EMOJI: '🥤', PRIX_ACHAT: 1000, PRIX_VENTE: 2500, STOCK: 60, STOCK_MIN: 12, ACTIF: true, GERE_STOCK: true, SAISIE_PRIX_VENTE: false },
  { IDARTICLE: 4, CODE: 'EAU', NOM: 'Eau Vive 50cl', IDFAMILLE: 2, EMOJI: '💧', PRIX_ACHAT: 500, PRIX_VENTE: 1500, STOCK: 100, STOCK_MIN: 20, ACTIF: true, GERE_STOCK: true, SAISIE_PRIX_VENTE: false },
  { IDARTICLE: 5, CODE: 'RHUM', NOM: 'Rhum 5cl', IDFAMILLE: 3, EMOJI: '🥃', PRIX_ACHAT: 2000, PRIX_VENTE: 6000, STOCK: 30, STOCK_MIN: 5, ACTIF: true, GERE_STOCK: true, SAISIE_PRIX_VENTE: true },
  { IDARTICLE: 6, CODE: 'BROCH', NOM: 'Brochettes', IDFAMILLE: 4, EMOJI: '🍢', PRIX_ACHAT: 1500, PRIX_VENTE: 4000, STOCK: 999, STOCK_MIN: 0, ACTIF: true, GERE_STOCK: false, SAISIE_PRIX_VENTE: false },
];

const MOCK_TABLES: TableR[] = [
  { IDTABLE: 1, NUMERO: 1, DESCRIPTION: 'Terrasse', PLACES: 4, ETAT: 'Libre' },
  { IDTABLE: 2, NUMERO: 2, DESCRIPTION: 'Terrasse', PLACES: 4, ETAT: 'Libre' },
  { IDTABLE: 3, NUMERO: 3, DESCRIPTION: 'Salle', PLACES: 2, ETAT: 'Libre' },
  { IDTABLE: 4, NUMERO: 4, DESCRIPTION: 'Salle VIP', PLACES: 6, ETAT: 'Libre' },
];

const MOCK_EMPTY: Record<DatasetName, Row[]> = {
  societe: [MOCK_SOCIETE as unknown as Row],
  personnel: MOCK_PERSONNEL as unknown as Row[],
  familles: MOCK_FAMILLES as unknown as Row[],
  articles: MOCK_ARTICLES as unknown as Row[],
  tables: MOCK_TABLES as unknown as Row[],
  clients: [],
  fournisseurs: [],
  ventes: [],
  lignes_vente: [],
  paiements: [],
  clotures: [],
  mouvements: [],
  achats: [],
  lignes_achat: [],
  inventaires: [],
  lignes_inventaire: [],
  consommations: [],
};

// ---------------- LocalStorage helpers ----------------
function lsGet<T>(key: DatasetName, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}
function lsSet<T>(key: DatasetName, data: T[]) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(data));
  } catch {
    // ignore quota
  }
}

// ---------------- XML helpers (MySQL mode) ----------------
const EMPTY_SOCIETE: Societe = {
  NOM: 'Bar POS — MySQL indisponible',
  ADRESSE: '',
  TELEPHONE: '',
  EMAIL: '',
  LOGO_EMOJI: '⚠️',
  LOGO_TYPE: 'emoji',
  UTILISER_IMPRIMANTE: false,
};

const escapeXml = (value: unknown): string => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Erreur inconnue de communication avec MySQL';

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

const isFileProtocol = (): boolean => {
  try {
    return typeof window !== 'undefined' && window.location.protocol === 'file:';
  } catch { return false; }
};

// Synchronous XHR with safety
const sendXml = (xml: string): Element => {
  if (isFileProtocol()) {
    throw new Error('Protocole file:// détecté : API MySQL inaccessible. Mode démo offline activé.');
  }
  const xhr = new XMLHttpRequest();
  xhr.open('POST', API_URL, false);
  try { xhr.withCredentials = true; } catch {}
  xhr.setRequestHeader('Content-Type', 'application/xml; charset=UTF-8');
  xhr.setRequestHeader('X-BarPOS-Request', '1');

  try {
    xhr.send(xml);
  } catch {
    throw new Error('API PHP inaccessible. Vérifiez que WAMP et Apache sont démarrés.');
  }

  if (xhr.status < 200 || xhr.status >= 300) {
    throw new Error(`API PHP indisponible (HTTP ${xhr.status || 0}).`);
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

const safeRead = <T>(dataset: DatasetName, fallback: T[]): T[] => {
  if (offlineMode && isFileProtocol()) {
    // file:// → toujours offline, pas de tentative réseau
    const fromLS = lsGet<T>(dataset, [] as T[]);
    if (fromLS.length > 0) return fromLS;
    return (MOCK_EMPTY[dataset] as unknown as T[]) || fallback;
  }
  // Si offlineMode mais pas file:// (ex: flag restant), on tente quand même MySQL une fois
  try {
    const data = request('read', dataset) as T[];
    // Succès MySQL → on sort du mode offline
    markOnlineSuccess();
    // Sauvegarde cache offline pour prochain lancement
    if (data && data.length >= 0) {
      lsSet(dataset, data);
    }
    return data;
  } catch (error) {
    const msg = errorMessage(error);
    lastError = msg;
    // Premier échec → bascule offline
    if (!offlineMode) {
      offlineMode = true;
      offlineReason = msg;
      try { localStorage.setItem(LS_FLAG_OFFLINE, '1'); } catch {}
      console.warn('[BarPOS] Bascule mode offline démo:', msg, 'API_URL=', API_URL);
    }
    const fromLS = lsGet<T>(dataset, [] as T[]);
    if (fromLS.length > 0) return fromLS;
    // Fallback mock par dataset
    if (MOCK_EMPTY[dataset]) {
      return (MOCK_EMPTY[dataset] as unknown as T[]);
    }
    return fallback;
  }
};

const sync = <T>(dataset: DatasetName, data: T[]): void => {
  if (offlineMode) {
    lsSet(dataset, data);
    return;
  }
  try {
    request('sync', dataset, data as Row[]);
    lsSet(dataset, data);
  } catch (error) {
    lastError = errorMessage(error);
    // Si échec sync, on sauvegarde quand même en offline pour ne pas perdre
    lsSet(dataset, data);
    window.alert(`Enregistrement MySQL impossible :\n${lastError}\n\nLes données sont sauvegardées en mode démo local (offline). Elles seront perdues si vous videz le cache du navigateur.`);
    // Ne pas throw pour éviter écran blanc ; on bascule
    offlineMode = true;
  }
};

const readBackup = (): string => {
  if (offlineMode) {
    throw new Error('Sauvegarde SQL indisponible en mode démo offline. Utilisez Export Excel ou installez WAMP.');
  }
  const root = sendXml('<request action="backup"><params/></request>');
  return Array.from(root.children).find(child => child.tagName === 'content')?.textContent || '';
};

// Init : seul file:// force offline immediatement.
// Le flag localStorage est conservé comme hint mais on tente quand même MySQL au premier read
// pour permettre passage auto de mode démo -> WAMP sans devoir cliquer.
let hasOfflineFlag = false;
try {
  hasOfflineFlag = localStorage.getItem(LS_FLAG_OFFLINE) === '1';
  if (isFileProtocol()) {
    offlineMode = true;
    offlineReason = 'file://';
  } else if (hasOfflineFlag) {
    // on garde trace mais on ne force pas offline ici : on laissera safeRead tenter MySQL
    // si ça réussit, on effacera le flag (voir safeRead success)
    offlineReason = 'offline flag (tentative MySQL en cours)';
  }
} catch {}

function clearOfflineFlag() {
  try { localStorage.removeItem(LS_FLAG_OFFLINE); } catch {}
  hasOfflineFlag = false;
  offlineMode = false;
  offlineReason = '';
  lastError = '';
}

function markOnlineSuccess() {
  if (hasOfflineFlag || offlineMode) {
    clearOfflineFlag();
  }
  offlineMode = false;
  offlineReason = '';
}

// ---------------- Export ----------------
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
  isOffline: (): boolean => offlineMode,
  getOfflineReason: (): string => offlineReason,
  clearOfflineFlag: (): void => { clearOfflineFlag(); },

  getSociete: (): Societe => {
    const data = safeRead<Societe>('societe', [EMPTY_SOCIETE]);
    // Si offline et pas de data MySQL, utiliser mock societe
    if (offlineMode && data.length === 0) return MOCK_SOCIETE;
    return data[0] || (offlineMode ? MOCK_SOCIETE : EMPTY_SOCIETE);
  },
  setSociete: (data: Societe): void => {
    if (offlineMode) lsSet('societe', [data]);
    else sync('societe', [data]);
  },

  getPersonnel: (): Personnel[] => safeRead<Personnel>('personnel', []),
  setPersonnel: (data: Personnel[]): void => sync('personnel', data),

  getFamilles: (): Famille[] => safeRead<Famille>('familles', []),
  setFamilles: (data: Famille[]): void => sync('familles', data),

  getArticles: (): Article[] => safeRead<Article>('articles', []),
  setArticles: (data: Article[]): void => sync('articles', data),

  getTables: (): TableR[] => safeRead<TableR>('tables', []),
  setTables: (data: TableR[]): void => sync('tables', data),

  getClients: (): Client[] => safeRead<Client>('clients', []),
  setClients: (data: Client[]): void => sync('clients', data),

  getFournisseurs: (): Fournisseur[] => safeRead<Fournisseur>('fournisseurs', []),
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
    if (offlineMode && isFileProtocol()) {
      try {
        const raw = localStorage.getItem(LS_SESSION);
        if (!raw) return null;
        return JSON.parse(raw) as Personnel;
      } catch { return null; }
    }
    try {
      const res = request('session')[0] as unknown as Personnel | undefined;
      if (res) markOnlineSuccess();
      return res || null;
    } catch (error) {
      lastError = errorMessage(error);
      // si API down, on tente session locale
      try {
        const raw = localStorage.getItem(LS_SESSION);
        if (raw) return JSON.parse(raw) as Personnel;
      } catch {}
      // Bascule offline silencieusement si pas déjà file://
      if (!offlineMode && !isFileProtocol()) {
        offlineMode = true;
        offlineReason = lastError;
        try { localStorage.setItem(LS_FLAG_OFFLINE, '1'); } catch {}
      }
      return null;
    }
  },

  setSession: (data: Personnel | null): void => {
    // En offline, on stocke session en local
    try {
      if (data) localStorage.setItem(LS_SESSION, JSON.stringify(data));
      else localStorage.removeItem(LS_SESSION);
    } catch {}
  },

  authenticate: (login: string, password: string): Personnel | null => {
    // Si on est en file://, pas de tentative MySQL
    if (offlineMode && isFileProtocol()) {
      const users = safeRead<Personnel>('personnel', MOCK_PERSONNEL);
      const u = users.find(p => p.LOGIN === login && p.MOT_DE_PASSE === password && p.ACTIF);
      if (u) {
        store.setSession(u);
        return u;
      }
      return null;
    }
    try {
      const res = request('authenticate', undefined, undefined, { login, password })[0] as unknown as Personnel | undefined;
      if (res) {
        markOnlineSuccess();
        // aussi cache session locale pour fallback
        try { localStorage.setItem(LS_SESSION, JSON.stringify(res)); } catch {}
      }
      return res || null;
    } catch (error) {
      lastError = errorMessage(error);
      // Fallback offline auth si pas file:// déjà géré
      if (isFileProtocol()) throw error;
      console.warn('[BarPOS] Auth API échouée, tentative offline:', lastError);
      if (!offlineMode) {
        offlineMode = true;
        offlineReason = lastError;
        try { localStorage.setItem(LS_FLAG_OFFLINE, '1'); } catch {}
      }
      // Tente auth locale
      try {
        const raw = localStorage.getItem(LS_PREFIX + 'personnel');
        if (raw) {
          const localUsers = JSON.parse(raw) as Personnel[];
          const u = localUsers.find(p => p.LOGIN === login && p.MOT_DE_PASSE === password && p.ACTIF);
          if (u) {
            try { localStorage.setItem(LS_SESSION, JSON.stringify(u)); } catch {}
            return u;
          }
        }
      } catch {}
      const users = MOCK_PERSONNEL;
      const u = users.find(p => p.LOGIN === login && p.MOT_DE_PASSE === password && p.ACTIF);
      if (u) {
        try { localStorage.setItem(LS_SESSION, JSON.stringify(u)); } catch {}
        return u;
      }
      throw error;
    }
  },

  logout: (): void => {
    try { localStorage.removeItem(LS_SESSION); } catch {}
    if (offlineMode) return;
    try {
      request('logout');
    } catch (error) {
      lastError = errorMessage(error);
    }
  },

  getStockAlerts: (): number => safeRead<Article>('articles', [])
    .filter(article => article.ACTIF && article.GERE_STOCK && article.STOCK <= article.STOCK_MIN).length,

  resetAll: (): void => {
    if (offlineMode) {
      // Supprime toutes les données offline sauf comptes/familles/articles/tables/societe
      const toClear: DatasetName[] = ['ventes','lignes_vente','paiements','clotures','mouvements','achats','lignes_achat','inventaires','lignes_inventaire','consommations','clients'];
      toClear.forEach(k => localStorage.removeItem(LS_PREFIX + k));
      return;
    }
    try {
      request('reset');
    } catch (error) {
      lastError = errorMessage(error);
      window.alert(`Réinitialisation MySQL impossible :\n${lastError}`);
      throw error;
    }
  },

  exportAll,
  exportSQL: readBackup,
};
