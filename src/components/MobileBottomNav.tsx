import React from 'react';
import { 
  LayoutDashboard, ShoppingCart, UtensilsCrossed, Receipt, Calculator, 
  Package, Warehouse, ShoppingBag, Menu, MoreHorizontal
} from 'lucide-react';
import { Personnel, ModuleType } from '../types';

interface Props {
  user: Personnel;
  activeModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
  onOpenMenu: () => void;
}

interface BottomTab {
  id: ModuleType | 'menu';
  label: string;
  icon: React.ReactNode;
}

export default function MobileBottomNav({ user, activeModule, onModuleChange, onOpenMenu }: Props) {
  const getTabsForRole = (): BottomTab[] => {
    switch (user.ROLE) {
      case 'Caissier':
        return [
          { id: 'caisse', label: 'Caisse', icon: <ShoppingCart size={20} /> },
          { id: 'tables', label: 'Tables', icon: <UtensilsCrossed size={20} /> },
          { id: 'ventes', label: 'Ventes', icon: <Receipt size={20} /> },
          { id: 'cloture', label: 'Clôture', icon: <Calculator size={20} /> },
          { id: 'menu', label: 'Menu', icon: <Menu size={20} /> },
        ];
      case 'Serveur':
        return [
          { id: 'tables', label: 'Tables', icon: <UtensilsCrossed size={20} /> },
          { id: 'ventes', label: 'Ventes', icon: <Receipt size={20} /> },
          { id: 'menu', label: 'Menu', icon: <Menu size={20} /> },
        ];
      case 'Magasinier':
        return [
          { id: 'articles', label: 'Articles', icon: <Package size={20} /> },
          { id: 'stock', label: 'Stock', icon: <Warehouse size={20} /> },
          { id: 'achats', label: 'Achats', icon: <ShoppingBag size={20} /> },
          { id: 'menu', label: 'Menu', icon: <Menu size={20} /> },
        ];
      case 'Administrateur':
      case 'Gérant':
      default:
        return [
          { id: 'dashboard', label: 'Tableau', icon: <LayoutDashboard size={20} /> },
          { id: 'caisse', label: 'Caisse', icon: <ShoppingCart size={20} /> },
          { id: 'tables', label: 'Tables', icon: <UtensilsCrossed size={20} /> },
          { id: 'ventes', label: 'Ventes', icon: <Receipt size={20} /> },
          { id: 'menu', label: 'Plus...', icon: <MoreHorizontal size={20} /> },
        ];
    }
  };

  const tabs = getTabsForRole();

  return (
    <nav 
      aria-label="Navigation mobile principale"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 shadow-lg pb-safe"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {tabs.map(tab => {
          const isActive = tab.id !== 'menu' && activeModule === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'menu') {
                  onOpenMenu();
                } else {
                  onModuleChange(tab.id as ModuleType);
                }
              }}
              className={`flex-1 flex flex-col items-center justify-center py-1 min-h-[48px] rounded-xl transition-all ${
                isActive 
                  ? 'text-[#0D47A1] font-semibold' 
                  : 'text-gray-500 hover:text-gray-900 active:scale-95'
              }`}
            >
              <div className={`relative p-1 rounded-xl transition-colors ${
                isActive ? 'bg-blue-50 text-[#0D47A1]' : ''
              }`}>
                {tab.icon}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#0D47A1] rounded-full" />
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
