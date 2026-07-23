import { useMemo } from 'react';
import { 
  TrendingUp, ShoppingCart, Users, Package, 
  AlertTriangle, DollarSign, CreditCard, Wallet 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { store } from '../store';
import { Personnel } from '../types';
import { formatAr, today, dateLabel } from '../helpers';

interface Props {
  user: Personnel;
}

export default function DashboardModule({ user }: Props) {
  const ventes = store.getVentes();
  const articles = store.getArticles();
  const lignesVente = store.getLignesVente();
  const clients = store.getClients();
  const familles = store.getFamilles();

  const stats = useMemo(() => {
    const ventesAujourdhui = ventes.filter(v => v.DATE_VENTE === today() && v.STATUT === 'Payée');
    const totalAujourdhui = ventesAujourdhui.reduce((s, v) => s + v.TOTAL - v.REMISE, 0);
    const remisesAujourdhui = ventesAujourdhui.reduce((s, v) => s + v.REMISE, 0);
    
    const articlesAlerte = articles.filter(a => a.ACTIF && a.GERE_STOCK && a.STOCK <= a.STOCK_MIN);
    const totalCredits = clients.reduce((s, c) => s + c.CREDIT_TOTAL, 0);

    // Ventes des 7 derniers jours
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const ventesParJour = last7Days.map(date => {
      const dayVentes = ventes.filter(v => v.DATE_VENTE === date && v.STATUT === 'Payée');
      return {
        date: new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
        total: dayVentes.reduce((s, v) => s + v.TOTAL - v.REMISE, 0),
      };
    });

    // Ventes par famille
    const ventesParFamille = familles.map(f => {
      const artIds = articles.filter(a => a.IDFAMILLE === f.IDFAMILLE).map(a => a.IDARTICLE);
      const lignes = lignesVente.filter(l => artIds.includes(l.IDARTICLE));
      return {
        name: f.FAMILLE,
        value: lignes.reduce((s, l) => s + l.MONTANT, 0),
        color: f.COULEUR,
      };
    }).filter(f => f.value > 0);

    // Top 5 produits
    const produitStats: Record<number, { nom: string; qte: number; montant: number }> = {};
    lignesVente.forEach(l => {
      const art = articles.find(a => a.IDARTICLE === l.IDARTICLE);
      if (art) {
        if (!produitStats[l.IDARTICLE]) {
          produitStats[l.IDARTICLE] = { nom: art.NOM, qte: 0, montant: 0 };
        }
        produitStats[l.IDARTICLE].qte += l.QUANTITE;
        produitStats[l.IDARTICLE].montant += l.MONTANT;
      }
    });
    const topProduits = Object.values(produitStats)
      .sort((a, b) => b.qte - a.qte)
      .slice(0, 5);

    // Dernières ventes
    const dernieresVentes = [...ventes]
      .filter(v => v.STATUT === 'Payée')
      .sort((a, b) => b.IDVENTE - a.IDVENTE)
      .slice(0, 5);

    return {
      totalAujourdhui,
      nbVentesAujourdhui: ventesAujourdhui.length,
      remisesAujourdhui,
      articlesAlerte: articlesAlerte.length,
      totalCredits,
      totalArticles: articles.filter(a => a.ACTIF).length,
      ventesParJour,
      ventesParFamille,
      topProduits,
      dernieresVentes,
    };
  }, [ventes, articles, lignesVente, clients, familles]);

  const personnel = store.getPersonnel();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">📊 Tableau de bord</h1>
          <p className="text-gray-500">Bienvenue, {user.PRENOM} {user.NOM}</p>
        </div>
        <div className="text-right text-sm text-gray-500">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="kpi-card bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <DollarSign className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Ventes du jour</p>
              <p className="text-xl font-bold text-gray-900">{formatAr(stats.totalAujourdhui)}</p>
            </div>
          </div>
        </div>

        <div className="kpi-card bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <ShoppingCart className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Nb de ventes</p>
              <p className="text-xl font-bold text-gray-900">{stats.nbVentesAujourdhui}</p>
            </div>
          </div>
        </div>

        <div className="kpi-card bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <Wallet className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Remises</p>
              <p className="text-xl font-bold text-gray-900">{formatAr(stats.remisesAujourdhui)}</p>
            </div>
          </div>
        </div>

        <div className="kpi-card bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="text-orange-600" size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Stock alerte</p>
              <p className="text-xl font-bold text-gray-900">{stats.articlesAlerte}</p>
            </div>
          </div>
        </div>

        <div className="kpi-card bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
              <CreditCard className="text-red-600" size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Crédits clients</p>
              <p className="text-xl font-bold text-gray-900">{formatAr(stats.totalCredits)}</p>
            </div>
          </div>
        </div>

        <div className="kpi-card bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center">
              <Package className="text-teal-600" size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Articles actifs</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalArticles}</p>
            </div>
          </div>
        </div>

        <div className="kpi-card bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Users className="text-indigo-600" size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Clients</p>
              <p className="text-xl font-bold text-gray-900">{clients.length}</p>
            </div>
          </div>
        </div>

        <div className="kpi-card bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center">
              <TrendingUp className="text-pink-600" size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Total ventes</p>
              <p className="text-xl font-bold text-gray-900">{ventes.filter(v => v.STATUT === 'Payée').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ventes 7 jours */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">📈 Ventes des 7 derniers jours</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.ventesParJour}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(value) => formatAr(Number(value))} />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#0D47A1" 
                  strokeWidth={3}
                  dot={{ fill: '#0D47A1', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ventes par famille */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">🥧 Répartition par famille</h3>
          <div className="h-64">
            {stats.ventesParFamille.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.ventesParFamille}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {stats.ventesParFamille.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatAr(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                Pas de données
              </div>
            )}
          </div>
        </div>

        {/* Top 5 produits */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">🏆 Top 5 produits</h3>
          <div className="h-64">
            {stats.topProduits.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topProduits} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                  <YAxis dataKey="nom" type="category" width={80} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                  <Tooltip formatter={(value) => Number(value) + ' vendus'} />
                  <Bar dataKey="qte" fill="#0D47A1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                Pas de ventes
              </div>
            )}
          </div>
        </div>

        {/* Dernières ventes */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">🛒 Dernières ventes</h3>
          <div className="space-y-3">
            {stats.dernieresVentes.map(v => {
              const caissier = personnel.find(p => p.IDPERSONNEL === v.IDPERSONNEL);
              return (
                <div key={v.IDVENTE} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-sm">{v.NUMERO_FACTURE}</p>
                    <p className="text-xs text-gray-500">{dateLabel(v.DATE_VENTE)} • {v.HEURE} • {caissier?.PRENOM}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#0D47A1]">{formatAr(v.TOTAL - v.REMISE)}</p>
                    {v.REMISE > 0 && <p className="text-xs text-red-500">-{formatAr(v.REMISE)}</p>}
                  </div>
                </div>
              );
            })}
            {stats.dernieresVentes.length === 0 && (
              <p className="text-center text-gray-400 py-8">Aucune vente</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
