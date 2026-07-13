import { store } from '../store';

const baseStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 5mm; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 5px 0; }
  .double-line { border-top: 2px solid #000; margin: 5px 0; }
  .row { display: flex; justify-content: space-between; }
  .small { font-size: 10px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 2px 0; vertical-align: top; }
  .no-print { display: none; }
  @media print { .no-print { display: none !important; } }
`;

// Impression DIRECTE (Caisse POS, Encaissement Table)
export const printDirect = (content: string) => {
  const societe = store.getSociete();
  if (!societe.UTILISER_IMPRIMANTE) return;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head><style>${baseStyles}</style></head>
    <body>
      <div class="center bold">${societe.NOM}</div>
      <div class="center small">${societe.ADRESSE}</div>
      <div class="center small">Tél: ${societe.TELEPHONE}</div>
      <div class="line"></div>
      ${content}
      <div class="line"></div>
      <div class="center small">Merci de votre visite !</div>
    </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 100);
};

// Impression avec APERÇU (Ventes, Clôture, Stock, etc.)
export const printTicket = (content: string, title = 'Impression') => {
  const societe = store.getSociete();
  if (!societe.UTILISER_IMPRIMANTE) return;

  const win = window.open('', '_blank', 'width=380,height=650');
  if (!win) return;

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        ${baseStyles}
        .print-buttons { 
          position: fixed; 
          bottom: 10px; 
          left: 0; 
          right: 0; 
          display: flex; 
          gap: 10px; 
          padding: 10px;
          background: #fff;
          border-top: 1px solid #ddd;
        }
        .print-btn {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-weight: bold;
          cursor: pointer;
          font-size: 14px;
        }
        .print-btn.primary { background: #0D47A1; color: white; }
        .print-btn.secondary { background: #f3f4f6; color: #333; }
        @media print { 
          .print-buttons { display: none !important; } 
          body { padding-bottom: 0; }
        }
        body { padding-bottom: 70px; }
      </style>
    </head>
    <body>
      <div class="center bold">${societe.NOM}</div>
      <div class="center small">${societe.ADRESSE}</div>
      <div class="center small">Tél: ${societe.TELEPHONE}</div>
      <div class="line"></div>
      ${content}
      <div class="line"></div>
      <div class="center small">Merci de votre visite !</div>
      
      <div class="print-buttons no-print">
        <button class="print-btn secondary" onclick="window.close()">✕ Fermer</button>
        <button class="print-btn primary" onclick="window.print()">🖨️ Imprimer</button>
      </div>
    </body>
    </html>
  `);
  win.document.close();
};
