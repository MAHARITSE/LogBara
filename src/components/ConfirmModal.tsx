import { Trash2, AlertTriangle, Info } from 'lucide-react';

interface Props {
  open: boolean;
  type?: 'danger' | 'warning' | 'info';
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  type = 'danger',
  title,
  message,
  confirmText = 'Oui',
  cancelText = 'Non',
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  const icons = {
    danger: <Trash2 size={32} className="text-red-500" />,
    warning: <AlertTriangle size={32} className="text-orange-500" />,
    info: <Info size={32} className="text-blue-500" />,
  };

  const btnColors = {
    danger: 'bg-red-500 hover:bg-red-600',
    warning: 'bg-orange-500 hover:bg-orange-600',
    info: 'bg-blue-500 hover:bg-blue-600',
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            {icons[type]}
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-500 text-sm">{message}</p>
        </div>
        <div className="flex border-t">
          <button
            onClick={onCancel}
            className="flex-1 py-3 font-medium text-gray-600 hover:bg-gray-50 border-r"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 font-medium text-white ${btnColors[type]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
