import React, { useState, useEffect } from 'react';

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const TimeInput: React.FC<TimeInputProps> = ({ value, onChange, className }) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    
    if (val.length > 4) {
      val = val.slice(0, 4);
    }

    let formatted = val;
    if (val.length >= 3) {
      formatted = `${val.slice(0, 2)}:${val.slice(2)}`;
    } else if (val.length === 2 && e.target.value.includes(':')) {
      formatted = `${val}:`;
    }

    setDisplayValue(formatted);

    if (val.length === 4) {
      const h = parseInt(val.slice(0, 2), 10);
      const m = parseInt(val.slice(2, 4), 10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        onChange(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      }
    }
  };

  const handleBlur = () => {
    let val = displayValue.replace(/[^0-9]/g, '');
    if (!val) {
      setDisplayValue('');
      onChange('');
      return;
    }

    if (val.length === 1 || val.length === 2) {
      const h = Math.min(parseInt(val, 10), 23).toString().padStart(2, '0');
      const finalVal = `${h}:00`;
      setDisplayValue(finalVal);
      onChange(finalVal);
    } else if (val.length === 3) {
      const h = Math.min(parseInt(val.slice(0, 1), 10), 23).toString().padStart(2, '0');
      const m = Math.min(parseInt(val.slice(1, 3), 10), 59).toString().padStart(2, '0');
      const finalVal = `${h}:${m}`;
      setDisplayValue(finalVal);
      onChange(finalVal);
    } else if (val.length === 4) {
      const h = Math.min(parseInt(val.slice(0, 2), 10), 23).toString().padStart(2, '0');
      const m = Math.min(parseInt(val.slice(2, 4), 10), 59).toString().padStart(2, '0');
      const finalVal = `${h}:${m}`;
      setDisplayValue(finalVal);
      onChange(finalVal);
    } else {
      setDisplayValue(value);
    }
  };

  return (
    <input
      type="text"
      placeholder="HH:mm"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
    />
  );
};
