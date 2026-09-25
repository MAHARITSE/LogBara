import { useState, useEffect } from 'react';
import { store } from './store';
import { Personnel, ModuleType } from './types';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import DashboardModule from './modules/DashboardModule';
import CaisseModule from './modules/CaisseModule';
import TablesModule from './modules/TablesModule';
import VentesModule from './modules/VentesModule';
import PaiementsModule from './modules/PaiementsModule';
import ClotureModule from './modules/ClotureModule';
import ArticlesModule from './modules/ArticlesModule';
import FamillesModule from './modules/FamillesModule';
import StockModule from './modules/StockModule';
import AchatsModule from './modules/AchatsModule';
import ClientsModule from './modules/ClientsModule';
import PersonnelModule from './modules/PersonnelModule';
import SocieteModule from './modules/SocieteModule';
import FournisseursModule from './modules/FournisseursModule';
import CreditsModule from './modules/CreditsModule';
import InventaireModule from './modules/InventaireModule';
import SauvegardeModule from './modules/SauvegardeModule';
import { Package } from 'lucide-react';
import MobileBottomNav from './components/MobileBottomNav';

function App() {
  const [user, setUser] = useState<Personnel | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleType>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    // Initialiser 3 mois de ventes uniquement en mode local/demo (pas en mode MySQL WAMP)
    try {
      const isApi = store.isApiConfigured();
      if (!isApi) {
        const existingVentes = store.getVentes();
        const v2Seeded = localStorage.getItem('barpos_seeded_3months_v2');
        if (!v2Seeded || existingVentes.length < 10) {
          store.seedRandomSales(3, false);
          localStorage.setItem('barpos_seeded_3months_v2', 'true');
        }
      }

      // En production, cette vérification force un premier aller-retour vers PHP
      // avant d'afficher la page de connexion. Ainsi un WAMP mal configuré ne peut
      // pas être confondu avec un fonctionnement local du navigateur.
      const session = store.getSession();
      if (session) {
        setUser(session);
        // Set default module based on role
        if (session.ROLE === 'Caissier') {
          setActiveModule('caisse');
        } else if (session.ROLE === 'Serveur') {
          setActiveModule('tables');
        } else if (session.ROLE === 'Magasinier') {
          setActiveModule('articles');
        }
      }
    } catch (error) {
      setApiError(
      }
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : store.getLastError() || 'Connexion à l’API PHP impossible.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (loggedUser: Personnel) => {
    setUser(loggedUser);
    // Set default module based on role
    if (loggedUser.ROLE === 'Administrateur' || loggedUser.ROLE === 'Gérant') {
      setActiveModule('dashboard');
    } else if (loggedUser.ROLE === 'Caissier') {
      setActiveModule('caisse');
    } else if (loggedUser.ROLE === 'Serveur') {
      setActiveModule('tables');
    } else if (loggedUser.ROLE === 'Magasinier') {
      setActiveModule('articles');
    }
  };

  const handleLogout = () => {
    store.logout();
    setUser(null);
    setActiveModule('dashboard');
  };

  const handleModuleChange = (module: ModuleType) => {
    setActiveModule(module);
    setMobileOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0D47A1] to-[#1565C0]">
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  if (apiError) {
    const diagnosticUrl = new URL('api/diagnostic.php', document.baseURI).toString();
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0a3b75] via-[#0d4f9e] to-[#072952]">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-3xl mb-5">!</div>
          <h1 className="text-2xl font-extrabold text-gray-900">Connexion MySQL indisponible</h1>
          <p className="mt-3 text-gray-600">
            Bar POS n’utilise pas de stockage local en production. Vérifiez WAMP, l’import de
            <strong> barpos_db </strong> et <strong>api/config.php</strong>.
          </p>
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 break-words">
            <strong>Détail détecté :</strong> {apiError}
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 rounded-xl bg-[#0D47A1] px-4 py-3 font-bold text-white hover:bg-[#1565C0]"
            >
              Réessayer
            </button>
            <a
              href={diagnosticUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-xl border border-[#0D47A1] px-4 py-3 text-center font-bold text-[#0D47A1] hover:bg-blue-50"
            >
              Ouvrir le diagnostic WAMP
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardModule user={user} />;
      case 'caisse':
        return <CaisseModule user={user} />;
      case 'tables':
        return <TablesModule user={user} />;
      case 'ventes':
        return <VentesModule user={user} />;
      case 'paiements':
        return <PaiementsModule user={user} />;
      case 'cloture':
        return <ClotureModule user={user} />;
      case 'articles':
        return <ArticlesModule user={user} />;
      case 'familles':
        return <FamillesModule user={user} />;
      case 'stock':
        return <StockModule user={user} />;
      case 'achats':
        return <AchatsModule user={user} />;
      case 'inventaire':
        return <InventaireModule user={user} />;
      case 'fournisseurs':
        return <FournisseursModule user={user} />;
      case 'clients':
        return <ClientsModule user={user} />;
      case 'credits':
        if (user.ROLE !== 'Administrateur') {
          return <CaisseModule user={user} />;
        }
        return <CreditsModule user={user} />;
      case 'personnel':
        return <PersonnelModule user={user} />;
      case 'societe':
        return <SocieteModule user={user} />;
      case 'sauvegarde':
        return <SauvegardeModule user={user} />;
      default:
        return (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-gray-400">
              <Package size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Module "{activeModule}"</p>
              <p className="text-sm">En cours de développement</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        user={user}
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onMobileToggle={() => setMobileOpen(!mobileOpen)}
      />
      
      {/* Main content */}
      <main className="lg:ml-64 min-h-screen flex flex-col">
        {/* Spacer for mobile fixed header */}
        <div className="lg:hidden h-14 shrink-0" />
        <div className="flex-1 p-2.5 sm:p-4 lg:p-6 pb-20 lg:pb-6">
          {renderModule()}
        </div>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <MobileBottomNav
        user={user}
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        onOpenMenu={() => setMobileOpen(true)}
      />
    </div>
  );
}

export default App;
