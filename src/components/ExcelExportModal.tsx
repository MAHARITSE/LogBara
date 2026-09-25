import { useState, useMemo } from 'react';
import { FileSpreadsheet, Download, X, Check, ShoppingCart, ShoppingBag, Layers, Award } from 'lucide-react';
import { store } from '../store';
import { formatAr, dateLabel } from '../helpers';
import { getPresetDateRange, exportVentesToExcel, exportAchatsToExcel } from '../utils/excelExporter';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultType?: 'ventes' | 'achats' | 'tout';
}

type PeriodPreset = 'this_month' | 'last_month' | 'today' | 'last_7_days' | 'custom';

export default function ExcelExportModal({ open, onClose, defaultType = 'ventes' }: Props) {
  const [exportType, setExportType] = useState<'ventes' | 'achats' | 'tout'>(defaultType);
  const [preset, setPreset] = useState<PeriodPreset>('this_month');

  // Dates personnalisées
  const [dateDebut, setDateDebut] = useState(() => getPresetDateRange('this_month').debut);
  const [dateFin, setDateFin] = useState(() => getPresetDateRange('this_month').fin);
  const [downloading, setDownloading] = useState(false);

  const handlePresetChange = (newPreset: PeriodPreset) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      const range = getPresetDateRange(newPreset);
      setDateDebut(range.debut);
      setDateFin(range.fin);
    }
  };

  const ventes = store.getVentes();
  const achats = store.getAchats();
  const articles = store.getArticles();

  // Statistiques en direct sur la période choisie
  const liveStats = useMemo(() => {
    const vPeriod = ventes.filter(v => v.STATUT === 'Payée' && v.DATE_VENTE >= dateDebut && v.DATE_VENTE <= dateFin);
    const totalVentesBrut = vPeriod.reduce((s, v) => s + v.TOTAL, 0);
    const totalRemises = vPeriod.reduce((s, v) => s + (v.REMISE || 0), 0);
    const totalVentesNet = totalVentesBrut - totalRemises;

    const aPeriod = achats.filter(a => a.DATE_ACHAT >= dateDebut && a.DATE_ACHAT <= dateFin);
    const totalAchats = aPeriod.reduce((s, a) => s + (a.TOTAL || 0), 0);

    // Nombre de jours distincts avec ventes
    const joursVentes = new Set(vPeriod.map(v => v.DATE_VENTE)).size;

    return {
      nbVentes: vPeriod.length,
      joursVentes,
      totalVentesNet,
      nbAchats: aPeriod.length,
      totalAchats,
      margeEstimee: totalVentesNet - totalAchats,
    };
  }, [ventes, achats, dateDebut, dateFin]);

  if (!open) return null;

  const handleExecuteExport = () => {
    setDownloading(true);
    try {
      if (exportType === 'ventes') {
        exportVentesToExcel(dateDebut, dateFin);
      } else if (exportType === 'achats') {
        exportAchatsToExcel(dateDebut, dateFin);
      } else {
        exportVentesToExcel(dateDebut, dateFin);
        setTimeout(() => {
          exportAchatsToExcel(dateDebut, dateFin);
        }, 500);
      }
      setTimeout(() => {
        setDownloading(false);
        onClose();
      }, 700);
    } catch (e) {
      console.error(e);
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
        
        {/* En-tête vert Excel */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
              <FileSpreadsheet size={24} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg sm:text-xl">Exportation Excel (.xlsx)</h2>
              <p className="text-xs text-emerald-100">Rapport comptable et analytique pour la gérance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-gray-800">
          
          {/* 1. Choix du type de rapport */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              1. Type de rapport à exporter
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setExportType('ventes')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  exportType === 'ventes'
                    ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <ShoppingCart size={18} className={exportType === 'ventes' ? 'text-emerald-600' : 'text-gray-400'} />
                  {exportType === 'ventes' && <Check size={16} className="text-emerald-600 font-bold" />}
                </div>
                <p className="font-bold text-xs sm:text-sm text-gray-900">Ventes</p>
                <p className="text-[11px] text-gray-500 line-clamp-1">Jour par jour</p>
              </button>

              <button
                type="button"
                onClick={() => setExportType('achats')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  exportType === 'achats'
                    ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <ShoppingBag size={18} className={exportType === 'achats' ? 'text-emerald-600' : 'text-gray-400'} />
                  {exportType === 'achats' && <Check size={16} className="text-emerald-600 font-bold" />}
                </div>
                <p className="font-bold text-xs sm:text-sm text-gray-900">Achats</p>
                <p className="text-[11px] text-gray-500 line-clamp-1">Meilleurs prix</p>
              </button>

              <button
                type="button"
                onClick={() => setExportType('tout')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  exportType === 'tout'
                    ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Layers size={18} className={exportType === 'tout' ? 'text-emerald-600' : 'text-gray-400'} />
                  {exportType === 'tout' && <Check size={16} className="text-emerald-600 font-bold" />}
                </div>
                <p className="font-bold text-xs sm:text-sm text-gray-900">Pack Complet</p>
                <p className="text-[11px] text-gray-500 line-clamp-1">Ventes + Achats</p>
              </button>
            </div>
          </div>

          {/* 2. Choix de la période */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              2. Sélection de la période
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { id: 'this_month', label: 'Ce mois-ci' },
                { id: 'last_month', label: 'Mois précédent' },
                { id: 'last_7_days', label: '7 derniers jours' },
                { id: 'today', label: "Aujourd'hui" },
                { id: 'custom', label: 'Personnalisé' },
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePresetChange(item.id as PeriodPreset)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    preset === item.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Sélecteurs de dates début / fin */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-200/80">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1 block">Date de début</label>
                <input
                  type="date"
                  value={dateDebut}
                  onChange={e => {
                    setDateDebut(e.target.value);
                    setPreset('custom');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1 block">Date de fin</label>
                <input
                  type="date"
                  value={dateFin}
                  onChange={e => {
                    setDateFin(e.target.value);
                    setPreset('custom');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* 3. Aperçu des données trouvées */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/50 border border-emerald-200">
            <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <span>📊</span>
              <span>Aperçu des données incluses ({dateLabel(dateDebut)} au {dateLabel(dateFin)})</span>
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              {(exportType === 'ventes' || exportType === 'tout') && (
                <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-100 shadow-2xs">
                  <p className="text-gray-500 text-[10px]">Ventes comptabilisées</p>
                  <p className="font-extrabold text-gray-900 text-sm">{liveStats.nbVentes} factures</p>
                  <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">{formatAr(liveStats.totalVentesNet)}</p>
                </div>
              )}

              {(exportType === 'achats' || exportType === 'tout') && (
                <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-100 shadow-2xs">
                  <p className="text-gray-500 text-[10px]">Achats fournisseurs</p>
                  <p className="font-extrabold text-gray-900 text-sm">{liveStats.nbAchats} commandes</p>
                  <p className="text-[10px] text-orange-600 font-semibold mt-0.5">{formatAr(liveStats.totalAchats)}</p>
                </div>
              )}

              <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-100 shadow-2xs">
                <p className="text-gray-500 text-[10px]">Articles au catalogue</p>
                <p className="font-extrabold text-gray-900 text-sm">{articles.length} articles</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{liveStats.joursVentes} jours d'activité</p>
              </div>
            </div>

            {/* Note informative sur la mise en forme de l'Excel */}
            <div className="mt-3 pt-2.5 border-t border-emerald-200/60 text-[11px] text-emerald-950 space-y-1">
              {exportType === 'ventes' && (
                <p className="flex items-start gap-1.5">
                  <Check size={14} className="text-emerald-700 shrink-0 mt-0.5" />
                  <span><strong>Regroupement jour par jour :</strong> Ventes classées avec sous-totaux quotidiens et synthèse des articles vendus.</span>
                </p>
              )}
              {exportType === 'achats' && (
                <p className="flex items-start gap-1.5">
                  <Award size={14} className="text-emerald-700 shrink-0 mt-0.5" />
                  <span><strong>Comparatif Fournisseurs :</strong> Identification et mise en avant des meilleurs prix d'achat constatés pour chaque article.</span>
                </p>
              )}
              {exportType === 'tout' && (
                <p className="flex items-start gap-1.5">
                  <Check size={14} className="text-emerald-700 shrink-0 mt-0.5" />
                  <span><strong>Pack complet :</strong> 2 classeurs Excel complets avec regroupements journaliers et analyse des meilleurs prix.</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-gray-600 hover:bg-gray-200 text-sm font-semibold transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleExecuteExport}
            disabled={downloading}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            <Download size={18} />
            <span>{downloading ? 'Génération...' : 'Télécharger le fichier Excel'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
