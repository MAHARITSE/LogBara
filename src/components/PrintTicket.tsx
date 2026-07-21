import { store } from '../store';
import { globalToast } from '../utils/globalToast';

// Génère le HTML complet du ticket
const buildTicketHtml = (content: string) => {
  const societe = store.getSociete();
  
  const logoHtml = societe.LOGO_TYPE === 'emoji' 
    ? `<div style="font-size: 32px; text-align: center; margin-bottom: 8px;">${societe.LOGO_EMOJI}</div>`
    : societe.LOGO_TYPE === 'image' && societe.LOGO_IMAGE
    ? `<div style="text-align: center; margin-bottom: 8px;"><img src="${societe.LOGO_IMAGE}" style="max-width: 60px; max-height: 60px;" /></div>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Ticket</title>
      <style>
        @page { margin: 0; size: 80mm auto; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          width: 80mm;
          padding: 5mm;
          line-height: 1.4;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; }
        .right { text-align: right; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; vertical-align: top; }
        .small { font-size: 10px; }
        .header { margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="header center">
        ${logoHtml}
        <div class="bold">${societe.NOM}</div>
        <div class="small">${societe.ADRESSE}</div>
        <div class="small">Tel: ${societe.TELEPHONE}</div>
        ${societe.NIF ? `<div class="small">NIF: ${societe.NIF}</div>` : ''}
      </div>
      <div class="line"></div>
      ${content}
      <div class="line"></div>
      <div class="center small">Merci de votre visite !</div>
    </body>
    </html>
  `;
};

/**
 * Impression DIRECTE : ouvre une fenêtre, lance window.print() automatiquement
 * puis ferme la fenêtre. Utilisé pour les tickets de caisse, tables, remboursements.
 *
 * Si l'option "Utiliser l'imprimante" est désactivée dans les paramètres société,
 * aucune impression ni aucun aperçu n'est ouvert : une simple notification
 * informe que le ticket n'a pas été imprimé.
 */
export const printTicket = (content: string) => {
  const societe = store.getSociete();

  // Imprimante désactivée → pas d'impression, pas d'aperçu, juste une notification
  if (!societe.UTILISER_IMPRIMANTE) {
    globalToast('Impression désactivée — ticket non imprimé', 'info');
    return;
  }

  const html = buildTicketHtml(content);
  const printWindow = window.open('', '_blank', 'width=350,height=600');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      // Fermer après un délai pour laisser le dialogue d'impression se terminer
      setTimeout(() => {
        try { printWindow.close(); } catch (_) { /* ignore */ }
      }, 1000);
    };
  }
};

/**
 * Impression APERÇU : ouvre une fenêtre qui reste ouverte pour consultation.
 * L'utilisateur peut imprimer manuellement s'il le souhaite.
 * Utilisé pour clôture, factures, récap TCD, bons d'achat.
 */
export const printPreview = (content: string) => {
  const html = buildTicketHtml(content);
  const printWindow = window.open('', '_blank', 'width=350,height=600');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
};
