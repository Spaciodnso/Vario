
import React from 'react';
import { FlightData } from '../types';
import { DataBox } from './DataBox';

interface DataGridProps {
  data: FlightData;
}

export const DataGrid: React.FC<DataGridProps> = ({ data }) => {
  const altitude = data.altitudeBaro > 0 ? data.altitudeBaro : data.altitudeGPS;

  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <DataBox label="Altitude (m)" value={altitude.toFixed(0)} />
      <DataBox label="Speed (km/h)" value={(data.groundSpeed * 3.6).toFixed(0)} />
      <DataBox label="Glide" value={data.glideRatio > 0 ? data.glideRatio.toFixed(1) : '---'} />
    </div>
  );
};
