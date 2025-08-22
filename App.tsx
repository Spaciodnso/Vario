
import React, { useState, useEffect, useCallback } from 'react';
import { useSensors } from './hooks/useSensors';
import { VarioDisplay } from './components/VarioDisplay';
import { HistoryChart } from './components/HistoryChart';
import { DataGrid } from './components/DataGrid';
import { ControlBar } from './components/ControlBar';
import { StatusDisplay } from './components/StatusDisplay';
import { FlightData, SensorStatus } from './types';
import { exportToIGC } from './services/igcExporter';

const App: React.FC = () => {
  const [isFlightActive, setIsFlightActive] = useState(false);
  const { flightData, sensorStatus, startSensors, stopSensors } = useSensors();
  const [trackLog, setTrackLog] = useState<FlightData[]>([]);

  useEffect(() => {
    if (isFlightActive) {
      const interval = setInterval(() => {
        setTrackLog(prevLog => [...prevLog, flightData]);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isFlightActive, flightData]);
  
  const handleStartStop = useCallback(() => {
    if (isFlightActive) {
      stopSensors();
      setIsFlightActive(false);
    } else {
      startSensors().then(success => {
        if (success) {
          setIsFlightActive(true);
          setTrackLog([]);
        }
      });
    }
  }, [isFlightActive, startSensors, stopSensors]);

  const handleDownloadIGC = () => {
    if (trackLog.length > 1) {
      exportToIGC(trackLog);
    } else {
      alert("Not enough track data to generate IGC file.");
    }
  };
  
  return (
    <div className={`w-screen h-screen flex flex-col font-sans transition-colors duration-500 ${sensorStatus.theme}`}>
      <main className="flex-grow flex flex-col p-4 gap-4 justify-between">
        <StatusDisplay status={sensorStatus} />
        
        {isFlightActive ? (
          <>
            <VarioDisplay verticalSpeed={flightData.verticalSpeed} />
            <HistoryChart data={flightData.history} />
            <DataGrid data={flightData} />
          </>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center text-center">
            <h1 className="text-4xl font-bold text-dark-text-primary">VarioSpaciodnso</h1>
            <p className="text-dark-text-secondary mt-2">Ready for flight.</p>
            <p className="mt-8 max-w-sm text-sm text-dark-text-secondary">
              Click 'Start Flight' to activate sensors. Please grant all requested permissions for full functionality.
            </p>
          </div>
        )}

        <ControlBar
          isFlightActive={isFlightActive}
          isMuted={flightData.isMuted}
          onStartStop={handleStartStop}
          onMuteToggle={flightData.toggleMute}
          onDownloadIGC={handleDownloadIGC}
          isLogReady={trackLog.length > 1}
        />
      </main>
    </div>
  );
};

export default App;
