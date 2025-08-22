
import React from 'react';

interface VarioDisplayProps {
  verticalSpeed: number;
}

export const VarioDisplay: React.FC<VarioDisplayProps> = ({ verticalSpeed }) => {
  const displayValue = verticalSpeed.toFixed(1);
  const colorClass = verticalSpeed > 0.1 ? 'text-lift' : verticalSpeed < -0.2 ? 'text-sink' : 'text-inherit';

  return (
    <div className="text-center">
      <div className={`text-8xl md:text-9xl font-mono font-bold transition-colors duration-200 ${colorClass}`}>
        {displayValue}
      </div>
      <div className="text-xl text-dark-text-secondary">m/s</div>
    </div>
  );
};
