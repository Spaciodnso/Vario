
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';

interface HistoryChartProps {
  data: { time: number; vz: number }[];
}

export const HistoryChart: React.FC<HistoryChartProps> = ({ data }) => {
  const gradientId = "vzGradient";

  return (
    <div className="w-full h-24 md:h-32">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.6}/>
              <stop offset="50%" stopColor="#8884d8" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.6}/>
            </linearGradient>
          </defs>
          <YAxis domain={[-5, 5]} hide={true} />
          <XAxis dataKey="time" hide={true} />
          <ReferenceLine y={0} stroke="#808080" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="vz"
            stroke="#8884d8"
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
