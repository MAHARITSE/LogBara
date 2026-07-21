import { useState } from 'react';
import { Download, FileSpreadsheet, Database, RotateCcw, ShieldCheck } from 'lucide-react';
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

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
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

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">💾 Sauvegarde</h1>
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
          <h3 className="font-bold text-gray-900">Exports disponibles</h3>

          <button onClick={exportExcel} className="w-full bg-green-500 text-white py-3 rounded-xl font-bold hover:bg-green-600 flex items-center justify-center gap-2">
            <FileSpreadsheet size={18} /> Export Excel multi-onglets
          </button>

          <button onClick={exportSQL} className="w-full bg-[#0D47A1] text-white py-3 rounded-xl font-bold hover:bg-[#1565C0] flex items-center justify-center gap-2">
            <Database size={18} /> Export SQL
          </button>

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
            <p className="font-semibold mb-1">Stockage MySQL exclusif</p>
            <p>Toutes les données de l’application et les sessions sont conservées dans MySQL. Utilisez l’export SQL pour une sauvegarde complète.</p>
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
    </div>
  );
}
