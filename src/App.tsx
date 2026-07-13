import { useState, useEffect } from 'react';
import { store } from './store';
import { Personnel, ModuleType } from './types';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import Dashboard from './modules/Dashboard';
import CaissePOS from './modules/CaissePOS';
import Tables from './modules/Tables';
import Ventes from './modules/Ventes';
import AchatsModule from './modules/Achats';
import { 
  ArticlesModule, FamillesModule, StockModule, FournisseursModule,
  PersonnelModule, ClientsModule, CreditsModule, SocieteModule,
  ClotureModule, InventaireModule, SauvegardeModule
} from './modules/OtherModules';

function App() {
  const [user, setUser] = useState<Personnel | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleType>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
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
    setLoading(false);
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
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#0D47A1] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement...</p>
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
        return <Dashboard user={user} />;
      case 'caisse':
        return <CaissePOS user={user} />;
      case 'tables':
        return <Tables user={user} />;
      case 'ventes':
        return <Ventes user={user} />;
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
      case 'personnel':
        return <PersonnelModule user={user} />;
      case 'clients':
        return <ClientsModule user={user} />;
      case 'credits':
        return <CreditsModule user={user} />;
      case 'societe':
        return <SocieteModule user={user} />;
      case 'sauvegarde':
        return <SauvegardeModule user={user} />;
      default:
        return <Dashboard user={user} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      <Sidebar
        user={user}
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onMobileToggle={() => setMobileOpen(!mobileOpen)}
      />
      
      <main className="flex-1 lg:ml-0 pt-16 lg:pt-0">
        <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
          {renderModule()}
        </div>
      </main>
    </div>
  );
}

export default App;
