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
export const buildTicketHtml = (content: string, showFooter: boolean = true) => {
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
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
        }
        body {
          font-family: 'Segoe UI', Arial, Helvetica, -apple-system, sans-serif;
          font-size: 13px;
          font-weight: 500;
          width: 76mm;
          max-width: 80mm;
          margin: 0 auto;
          padding: 2mm 2mm 8mm 2mm;
          line-height: 1.35;
          color: #000;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .left { text-align: left; }
        .right { text-align: right; }
        .line { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; align-items: baseline; }
        table { width: 100%; border-collapse: collapse; }
        td, th { padding: 3px 2px; vertical-align: top; font-size: 12.5px; }
        .small { font-size: 11px; }
        .header { margin-bottom: 8px; }
        /* Colonnes standard pour tickets 80mm */
        .col-art { width: 44%; text-align: left; word-break: break-word; }
        .col-qty { width: 14%; text-align: center; }
        .col-pu { width: 20%; text-align: right; }
        .col-tot { width: 22%; text-align: right; font-weight: 600; }
        /* Nouvelle page (ex. récap ACHATS de la clôture) : pas de ligne pointillée
           au-dessus du logo, la page commence directement par l'en-tête société. */
        .page-break {
          page-break-before: always;
          break-before: page;
        }
        @media print {
          @page { margin: 0; size: 80mm auto; }
          body { width: 76mm; max-width: 80mm; margin: 0 auto; padding: 2mm 2mm 6mm 2mm; font-size: 13px; }
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
      ${showFooter ? `<div class="line"></div><div class="center small">Merci de votre visite !</div>` : ''}
    </body>
    </html>
  `;
};

/**
 * Impression SILENCIEUSE et DISCRÈTE :
 * Utilise un iframe invisible (opacity: 0, positionné hors écran, sans visibility:hidden
 * pour que le moteur de rendu Chromium ne bloque pas l'impression).
 *
 * - Avec le lanceur clientwamp.bat (--kiosk-printing) :
 *   Chrome intercepte l'appel window.print() de l'iframe et envoie DIRECTEMENT
 *   le ticket à l'imprimante Windows par défaut sans aucune boîte de dialogue,
 *   sans pop-up et sans le moindre aperçu visible à l'écran.
 * - Aucune fenêtre pop-up visible n'est affichée à l'écran.
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
    // Important : opacity: 0 et hors écran au lieu de visibility: hidden (qui bloque l'impression sous Chromium)
    iframe.setAttribute(
      'style',
      'position:fixed;left:-9999px;top:-9999px;width:80mm;height:100px;border:none;opacity:0;pointer-events:none;z-index:-9999;'
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

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      iframe.remove();
    };
    iframe.contentWindow.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 60000);

    const doPrint = () => {
      try {
        if (!iframe.contentWindow) return;
        iframe.contentWindow.print();
      } catch (err) {
        console.warn('Erreur impression directe iframe', err);
        cleanup();
        openDirectPrintPopup(html);
      }
    };

    // Déclenche l'impression dès que le document est prêt sans voler le focus
    if (frameDoc.readyState === 'complete') {
      setTimeout(doPrint, 80);
    } else {
      iframe.onload = () => setTimeout(doPrint, 80);
      setTimeout(doPrint, 250);
    }
  } catch (e) {
    console.warn('Erreur déclenchement impression directe', e);
    openDirectPrintPopup(html);
  }
};

/**
 * Impression de secours discrète via mini popup si l'iframe est totalement restreint par l'OS
 */
export const openDirectPrintPopup = (html: string) => {
  try {
    // Positionné hors champ ou invisible pour éviter tout flash d'aperçu à l'écran
    const printWindow = window.open('', '_blank', 'left=50000,top=50000,width=10,height=10');
    if (printWindow) {
      const autoPrintHtml = html.replace(
        '</body>',
        `<script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
            setTimeout(function() { window.close(); }, 5000);
          };
        </script></body>`
      );
      printWindow.document.open();
      printWindow.document.write(autoPrintHtml);
      printWindow.document.close();
    } else {
      globalToast('Impression bloquée. Veuillez autoriser les fenêtres popups ou le mode kiosque.', 'warning');
    }
  } catch {
    globalToast('Impression non disponible dans cet environnement', 'info');
  }
};

/**
 * Impression DIRECTE : envoie directement le ticket vers l'imprimante (kiosque / boîte système)
 * sans ouvrir la fenêtre d'aperçu ni le bandeau « Aperçu du document ».
 */
export const printDirect = (content: string, showFooter: boolean = true) => {
  const html = buildTicketHtml(content, showFooter);
  executeDirectPrint(html);
};

/**
 * Ouvre la FENÊTRE D'APERÇU VISIBLE :
 * Affiche le document à l'écran sans déclencher d'impression automatique ni de fermeture automatique,
 * afin d'éviter que le mode kiosque de Chrome (--kiosk-printing) n'intercepte et ne ferme l'aperçu.
 */
export const openPreviewPage = (html: string) => {
  executeDirectPrint(html);
};

/**
 * Alias de compatibilité
 */
export const openPrintPage = (html: string) => {
  executeDirectPrint(html);
};

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
  executeDirectPrint(html);
};

/**
 * APERÇU / REPRINTS / RAPPORTS / TABLES SUIVI / VENTES / ACHATS / ETC.
 * Déclenche directement la page / boîte d'impression sans écran intermédiaire bloquant.
 */
export const printPreview = (content: string) => {
  const html = buildTicketHtml(content);
  executeDirectPrint(html);
};

/**
 * Impression du ticket de CLÔTURE DE CAISSE :
 * Envoie directement à l'impression (mode kiosque immédiat si configuré, ou boîte d'impression)
 * sans afficher la fenêtre d'aperçu avec boutons.
 */
export const printClotureTicket = (content: string, _userId?: number, _directPrint: boolean = false) => {
  const html = buildTicketHtml(content);
  executeDirectPrint(html);
};

/**
 * Impression du ticket d'OUVERTURE DE CAISSE & BON DE DOTATION STOCK :
 * Envoie directement à l'impression sans afficher la fenêtre d'aperçu avec boutons.
 */
export const printOuvertureTicket = (content: string, _userId?: number, _directPrint: boolean = false) => {
  const html = buildTicketHtml(content, false);
  executeDirectPrint(html);
};
