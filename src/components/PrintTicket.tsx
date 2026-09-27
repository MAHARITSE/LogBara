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
        openPrintPage(html);
      }
    }, 250);
  } catch (e) {
    console.warn('Erreur déclenchement impression directe', e);
    openPrintPage(html);
  }
};

/**
 * Ouvre la FENÊTRE D'APERÇU VISIBLE :
 * Affiche le document à l'écran sans déclencher d'impression automatique ni de fermeture automatique,
 * afin d'éviter que le mode kiosque de Chrome (--kiosk-printing) n'intercepte et ne ferme l'aperçu.
 */
export const openPreviewPage = (html: string) => {
  try {
    const printWindow = window.open('', '_blank', 'width=420,height=680,scrollbars=yes,resizable=yes');
    if (printWindow) {
      const barHtml = `
        <div class="no-print" style="position: sticky; top: 0; left: 0; right: 0; background: #0D47A1; color: #fff; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 10000; border-bottom: 1px solid rgba(255,255,255,0.2);">
          <span style="display: flex; align-items: center; gap: 6px;">👁️ Aperçu du document</span>
          <div style="display: flex; gap: 8px;">
            <button onclick="window.print()" style="background: #22c55e; color: white; border: none; padding: 6px 14px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
              🖨️ Imprimer
            </button>
            <button onclick="window.close()" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 6px 12px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px;">
              ❌ Fermer
            </button>
          </div>
        </div>
      `;

      const previewHtml = html
        .replace('</style>', `@media print { .no-print { display: none !important; } }</style>`)
        .replace('<body>', `<body>${barHtml}`);

      printWindow.document.open();
      printWindow.document.write(previewHtml);
      printWindow.document.close();
      printWindow.focus();
    } else {
      globalToast('Fenêtre d\'aperçu bloquée. Veuillez autoriser les popups.', 'warning');
    }
  } catch {
    globalToast('Aperçu non disponible dans cet environnement', 'info');
  }
};

/**
 * Alias de compatibilité
 */
export const openPrintPage = (html: string) => openPreviewPage(html);

/**
 * Impression d'un ticket, en respectant la préférence du poste / utilisateur :
 *
 * - Imprimante activée (case cochée) : impression directe silencieuse immédiate (kiosque), aucune page affichée.
 * - Imprimante désactivée (case non cochée) : AUCUNE impression kiosque (paiement en caisse, clôture automatique) :
 *   simple notification d'enregistrement. Un appel forcé (force=true)
 *   ouvre la fenêtre d'aperçu du document.
 */
export const printTicket = (content: string, force: boolean = false, userId?: number) => {
  const isPrinterActive = store.isUserPrinterEnabled(userId);

  if (!isPrinterActive && !force) {
    globalToast('✓ Paiement enregistré (sans ticket imprimé)', 'success', 3000, 'center');
    return;
  }

  const html = buildTicketHtml(content);

  if (isPrinterActive) {
    executeDirectPrint(html);
  } else {
    openPreviewPage(html);
  }
};

/**
 * APERÇU / REPRINTS / RAPPORTS / TABLES SUIVI / VENTES / ACHATS / ETC.
 * Ouvre TOUJOURS la fenêtre d'aperçu d'impression (openPreviewPage)
 * sans auto-print/auto-close pour qu'elle reste affichée à l'écran.
 */
export const printPreview = (content: string) => {
  const html = buildTicketHtml(content);
  openPreviewPage(html);
};

/**
 * Impression du ticket de CLÔTURE DE CAISSE :
 * - Imprimante activée -> impression DIRECTE silencieuse (kiosque) ;
 * - Imprimante désactivée -> ouverture de la FENÊTRE D'APERÇU.
 */
export const printClotureTicket = (content: string, userId?: number, directPrint: boolean = false) => {
  const html = buildTicketHtml(content);
  if (directPrint && store.isUserPrinterEnabled(userId)) {
    executeDirectPrint(html);
  } else {
    openPreviewPage(html);
  }
};
