// ============================================
// Toast global (impératif) — Bar POS v4.2
// Développeur: MAHARITSE Hiacinthe Bertrand
// ============================================
// Permet d'afficher une notification depuis n'importe quel fichier
// (y compris des utilitaires hors React comme PrintTicket), sans avoir
// à monter un composant ni à modifier les modules appelants.

type ToastType = 'success' | 'error' | 'warning' | 'info';

const COLORS: Record<ToastType, string> = {
  success: '#22c55e',
  error: '#ef4444',
  warning: '#eab308',
  info: '#0D47A1',
};

const STYLE_ID = 'logbara-global-toast-style';

let current: HTMLDivElement | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const ensureStyle = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent =
    '@keyframes logbaraToastIn{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}';
  document.head.appendChild(style);
};

/**
 * Affiche une notification globale en haut à droite, puis la retire
 * automatiquement après `duration` ms. Un nouvel appel remplace la
 * notification précédente.
 */
export const globalToast = (
  message: string,
  type: ToastType = 'info',
  duration = 3000
) => {
  if (typeof document === 'undefined') return;

  // Remplace une éventuelle notification déjà affichée
  if (current) current.remove();
  if (timer) clearTimeout(timer);

  ensureStyle();

  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.style.cssText = [
    'position:fixed',
    'top:16px',
    'right:16px',
    'z-index:2147483647',
    `background:${COLORS[type]}`,
    'color:#fff',
    'padding:12px 20px',
    'border-radius:12px',
    'box-shadow:0 10px 15px -3px rgba(0,0,0,.25)',
    'font-weight:600',
    'font-size:14px',
    'max-width:340px',
    'display:flex',
    'align-items:center',
    'gap:8px',
    'animation:logbaraToastIn .2s ease-out',
  ].join(';');
  el.textContent = message;

  document.body.appendChild(el);
  current = el;

  timer = setTimeout(() => {
    el.remove();
    if (current === el) current = null;
  }, duration);
};
