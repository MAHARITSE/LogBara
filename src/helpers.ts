// Helpers pour l'application POS

// Formater en Ariary
export const formatAr = (n: number): string => {
  return n.toLocaleString('fr-MG') + ' Ar';
};

// Date du jour (YYYY-MM-DD)
export const today = (): string => {
  return new Date().toISOString().split('T')[0];
};

// Heure actuelle (HH:MM:SS)
export const nowTime = (): string => {
  return new Date().toTimeString().split(' ')[0];
};

// Heure courte (HH:MM)
export const shortTime = (): string => {
  return new Date().toTimeString().slice(0, 5);
};

// Date longue en français
export const dateLongFr = (date?: string): string => {
  const d = date ? new Date(date) : new Date();
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
};

// Date courte formatée
export const dateLabel = (date: string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Prochain ID
export const nextId = <T>(arr: T[], field: keyof T): number => {
  if (arr.length === 0) return 1;
  const max = Math.max(...arr.map(item => Number(item[field]) || 0));
  return max + 1;
};

// Capitaliser la première lettre
export const capitalize = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Générer un numéro de facture
export const genFactureNum = (prefix: string, id: number): string => {
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

// Couleurs des modes de paiement
export const paiementColors: Record<string, string> = {
  'Espèces': 'bg-green-100 text-green-700',
  'Mobile Money': 'bg-blue-100 text-blue-700',
  'Crédit': 'bg-orange-100 text-orange-700',
};

// Emojis disponibles pour le logo
export const logoEmojis = ['🍺', '🍻', '🍷', '🍸', '🍹', '☕', '🍔', '🍕', '🍜', '🍣', '🍽️', '🏪', '🏠', '⭐'];
