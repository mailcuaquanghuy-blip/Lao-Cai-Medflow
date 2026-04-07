import React from 'react';
import DatePicker from 'react-datepicker';
import { format, parseISO } from 'date-fns';

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({ value, onChange, className }) => {
  const selectedDate = value ? parseISO(value) : null;

  const handleChange = (date: Date | null) => {
    if (date) {
      // Format to YYYY-MM-DDTHH:mm
      const formatted = format(date, "yyyy-MM-dd'T'HH:mm");
      onChange(formatted);
    } else {
      onChange('');
    }
  };

  return (
    <DatePicker
      selected={selectedDate}
      onChange={handleChange}
      showTimeSelect
      timeFormat="HH:mm"
      timeIntervals={15}
      timeCaption="Giờ"
      dateFormat="dd/MM/yyyy HH:mm"
      className={className}
    />
  );
};
