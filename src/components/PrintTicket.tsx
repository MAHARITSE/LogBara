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
        .page-break {
          page-break-before: always;
          break-before: page;
          margin-top: 15px;
          padding-top: 10px;
          border-top: 1px dashed #000;
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
 * Fallback si iframe d'impression non supporté :
 * Ouvre une fenêtre popup avec auto-print et auto-close immédiat.
 */
const fallbackPrintWindow = (html: string) => {
  try {
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (printWindow) {
      const autoPrintHtml = html.replace(
        '</body>',
        `<script>
          window.focus();
          setTimeout(function() {
            window.print();
          }, 150);
          window.onafterprint = function() {
            setTimeout(function() { window.close(); }, 300);
          };
        </script></body>`
      );
      printWindow.document.open();
      printWindow.document.write(autoPrintHtml);
      printWindow.document.close();
    } else {
      globalToast('Fenêtre d\'impression bloquée. Veuillez autoriser les popups.', 'warning');
    }
  } catch {
    globalToast('Impression non disponible dans cet environnement', 'info');
  }
};

/**
 * Exécute l'impression directe dans la page actuelle via un iframe invisible.
 * - Ne crée AUCUNE autre fenêtre d'application ni onglet dans le navigateur
 * - Affiche directement la boîte de dialogue d'impression système/navigateur
 * - En mode Kiosk (--kiosk-printing), imprime directement sans ouvrir de fenêtre
 */
const executeDirectPrint = (html: string) => {
  try {
    const oldFrame = document.getElementById('barpos-direct-print-frame');
    if (oldFrame) {
      oldFrame.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'barpos-direct-print-frame';
    iframe.setAttribute(
      'style',
      'position:fixed;top:-10000px;left:-10000px;width:80mm;height:100px;border:none;visibility:hidden;pointer-events:none;'
    );
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!frameDoc) {
      fallbackPrintWindow(html);
      return;
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    setTimeout(() => {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } else {
          fallbackPrintWindow(html);
        }
      } catch (err) {
        console.warn('Erreur impression iframe, recours au fallback', err);
        fallbackPrintWindow(html);
      } finally {
        setTimeout(() => {
          const f = document.getElementById('barpos-direct-print-frame');
          if (f) f.remove();
        }, 3000);
      }
    }, 250);
  } catch (e) {
    console.warn('Erreur déclenchement impression directe', e);
    fallbackPrintWindow(html);
  }
};

/**
 * Impression DIRECTE :
 * Déclenche directement la fenêtre d'impression native du navigateur/système
 * sans ouvrir d'autre fenêtre d'application.
 *
 * Si force est true (comme pour la clôture de caisse), l'impression se déclenche TOUJOURS.
 * En multi-poste, l'état d'imprimante est vérifié par utilisateur/poste (store.isUserPrinterEnabled).
 */
export const printTicket = (content: string, force: boolean = false, userId?: number) => {
  const isPrinterActive = store.isUserPrinterEnabled(userId);

  // Si l'imprimante est désactivée pour cet utilisateur/poste ET que l'impression n'est pas forcée :
  // afficher uniquement la notification d'enregistrement
  if (!isPrinterActive && !force) {
    globalToast('✓ Paiement enregistré (sans ticket imprimé)', 'success', 3000, 'center');
    return;
  }

  const html = buildTicketHtml(content);
  executeDirectPrint(html);
};

/**
 * Aperçu / réimpression directe du ticket
 */
export const printPreview = (content: string, autoPrint: boolean = true) => {
  const html = buildTicketHtml(content);
  if (autoPrint) {
    executeDirectPrint(html);
  } else {
    fallbackPrintWindow(html);
  }
};
