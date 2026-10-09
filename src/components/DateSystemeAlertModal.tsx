import { useState, useEffect } from 'react';
import { AlertTriangle, CalendarX, Clock, RefreshCw, X, ShieldAlert } from 'lucide-react';
import { store } from '../store';
import { today } from '../helpers';

interface Props {
  onAcknowledge?: () => void;
}

export default function DateSystemeAlertModal({ onAcknowledge }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [systemDate, setSystemDate] = useState(() => today());
  const [lastVenteDate, setLastVenteDate] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkDate = () => {
    setIsRefreshing(true);
    const currSysDate = today();
    setSystemDate(currSysDate);

    // Trouver la date de la dernière vente enregistrée dans l'application
    const ventes = store.getVentes();
    const latestDate = ventes.reduce<string | null>((max, v) => {
      if (!v.DATE_VENTE) return max;
      return !max || v.DATE_VENTE > max ? v.DATE_VENTE : max;
    }, null);

    setLastVenteDate(latestDate);

    // Alerte si la date système est STRICTEMENT INFÉRIEURE à la date de la dernière vente
    if (latestDate && currSysDate < latestDate) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setDismissed(false);
    }

    setTimeout(() => setIsRefreshing(false), 300);
  };

  useEffect(() => {
    // Vérification initiale à l'ouverture de l'application
    checkDate();

    // Revérifier périodiquement ou lors du focus de la fenêtre (si l'utilisateur corrige l'heure Windows)
    const handleFocus = () => checkDate();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const handleDismiss = () => {
    setIsOpen(false);
    setDismissed(true);
    if (onAcknowledge) onAcknowledge();
  };

  const isAnomalous = Boolean(lastVenteDate && systemDate < lastVenteDate);

  if (!isAnomalous) return null;

  return (
    <>
      {/* BANDEAU PERSISTANT EN HAUT SI LE MODAL A ÉTÉ MASQUÉ */}
      {dismissed && (
        <div className="bg-red-600 text-white px-4 py-2 text-xs sm:text-sm font-bold flex items-center justify-between gap-3 sticky top-0 z-[100] shadow-md animate-in slide-in-from-top">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="shrink-0 text-amber-300 animate-pulse" />
            <span>
              ⚠️ <strong>Anomalie de date système détectée :</strong> Date PC = {systemDate} &lt; Dernière vente = {lastVenteDate}. Veuillez corriger la date de votre ordinateur.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={checkDate}
              className="bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Revérifier la date système"
            >
              <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
              <span>Revérifier</span>
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="bg-white text-red-700 px-2.5 py-1 rounded text-xs font-bold cursor-pointer hover:bg-gray-100 transition-colors"
            >
              Voir détails
            </button>
          </div>
        </div>
      )}

      {/* MODAL PRINCIPAL D'ALERTE */}
      {isOpen && (
        <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border-2 border-red-500 animate-in zoom-in-95">
            {/* Header rouge d'alerte */}
            <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
                  <ShieldAlert size={26} className="text-white animate-bounce" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">ALERTE DATE DU SYSTÈME</h3>
                  <p className="text-xs text-red-100 font-medium">Incohérence chronologique critique détectée</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDismiss}
                className="text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                title="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenu explicatif */}
            <div className="p-6 space-y-5 text-gray-800">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs sm:text-sm text-red-900 leading-relaxed">
                <p className="font-bold text-red-950 mb-1 flex items-center gap-1.5">
                  <AlertTriangle size={16} className="text-red-600 shrink-0" />
                  La date de votre ordinateur est en retard sur l'application !
                </p>
                La date actuelle fournie par votre système d'exploitation est{' '}
                <strong className="underline underline-offset-2">strictement inférieure</strong> à la date de la dernière vente déjà enregistrée dans la base de données.
              </div>

              {/* Comparatif visuel des dates */}
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-red-50/70 border border-red-200 rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-red-700 uppercase tracking-wider">
                    <Clock size={13} />
                    <span>Date Système (PC)</span>
                  </div>
                  <p className="text-xl font-black text-red-700 tabular-nums">
                    {systemDate}
                  </p>
                  <span className="text-[10px] text-red-500 font-semibold block">
                    (Date de votre machine)
                  </span>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                    <CalendarX size={13} />
                    <span>Dernière vente</span>
                  </div>
                  <p className="text-xl font-black text-emerald-800 tabular-nums">
                    {lastVenteDate}
                  </p>
                  <span className="text-[10px] text-emerald-600 font-semibold block">
                    (Enregistrée dans l'app)
                  </span>
                </div>
              </div>

              {/* Risque et recommandations */}
              <div className="space-y-2 text-xs text-gray-600 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <p className="font-bold text-gray-800 flex items-center gap-1">
                  <span>💡</span> Conséquences si non corrigé :
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 pl-1">
                  <li>Les nouvelles ventes porteront une date antérieure (dans le passé).</li>
                  <li>La clôture de caisse et les calculs de stocks peuvent être incohérents.</li>
                  <li>Le suivi chronologique des dettes et crédits clients sera faussé.</li>
                </ul>
                <div className="pt-2 text-blue-900 font-semibold border-t border-gray-200 text-[11px]">
                  👉 <strong>Action recommandée :</strong> Ajustez la date et l'heure dans les paramètres Windows ou système de cet ordinateur à la date du jour réelle, puis cliquez sur <strong>Revérifier</strong>.
                </div>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={checkDate}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-800 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-[#0D47A1]' : ''} />
                <span>Revérifier la date</span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold transition-all cursor-pointer shadow-sm active:scale-95 text-center"
              >
                Continuer malgré tout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
