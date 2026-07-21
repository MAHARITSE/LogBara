import { useState, useEffect } from 'react';
import { store } from './store';
import { Personnel, ModuleType } from './types';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import DashboardModule from './modules/DashboardModule';
import CaisseModule from './modules/CaisseModule';
import TablesModule from './modules/TablesModule';
import VentesModule from './modules/VentesModule';
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
import { Package, WifiOff, AlertTriangle } from 'lucide-react';

function App() {
  const [user, setUser] = useState<Personnel | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleType>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string>('');

  useEffect(() => {
    // Check for existing session — avec sécurité anti écran blanc
    try {
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
    } catch (e) {
      console.error('[BarPOS] getSession error', e);
      setInitError(e instanceof Error ? e.message : String(e));
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
    try {
      store.logout();
    } catch {}
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
          {initError && <p className="text-sm text-white/70 mt-2 max-w-md">{initError}</p>}
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const renderModule = () => {
    try {
      switch (activeModule) {
        case 'dashboard':
          return <DashboardModule user={user} />;
        case 'caisse':
          return <CaisseModule user={user} />;
        case 'tables':
          return <TablesModule user={user} />;
        case 'ventes':
          return <VentesModule user={user} />;
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
    } catch (e) {
      console.error('[BarPOS] renderModule error', e);
      return (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
          <div className="flex items-center gap-2 font-bold"><AlertTriangle size={20}/> Erreur de rendu du module {activeModule}</div>
          <p className="mt-2 text-sm">{e instanceof Error ? e.message : String(e)}</p>
          <button onClick={() => setActiveModule('dashboard')} className="mt-4 bg-[#0D47A1] text-white px-4 py-2 rounded-xl">Retour dashboard</button>
        </div>
      );
    }
  };

  const offline = store.isOffline();

  return (
    <div className="min-h-screen bg-gray-50">
      {offline && (
        <div className="bg-amber-400 text-amber-900 text-center text-sm py-2 px-4 flex items-center justify-center gap-2 font-medium sticky top-0 z-[100]">
          <WifiOff size={16}/> Mode démo offline actif — {store.getOfflineReason() || 'MySQL indisponible'} — Les données sont locales
          <button onClick={() => { try{ store.clearOfflineFlag(); }catch{}; location.reload(); }} className="ml-3 bg-black/10 hover:bg-black/20 px-2 py-1 rounded-lg text-xs">Re-tenter MySQL</button>
        </div>
      )}
      <Sidebar
        user={user}
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onMobileToggle={() => setMobileOpen(!mobileOpen)}
      />
      
      {/* Main content */}
      <main className="lg:ml-64 min-h-screen">
        <div className="lg:hidden h-16" /> {/* Spacer for mobile header */}
        <div className="p-4 lg:p-6">
          {renderModule()}
        </div>
      </main>
    </div>
  );
}

export default App;
