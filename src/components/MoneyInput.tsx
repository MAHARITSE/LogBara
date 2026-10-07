import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import { formatAmount, parseAmount } from '../helpers';

export interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | string | null | undefined;
  onChange: (value: number) => void;
  allowZero?: boolean;
  className?: string;
  placeholder?: string;
}

const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(({
  value,
  onChange,
  allowZero = true,
  className = '',
  placeholder = '0',
  onKeyDown,
  onFocus,
  ...rest
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current!);

  // Valeur affichée formatée avec espaces automatiques
  const displayValue = (value === 0 || value === '0') && !allowZero
    ? ''
    : value === '' || value === null || value === undefined
      ? ''
      : formatAmount(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const rawVal = input.value;
    const selectionStart = input.selectionStart || 0;

    // Nombre de chiffres avant la position du curseur
    const digitsBeforeCursor = rawVal.slice(0, selectionStart).replace(/\D/g, '').length;

    // Valeur numérique extraite
    const numericValue = parseAmount(rawVal);

    // Formater la nouvelle valeur
    const formatted = rawVal.trim() === '' ? '' : formatAmount(numericValue);

    onChange(numericValue);

    // Repositionner le curseur de façon fluide après le formatage
    requestAnimationFrame(() => {
      if (inputRef.current) {
        let digitCount = 0;
        let newCursorPos = formatted.length;

        if (digitsBeforeCursor === 0) {
          newCursorPos = 0;
        } else {
          for (let i = 0; i < formatted.length; i++) {
            if (/\d/.test(formatted[i])) {
              digitCount++;
              if (digitCount === digitsBeforeCursor) {
                newCursorPos = i + 1;
                break;
              }
            }
          }
        }

        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Si l'utilisateur appuie sur Backspace juste après un espace, supprimer le chiffre précédent
    if (e.key === 'Backspace' && inputRef.current) {
      const { selectionStart, selectionEnd, value: currentVal } = inputRef.current;
      if (selectionStart === selectionEnd && selectionStart && selectionStart > 1) {
        if (currentVal[selectionStart - 1] === ' ') {
          e.preventDefault();
          const newVal = currentVal.slice(0, selectionStart - 2) + currentVal.slice(selectionStart);
          const num = parseAmount(newVal);
          onChange(num);

          requestAnimationFrame(() => {
            if (inputRef.current) {
              const formatted = newVal.trim() === '' ? '' : formatAmount(num);
              const targetDigit = currentVal.slice(0, selectionStart - 2).replace(/\D/g, '').length;
              let digitCount = 0;
              let newPos = 0;
              for (let i = 0; i < formatted.length; i++) {
                if (/\d/.test(formatted[i])) {
                  digitCount++;
                  if (digitCount === targetDigit) {
                    newPos = i + 1;
                    break;
                  }
                }
              }
              inputRef.current.setSelectionRange(newPos, newPos);
            }
          });
          return;
        }
      }
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={onFocus}
      placeholder={placeholder}
      className={className}
      {...rest}
    />
  );
});

MoneyInput.displayName = 'MoneyInput';

export default MoneyInput;
