import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface Props {
  open: boolean;
  type?: 'danger' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open, type = 'danger', title, message, 
  confirmText = 'Confirmer', cancelText = 'Annuler',
  onConfirm, onCancel
}: Props) {
  if (!open) return null;

  const icons = {
    danger: <AlertTriangle className="text-red-500" size={48} />,
    warning: <AlertTriangle className="text-yellow-500" size={48} />,
    success: <CheckCircle className="text-green-500" size={48} />,
    info: <Info className="text-blue-500" size={48} />,
  };

  const btnColors = {
    danger: 'bg-red-500 hover:bg-red-600',
    warning: 'bg-yellow-500 hover:bg-yellow-600',
    success: 'bg-green-500 hover:bg-green-600',
    info: 'bg-blue-500 hover:bg-blue-600',
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="p-6 text-center">
          <div className="flex justify-center mb-4">{icons[type]}</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600">{message}</p>
        </div>
        <div className="flex border-t border-gray-100">
          <button
            onClick={onCancel}
            className="flex-1 py-4 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-4 text-white font-medium transition-colors ${btnColors[type]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
