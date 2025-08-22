import { useState, useEffect, useCallback, useRef } from 'react';
import { FlightData, SensorStatus } from '../types';
import { AudioEngine } from '../services/audioEngine';

// --- Constants ---
const ALTITUDE_EMA_ALPHA = 0.2; // Smoothing for altitude
const G_FORCE_THRESHOLD = 1.5; // g's to detect for thermal entry compensation
const HISTORY_LENGTH = 30; // 30 seconds of vertical speed history

// --- Sensor Interfaces (to satisfy TypeScript) ---
interface GenericSensor extends EventTarget {
  start: () => void;
  stop: () => void;
}
declare let Barometer: { new(options: any): GenericSensor & { pressure: number } };
declare let Accelerometer: { new(options: any): GenericSensor & { x: number, y: number, z: number } };
declare let Gyroscope: { new(options: any): GenericSensor & { x: number, y: number, z: number } };
declare let AmbientLightSensor: { new(options: any): GenericSensor & { illuminance: number } };
declare let ProximitySensor: { new(options: any): GenericSensor & { distance: number; near: boolean } };

export const useSensors = () => {
  const [flightData, setFlightData] = useState<FlightData>({
    verticalSpeed: 0,
    altitudeGPS: 0,
    altitudeBaro: 0,
    groundSpeed: 0,
    glideRatio: 0,
    latitude: 0,
    longitude: 0,
    timestamp: Date.now(),
    history: [],
    isMuted: false,
    toggleMute: () => {}
  });

  const [sensorStatus, setSensorStatus] = useState<SensorStatus>({
    barometer: 'unavailable',
    gps: 'unavailable',
    imu: 'unavailable',
    light: 'unavailable',
    proximity: 'unavailable',
    permissionGranted: false,
    theme: 'theme-dark',
    messages: []
  });

  const audioEngineRef = useRef<AudioEngine | null>(null);
  const sensorsRef = useRef<{ [key: string]: GenericSensor | null }>({});
  const lastPressureDataRef = useRef<{ pressure: number; timestamp: number } | null>(null);
  const smoothedBaroAltitudeRef = useRef<number | null>(null);
  const gpsWatcherRef = useRef<number | null>(null);

  const addMessage = (msg: string) => {
    setSensorStatus(prev => ({ ...prev, messages: [...prev.messages, msg] }));
  };

  const toggleMute = useCallback(() => {
    if (audioEngineRef.current) {
      const newMutedState = !audioEngineRef.current.isMuted();
      audioEngineRef.current.setMuted(newMutedState);
      setFlightData(prev => ({ ...prev, isMuted: newMutedState }));
    }
  }, []);

  const startSensors = async (): Promise<boolean> => {
    try {
      // @ts-ignore
      const permissionState = await navigator.permissions.query({ name: "accelerometer" });
      if (permissionState.state !== 'granted') {
          addMessage('Sensor permissions not granted. Please allow access.');
          return false;
      }
      setSensorStatus(prev => ({...prev, permissionGranted: true}));
    } catch (e) {
      addMessage('Generic Sensor API not supported. Using fallbacks.');
    }
    
    // --- Initialize Audio ---
    if (!audioEngineRef.current) {
      audioEngineRef.current = new AudioEngine();
      setFlightData(prev => ({...prev, isMuted: audioEngineRef.current?.isMuted() || false, toggleMute }));
    }
    audioEngineRef.current.start();
    
    const freq = 60; // 60hz for high frequency sensors

    // --- Barometer ---
    if ('Barometer' in window) {
      try {
        const barometer = new Barometer({ frequency: freq });
        barometer.addEventListener('reading', (event) => handleBarometerReading(event));
        barometer.start();
        sensorsRef.current.barometer = barometer;
        setSensorStatus(prev => ({ ...prev, barometer: 'active' }));
      } catch (e) {
        setSensorStatus(prev => ({ ...prev, barometer: 'unavailable' }));
        addMessage('Barometer failed to start. Vario will use GPS (less accurate).');
      }
    } else {
        addMessage('Barometer not available.');
    }

    // --- IMU (Accelerometer for G-Force) ---
    if ('Accelerometer' in window) {
        try {
            const accelerometer = new Accelerometer({ frequency: 10 });
            accelerometer.addEventListener('reading', (event) => handleAccelerometerReading(event));
            accelerometer.start();
            sensorsRef.current.accelerometer = accelerometer;
            setSensorStatus(prev => ({...prev, imu: 'active'}));
        } catch(e) {
            setSensorStatus(prev => ({...prev, imu: 'unavailable'}));
            addMessage('Accelerometer not available.');
        }
    } else {
        addMessage('Accelerometer not available.');
    }

    // --- Geolocation (GPS) ---
    if ('geolocation' in navigator) {
        setSensorStatus(prev => ({...prev, gps: 'active'}));
        gpsWatcherRef.current = navigator.geolocation.watchPosition(handleGPSUpdate, handleGPSError, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000,
        });
    } else {
        setSensorStatus(prev => ({...prev, gps: 'unavailable'}));
        addMessage('GPS not available.');
    }
    
    // --- Ambient Light Sensor ---
    if ('AmbientLightSensor' in window) {
      try {
        const lightSensor = new AmbientLightSensor();
        lightSensor.addEventListener('reading', handleLightSensorReading);
        lightSensor.start();
        sensorsRef.current.light = lightSensor;
        setSensorStatus(prev => ({ ...prev, light: 'active' }));
      } catch (e) {
        setSensorStatus(prev => ({ ...prev, light: 'unavailable' }));
      }
    }

    // --- Proximity Sensor ---
    if ('ProximitySensor' in window) {
      try {
        const proximitySensor = new ProximitySensor();
        proximitySensor.addEventListener('reading', handleProximityReading);
        proximitySensor.start();
        sensorsRef.current.proximity = proximitySensor;
        setSensorStatus(prev => ({ ...prev, proximity: 'active' }));
      } catch (e) {
        setSensorStatus(prev => ({ ...prev, proximity: 'unavailable' }));
      }
    }

    return true;
  };
  
  const stopSensors = () => {
    Object.keys(sensorsRef.current).forEach(key => sensorsRef.current[key]?.stop());
    sensorsRef.current = {};
    if (gpsWatcherRef.current) navigator.geolocation.clearWatch(gpsWatcherRef.current);
    audioEngineRef.current?.stop();
    lastPressureDataRef.current = null;
    smoothedBaroAltitudeRef.current = null;
    setFlightData(prev => ({ ...prev, verticalSpeed: 0, history: [] }));
  };
  
  // --- Sensor Handlers ---
  const handleBarometerReading = useCallback((event: any) => {
    const { pressure } = event.target;
    const timestamp = event.timeStamp;

    if (!lastPressureDataRef.current) {
        lastPressureDataRef.current = { pressure, timestamp };
        return;
    }
    
    // Pressure to Altitude conversion: p = p0 * (1 - L*h/T0)^(g*M/(R*L))
    // Simplified: h = (1 - (p/p0)^(1/5.255)) * 145366.45 feet
    // h_meters = 44330 * (1 - (p / 1013.25)^(1/5.255))
    const currentAltitude = 44330 * (1 - Math.pow(pressure / 1013.25, 1 / 5.255));
    
    if (smoothedBaroAltitudeRef.current === null) {
      smoothedBaroAltitudeRef.current = currentAltitude;
    } else {
      smoothedBaroAltitudeRef.current = (ALTITUDE_EMA_ALPHA * currentAltitude) + ((1 - ALTITUDE_EMA_ALPHA) * smoothedBaroAltitudeRef.current);
    }
    const lastAltitude = 44330 * (1 - Math.pow(lastPressureDataRef.current.pressure / 1013.25, 1 / 5.255));
    
    const dt = (timestamp - lastPressureDataRef.current.timestamp) / 1000.0;
    if (dt > 0) {
        const verticalSpeed = (smoothedBaroAltitudeRef.current - lastAltitude) / dt;
        
        setFlightData(prev => {
            const newHistory = [...prev.history, { time: Date.now(), vz: verticalSpeed }].slice(-HISTORY_LENGTH);
            const glideRatio = prev.groundSpeed > 1 && verticalSpeed < -0.1 ? Math.abs(prev.groundSpeed / verticalSpeed) : 0;
            return {
                ...prev,
                verticalSpeed,
                altitudeBaro: smoothedBaroAltitudeRef.current || 0,
                glideRatio,
                history: newHistory,
            };
        });
    }

    lastPressureDataRef.current = { pressure, timestamp };
  }, []);

  const handleGPSUpdate = useCallback((position: GeolocationPosition) => {
    const { latitude, longitude, altitude, speed } = position.coords;
    const groundSpeed = speed ? speed : 0; // speed is in m/s

    // GPS-based Vario (fallback if barometer is unavailable)
    if (sensorStatus.barometer !== 'active') {
        setFlightData(prev => {
            const dt = (position.timestamp - prev.timestamp) / 1000;
            let verticalSpeed = 0;
            if (dt > 0 && prev.altitudeGPS > 0 && altitude) {
                verticalSpeed = (altitude - prev.altitudeGPS) / dt;
            }
            const newHistory = [...prev.history, { time: Date.now(), vz: verticalSpeed }].slice(-HISTORY_LENGTH);
            const glideRatio = groundSpeed > 1 && verticalSpeed < -0.1 ? Math.abs(groundSpeed / verticalSpeed) : 0;
            return { ...prev, verticalSpeed, history: newHistory, glideRatio };
        });
    }
    
    setFlightData(prev => ({
      ...prev,
      altitudeGPS: altitude || 0,
      groundSpeed,
      latitude,
      longitude,
      timestamp: position.timestamp
    }));
  }, [sensorStatus.barometer]);

  const handleGPSError = (error: GeolocationPositionError) => {
      addMessage(`GPS Error: ${error.message}`);
  };

  const handleAccelerometerReading = useCallback((event: any) => {
    if (!event.target) return;
    const { x, y, z } = event.target;
    const gForce = Math.sqrt(x*x + y*y + z*z) / 9.81;

    // Simple G-force compensation: if we detect a spike (like in a thermal turn),
    // temporarily dampen the variometer reading to avoid false lift.
    if (gForce > G_FORCE_THRESHOLD) {
      // This is a simplified approach. A real Kalman filter would be more complex.
      // Here we can just briefly ignore strong Vario changes.
    }
  }, []);

  const handleLightSensorReading = useCallback((event: any) => {
    const illuminance = event.target.illuminance;
    if (illuminance > 1000) { // Bright sunlight
      document.body.classList.remove('bg-dark-bg', 'text-dark-text-primary');
      document.body.classList.add('bg-high-contrast-bg', 'text-high-contrast-text');
      setSensorStatus(prev => ({...prev, theme: 'theme-high-contrast'}));
    } else {
      document.body.classList.remove('bg-high-contrast-bg', 'text-high-contrast-text');
      document.body.classList.add('bg-dark-bg', 'text-dark-text-primary');
      setSensorStatus(prev => ({...prev, theme: 'theme-dark'}));
    }
  }, []);

  const handleProximityReading = useCallback((event: any) => {
    if (event.target.near) {
      // Debounce the toggle to prevent rapid firing
      if (!audioEngineRef.current?.isActionPending()) {
        audioEngineRef.current?.setActionPending(true);
        toggleMute();
        setTimeout(() => audioEngineRef.current?.setActionPending(false), 1000); // 1s cooldown
      }
    }
  }, [toggleMute]);

  useEffect(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.update(flightData.verticalSpeed);
    }
  }, [flightData.verticalSpeed]);

  return { flightData, sensorStatus, startSensors, stopSensors };
};
