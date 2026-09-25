import { store } from '../store';
import { globalToast } from '../utils/globalToast';

// Génère l'en-tête société (logo + nom + adresse + téléphone + NIF) réutilisable sur chaque page
export const buildSocieteHeaderHtml = () => {
  const societe = store.getSociete();
  const logoHtml = societe.LOGO_TYPE === 'emoji'
    ? `<div style="font-size: 32px; text-align: center; margin-bottom: 8px;">${societe.LOGO_EMOJI}</div>`
    : societe.LOGO_TYPE === 'image' && societe.LOGO_IMAGE
    ? `<div style="text-align: center; margin-bottom: 8px;"><img src="${societe.LOGO_IMAGE}" style="max-width: 60px; max-height: 60px;" /></div>`
    : '';
  return `
      <div class="header center">
        ${logoHtml}
        <div class="bold">${societe.NOM}</div>
        <div class="small">${societe.ADRESSE}</div>
        <div class="small">Tel: ${societe.TELEPHONE}</div>
        ${societe.NIF ? `<div class="small">NIF: ${societe.NIF}</div>` : ''}
      </div>
      <div class="line"></div>`;
};

// Génère le HTML complet du ticket
export const buildTicketHtml = (content: string) => {
  const societe = store.getSociete();
  const headerHtml = buildSocieteHeaderHtml();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Ticket - ${societe.NOM || 'Bar POS'}</title>
      <style>
        @page { margin: 0; size: 80mm auto; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace, sans-serif;
          font-size: 12px;
          width: 80mm;
          padding: 4mm 5mm;
          line-height: 1.4;
          color: #000;
          background: #fff;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; }
        .right { text-align: right; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; vertical-align: top; }
        .small { font-size: 10px; }
        .header { margin-bottom: 8px; }
        /* Nouvelle page (ex. récap ACHATS de la clôture) : pas de ligne pointillée
           au-dessus du logo, la page commence directement par l'en-tête société. */
        .page-break {
          page-break-before: always;
          break-before: page;
        }
        @media print {
          body { width: 80mm; padding: 2mm 3mm; }
          .page-break {
            page-break-before: always !important;
            break-before: page !important;
          }
        }
      </style>
    </head>
    <body>
      ${headerHtml}
      ${content}
      <div class="line"></div>
      <div class="center small">Merci de votre visite !</div>
    </body>
    </html>
  `;
};

/**
 * Impression SILENCIEUSE : iframe invisible hors écran, AUCUNE fenêtre ni
 * popup affichée (plus d'« affichage bref de la page d'impression »).
 *
 * - Avec le lanceur clientwamp.bat (--kiosk-printing, comportement par défaut) :
 *   le ticket part DIRECTEMENT sur l'imprimante par défaut, sans rien afficher.
 * - Sans le mode kiosque (lanceur clientwamp.bat --dialogue) : le navigateur
 *   ouvre sa boîte de dialogue : l'utilisateur choisit l'imprimante.
 *
 * L'iframe n'est retiré qu'APRÈS l'événement afterprint (ou 60 s au maximum) :
 * le retirer trop tôt annulait l'impression en cours.
 */
const executeDirectPrint = (html: string) => {
  try {
    const oldFrame = document.getElementById('barpos-direct-print-frame');
    if (oldFrame) {
      oldFrame.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'barpos-direct-print-frame';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute(
      'style',
      'position:fixed;top:-10000px;left:-10000px;width:80mm;height:100px;border:none;visibility:hidden;pointer-events:none;'
    );
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!frameDoc || !iframe.contentWindow) {
      globalToast("Impression impossible dans cet environnement (iframe bloqué).", 'warning');
      iframe.remove();
      return;
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    // Retire l'iframe seulement une fois l'impression terminée (afterprint),
    // avec une sécurité à 60 s. Supprimer l'iframe trop tôt annulait
    // l'impression / fermait brutalement la boîte de dialogue.
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      iframe.remove();
    };
    iframe.contentWindow.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 60000);

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Erreur impression iframe', err);
        cleanup();
        globalToast("Impression impossible dans cet environnement.", 'warning');
      }
    }, 250);
  } catch (e) {
    console.warn('Erreur déclenchement impression directe', e);
    globalToast("Impression impossible dans cet environnement.", 'warning');
  }
};

/**
 * Impression d'un ticket, en respectant le mode du poste / utilisateur :
 *
 * - 'directe' : impression silencieuse immédiate (kiosque), aucune page affichée.
 * - 'choix'   : impression via la boîte de dialogue (choix de l'imprimante) ;
 *               nécessite le lanceur clientwamp.bat --dialogue (sans --kiosk-printing).
 * - 'aucune'  : AUCUNE impression kiosque (paiement en caisse, clôture automatique) :
 *               simple notification d'enregistrement. Un appel forcé (force=true,
 *               ex. bouton « Réimprimer » cliqué par l'utilisateur) reste ignoré
 *               en mode kiosque : l'impression silencieuse est désactivée sur ce
 *               poste ; un message invite à réactiver l'imprimante.
 */
export const printTicket = (content: string, force: boolean = false, userId?: number) => {
  const mode = store.getUserPrinterMode(userId);

  if (mode === 'aucune') {
    // Imprimante désactivée sur ce poste : jamais d'impression kiosque silencieuse.
    globalToast(
      force
        ? "Impression désactivée sur ce poste — activez-la dans le menu latéral ou dans l'écran d'encaissement."
        : 'Impression désactivée sur ce poste — ticket non imprimé.',
      force ? 'warning' : 'info',
      3500,
      'center',
    );
    return;
  }

  const html = buildTicketHtml(content);
  executeDirectPrint(html);
};

/**
 * Aperçu / réimpression directe du ticket (impression silencieuse, sans page affichée)
 */
export const printPreview = (content: string, autoPrint: boolean = true) => {
  const html = buildTicketHtml(content);
  executeDirectPrint(html);
};
