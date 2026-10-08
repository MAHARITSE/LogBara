import { useMemo } from 'react';
import { Package, X, Printer, CheckCircle, AlertTriangle } from 'lucide-react';
import { store } from '../store';
import { Personnel, OuvertureCaisse } from '../types';
import { formatAr } from '../helpers';
import { printOuvertureTicket } from './PrintTicket';

interface Props {
  user: Personnel;
  session: OuvertureCaisse;
  isOpen: boolean;
  onClose: () => void;
}

export default function StockDotationViewModal({ user, session, isOpen, onClose }: Props) {
  const ventes = store.getVentes();
  const lignesVente = store.getLignesVente();

  const stockRecap = useMemo(() => {
    // Calculer les ventes effectuées dans cette session (depuis l'ouverture)
    const sessionVentes = ventes.filter(
      v => v.IDPERSONNEL === session.IDPERSONNEL &&
           v.STATUT === 'Payée' &&
           (v.DATE_VENTE > session.DATE_OUVERTURE ||
            (v.DATE_VENTE === session.DATE_OUVERTURE && v.HEURE >= session.HEURE_OUVERTURE))
    );
    const sessionVenteIds = new Set(sessionVentes.map(v => v.IDVENTE));

    const salesByArticle: Record<number, number> = {};
    lignesVente.forEach(lv => {
      if (sessionVenteIds.has(lv.IDVENTE)) {
        salesByArticle[lv.IDARTICLE] = (salesByArticle[lv.IDARTICLE] || 0) + lv.QUANTITE;
      }
    });

    return session.DOTATIONS.map(dot => {
      const vendus = salesByArticle[dot.IDARTICLE] || 0;
      const restant = Math.max(0, dot.QUANTITE - vendus);
      return {
        ...dot,
        VENDUS: vendus,
        RESTANT: restant,
      };
    });
  }, [session, ventes, lignesVente]);

  if (!isOpen) return null;

  const handlePrint = () => {
    let content = `
      <div class="center bold" style="font-size: 14px; margin-bottom: 4px;">ÉTAT DE STOCK CAISSE</div>
      <div class="center small" style="margin-bottom: 8px;">Session #${session.IDOUVERTURE} - ${session.DATE_OUVERTURE} à ${session.HEURE_OUVERTURE}</div>
      <div class="line"></div>
      <div>Caissier(e) : <b>${session.NOM_PERSONNEL}</b></div>
      <div>Fond de caisse : <b>${formatAr(session.FOND_DE_CAISSE)}</b></div>
      <div class="line"></div>
      <div class="bold" style="margin-bottom: 4px;">RÉCAPITULATIF STOCK :</div>
      <table>
        <thead>
          <tr style="border-bottom: 1px solid #000;">
            <td style="font-weight: bold;">Article</td>
            <td style="font-weight: bold; text-align: center;">Init.</td>
            <td style="font-weight: bold; text-align: center;">Vendu</td>
            <td style="font-weight: bold; text-align: right;">Restant</td>
          </tr>
        </thead>
        <tbody>
    `;

    stockRecap.forEach(item => {
      content += `
        <tr>
          <td>${item.NOM}</td>
          <td style="text-align: center;">${item.QUANTITE}</td>
          <td style="text-align: center;">${item.VENDUS}</td>
          <td style="text-align: right; font-weight: bold;">${item.RESTANT}</td>
        </tr>
      `;
    });

    content += `
        </tbody>
      </table>
      <div class="line"></div>
      <br/><br/>
    `;

    printOuvertureTicket(content, user.IDPERSONNEL, false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 my-8 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-[#0D47A1] flex items-center justify-center font-bold text-xl">
              <Package size={26} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Mon Stock de Caisse</h3>
              <p className="text-sm text-gray-500">
                Session ouverte le {session.DATE_OUVERTURE} à {session.HEURE_OUVERTURE} — {session.NOM_PERSONNEL}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {/* Info Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50/80 p-3.5 rounded-xl border border-blue-100 text-sm">
            <div>
              <span className="text-blue-700 font-medium">Caissier(e) responsable : </span>
              <span className="font-bold text-blue-900 text-base">{session.NOM_PERSONNEL}</span>
              {session.FOND_DE_CAISSE > 0 && (
                <span className="ml-3 text-xs text-blue-800">(Fond : {formatAr(session.FOND_DE_CAISSE)})</span>
              )}
            </div>
            {session.OBSERVATION && (
              <div className="text-xs text-blue-800 italic">
                "{session.OBSERVATION}"
              </div>
            )}
          </div>

          {/* Table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs sticky top-0">
                <tr>
                  <th className="p-3">Article Alloué</th>
                  <th className="p-3 text-center">Dotation Initiale</th>
                  <th className="p-3 text-center">Qté Vendue</th>
                  <th className="p-3 text-right">Stock Restant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stockRecap.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-400">
                      Aucun article alloué dans cette session.
                    </td>
                  </tr>
                ) : (
                  stockRecap.map(item => {
                    const isLow = item.RESTANT <= 2 && item.QUANTITE > 0;
                    const isOut = item.RESTANT === 0 && item.QUANTITE > 0;

                    return (
                      <tr key={item.IDARTICLE} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-3 font-medium text-gray-900">
                          {item.NOM}
                        </td>
                        <td className="p-3 text-center text-gray-700">
                          {item.QUANTITE} pcs
                        </td>
                        <td className="p-3 text-center font-bold text-blue-800">
                          {item.VENDUS} pcs
                        </td>
                        <td className="p-3 text-right">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-xs ${
                            isOut
                              ? 'bg-red-100 text-red-700'
                              : isLow
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {isOut ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                            {item.RESTANT} pcs
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold flex items-center gap-2 text-sm transition-colors"
          >
            <Printer size={18} />
            <span>Imprimer Bon Stock</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#0D47A1] text-white font-bold text-sm hover:bg-[#1565C0] transition-colors"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
