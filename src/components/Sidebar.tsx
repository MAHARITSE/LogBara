import { 
  LayoutDashboard, ShoppingCart, UtensilsCrossed, Receipt, Calculator,
  Package, Tag, Warehouse, ShoppingBag, ClipboardList, Truck, Users,
  UserCircle, CreditCard, Building2, HardDrive, LogOut, Menu, X, AlertTriangle
} from 'lucide-react';
import { store } from '../store';
import { Personnel, ModuleType } from '../types';
import { dateLongFr, roleColors } from '../helpers';

interface Props {
  user: Personnel;
  activeModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
  onLogout: () => void;
  mobileOpen: boolean;
  onMobileToggle: () => void;
}

interface MenuItem {
  id: ModuleType;
  label: string;
  icon: React.ReactNode;
  roles: string[];
}

const menuGroups: { title?: string; items: MenuItem[] }[] = [
  {
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ['Administrateur', 'Gérant'] },
      { id: 'caisse', label: 'Caisse POS', icon: <ShoppingCart size={20} />, roles: ['Gérant', 'Caissier'] },
      { id: 'tables', label: 'Tables', icon: <UtensilsCrossed size={20} />, roles: ['Administrateur', 'Gérant', 'Caissier', 'Serveur'] },
    ]
  },
  {
    title: 'Ventes & Finance',
    items: [
      { id: 'ventes', label: 'Ventes', icon: <Receipt size={20} />, roles: ['Administrateur', 'Gérant', 'Caissier'] },
      { id: 'cloture', label: 'Clôture', icon: <Calculator size={20} />, roles: ['Administrateur', 'Gérant', 'Caissier'] },
      { id: 'credits', label: 'Crédits', icon: <CreditCard size={20} />, roles: ['Administrateur', 'Gérant', 'Caissier'] },
    ]
  },
  {
    title: 'Articles & Stock',
    items: [
      { id: 'articles', label: 'Articles', icon: <Package size={20} />, roles: ['Administrateur', 'Gérant', 'Magasinier'] },
      { id: 'familles', label: 'Familles', icon: <Tag size={20} />, roles: ['Administrateur', 'Gérant'] },
      { id: 'stock', label: 'Stock', icon: <Warehouse size={20} />, roles: ['Administrateur', 'Gérant', 'Magasinier'] },
      { id: 'achats', label: 'Achats', icon: <ShoppingBag size={20} />, roles: ['Administrateur', 'Magasinier', 'Caissier'] },
      { id: 'inventaire', label: 'Inventaire', icon: <ClipboardList size={20} />, roles: ['Administrateur', 'Gérant', 'Magasinier'] },
    ]
  },
  {
    title: 'Gestion',
    items: [
      { id: 'fournisseurs', label: 'Fournisseurs', icon: <Truck size={20} />, roles: ['Administrateur', 'Gérant'] },
      { id: 'personnel', label: 'Personnel', icon: <Users size={20} />, roles: ['Administrateur'] },
      { id: 'clients', label: 'Clients', icon: <UserCircle size={20} />, roles: ['Administrateur', 'Gérant'] },
    ]
  },
  {
    title: 'Système',
    items: [
      { id: 'societe', label: 'Société', icon: <Building2 size={20} />, roles: ['Administrateur', 'Gérant'] },
      { id: 'sauvegarde', label: 'Sauvegarde', icon: <HardDrive size={20} />, roles: ['Administrateur', 'Gérant'] },
    ]
  },
];

export default function Sidebar({ user, activeModule, onModuleChange, onLogout, mobileOpen, onMobileToggle }: Props) {
  const societe = store.getSociete();
  const stockAlerts = store.getStockAlerts();

  const renderLogo = () => {
    if (societe.LOGO_TYPE === 'image' && societe.LOGO_IMAGE) {
      return <img src={societe.LOGO_IMAGE} alt="Logo" className="w-10 h-10 object-contain" />;
    }
    if (societe.LOGO_TYPE === 'emoji' && societe.LOGO_EMOJI) {
      return <span className="text-2xl">{societe.LOGO_EMOJI}</span>;
    }
    return <span className="text-xl font-bold text-white">{societe.NOM.charAt(0)}</span>;
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo & Company */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0D47A1] to-[#1976D2] flex items-center justify-center shadow-lg">
            {renderLogo()}
          </div>
          <div>
            <h2 className="font-bold text-gray-900">{societe.NOM}</h2>
            <p className="text-xs text-gray-500 capitalize">{dateLongFr()}</p>
          </div>
        </div>
      </div>

      {/* Stock Alert Banner */}
      {stockAlerts > 0 && (
        <div 
          onClick={() => onModuleChange('stock')}
          className="mx-4 mb-2 p-3 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl cursor-pointer hover:border-red-300 transition-all"
        >
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={16} />
            <span className="text-sm font-medium">{stockAlerts} alerte{stockAlerts > 1 ? 's' : ''} stock</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {menuGroups.map((group, gIdx) => (
          <div key={gIdx} className="mb-4">
            {group.title && (
              <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {group.title}
              </div>
            )}
            {group.items
              .filter(item => item.roles.includes(user.ROLE))
              .map(item => (
                <button
                  key={item.id}
                  onClick={() => { onModuleChange(item.id); onMobileToggle(); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all ${
                    activeModule === item.id
                      ? 'bg-gradient-to-r from-[#0D47A1] to-[#1565C0] text-white shadow-lg shadow-blue-200'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                  {item.id === 'stock' && stockAlerts > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {stockAlerts}
                    </span>
                  )}
                </button>
              ))}
          </div>
        ))}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0D47A1] to-[#1976D2] flex items-center justify-center text-white font-bold">
            {user.PRENOM.charAt(0)}{user.NOM.charAt(0)}
          </div>
          <div>
            <p className="font-medium text-gray-900">{user.PRENOM} {user.NOM}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full uppercase tracking-wider ${roleColors[user.ROLE]}`}>
              {user.ROLE}
            </span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <LogOut size={18} />
          <span className="font-medium">Déconnexion</span>
        </button>
      </div>

      {/* Developer Signature */}
      <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 border-t">
        <p className="text-xs text-gray-500 text-center">
          Développé par <span className="font-medium text-gray-700">MAHARITSE H.B.</span>
        </p>
        <p className="text-xs text-gray-400 text-center">📞 038 34 092 61</p>
      </div>

      {/* Mode Badge */}
      <div className="px-4 pb-4">
        <div className={`flex items-center justify-center gap-2 py-2 rounded-xl text-sm ${
          store.isMySQL
            ? 'bg-green-100 text-green-700'
            : 'bg-blue-100 text-blue-700'
        }`}>
          {store.isMySQL ? '🌐 Mode MySQL' : '💾 Mode Local'}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-sm border-b border-gray-100 z-40 flex items-center px-4">
        <button onClick={onMobileToggle} className="p-2 rounded-xl hover:bg-gray-100">
          <Menu size={24} />
        </button>
        <div className="flex-1 flex items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0D47A1] to-[#1976D2] flex items-center justify-center">
            {renderLogo()}
          </div>
          <span className="font-bold text-gray-900">{societe.NOM}</span>
        </div>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={onMobileToggle} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-white border-r border-gray-100
        transform transition-transform lg:transform-none
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Mobile Close */}
        <button
          onClick={onMobileToggle}
          className="lg:hidden absolute top-4 right-4 p-2 rounded-xl hover:bg-gray-100"
        >
          <X size={20} />
        </button>
        {sidebarContent}
      </aside>
    </>
  );
}
