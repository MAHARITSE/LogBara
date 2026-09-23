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
 * Impression DIRECTE : ouvre une fenêtre avec aperçu et lance window.print()
 * pour le choix de l'imprimante. Utilisé pour les tickets de caisse, tables, etc.
 *
 * Si force est true (comme pour la clôture de caisse), l'aperçu et le choix d'imprimante
 * s'ouvrent TOUJOURS, même si l'option "Utiliser l'imprimante" est désactivée dans la gestion société.
 */
export const printTicket = (content: string, force: boolean = false) => {
  const societe = store.getSociete();

  // Si l'imprimante est désactivée ET que l'impression n'est pas forcée :
  // afficher uniquement la notification d'enregistrement
  if (!societe.UTILISER_IMPRIMANTE && !force) {
    globalToast('✓ Paiement enregistré', 'success', 3000, 'center');
    return;
  }

  const html = buildTicketHtml(content);
  try {
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    } else {
      globalToast('Aperçu bloqué par le navigateur', 'info');
    }
  } catch {
    globalToast('Aperçu non disponible dans cet environnement', 'info');
  }
};

/**
 * Impression APERÇU : ouvre une fenêtre qui reste ouverte pour consultation.
 * L'utilisateur peut imprimer manuellement ou déclencher l'impression automatique.
 */
export const printPreview = (content: string, autoPrint: boolean = false) => {
  const html = buildTicketHtml(content);
  try {
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      if (autoPrint) {
        printWindow.onload = () => {
          printWindow.focus();
          printWindow.print();
        };
      }
    } else {
      globalToast('Aperçu bloqué par le navigateur', 'info');
    }
  } catch {
    globalToast('Aperçu non disponible dans cet environnement', 'info');
  }
};
