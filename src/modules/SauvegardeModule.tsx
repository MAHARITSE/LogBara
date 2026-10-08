import { useState, useRef } from 'react';
import { Download, FileSpreadsheet, Database, RotateCcw, ShieldCheck, Upload, AlertTriangle, FileUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import { store } from '../store';
import { Personnel } from '../types';
import ConfirmModal from '../components/ConfirmModal';

interface Props {
  user: Personnel;
}

export default function SauvegardeModule({ user }: Props) {
  const [toast, setToast] = useState('');
  const [resetStep, setResetStep] = useState(0); // 0=off, 1=step1, 2=step2, 3=step3
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.sql')) {
      showMsg('Veuillez sélectionner un fichier avec l’extension .sql');
      e.target.value = '';
      return;
    }

    setRestoreFile(file);
    setShowRestoreModal(true);
    e.target.value = '';
  };

  const handleConfirmRestore = () => {
    if (!restoreFile) return;

    setIsRestoring(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const sqlContent = event.target?.result as string;
        const res = store.restoreSQL(sqlContent);
        showMsg(res.message);
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch (error) {
        setIsRestoring(false);
        setShowRestoreModal(false);
        showMsg(error instanceof Error ? error.message : 'Erreur lors de la restauration SQL');
      }
    };

    reader.onerror = () => {
      setIsRestoring(false);
      setShowRestoreModal(false);
      showMsg('Erreur lors de la lecture du fichier SQL');
    };

    reader.readAsText(restoreFile, 'utf-8');
  };

  const exportExcel = () => {
    const data = store.exportAll();
    const wb = XLSX.utils.book_new();

    Object.entries(data).forEach(([sheetName, value]) => {
      const rows = (Array.isArray(value) ? value : [value]) as unknown as Record<string, unknown>[];
      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
      const cells = [headers, ...rows.map(row => headers.map(header => row[header]))];
      const ws = XLSX.utils.aoa_to_sheet(cells);
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    });

    XLSX.writeFile(wb, `barpos-sauvegarde-${new Date().toISOString().slice(0, 10)}.xlsx`);
    showMsg('Export Excel généré');
  };

  const exportSQL = () => {
    try {
      // La sauvegarde est produite côté PHP directement depuis les tables MySQL.
      // Elle conserve notamment les mots de passe hachés et les vraies colonnes SQL.
      const sql = store.exportSQL();
      const blob = new Blob([sql], { type: 'application/sql;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `barpos-sauvegarde-${new Date().toISOString().slice(0, 10)}.sql`;
      a.click();
      URL.revokeObjectURL(url);
      showMsg('Sauvegarde MySQL générée');
    } catch (error) {
      showMsg(error instanceof Error ? error.message : 'Sauvegarde MySQL impossible');
    }
  };

  const resetData = () => {
    store.resetAll();
    setResetStep(0);
    showMsg('Les données d’exploitation MySQL ont été réinitialisées');
    setTimeout(() => window.location.reload(), 500);
  };

  const stats = store.exportAll();
  const counts = {
    personnel: stats.personnel.length,
    familles: stats.familles.length,
    articles: stats.articles.length,
    tables: stats.tables.length,
    clients: stats.clients.length,
    fournisseurs: stats.fournisseurs.length,
    ventes: stats.ventes.length,
    achats: stats.achats.length,
    clotures: stats.clotures.length,
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

      <input
        ref={fileInputRef}
        type="file"
        accept=".sql"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">💾 Sauvegarde & Restauration</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center"><ShieldCheck size={24} /></div>
            <div>
              <p className="text-sm text-gray-500">Mode conseillé</p>
              <p className="text-xl font-bold text-[#0D47A1]">SQL uniquement</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Ventes sauvegardables</p>
          <p className="text-2xl font-bold">{counts.ventes}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Achats sauvegardables</p>
          <p className="text-2xl font-bold">{counts.achats}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 className="font-bold text-gray-900">Sauvegardes & Restauration</h3>

          <button onClick={exportExcel} className="w-full bg-green-500 text-white py-3 rounded-xl font-bold hover:bg-green-600 flex items-center justify-center gap-2 cursor-pointer">
            <FileSpreadsheet size={18} /> Export brut global (Multi-onglets)
          </button>

          <button onClick={exportSQL} className="w-full bg-[#0D47A1] text-white py-3 rounded-xl font-bold hover:bg-[#1565C0] flex items-center justify-center gap-2 cursor-pointer">
            <Database size={18} /> Export SQL (Sauvegarde)
          </button>

          {user.ROLE === 'Administrateur' ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-amber-600 text-white py-3 rounded-xl font-bold hover:bg-amber-700 flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
            >
              <Upload size={18} /> Restaurer avec un fichier .sql
            </button>
          ) : (
            <div className="w-full bg-gray-100 text-gray-500 py-3 rounded-xl text-center text-sm font-medium">
              Restauration réservée à l’administrateur
            </div>
          )}

          {user.ROLE === 'Administrateur' ? (
            <button onClick={() => setResetStep(1)} className="w-full bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 flex items-center justify-center gap-2">
              <RotateCcw size={18} /> Réinitialiser les données MySQL
            </button>
          ) : (
            <div className="w-full bg-gray-100 text-gray-500 py-3 rounded-xl text-center text-sm font-medium">
              Réinitialisation réservée à l’administrateur
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-semibold mb-1">Stockage & Restauration SQL</p>
            <p>Toutes les données de l’application et les sessions sont conservées dans MySQL. L'import d'un fichier .sql efface les données existantes pour y injecter le contenu de la sauvegarde.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Download size={18} className="text-[#0D47A1]" />
            <h3 className="font-bold text-gray-900">Résumé des données</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-6">
            {[
              ['Personnel', counts.personnel],
              ['Familles', counts.familles],
              ['Articles', counts.articles],
              ['Tables', counts.tables],
              ['Clients', counts.clients],
              ['Fournisseurs', counts.fournisseurs],
              ['Ventes', counts.ventes],
              ['Achats', counts.achats],
              ['Clôtures', counts.clotures],
            ].map(([label, count]) => (
              <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={resetStep === 1}
        type="warning"
        title="Réinitialiser les données MySQL"
        message="Cette action supprime les opérations et remet les stocks et crédits à zéro dans MySQL. Voulez-vous continuer ?"
        confirmText="Oui, réinitialiser"
        cancelText="Annuler"
        onConfirm={() => setResetStep(2)}
        onCancel={() => setResetStep(0)}
      />
      <ConfirmModal open={resetStep === 2} type="danger" title="Confirmation 2/3" message="ATTENTION : Les donnees supprimees seront IRRECUPERABLES. Avez-vous effectue une sauvegarde SQL ?" confirmText="Oui, continuer" cancelText="Revenir" onConfirm={() => setResetStep(3)} onCancel={() => setResetStep(0)} />
      <ConfirmModal open={resetStep === 3} type="danger" title="Derniere confirmation 3/3" message="Cliquer SUPPRIMER pour effacer toutes les ventes, achats, stock, inventaires, mouvements et clotures." confirmText="SUPPRIMER TOUT" cancelText="Annuler" onConfirm={resetData} onCancel={() => setResetStep(0)} />

      {/* Modal Confirmation de Restauration SQL */}
      {showRestoreModal && restoreFile && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4 text-amber-600">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <AlertTriangle size={28} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Restauration depuis fichier .sql</h3>
                  <p className="text-xs text-gray-500">Remplacement complet de la base de données</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-900 space-y-2">
                <p className="font-bold flex items-center gap-2">
                  <span>⚠️</span>
                  <span>Suppression et remplacement intégral des données</span>
                </p>
                <p className="text-xs text-amber-800 leading-relaxed">
                  La restauration va <strong>supprimer tous les enregistrements actuels de la base</strong> (articles, ventes, clients, personnel, tables, stocks, clôtures, achats, mouvements) pour y ajouter le fichier importé.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <FileUp size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 truncate">{restoreFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(restoreFile.size / 1024).toFixed(1)} Ko • Fichier SQL MySQL
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-4 italic text-center">
                Cette opération est irréversible. Les données actuelles non sauvegardées seront perdues.
              </p>
            </div>

            <div className="flex border-t border-gray-100 bg-gray-50 p-3 gap-2">
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => {
                  setShowRestoreModal(false);
                  setRestoreFile(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={handleConfirmRestore}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm text-sm"
              >
                {isRestoring ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Restauration en cours...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={16} />
                    <span>Confirmer la restauration</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
