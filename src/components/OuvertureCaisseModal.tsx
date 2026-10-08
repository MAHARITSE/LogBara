import { useState } from 'react';
import { KeyRound, Package, X, Printer } from 'lucide-react';
import { store } from '../store';
import { Personnel, OuvertureCaisse, DotationArticle, Mouvement } from '../types';
import { today, nowTime, nextId } from '../helpers';
import { printOuvertureTicket } from './PrintTicket';

interface Props {
  user: Personnel;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (ouverture: OuvertureCaisse) => void;
}

export default function OuvertureCaisseModal({ user, isOpen, onClose, onSuccess }: Props) {
  const articles = store.getArticles().filter(a => a.ACTIF && a.GERE_STOCK);
  
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (andPrint = true) => {
    setLoading(true);

    try {
      const history = store.getOuverturesHistory();
      const idOuverture = nextId(history, 'IDOUVERTURE');

      const dotationList: DotationArticle[] = articles.map(a => ({
        IDARTICLE: a.IDARTICLE,
        NOM: a.NOM,
        QUANTITE: a.STOCK,
      }));

      const newOuverture: OuvertureCaisse = {
        IDOUVERTURE: idOuverture,
        DATE_OUVERTURE: today(),
        HEURE_OUVERTURE: nowTime(),
        IDPERSONNEL: user.IDPERSONNEL,
        NOM_PERSONNEL: `${user.PRENOM} ${user.NOM}`,
        FOND_DE_CAISSE: 0,
        DOTATIONS: dotationList,
        ACTIVE: true,
      };

      // Enregistrer la session d'ouverture
      store.setOuvertureSession(newOuverture);

      // Enregistrer les mouvements de stock pour traçabilité de la dotation
      const mouvements = store.getMouvements();
      let lastMovId = nextId(mouvements, 'IDMOUVEMENT');
      const newMouvements: Mouvement[] = [];

      dotationList.forEach(d => {
        newMouvements.push({
          IDMOUVEMENT: lastMovId++,
          DATE_MOUVEMENT: today(),
          HEURE: nowTime(),
          IDARTICLE: d.IDARTICLE,
          TYPE: 'Ajustement',
          QUANTITE: d.QUANTITE,
          REFERENCE: `Dotation Ouverture Caisse #${idOuverture} - ${user.PRENOM}`,
        });
      });

      if (newMouvements.length > 0) {
        store.setMouvements([...mouvements, ...newMouvements]);
      }

      // Imprimer le ticket d'ouverture si demandé
      if (andPrint) {
        let content = `
          <div class="center bold" style="font-size: 14px; margin-bottom: 4px;">BON D'OUVERTURE DE CAISSE</div>
          <div class="center small" style="margin-bottom: 8px;">N° ${idOuverture} - ${today()} à ${nowTime()}</div>
          <div class="line"></div>
          <div>Caissier(e) : <b>${user.PRENOM} ${user.NOM}</b></div>
          <div class="line"></div>
          <div class="bold" style="margin-bottom: 4px;">STOCK ET ARTICLES ALLOUÉS :</div>
          <table>
            <thead>
              <tr style="border-bottom: 1px solid #000;">
                <td style="font-weight: bold;">Article</td>
                <td style="font-weight: bold; text-align: right;">Qté Donnée</td>
              </tr>
            </thead>
            <tbody>
        `;

        if (dotationList.length === 0) {
          content += `<tr><td colspan="2" style="text-align: center; padding: 4px 0;">Aucun stock attribué</td></tr>`;
        } else {
          dotationList.forEach(d => {
            content += `
              <tr>
                <td>${d.NOM}</td>
                <td style="text-align: right; font-weight: bold;">${d.QUANTITE}</td>
              </tr>
            `;
          });
        }

        content += `
            </tbody>
          </table>
          <div class="line"></div>
          <div style="margin-top: 15px; display: flex; justify-content: space-between; font-size: 10px;">
            <div>Signature Caissier</div>
            <div>Signature Responsable</div>
          </div>
          <br/><br/>
        `;

        printOuvertureTicket(content, user.IDPERSONNEL, true);
      }

      onSuccess(newOuverture);
      onClose();
    } catch (err) {
      console.error('Erreur lors de l\'ouverture de caisse:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 my-8 animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-[#0D47A1] flex items-center justify-center font-bold text-xl">
              <KeyRound size={26} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Ouverture de Caisse & Dotation Stock</h3>
              <p className="text-sm text-gray-500">Validation de l'ouverture de la session caisse avec attribution automatique du stock</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          {/* Dotation Stock pour la caisse */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package size={20} className="text-[#0D47A1]" />
              <h4 className="font-bold text-gray-800 text-base">Dotation en Stock de Caisse</h4>
            </div>

            <p className="text-xs text-gray-500 mb-3">
              Stock d'articles alloué automatiquement à la caisse pour la session :
            </p>

            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs sticky top-0 z-10">
                    <tr>
                      <th className="p-3">Article</th>
                      <th className="p-3 text-right">Qté Remise en Caisse</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {articles.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="p-4 text-center text-gray-400">
                          Aucun article géré en stock.
                        </td>
                      </tr>
                    ) : (
                      articles.map(art => (
                        <tr key={art.IDARTICLE} className="hover:bg-gray-50/80 transition-colors">
                          <td className="p-3">
                            <div className="font-medium text-gray-900 flex items-center gap-2">
                              <span>{art.EMOJI || '📦'}</span>
                              <span>{art.NOM}</span>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <span className="inline-block px-3 py-1 bg-blue-50 text-[#0D47A1] font-bold text-xs rounded-lg border border-blue-100">
                              {art.STOCK} pcs
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Annuler / Page de connexion
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSubmit(true)}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#0D47A1] hover:bg-[#1565C0] text-white font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] cursor-pointer"
          >
            <KeyRound size={18} />
            <Printer size={18} />
            <span>Valider l'Ouverture & Imprimer</span>
          </button>
        </div>

      </div>
    </div>
  );
}
