// ============================================
// HELPERS BAR POS v4.2
// ============================================

// Format monétaire en Ariary
export const formatAr = (n: number): string => {
  return new Intl.NumberFormat('fr-MG').format(Math.round(n)) + ' Ar';
};

// Date du jour (YYYY-MM-DD)
export const today = (): string => {
  return new Date().toISOString().split('T')[0];
};

// Heure actuelle (HH:MM:SS)
export const nowTime = (): string => {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// Prochain ID
export const nextId = <T>(arr: T[], key: keyof T): number => {
  if (arr.length === 0) return 1;
  const ids = arr.map(item => Number(item[key]) || 0);
  return Math.max(...ids) + 1;
};

// Label de date
export const dateLabel = (date: string): string => {
  const d = new Date(date);
  const todayStr = today();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yestStr = yesterday.toISOString().split('T')[0];
  
  if (date === todayStr) return "Aujourd'hui";
  if (date === yestStr) return "Hier";
  
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Capitaliser la première lettre
export const capitalize = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Format téléphone: XXX XX XXX XX
export const formatPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 8) return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)}`;
};

// Générer un numéro de facture
export const generateFactureNum = (prefix: string, id: number): string => {
  const dateStr = today().replace(/-/g, '');
  return `${prefix}-${dateStr}-${String(id).padStart(4, '0')}`;
};

// Couleurs des rôles
export const roleColors: Record<string, string> = {
  'Administrateur': 'bg-red-100 text-red-700',
  'Gérant': 'bg-purple-100 text-purple-700',
  'Caissier': 'bg-blue-100 text-blue-700',
  'Serveur': 'bg-green-100 text-green-700',
  'Magasinier': 'bg-orange-100 text-orange-700',
};

// Date longue en français
export const dateLongFr = (date?: string): string => {
  const d = date ? new Date(date) : new Date();
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
};

// Vérifier les permissions
export const hasAccess = (role: string, module: string): boolean => {
  const permissions: Record<string, string[]> = {
    'Administrateur': ['dashboard', 'tables', 'ventes', 'cloture', 'articles', 'familles', 'stock', 'inventaire', 'achats', 'fournisseurs', 'personnel', 'clients', 'credits', 'societe', 'sauvegarde'],
    'Gérant': ['dashboard', 'caisse', 'tables', 'ventes', 'cloture', 'articles', 'familles', 'stock', 'inventaire', 'fournisseurs', 'clients', 'credits', 'societe', 'sauvegarde'],
    'Caissier': ['caisse', 'tables', 'ventes', 'cloture', 'credits', 'achats'],
    'Serveur': ['tables'],
    'Magasinier': ['articles', 'stock', 'inventaire', 'achats'],
  };
  return permissions[role]?.includes(module) || false;
};

// Mode de stockage
export const getStorageMode = (): 'local' | 'mysql' => {
  const urlParams = new URLSearchParams(window.location.search);
  const urlMode = urlParams.get('mode');
  
  if (urlMode === 'mysql' || urlMode === 'local') {
    localStorage.setItem('pos_mode', urlMode);
    return urlMode;
  }
  
  return (localStorage.getItem('pos_mode') as 'local' | 'mysql') || 'local';
};
