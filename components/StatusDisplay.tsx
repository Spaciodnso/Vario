
import React from 'react';
import { SensorStatus } from '../types';

interface StatusDisplayProps {
  status: SensorStatus;
}

const StatusIcon: React.FC<{ label: string, status: 'unavailable' | 'available' | 'active' }> = ({ label, status }) => {
    const color = status === 'active' ? 'text-green-500' : status === 'available' ? 'text-yellow-500' : 'text-red-500';
    const title = `Status: ${status}`;
    return <span title={title} className={`font-bold ${color}`}>{label}</span>
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({ status }) => {
  return (
    <div className="absolute top-2 left-2 text-xs text-dark-text-secondary opacity-70">
        <div className="flex gap-2">
            <StatusIcon label="BARO" status={status.barometer} />
            <StatusIcon label="GPS" status={status.gps} />
            <StatusIcon label="IMU" status={status.imu} />
            <StatusIcon label="LIGHT" status={status.light} />
        </div>
        {status.messages.length > 0 && <div className="mt-1 text-red-400">{status.messages[status.messages.length - 1]}</div>}
    </div>
  );
};
