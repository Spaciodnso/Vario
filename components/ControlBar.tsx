
import React from 'react';

interface ControlBarProps {
  isFlightActive: boolean;
  isMuted: boolean;
  onStartStop: () => void;
  onMuteToggle: () => void;
  onDownloadIGC: () => void;
  isLogReady: boolean;
}

const Button: React.FC<{ onClick: () => void; children: React.ReactNode; className?: string; disabled?: boolean }> = ({ onClick, children, className = '', disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-4 py-3 text-lg font-bold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);

export const ControlBar: React.FC<ControlBarProps> = ({ isFlightActive, isMuted, onStartStop, onMuteToggle, onDownloadIGC, isLogReady }) => {
  return (
    <div className="flex justify-center items-center gap-2">
      <Button
        onClick={onStartStop}
        className={isFlightActive ? 'bg-red-600 hover:bg-red-700 w-32' : 'bg-green-600 hover:bg-green-700 w-32'}
      >
        {isFlightActive ? 'End Flight' : 'Start Flight'}
      </Button>

      {isFlightActive && (
        <Button onClick={onMuteToggle} className="bg-gray-600 hover:bg-gray-700 w-24">
          {isMuted ? 'Unmute' : 'Mute'}
        </Button>
      )}

      {!isFlightActive && isLogReady && (
         <Button onClick={onDownloadIGC} className="bg-blue-600 hover:bg-blue-700 w-32">
          Download IGC
        </Button>
      )}
    </div>
  );
};
