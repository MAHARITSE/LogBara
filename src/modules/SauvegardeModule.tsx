import { useState } from 'react';
import { Download, FileSpreadsheet, Database, RotateCcw, ShieldCheck } from 'lucide-react';
import * as XLSX from 'xlsx';
import { store } from '../store';
import { Personnel } from '../types';
import ConfirmModal from '../components/ConfirmModal';

interface Props {
  user: Personnel;
}

export default function SauvegardeModule({ user: _user }: Props) {
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
      const rows = Array.isArray(value) ? value : [value];
      const ws = XLSX.utils.json_to_sheet(rows as unknown as Record<string, unknown>[]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    });

    XLSX.writeFile(wb, `barpos-sauvegarde-${new Date().toISOString().slice(0, 10)}.xlsx`);
    showMsg('Export Excel généré');
  };

  const sqlValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return 'NULL';
    if (typeof value === 'number' || typeof value === 'boolean') return Number(value).toString();
    return `'${String(value).replace(/'/g, "''")}'`;
  };

  const buildInsert = (table: string, rows: Record<string, unknown>[]) => {
    if (!rows.length) return '';
    const columns = Object.keys(rows[0]);
    const values = rows.map(row => `(${columns.map(col => sqlValue(row[col])).join(', ')})`).join(',\n');
    return `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${values};\n\n`;
  };

  const exportSQL = () => {
    const data = store.exportAll();
    const sql = [
      '-- ============================================',
      '-- SAUVEGARDE SQL BAR POS',
      '-- Généré depuis l\'application',
      '-- ============================================',
      'SET NAMES utf8mb4;',
      'SET FOREIGN_KEY_CHECKS = 0;',
      '',
      'USE barpos_db;',
      '',
      'TRUNCATE TABLE consommations;',
      'TRUNCATE TABLE lignes_inventaire;',
      'TRUNCATE TABLE inventaires;',
      'TRUNCATE TABLE lignes_achat;',
      'TRUNCATE TABLE achats;',
      'TRUNCATE TABLE mouvements;',
      'TRUNCATE TABLE paiements;',
      'TRUNCATE TABLE lignes_vente;',
      'TRUNCATE TABLE ventes;',
      'TRUNCATE TABLE clotures;',
      'TRUNCATE TABLE clients;',
      'TRUNCATE TABLE fournisseurs;',
      'TRUNCATE TABLE tables_resto;',
      'TRUNCATE TABLE articles;',
      'TRUNCATE TABLE familles;',
      'TRUNCATE TABLE personnel;',
      'TRUNCATE TABLE societe;',
      '',
      buildInsert('societe', [data.societe as unknown as Record<string, unknown>]),
      buildInsert('personnel', data.personnel as unknown as Record<string, unknown>[]),
      buildInsert('familles', data.familles as unknown as Record<string, unknown>[]),
      buildInsert('articles', data.articles as unknown as Record<string, unknown>[]),
      buildInsert('tables_resto', data.tables as unknown as Record<string, unknown>[]),
      buildInsert('clients', data.clients as unknown as Record<string, unknown>[]),
      buildInsert('fournisseurs', data.fournisseurs as unknown as Record<string, unknown>[]),
      buildInsert('clotures', data.clotures as unknown as Record<string, unknown>[]),
      buildInsert('ventes', data.ventes as unknown as Record<string, unknown>[]),
      buildInsert('lignes_vente', data.lignes_vente as unknown as Record<string, unknown>[]),
      buildInsert('paiements', data.paiements as unknown as Record<string, unknown>[]),
      buildInsert('mouvements', data.mouvements as unknown as Record<string, unknown>[]),
      buildInsert('achats', data.achats as unknown as Record<string, unknown>[]),
      buildInsert('lignes_achat', data.lignes_achat as unknown as Record<string, unknown>[]),
      buildInsert('inventaires', data.inventaires as unknown as Record<string, unknown>[]),
      buildInsert('lignes_inventaire', data.lignes_inventaire as unknown as Record<string, unknown>[]),
      buildInsert('consommations', data.consommations as unknown as Record<string, unknown>[]),
      'SET FOREIGN_KEY_CHECKS = 1;',
      '-- FIN SAUVEGARDE',
    ].join('\n');

    const blob = new Blob([sql], { type: 'application/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barpos-sauvegarde-${new Date().toISOString().slice(0, 10)}.sql`;
    a.click();
    URL.revokeObjectURL(url);
    showMsg('Export SQL généré');
  };

  const resetData = () => {
    store.resetAll();
    setResetStep(0);
    showMsg('Toutes les données ont été supprimées');
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
      {toast && <div className="fixed top-4 right-4 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

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

          <button onClick={() => setResetStep(1)} className="w-full bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 flex items-center justify-center gap-2">
            <RotateCcw size={18} /> Réinitialiser les données locales
          </button>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-semibold mb-1">Recommandation</p>
            <p>Pour WAMP/phpMyAdmin, utilisez prioritairement l’export SQL. Le JSON n’est pas proposé ici, conformément à votre consigne.</p>
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
        title="Réinitialiser les données"
        message="Cette action supprime toutes les données locales de l’application. Voulez-vous continuer ?"
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
