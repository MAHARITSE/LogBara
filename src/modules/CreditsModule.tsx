import { useMemo, useState } from 'react';
import { CreditCard, Wallet, CheckCircle2, Search, X } from 'lucide-react';
import { store } from '../store';
import { Personnel } from '../types';
import { formatAr, nextId, nowTime, today } from '../helpers';
import { printTicket } from '../components/PrintTicket';
import ConfirmModal from '../components/ConfirmModal';

interface Props { user: Personnel }

export default function CreditsModule({ user }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [montant, setMontant] = useState('');
  const [modePaiement, setModePaiement] = useState<'Espèces' | 'Mobile Money'>('Espèces');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const clients = useMemo(() => store.getClients(), [refreshKey]);
  const paiements = useMemo(() => store.getPaiements(), [refreshKey]);

  const showMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const filteredClients = useMemo(() => {
    return clients
      .filter(c => c.CREDIT_TOTAL > 0)
      .filter(c => c.NOM_CLIENT.toLowerCase().includes(searchTerm.toLowerCase()) || c.TELEPHONE.includes(searchTerm))
      .sort((a, b) => b.CREDIT_TOTAL - a.CREDIT_TOTAL);
  }, [clients, searchTerm]);

  const totalCredits = clients.reduce((s, c) => s + c.CREDIT_TOTAL, 0);
  const totalClientsCredit = clients.filter(c => c.CREDIT_TOTAL > 0).length;
  const remboursementsJour = paiements.filter(p => p.DATE_PAIEMENT === today() && !p.IDVENTE);
  const totalRemboursementsJour = remboursementsJour.reduce((s, p) => s + p.MONTANT, 0);

  const selected = clients.find(c => c.IDCLIENT === selectedClient) || null;
  const montantNum = Math.max(0, Number(montant) || 0);

  const openRemboursement = (clientId: number) => {
    const c = clients.find(cl => cl.IDCLIENT === clientId);
    setSelectedClient(clientId);
    setMontant(c ? String(c.CREDIT_TOTAL) : '');
    setModePaiement('Espèces');
  };

  const handleRemboursement = () => {
    if (!selected || montantNum <= 0) { showMsg('Montant invalide'); return; }
    if (montantNum > selected.CREDIT_TOTAL) { showMsg('Le montant dépasse le crédit'); return; }

    const updatedClients = clients.map(c =>
      c.IDCLIENT === selected.IDCLIENT ? { ...c, CREDIT_TOTAL: Math.max(0, c.CREDIT_TOTAL - montantNum) } : c
    );

    const newPaiement = {
      IDPAIEMENT: nextId(paiements, 'IDPAIEMENT'),
      DATE_PAIEMENT: today(),
      HEURE: nowTime(),
      IDVENTE: null,
      IDPERSONNEL: user.IDPERSONNEL,
      MONTANT: montantNum,
      MODE_PAIEMENT: modePaiement,
      IDCLIENT: selected.IDCLIENT,
    };

    store.setClients(updatedClients);
    store.setPaiements([...paiements, newPaiement]);

    // Imprimer le ticket de remboursement
    const resteApres = Math.max(0, selected.CREDIT_TOTAL - montantNum);
    printTicket(`
      <div class="center bold">TICKET DE REMBOURSEMENT</div>
      <div class="row"><span>${today()}</span><span>${nowTime()}</span></div>
      <div>Caissier: ${user.PRENOM} ${user.NOM}</div>
      <div class="line"></div>
      <div class="row"><span>Client</span><span>${selected.NOM_CLIENT}</span></div>
      <div class="row"><span>Mode</span><span>${modePaiement}</span></div>
      <div class="line"></div>
      <div class="row"><span>Credit avant</span><span>${formatAr(selected.CREDIT_TOTAL)}</span></div>
      <div class="row bold"><span>Montant rembourse</span><span>${formatAr(montantNum)}</span></div>
      <div class="row"><span>Reste</span><span>${formatAr(resteApres)}</span></div>
    `);

    setShowConfirm(false);
    setSelectedClient(null);
    setMontant('');
    setRefreshKey(k => k + 1);
    showMsg(`Remboursement de ${formatAr(montantNum)} enregistré pour ${selected.NOM_CLIENT}`);
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0D47A1] text-white px-5 py-3 rounded-xl shadow-lg z-50 animate-pulse">{toast}</div>}

      <h1 className="text-2xl font-bold text-gray-900">💳 Crédits clients</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center"><CreditCard size={24} /></div>
            <div><p className="text-sm text-gray-500">Crédit total</p><p className="text-2xl font-bold text-red-500">{formatAr(totalCredits)}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center"><Wallet size={24} /></div>
            <div><p className="text-sm text-gray-500">Clients débiteurs</p><p className="text-2xl font-bold">{totalClientsCredit}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center"><CheckCircle2 size={24} /></div>
            <div><p className="text-sm text-gray-500">Remboursements du jour</p><p className="text-2xl font-bold text-green-600">{formatAr(totalRemboursementsJour)}</p></div>
          </div>
        </div>
      </div>

      {/* Tableau des clients débiteurs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Rechercher un client débiteur..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-[#0D47A1]" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Téléphone</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Crédit</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(c => (
                <tr key={c.IDCLIENT} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.NOM_CLIENT}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.TELEPHONE || '-'}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-500">{formatAr(c.CREDIT_TOTAL)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => openRemboursement(c.IDCLIENT)} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-600">Rembourser</button>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && <tr><td colSpan={4} className="text-center py-10 text-gray-400">Aucun crédit en cours</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal remboursement */}
      {selectedClient && selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedClient(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0D47A1] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">💵 Remboursement</h3>
              <button onClick={() => setSelectedClient(null)}><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="font-bold text-gray-900 text-lg">{selected.NOM_CLIENT}</p>
                <p className="text-sm text-gray-500">{selected.TELEPHONE}</p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <p className="text-sm text-gray-500">Crédit actuel</p>
                <p className="text-2xl font-bold text-red-500">{formatAr(selected.CREDIT_TOTAL)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Montant remboursé</label>
                <input type="number" value={montant} onChange={e => setMontant(e.target.value)} className="w-full px-4 py-3 rounded-xl border text-center text-xl font-bold" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Mode de paiement</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Espèces', 'Mobile Money'] as const).map(mode => (
                    <button key={mode} onClick={() => setModePaiement(mode)} className={`py-2.5 rounded-xl text-sm font-medium ${modePaiement === mode ? 'bg-[#0D47A1] text-white' : 'bg-gray-100 text-gray-600'}`}>{mode}</button>
                  ))}
                </div>
              </div>
              {montantNum > 0 && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-sm">
                  <div className="flex justify-between"><span>Reste après remboursement</span><span className="font-bold text-green-700">{formatAr(Math.max(0, selected.CREDIT_TOTAL - montantNum))}</span></div>
                </div>
              )}
              <button onClick={() => setShowConfirm(true)} disabled={montantNum <= 0 || montantNum > selected.CREDIT_TOTAL} className="w-full bg-green-500 text-white py-3 rounded-xl font-bold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed">Confirmer le remboursement</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={showConfirm} type="success" title="Confirmer le remboursement" message={selected ? `Enregistrer ${formatAr(montantNum)} pour ${selected.NOM_CLIENT} ?` : ''} confirmText="Oui, enregistrer" cancelText="Annuler" onConfirm={handleRemboursement} onCancel={() => setShowConfirm(false)} />
    </div>
  );
}
