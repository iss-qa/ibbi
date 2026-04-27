import { useState, useEffect } from 'react';

export default function CustomDatePicker({ value, onChange, className }) {
  const [clicked, setClicked] = useState(false);
  const [isText, setIsText] = useState(false);

  // Converte de 'YYYY-MM-DD' para 'DD/MM/YYYY'
  const formatDateToText = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    if (y && m && d) return `${d}/${m}/${y}`;
    return dateStr;
  };

  const [textValue, setTextValue] = useState(formatDateToText(value));

  // Mantém sincronizado caso o valor mude externamente
  useEffect(() => {
    if (isText) {
      setTextValue(formatDateToText(value));
    }
  }, [value, isText]);

  const handleChangeDate = (e) => {
    onChange(e.target.value);
  };

  const handleChangeText = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);
    
    let masked = val;
    if (val.length > 2 && val.length <= 4) {
      masked = `${val.slice(0, 2)}/${val.slice(2)}`;
    } else if (val.length > 4) {
      masked = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
    }
    
    setTextValue(masked);

    if (val.length === 8) {
      const parentVal = `${val.slice(4, 8)}-${val.slice(2, 4)}-${val.slice(0, 2)}`;
      onChange(parentVal);
    } else if (val.length === 0) {
      onChange('');
    }
  };

  if (isText) {
    return (
      <input
        type="tel"
        className={className}
        placeholder="DD/MM/AAAA"
        value={textValue}
        onChange={handleChangeText}
        autoFocus
      />
    );
  }

  return (
    <input
      type="date"
      className={className}
      value={value || ''}
      onChange={handleChangeDate}
      onClick={(e) => {
        if (clicked) {
          e.preventDefault();
          setIsText(true);
        } else {
          setClicked(true);
        }
      }}
    />
  );
}
