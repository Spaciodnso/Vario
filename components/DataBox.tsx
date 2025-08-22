
import React from 'react';

interface DataBoxProps {
  label: string;
  value: string | number;
}

export const DataBox: React.FC<DataBoxProps> = ({ label, value }) => {
  return (
    <div className="bg-dark-surface p-2 rounded-lg">
      <div className="text-2xl md:text-3xl font-semibold font-mono">{value}</div>
      <div className="text-xs text-dark-text-secondary uppercase">{label}</div>
    </div>
  );
};
