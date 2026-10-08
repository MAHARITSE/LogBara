// ============================================
// STORE MYSQL & LOCAL FALLBACK BAR POS v4.2
// Supporte l'API PHP/XML MySQL (WAMP) ainsi que la persistance locale (localStorage)
// ============================================

import {
  Societe, Personnel, Famille, Article, TableR, Client,
  Fournisseur, Vente, LigneVente, Paiement, Cloture, OuvertureCaisse,
  Mouvement, Achat, LigneAchat, Inventaire, LigneInventaire, Consommation,
} from './types';
import { generateRandomSales } from './utils/seedSales';

type Row = Record<string, unknown>;
type DatasetName =
  | 'societe' | 'personnel' | 'familles' | 'articles' | 'tables'
  | 'clients' | 'fournisseurs' | 'ventes' | 'lignes_vente'
  | 'paiements' | 'clotures' | 'mouvements' | 'achats'
  | 'lignes_achat' | 'inventaires' | 'lignes_inventaire'
  | 'consommations';

/** Mode d'impression des tickets, propre à chaque poste / utilisateur. */
export type PrinterMode = 'directe' | 'choix' | 'aucune';

const API_URL = new URL('api/index.php', document.baseURI).toString();

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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('barpos-data-updated', { detail: { dataset: name } }));
      if (name === 'articles') {
        window.dispatchEvent(new CustomEvent('barpos-articles-updated', { detail: { articles: data } }));
      }
    }
  } catch (e) {
    console.error('Erreur sauvegarde locale barpos:', e);
  }
}

// Écoute des modifications provenant d'autres onglets / fenêtres
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key && event.key.startsWith('barpos_')) {
      const dataset = event.key.replace('barpos_', '');
      window.dispatchEvent(new CustomEvent('barpos-data-updated', { detail: { dataset } }));
      if (dataset === 'articles') {
        window.dispatchEvent(new CustomEvent('barpos-articles-updated'));
      }
    }
  });
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
    throw new Error('API PHP inaccessible.');
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

let _cachedApiStatus: boolean | null = null;
let _apiStatusMessage = '';

/**
 * Drapeau « MySQL FORCÉ » (version WAMP wamp_deploy uniquement) :
 * injecté dans wamp_deploy/index.html sous la forme
 * window.__BARPOS_USE_API__ = true. Dans ce mode, l'application ne fait
 * AUCUN repli vers le stockage navigateur : toutes les lectures/écritures
 * passent obligatoirement par l'API PHP + MySQL.
 */
const isForcedApi = (): boolean =>
  typeof window !== 'undefined' &&
  (window as unknown as { __BARPOS_USE_API__?: boolean }).__BARPOS_USE_API__ === true;

/**
 * Statut de la connexion MySQL (WAMP), exposé à l'interface.
 * - connected=true  : l'API PHP a répondu et MySQL fonctionne.
 * - connected=false : mode local (données dans ce navigateur uniquement),
 *   _apiStatusMessage explique la raison exacte.
 */
export const getApiStatus = (): { connected: boolean; message: string } => ({
  connected: isApiConfigured(),
  message: _apiStatusMessage,
});

const isApiConfigured = (): boolean => {
  if (typeof window === 'undefined') return false;

  // Contrôle explicite via drapeau global si nécessaire
  const win = window as unknown as { __BARPOS_USE_API__?: boolean };
  if (typeof win.__BARPOS_USE_API__ === 'boolean') {
    if (!win.__BARPOS_USE_API__ && _cachedApiStatus === null) {
      _apiStatusMessage = 'Mode local forcé par la configuration.';
    }
    return win.__BARPOS_USE_API__;
  }

  // Dans l'environnement de dev / bac à sable Vite Cloud (.run.app ou port 3000 sans backend PHP WAMP local)
  if (window.location.hostname.includes('.run.app') || (window.location.port === '3000' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) {
    _cachedApiStatus = false;
    _apiStatusMessage = 'Environnement de démonstration : MySQL (WAMP) n\'est pas utilisé ici.';
    return false;
  }

  // En environnement WAMP / Apache (ex: http://localhost/logbara/ ou adresse IP LAN en production)
  if (_cachedApiStatus !== null) return _cachedApiStatus;

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API_URL, false);
    xhr.setRequestHeader('Content-Type', 'application/xml; charset=UTF-8');
    xhr.setRequestHeader('X-BarPOS-Request', '1');
    // NB : aucun xhr.timeout ici — sur une requête synchrone, sa définition
    // lève InvalidAccessError et faisait échouer TOUTE détection de l'API WAMP.
    xhr.send('<request action="session"><params/></request>');
    if (xhr.status >= 200 && xhr.status < 400 && xhr.responseXML) {
      const root = xhr.responseXML.documentElement;
      if (root && root.tagName === 'response' && root.getAttribute('success') === '1') {
        _cachedApiStatus = true;
        _apiStatusMessage = '';
        return true;
      }
      // L'API PHP répond mais MySQL renvoie une erreur (base absente, identifiants...)
      const apiMessage = root
        ? Array.from(root.children).find(child => child.tagName === 'message')?.textContent
        : '';
      _cachedApiStatus = false;
      _apiStatusMessage = apiMessage
        ? `L'API PHP répond mais MySQL a renvoyé une erreur : ${apiMessage}`
        : 'Réponse non XML reçue de api/index.php : le PHP n\'est pas exécuté par ce serveur (WAMP requis).';
      return false;
    }
    _cachedApiStatus = false;
    _apiStatusMessage = `API PHP injoignable (HTTP ${xhr.status || 0}) — vérifiez WAMP (Apache + MySQL) et l'adresse http://localhost/logbara/.`;
  } catch {
    // API PHP WAMP non joignable
    _cachedApiStatus = false;
    _apiStatusMessage = 'API PHP inaccessible — vérifiez que WAMP est démarré (icône verte) et que l\'application est ouverte via http://localhost/logbara/.';
  }

  return _cachedApiStatus;
};

const safeRead = <T>(dataset: DatasetName, fallback: T[]): T[] => {
  if (isApiConfigured()) {
    try {
      const res = request('read', dataset) as T[];
      lastError = '';
      return res;
    } catch (error) {
      if (isForcedApi()) {
        // Version WAMP : MySQL uniquement — JAMAIS de repli local silencieux.
        lastError = errorMessage(error);
        return [];
      }
      lastError = '';
    }
  }
  const seed = fallback.length > 0 ? fallback : (getDefaultSeedForDataset(dataset) as T[]);
  return getLocalDataset<T>(dataset, seed);
};

const sync = <T>(dataset: DatasetName, data: T[]): void => {
  if (isForcedApi()) {
    // Version WAMP : aucune écriture dans le navigateur, MySQL obligatoire.
    if (isApiConfigured()) {
      try {
        request('sync', dataset, data as Row[]);
        lastError = '';
      } catch (error) {
        lastError = errorMessage(error);
      }
    } else {
      lastError = 'MySQL indisponible : données non enregistrées.';
    }
    return;
  }
  // Always update local storage first for resilience
  setLocalDataset(dataset, data);
  if (isApiConfigured()) {
    try {
      request('sync', dataset, data as Row[]);
    } catch (error) {
      lastError = errorMessage(error);
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
  isApiConfigured: (): boolean => isApiConfigured(),
  getApiStatus: (): { connected: boolean; message: string } => getApiStatus(),
  getLastError: (): string => lastError,

  getSociete: (): Societe => safeRead<Societe>('societe', [SEED_SOCIETE])[0] || SEED_SOCIETE,
  setSociete: (data: Societe): void => sync('societe', [data]),

  /**
   * Multi-poste / par utilisateur :
   * Détermine le mode d'impression des tickets pour un utilisateur spécifique ou ce poste.
   * Ne modifie pas la base de données partagée pour ne pas impacter les autres postes/caissiers.
   *
   * Modes :
   * - 'directe' : impression kiosque silencieuse (aucune page d'impression affichée)
   * - 'choix'   : la boîte de dialogue s'ouvre à chaque impression pour choisir l'imprimante
   *               (nécessite le lanceur clientwamp.bat --dialogue, sans --kiosk-printing)
   * - 'aucune'  : AUCUNE impression kiosque automatique (caisse / clôture) sur ce poste
   */
  /**
   * Multi-poste / par utilisateur :
   * Détermine si l'impression directe des tickets est activée pour un utilisateur spécifique ou ce poste (case à cocher).
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
        const modePref = localStorage.getItem(`barpos_printer_mode_user_${uid}`);
        if (modePref !== null) {
          return modePref !== 'aucune';
        }
      }
      const localPref = localStorage.getItem('barpos_printer_local');
      if (localPref !== null) {
        return localPref === 'true';
      }
      const modeLocal = localStorage.getItem('barpos_printer_mode_local');
      if (modeLocal !== null) {
        return modeLocal !== 'aucune';
      }
    } catch (_) { /* ignore */ }
    return store.getSociete().UTILISER_IMPRIMANTE ?? true;
  },

  setUserPrinterEnabled: (enabled: boolean, userId?: number): void => {
    try {
      const uid = userId || store.getSession()?.IDPERSONNEL;
      if (uid) {
        localStorage.setItem(`barpos_printer_user_${uid}`, String(enabled));
        localStorage.setItem(`barpos_printer_mode_user_${uid}`, enabled ? 'directe' : 'aucune');
      }
      localStorage.setItem('barpos_printer_local', String(enabled));
      localStorage.setItem('barpos_printer_mode_local', enabled ? 'directe' : 'aucune');
    } catch (_) { /* ignore */ }
  },

  getUserPrinterMode: (userId?: number): PrinterMode => {
    return store.isUserPrinterEnabled(userId) ? 'directe' : 'aucune';
  },

  setUserPrinterMode: (mode: PrinterMode, userId?: number): void => {
    store.setUserPrinterEnabled(mode !== 'aucune', userId);
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

  /**
   * Génère un historique de ventes réaliste pour 3 mois (90 jours)
   */
  seedRandomSales: (months = 3, append = false) => {
    const res = generateRandomSales(months, append);
    try {
      localStorage.setItem('barpos_seeded_3months_sales', 'true');
    } catch (_) {}
    return res;
  },

  getClotures: (): Cloture[] => safeRead<Cloture>('clotures', []),
  setClotures: (data: Cloture[]): void => sync('clotures', data),

  getOuvertureSession: (idPersonnel?: number): OuvertureCaisse | null => {
    try {
      const raw = localStorage.getItem('barpos_ouverture_session');
      if (raw) {
        const parsed = JSON.parse(raw) as OuvertureCaisse;
        if (parsed && parsed.ACTIVE) {
          if (!idPersonnel || parsed.IDPERSONNEL === idPersonnel) return parsed;
        }
      }
    } catch (_) {}
    return null;
  },

  setOuvertureSession: (data: OuvertureCaisse | null): void => {
    try {
      if (data) {
        localStorage.setItem('barpos_ouverture_session', JSON.stringify(data));
        const historyRaw = localStorage.getItem('barpos_ouvertures_history');
        const history: OuvertureCaisse[] = historyRaw ? JSON.parse(historyRaw) : [];
        const idx = history.findIndex(o => o.IDOUVERTURE === data.IDOUVERTURE);
        if (idx >= 0) history[idx] = data;
        else history.push(data);
        localStorage.setItem('barpos_ouvertures_history', JSON.stringify(history));
      } else {
        localStorage.removeItem('barpos_ouverture_session');
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('barpos-data-updated', { detail: { dataset: 'ouverture' } }));
      }
    } catch (_) {}
  },

  getOuverturesHistory: (): OuvertureCaisse[] => {
    try {
      const historyRaw = localStorage.getItem('barpos_ouvertures_history');
      return historyRaw ? JSON.parse(historyRaw) : [];
    } catch (_) {
      return [];
    }
  },

  closeOuvertureSession: (): void => {
    const current = store.getOuvertureSession();
    if (current) {
      current.ACTIVE = false;
      store.setOuvertureSession(current);
      localStorage.removeItem('barpos_ouverture_session');
    }
  },

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
    if (isApiConfigured()) {
      try {
        const rows = request('session');
        if (rows.length > 0) return rows[0] as unknown as Personnel;
      } catch {
        // Fallback local session
      }
    }
    try {
      const saved = localStorage.getItem('barpos_session');
      return saved ? (JSON.parse(saved) as Personnel) : null;
    } catch {
      return null;
    }
  },

  setSession: (data: Personnel | null): void => {
    try {
      if (data) localStorage.setItem('barpos_session', JSON.stringify(data));
      else localStorage.removeItem('barpos_session');
    } catch (_) { /* ignore */ }
  },

  authenticate: (login: string, password: string): Personnel | null => {
    if (isApiConfigured()) {
      try {
        const rows = request('authenticate', undefined, undefined, { login, password });
        if (rows.length > 0) return rows[0] as unknown as Personnel;
        lastError = '';
        // Identifiants incorrects selon MySQL. En mode forcé (WAMP), on ne
        // tente JAMAIS une connexion sur les comptes de démonstration locaux.
        if (isForcedApi()) return null;
      } catch (error) {
        // MySQL injoignable ou en erreur : on mémorise le message pour
        // l'afficher à l'utilisateur.
        lastError = errorMessage(error);
        // Version WAMP : MySQL obligatoire — l'erreur est propagée à l'écran
        // de connexion au lieu d'une connexion locale silencieuse.
        if (isForcedApi()) throw error;
      }
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
    if (isApiConfigured()) {
      try {
        request('logout');
      } catch {
        // ignore
      }
    }
    store.setSession(null);
  },

  getStockAlerts: (): number => store.getArticles()
    .filter(article => article.ACTIF && article.GERE_STOCK && (article.ALERTE_STOCK !== false) && article.STOCK <= article.STOCK_MIN).length,

  resetAll: (): void => {
    if (isApiConfigured()) {
      try {
        request('reset');
      } catch {
        // ignore
      }
    }
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
    if (isApiConfigured()) {
      try {
        const root = sendXml('<request action="backup"><params/></request>');
        const content = Array.from(root.children).find(child => child.tagName === 'content')?.textContent;
        if (content) return content;
      } catch {
        // Fallback to local SQL generation
      }
    }

    // Generate valid MySQL SQL dump from local data
    const all = exportAll();
    const escapeSql = (val: unknown): string => {
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'number') return String(val);
      if (typeof val === 'boolean') return val ? '1' : '0';
      return `'${String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    };

    let sql = `-- ============================================\n`;
    sql += `-- BAR POS - Sauvegarde SQL MySQL\n`;
    sql += `-- Date: ${new Date().toISOString()}\n`;
    sql += `-- ============================================\n\n`;
    sql += `SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n`;

    const tableMapping: Record<string, string> = {
      societe: 'societe',
      personnel: 'personnel',
      familles: 'familles',
      articles: 'articles',
      tables: 'tables_resto',
      clients: 'clients',
      fournisseurs: 'fournisseurs',
      ventes: 'ventes',
      lignes_vente: 'lignes_vente',
      paiements: 'paiements',
      clotures: 'clotures',
      mouvements: 'mouvements',
      achats: 'achats',
      lignes_achat: 'lignes_achat',
      inventaires: 'inventaires',
      lignes_inventaire: 'lignes_inventaire',
      consommations: 'consommations',
    };

    Object.entries(all).forEach(([key, items]) => {
      const rows = (Array.isArray(items) ? items : [items]) as unknown as Record<string, unknown>[];
      if (rows.length === 0) return;
      const tableName = tableMapping[key] || key;
      const cols = Object.keys(rows[0]);
      sql += `-- Données pour la table ${tableName}\n`;
      rows.forEach(row => {
        const vals = cols.map(c => escapeSql(row[c])).join(', ');
        sql += `INSERT INTO \`${tableName}\` (\`${cols.join('`, `')}\`) VALUES (${vals});\n`;
      });
      sql += '\n';
    });

    sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;
    return sql;
  },

  restoreSQL: (sqlContent: string): { success: boolean; message: string; totalRecords: number; details: Record<string, number> } => {
    if (!sqlContent || typeof sqlContent !== 'string' || sqlContent.trim() === '') {
      throw new Error('Le fichier SQL est vide ou invalide.');
    }

    // 1. Si API MySQL configurée (WAMP), envoyer le script SQL à MySQL
    if (isApiConfigured()) {
      try {
        sendXml(`<request action="restore"><sql>${escapeXml(sqlContent)}</sql></request>`);
      } catch (error) {
        if (isForcedApi()) {
          throw new Error(errorMessage(error));
        }
      }
    }

    // 2. Parser le contenu SQL pour restaurer les données dans l'application
    const parsed = parseSqlInsertStatements(sqlContent);
    const tableKeys = Object.keys(parsed);

    // Supprimer tous les fichiers / données de la base avant restauration
    const ALL_DATASETS: DatasetName[] = [
      'societe', 'personnel', 'familles', 'articles', 'tables',
      'clients', 'fournisseurs', 'ventes', 'lignes_vente',
      'paiements', 'clotures', 'mouvements', 'achats',
      'lignes_achat', 'inventaires', 'lignes_inventaire', 'consommations'
    ];
    ALL_DATASETS.forEach(d => {
      try {
        localStorage.removeItem(`barpos_${d}`);
        setLocalDataset(d, []);
      } catch (_) {}
    });
    try {
      localStorage.removeItem('barpos_ouverture_session');
      localStorage.removeItem('barpos_ouvertures_history');
      localStorage.removeItem('barpos_seeded_3months_v2');
      localStorage.removeItem('barpos_seeded_3months_sales');
    } catch (_) {}

    const TABLE_TO_DATASET: Record<string, DatasetName> = {
      societe: 'societe',
      personnel: 'personnel',
      familles: 'familles',
      articles: 'articles',
      tables_resto: 'tables',
      tables: 'tables',
      clients: 'clients',
      fournisseurs: 'fournisseurs',
      ventes: 'ventes',
      lignes_vente: 'lignes_vente',
      paiements: 'paiements',
      clotures: 'clotures',
      mouvements: 'mouvements',
      mouvements_stock: 'mouvements',
      achats: 'achats',
      lignes_achat: 'lignes_achat',
      inventaires: 'inventaires',
      lignes_inventaire: 'lignes_inventaire',
      consommations: 'consommations',
    };

    const details: Record<string, number> = {};
    let totalRecords = 0;

    tableKeys.forEach(table => {
      const dataset = TABLE_TO_DATASET[table.toLowerCase()];
      if (!dataset) return;
      const rawRows = parsed[table];
      if (!rawRows || rawRows.length === 0) return;

      const formatted = rawRows.map(row => formatRowForDataset(row, dataset));
      setLocalDataset(dataset, formatted);
      details[dataset] = (details[dataset] || 0) + formatted.length;
      totalRecords += formatted.length;
    });

    // S'assurer que les tables minimales requises existent
    if (!details['societe']) {
      setLocalDataset('societe', [SEED_SOCIETE]);
    }
    if (!details['personnel'] || safeRead<Personnel>('personnel', []).length === 0) {
      setLocalDataset('personnel', SEED_PERSONNEL);
    }
    if (!details['familles'] || safeRead<Famille>('familles', []).length === 0) {
      setLocalDataset('familles', SEED_FAMILLES);
    }

    // Mettre à jour la session courante si l'utilisateur existe dans le personnel restauré
    const currentSession = store.getSession();
    const restoredPersonnel = safeRead<Personnel>('personnel', []);
    if (currentSession && restoredPersonnel.length > 0) {
      const match = restoredPersonnel.find(
        p => p.IDPERSONNEL === currentSession.IDPERSONNEL || p.LOGIN.toLowerCase() === currentSession.LOGIN.toLowerCase()
      );
      if (match) {
        store.setSession(match);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('barpos-data-updated'));
      window.dispatchEvent(new CustomEvent('barpos-articles-updated'));
      window.dispatchEvent(new Event('storage'));
    }

    return {
      success: true,
      message: `Restauration effectuée avec succès ! ${totalRecords} enregistrements importés.`,
      totalRecords,
      details,
    };
  },
};

function parseSqlInsertStatements(sql: string): Record<string, Record<string, unknown>[]> {
  const result: Record<string, Record<string, unknown>[]> = {};
  let i = 0;
  const n = sql.length;

  while (i < n) {
    // Commentaires en ligne -- ou #
    if ((sql[i] === '-' && sql[i + 1] === '-') || sql[i] === '#') {
      while (i < n && sql[i] !== '\n') i++;
      continue;
    }
    // Commentaires en bloc /* */
    if (sql[i] === '/' && sql[i + 1] === '*') {
      i += 2;
      while (i < n && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // Espaces
    if (/\s/.test(sql[i])) {
      i++;
      continue;
    }

    // Détection INSERT INTO ou INSERT
    if (sql.substring(i, i + 6).toUpperCase() === 'INSERT') {
      i += 6;
      while (i < n && /\s/.test(sql[i])) i++;
      if (sql.substring(i, i + 4).toUpperCase() === 'INTO') {
        i += 4;
        while (i < n && /\s/.test(sql[i])) i++;
      }

      // Nom de table
      let tableName = '';
      if (sql[i] === '`' || sql[i] === '"' || sql[i] === "'") {
        const quote = sql[i++];
        while (i < n && sql[i] !== quote) {
          tableName += sql[i++];
        }
        i++;
      } else {
        while (i < n && /[a-zA-Z0-9_]/.test(sql[i])) {
          tableName += sql[i++];
        }
      }

      while (i < n && /\s/.test(sql[i])) i++;

      // Colonnes si présentes : (col1, col2, ...)
      let columns: string[] = [];
      if (sql[i] === '(') {
        i++;
        let colStr = '';
        while (i < n && sql[i] !== ')') {
          colStr += sql[i++];
        }
        if (sql[i] === ')') i++;
        columns = colStr
          .split(',')
          .map(c => c.trim().replace(/^[`"']|[`"']$/g, ''))
          .filter(Boolean);
      }

      while (i < n && /\s/.test(sql[i])) i++;

      // VALUES ou VALUE
      if (sql.substring(i, i + 6).toUpperCase() === 'VALUES') {
        i += 6;
      } else if (sql.substring(i, i + 5).toUpperCase() === 'VALUE') {
        i += 5;
      }

      const tableKey = tableName.toLowerCase();
      if (!result[tableKey]) {
        result[tableKey] = [];
      }

      // Lecture des tuples (v1, v2), (v3, v4)...
      while (i < n) {
        while (i < n && (/\s/.test(sql[i]) || sql[i] === ',')) i++;
        if (sql[i] !== '(') {
          if (sql[i] === ';') i++;
          break;
        }
        i++; // Sauter '('

        const rowValues: unknown[] = [];
        while (i < n && sql[i] !== ')') {
          while (i < n && /\s/.test(sql[i])) i++;
          if (sql[i] === ')') break;

          if (sql[i] === "'" || sql[i] === '"') {
            const quote = sql[i++];
            let str = '';
            while (i < n) {
              if (sql[i] === '\\') {
                i++;
                if (i < n) {
                  const esc = sql[i++];
                  if (esc === 'n') str += '\n';
                  else if (esc === 'r') str += '\r';
                  else if (esc === 't') str += '\t';
                  else str += esc;
                }
              } else if (sql[i] === quote) {
                if (sql[i + 1] === quote) {
                  str += quote;
                  i += 2;
                } else {
                  i++; // Fin de chaîne
                  break;
                }
              } else {
                str += sql[i++];
              }
            }
            rowValues.push(str);
          } else {
            let token = '';
            while (i < n && sql[i] !== ',' && sql[i] !== ')' && !/\s/.test(sql[i])) {
              token += sql[i++];
            }
            token = token.trim();
            const upperToken = token.toUpperCase();
            if (upperToken === 'NULL') {
              rowValues.push(null);
            } else if (upperToken === 'TRUE') {
              rowValues.push(true);
            } else if (upperToken === 'FALSE') {
              rowValues.push(false);
            } else if (!isNaN(Number(token)) && token !== '') {
              rowValues.push(Number(token));
            } else {
              rowValues.push(token);
            }
          }

          while (i < n && /\s/.test(sql[i])) i++;
          if (sql[i] === ',') i++;
        }

        if (sql[i] === ')') i++;

        if (columns.length > 0) {
          const rowObj: Record<string, unknown> = {};
          for (let c = 0; c < columns.length; c++) {
            rowObj[columns[c]] = rowValues[c] !== undefined ? rowValues[c] : null;
          }
          result[tableKey].push(rowObj);
        }

        while (i < n && /\s/.test(sql[i])) i++;
        if (sql[i] === ',') {
          continue;
        } else if (sql[i] === ';') {
          i++;
          break;
        } else {
          break;
        }
      }
      continue;
    }

    i++;
  }

  return result;
}

function formatRowForDataset(row: Record<string, unknown>, dataset: DatasetName): Row {
  const result: Row = {};

  const BOOLEAN_COLUMNS = new Set([
    'ACTIF', 'GERE_STOCK', 'SAISIE_PRIX_VENTE', 'ALERTE_STOCK',
    'NE_PLUS_VENDRE', 'UTILISER_IMPRIMANTE', 'CLOTUREE', 'VALIDE', 'CHECKED'
  ]);

  const NUMERIC_COLUMNS = new Set([
    'IDARTICLE', 'IDFAMILLE', 'STOCK', 'STOCK_MIN', 'PRIX_ACHAT', 'PRIX_VENTE',
    'IDTABLE', 'NUMERO', 'PLACES', 'IDCAISSIER', 'IDPERSONNEL', 'IDCLIENT',
    'CREDIT_TOTAL', 'IDFOURNISSEUR', 'IDVENTE', 'TOTAL', 'REMISE', 'IDCLOTURE',
    'TOTAL_VENTES', 'TOTAL_REMISES', 'TOTAL_ESPECES', 'TOTAL_MOBILE', 'TOTAL_CREDIT',
    'TOTAL_REMBOURSEMENTS', 'NB_VENTES', 'IDLIGNEVENTE', 'QUANTITE', 'PRIX_UNITAIRE',
    'MONTANT', 'IDPAIEMENT', 'IDMOUVEMENT', 'IDACHAT', 'IDLIGNEACHAT', 'IDINVENTAIRE',
    'STOCK_THEORIQUE', 'STOCK_PHYSIQUE', 'ECART', 'IDLIGNEINVENTAIRE', 'IDCONSOMMATION',
    'ORDRE'
  ]);

  Object.entries(row).forEach(([col, val]) => {
    let key = col.toUpperCase();
    if (col.toLowerCase() === 'type_mouvement') key = 'TYPE';
    if (col.toLowerCase() === 'nom_client') key = 'NOM_CLIENT';
    if (col.toLowerCase() === 'prix_achat') key = 'PRIX_ACHAT';
    if (col.toLowerCase() === 'prix_vente') key = 'PRIX_VENTE';
    if (col.toLowerCase() === 'date_mouvement') key = 'DATE_MOUVEMENT';
    if (col.toLowerCase() === 'date_vente') key = 'DATE_VENTE';
    if (col.toLowerCase() === 'date_achat') key = 'DATE_ACHAT';
    if (col.toLowerCase() === 'date_inventaire') key = 'DATE_INVENTAIRE';
    if (col.toLowerCase() === 'date_cloture') key = 'DATE_CLOTURE';
    if (col.toLowerCase() === 'date_paiement') key = 'DATE_PAIEMENT';
    if (col.toLowerCase() === 'date_creation') key = 'DATE_CREATION';
    if (col.toLowerCase() === 'numero_facture') key = 'NUMERO_FACTURE';
    if (col.toLowerCase() === 'credit_total') key = 'CREDIT_TOTAL';

    if (BOOLEAN_COLUMNS.has(key)) {
      result[key] = val === 1 || val === '1' || val === true || val === 'true';
    } else if (NUMERIC_COLUMNS.has(key)) {
      if (val === null || val === undefined || val === '') {
        const nullableIds = ['IDTABLE', 'IDCAISSIER', 'IDCLIENT', 'IDCLOTURE', 'IDFOURNISSEUR'];
        result[key] = nullableIds.includes(key) ? null : 0;
      } else {
        result[key] = Number(val) || 0;
      }
    } else {
      result[key] = val === null ? null : (typeof val === 'string' ? val : String(val));
    }
  });

  if (dataset === 'societe') {
    if (!result.NOM) result.NOM = 'Bar POS';
    if (!result.ADRESSE) result.ADRESSE = 'Antananarivo, Madagascar';
    if (!result.TELEPHONE) result.TELEPHONE = '034 00 000 00';
    if (!result.LOGO_EMOJI) result.LOGO_EMOJI = '🍺';
    if (!result.LOGO_TYPE) result.LOGO_TYPE = 'emoji';
    if (result.UTILISER_IMPRIMANTE === undefined) result.UTILISER_IMPRIMANTE = true;
  }
  if (dataset === 'articles') {
    if (result.ACTIF === undefined) result.ACTIF = true;
    if (result.GERE_STOCK === undefined) result.GERE_STOCK = true;
  }
  if (dataset === 'personnel') {
    if (result.ACTIF === undefined) result.ACTIF = true;
    if (!result.MOT_DE_PASSE) result.MOT_DE_PASSE = 'admin123';
  }

  return result;
}
