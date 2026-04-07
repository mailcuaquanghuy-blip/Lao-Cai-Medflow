import React from 'react';
import DatePicker from 'react-datepicker';
import { format, parseISO } from 'date-fns';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const DateInput: React.FC<DateInputProps> = ({ value, onChange, className }) => {
  const selectedDate = value ? parseISO(value) : null;

  const handleChange = (date: Date | null) => {
    if (date) {
      // Format to YYYY-MM-DD
      const formatted = format(date, 'yyyy-MM-dd');
      onChange(formatted);
    } else {
      onChange('');
    }
  };

  return (
    <DatePicker
      selected={selectedDate}
      onChange={handleChange}
      dateFormat="dd/MM/yyyy"
      className={className}
    />
  );
};
