import { formatPhone } from '../helpers';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function PhoneInput({ value, onChange, placeholder = '034 00 000 00', className = '' }: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    onChange(formatPhone(raw));
  };

  return (
    <input
      type="tel"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className={`w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0D47A1] focus:border-transparent ${className}`}
    />
  );
}
