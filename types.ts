
export interface FlightData {
  verticalSpeed: number;
  altitudeGPS: number;
  altitudeBaro: number;
  groundSpeed: number;
  glideRatio: number;
  latitude: number;
  longitude: number;
  timestamp: number;
  history: { time: number; vz: number }[];
  isMuted: boolean;
  toggleMute: () => void;
}

export interface SensorStatus {
  barometer: 'unavailable' | 'available' | 'active';
  gps: 'unavailable' | 'available' | 'active';
  imu: 'unavailable' | 'available' | 'active';
  light: 'unavailable' | 'available' | 'active';
  proximity: 'unavailable' | 'available' | 'active';
  permissionGranted: boolean;
  theme: 'theme-dark' | 'theme-high-contrast';
  messages: string[];
}
