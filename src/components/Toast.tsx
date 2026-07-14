import { useEffect } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

interface Props {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'success', onClose, duration = 3000 }: Props) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const styles = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-[#0D47A1]',
  };

  const icons = {
    success: <CheckCircle size={20} />,
    error: <X size={20} />,
    warning: <AlertTriangle size={20} />,
    info: <Info size={20} />,
  };

  return (
    <div className={`fixed top-4 right-4 z-[200] ${styles[type]} text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-right`}>
      {icons[type]}
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-70">
        <X size={18} />
      </button>
    </div>
  );
}
