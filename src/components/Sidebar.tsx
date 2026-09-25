import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ShoppingCart, UtensilsCrossed, Receipt, Calculator, Wallet,
  Package, Tag, Warehouse, ShoppingBag, ClipboardList, Truck, Users,
  UserCircle, CreditCard, Building2, HardDrive, LogOut, Menu, X, AlertTriangle, Printer
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
      { id: 'paiements', label: 'Paiements', icon: <Wallet size={20} />, roles: ['Administrateur', 'Gérant', 'Caissier'] },
      { id: 'cloture', label: 'Clôture', icon: <Calculator size={20} />, roles: ['Administrateur', 'Gérant', 'Caissier'] },
      { id: 'credits', label: 'Crédits', icon: <CreditCard size={20} />, roles: ['Administrateur'] },
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
  const [stockAlerts, setStockAlerts] = useState(() => store.getStockAlerts());
  const [utiliserImprimante, setUtiliserImprimante] = useState(() => store.isUserPrinterEnabled(user.IDPERSONNEL));

  useEffect(() => {
    setUtiliserImprimante(store.isUserPrinterEnabled(user.IDPERSONNEL));
  }, [user.IDPERSONNEL]);

  useEffect(() => {
    const handleUpdate = () => {
      setStockAlerts(store.getStockAlerts());
    };
    window.addEventListener('barpos-articles-updated', handleUpdate);
    window.addEventListener('barpos-data-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      window.removeEventListener('barpos-articles-updated', handleUpdate);
      window.removeEventListener('barpos-data-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, []);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ userId?: number; enabled?: boolean }>;
      if (!custom.detail || custom.detail.userId === user.IDPERSONNEL) {
        setUtiliserImprimante(store.isUserPrinterEnabled(user.IDPERSONNEL));
      }
    };
    window.addEventListener('barpos-printer-pref-change', handleUpdate);
    return () => window.removeEventListener('barpos-printer-pref-change', handleUpdate);
  }, [user.IDPERSONNEL]);

  const handleToggleImprimante = (checked: boolean) => {
    store.setUserPrinterEnabled(checked, user.IDPERSONNEL);
    setUtiliserImprimante(checked);
    window.dispatchEvent(new CustomEvent('barpos-printer-pref-change', { detail: { userId: user.IDPERSONNEL, enabled: checked } }));
  };

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
                  onClick={() => { onModuleChange(item.id); if (mobileOpen) onMobileToggle(); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all ${
                    activeModule === item.id
                      ? 'nav-active'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
          </div>
        ))}
      </nav>

      {/* Utiliser l'imprimante - propre à ce poste et utilisateur */}
      <div className="p-3 border-t border-gray-100 bg-gray-50/70">
        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={utiliserImprimante}
            onChange={e => handleToggleImprimante(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded text-[#0D47A1] focus:ring-[#0D47A1] cursor-pointer"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <p className="font-semibold text-xs text-gray-900 flex items-center gap-1.5">
                <Printer size={13} className="text-[#0D47A1]" />
                Utiliser l'imprimante
              </p>
              <span className="text-[9px] text-blue-700 bg-blue-50 px-1 rounded shrink-0">Ce poste</span>
            </div>
            <p className="text-[11px] text-gray-500 leading-tight mt-0.5">
              {utiliserImprimante ? 'Impression directe sur ce poste' : 'Désactivée sur ce poste'}
            </p>
          </div>
        </label>
      </div>

      {/* User Info */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0D47A1] to-[#1976D2] flex items-center justify-center text-white font-semibold">
            {user.PRENOM.charAt(0)}{user.NOM.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{user.PRENOM} {user.NOM}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[user.ROLE]}`}>
              {user.ROLE}
            </span>
          </div>
        </div>
        {(() => {
          const status = store.getApiStatus();
          return (
            <div
              className={`flex items-center gap-2 mb-2 px-3 py-2 rounded-xl text-[11px] font-medium ${
                status.connected ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
              }`}
              title={status.connected ? 'Données enregistrées dans MySQL (WAMP)' : status.message}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${status.connected ? 'bg-green-500' : 'bg-amber-500'}`} />
              {status.connected
                ? 'MySQL connecté — données centralisées'
                : 'Mode local — MySQL non connecté'}
            </div>
          );
        })()}
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-all"
        >
          <LogOut size={18} />
          <span className="font-medium">Déconnexion</span>
        </button>
      </div>

      {/* Developer signature */}
      <div className="p-4 text-center border-t border-gray-100">
        <p className="text-xs text-gray-400">Développé par</p>
        <p className="text-xs text-gray-500 font-medium">MAHARITSE H. Bertrand</p>
        <p className="text-xs text-gray-400">📞 038 34 092 61</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-3 z-40">
        <button 
          onClick={onMobileToggle} 
          className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 rounded-xl active:scale-95 transition-transform"
          aria-label="Ouvrir le menu"
        >
          <Menu size={22} className="text-gray-700" />
        </button>
        
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{societe.LOGO_TYPE === 'emoji' ? societe.LOGO_EMOJI : '🍺'}</span>
          <span className="font-bold text-gray-900 truncate text-sm">{societe.NOM}</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#0D47A1] shrink-0">
            {user.PRENOM} ({user.ROLE})
          </span>
        </div>

        <button 
          onClick={onLogout} 
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          title="Se déconnecter"
          aria-label="Se déconnecter"
        >
          <LogOut size={18} />
        </button>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onMobileToggle}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`lg:hidden fixed top-0 left-0 bottom-0 w-72 bg-white z-50 transform transition-transform duration-300 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <span className="font-bold text-gray-900">Menu</span>
          <button onClick={onMobileToggle} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-700" />
          </button>
        </div>
        {sidebarContent}
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-gray-200 z-30">
        {sidebarContent}
      </aside>
    </>
  );
}
