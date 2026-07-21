// ============================================
// STORE MYSQL BAR POS v4.2
// Toutes les donnees persistantes sont lues et ecrites dans MySQL via l'API PHP/XML.
// Aucun stockage metier n'est effectue dans le navigateur.
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

const API_URL = new URL('api/index.php', document.baseURI).toString();
const EMPTY_SOCIETE: Societe = {
  NOM: 'Bar POS — MySQL indisponible',
  ADRESSE: '',
  TELEPHONE: '',
  EMAIL: '',
  LOGO_EMOJI: '⚠️',
  LOGO_TYPE: 'emoji',
  UTILISER_IMPRIMANTE: false,
};

let lastError = '';

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

const sendXml = (xml: string): Element => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', API_URL, false);
  xhr.withCredentials = true;
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

const read = <T>(dataset: DatasetName): T[] => request('read', dataset) as T[];

const safeRead = <T>(dataset: DatasetName, fallback: T[]): T[] => {
  try {
    return read<T>(dataset);
  } catch (error) {
    lastError = errorMessage(error);
    return fallback;
  }
};

const sync = <T>(dataset: DatasetName, data: T[]): void => {
  try {
    request('sync', dataset, data as Row[]);
  } catch (error) {
    lastError = errorMessage(error);
    window.alert(`Enregistrement MySQL impossible :\n${lastError}`);
    throw error;
  }
};

const readBackup = (): string => {
  const root = sendXml('<request action="backup"><params/></request>');
  return Array.from(root.children).find(child => child.tagName === 'content')?.textContent || '';
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

  /**
   * Retourne l'URL complète du serveur au format http://ip/LogBara/
   * Appelle l'API pour obtenir l'IP réelle même en cas d'accès localhost.
   */
  getServerUrl: (): string => {
    try {
      const protocol = window.location.protocol;
      const rows = request('server_info');
      const displayHost = rows[0]?.['display_host'] as string | undefined;
      const host = displayHost || window.location.hostname;
      const path = window.location.pathname.replace(/\/api\/index\.php.*$/, '').replace(/\/+$/, '');
      return protocol + '//' + host + path + '/';
    } catch {
      // Fallback : utiliser window.location
      const protocol = window.location.protocol;
      const host = window.location.hostname;
      const path = window.location.pathname.replace(/\/api\/index\.php.*$/, '').replace(/\/+$/, '');
      return protocol + '//' + host + path + '/';
    }
  },

  getSociete: (): Societe => safeRead<Societe>('societe', [EMPTY_SOCIETE])[0] || EMPTY_SOCIETE,
  setSociete: (data: Societe): void => sync('societe', [data]),

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
    try {
      return (request('session')[0] as unknown as Personnel | undefined) || null;
    } catch (error) {
      lastError = errorMessage(error);
      return null;
    }
  },

  setSession: (_data: Personnel | null): void => {
    // La session est geree par un jeton opaque en cookie et une ligne MySQL cote serveur.
  },

  authenticate: (login: string, password: string): Personnel | null => {
    try {
      return (request('authenticate', undefined, undefined, { login, password })[0] as unknown as Personnel | undefined) || null;
    } catch (error) {
      lastError = errorMessage(error);
      throw error;
    }
  },

  logout: (): void => {
    try {
      request('logout');
    } catch (error) {
      lastError = errorMessage(error);
    }
  },

  getStockAlerts: (): number => safeRead<Article>('articles', [])
    .filter(article => article.ACTIF && article.GERE_STOCK && article.STOCK <= article.STOCK_MIN).length,

  resetAll: (): void => {
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
