interface Props {
  message: string;
  type?: 'success' | 'error' | 'info';
}

export default function Toast({ message, type = 'success' }: Props) {
  if (!message) return null;

  const colors = {
    success: 'bg-[#0D47A1]',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };

  return (
    <div className={`fixed top-4 right-4 ${colors[type]} text-white px-5 py-3 rounded-xl shadow-lg z-[100] animate-pulse`}>
      {message}
    </div>
  );
}
