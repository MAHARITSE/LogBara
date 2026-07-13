import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Receipt, ShoppingCart, Wallet, UtensilsCrossed, AlertTriangle, CreditCard } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { store } from '../store';
import { Personnel } from '../types';
import { formatAr, today } from '../helpers';

interface Props { user: Personnel }

export default function Dashboard({ user }: Props) {
  const [refresh, setRefresh] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => setRefresh(r => r + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const ventes = store.getVentes();
  const paiements = store.getPaiements();
  const tables = store.getTables();
  const articles = store.getArticles();
  const clients = store.getClients();
  const lignesVente = store.getLignesVente();

  const todayStr = today();
  const ventesJour = ventes.filter(v => v.DATE_VENTE === todayStr && v.STATUT === 'Payée');
  const caJour = ventesJour.reduce((s, v) => s + v.TOTAL - v.REMISE, 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const ventesMois = ventes.filter(v => v.DATE_VENTE >= monthStart && v.STATUT === 'Payée');
  const caMois = ventesMois.reduce((s, v) => s + v.TOTAL - v.REMISE, 0);

  const panierMoyen = ventesJour.length > 0 ? caJour / ventesJour.length : 0;

  // Bénéfice estimé (CA - coût articles)
  const benefice = ventesJour.reduce((s, v) => {
    const lignes = lignesVente.filter(l => l.IDVENTE === v.IDVENTE);
    const cout = lignes.reduce((c, l) => {
      const art = articles.find(a => a.IDARTICLE === l.IDARTICLE);
      return c + (art?.PRIX_ACHAT || 0) * l.QUANTITE;
    }, 0);
    return s + (v.TOTAL - v.REMISE - cout);
  }, 0);

  const tablesOccupees = tables.filter(t => t.ETAT === 'Occupée').length;
  const stockAlerts = store.getStockAlerts();
  const totalCredits = clients.reduce((s, c) => s + c.CREDIT_TOTAL, 0);

  // Données graphiques
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayVentes = ventes.filter(v => v.DATE_VENTE === dateStr && v.STATUT === 'Payée');
    return {
      jour: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
      montant: dayVentes.reduce((s, v) => s + v.TOTAL - v.REMISE, 0) / 1000
    };
  });

  const hourlyData = Array.from({ length: 12 }, (_, i) => {
    const hour = 10 + i;
    const count = ventesJour.filter(v => parseInt(v.HEURE.split(':')[0]) === hour).length;
    return { heure: `${hour}h`, ventes: count };
  });

  const familleStats = store.getFamilles().map(f => {
    const artIds = articles.filter(a => a.IDFAMILLE === f.IDFAMILLE).map(a => a.IDARTICLE);
    const total = lignesVente
      .filter(l => artIds.includes(l.IDARTICLE) && ventesJour.some(v => v.IDVENTE === l.IDVENTE))
      .reduce((s, l) => s + l.MONTANT, 0);
    return { name: f.FAMILLE, value: total, color: f.COULEUR };
  }).filter(f => f.value > 0);

  const paiementStats = ['Espèces', 'Mobile Money', 'Crédit'].map(mode => {
    const total = paiements
      .filter(p => p.MODE_PAIEMENT === mode && p.DATE_PAIEMENT === todayStr && p.IDVENTE > 0)
      .reduce((s, p) => s + p.MONTANT, 0);
    return { name: mode, value: total };
  }).filter(p => p.value > 0);

  const paiementColors = ['#10B981', '#3B82F6', '#F59E0B'];

  // Top 5 produits
  const productSales: Record<number, number> = {};
  lignesVente.filter(l => ventesJour.some(v => v.IDVENTE === l.IDVENTE)).forEach(l => {
    productSales[l.IDARTICLE] = (productSales[l.IDARTICLE] || 0) + l.QUANTITE;
  });
  const top5 = Object.entries(productSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, qty]) => {
      const art = articles.find(a => a.IDARTICLE === Number(id));
      return { nom: art?.NOM || '-', emoji: art?.EMOJI || '📦', qty };
    });

  // 5 dernières ventes
  const lastVentes = [...ventesJour].sort((a, b) => b.IDVENTE - a.IDVENTE).slice(0, 5);

  const kpis = [
    { label: 'CA Jour', value: formatAr(caJour), icon: <TrendingUp size={20} />, bg: 'bg-green-100', color: 'text-green-600' },
    { label: 'CA Mois', value: formatAr(caMois), icon: <DollarSign size={20} />, bg: 'bg-blue-100', color: 'text-blue-600' },
    { label: 'Tickets', value: ventesJour.length.toString(), icon: <Receipt size={20} />, bg: 'bg-violet-100', color: 'text-violet-600' },
    { label: 'Panier moyen', value: formatAr(panierMoyen), icon: <ShoppingCart size={20} />, bg: 'bg-orange-100', color: 'text-orange-600' },
    { label: 'Bénéfice', value: formatAr(benefice), icon: <Wallet size={20} />, bg: 'bg-emerald-100', color: 'text-emerald-600' },
    { label: 'Tables occupées', value: `${tablesOccupees}/${tables.length}`, icon: <UtensilsCrossed size={20} />, bg: 'bg-indigo-100', color: 'text-indigo-600' },
    { label: 'Alertes stock', value: stockAlerts.toString(), icon: <AlertTriangle size={20} />, bg: stockAlerts > 0 ? 'bg-red-100' : 'bg-gray-100', color: stockAlerts > 0 ? 'text-red-600' : 'text-gray-600' },
    { label: 'Total crédits', value: formatAr(totalCredits), icon: <CreditCard size={20} />, bg: 'bg-rose-100', color: 'text-rose-600' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">📊 Dashboard</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${kpi.bg} ${kpi.color} flex items-center justify-center`}>
                {kpi.icon}
              </div>
              <div>
                <p className="text-xs text-gray-500">{kpi.label}</p>
                <p className="text-lg font-bold text-gray-900">{kpi.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ventes 7 jours */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">📈 Ventes 7 derniers jours (en milliers)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={last7Days}>
              <defs>
                <linearGradient id="colorVentes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0D47A1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#0D47A1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="jour" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => `${v}k Ar`} />
              <Area type="monotone" dataKey="montant" stroke="#0D47A1" fill="url(#colorVentes)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Activité horaire */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">⏰ Activité horaire</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyData}>
              <XAxis dataKey="heure" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="ventes" fill="#0D47A1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ventes par famille */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">🏷️ Ventes par famille</h3>
          {familleStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={familleStats}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {familleStats.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatAr(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">Pas de données</div>
          )}
        </div>

        {/* Paiements */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">💳 Modes de paiement</h3>
          {paiementStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={paiementStats}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {paiementStats.map((_, i) => (
                    <Cell key={i} fill={paiementColors[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatAr(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">Pas de données</div>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">🏆 Top 5 produits du jour</h3>
          <div className="space-y-3">
            {top5.length > 0 ? top5.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#0D47A1] text-white flex items-center justify-center font-bold text-sm">
                  {i + 1}
                </div>
                <span className="text-lg">{p.emoji}</span>
                <span className="flex-1 font-medium">{p.nom}</span>
                <span className="text-[#0D47A1] font-semibold">{p.qty} vendu{p.qty > 1 ? 's' : ''}</span>
              </div>
            )) : (
              <p className="text-gray-400 text-center py-4">Aucune vente aujourd'hui</p>
            )}
          </div>
        </div>

        {/* Dernières ventes */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">📋 5 dernières ventes</h3>
          <div className="space-y-3">
            {lastVentes.length > 0 ? lastVentes.map(v => {
              const personnel = store.getPersonnel().find(p => p.IDPERSONNEL === v.IDPERSONNEL);
              return (
                <div key={v.IDVENTE} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="font-medium text-sm">{v.NUMERO_FACTURE}</p>
                    <p className="text-xs text-gray-500">{v.HEURE} • {personnel?.PRENOM || '-'}</p>
                  </div>
                  <span className="font-bold text-[#0D47A1]">{formatAr(v.TOTAL - v.REMISE)}</span>
                </div>
              );
            }) : (
              <p className="text-gray-400 text-center py-4">Aucune vente aujourd'hui</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
