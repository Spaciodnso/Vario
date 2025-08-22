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

  const addMessage = useCallback((msg: string) => {
    setSensorStatus(prev => ({ ...prev, messages: [...prev.messages.slice(-4), msg] }));
  }, []);

  const toggleMute = useCallback(() => {
    if (audioEngineRef.current) {
      const newMutedState = !audioEngineRef.current.isMuted();
      audioEngineRef.current.setMuted(newMutedState);
      setFlightData(prev => ({ ...prev, isMuted: newMutedState }));
    }
  }, []);

  const handleBarometerReading = useCallback((event: any) => {
    const { pressure } = event.target;
    const timestamp = event.timeStamp;

    if (!lastPressureDataRef.current) {
        lastPressureDataRef.current = { pressure, timestamp };
        return;
    }
    
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

  const handleGPSError = useCallback((error: GeolocationPositionError) => {
      addMessage(`GPS Error: ${error.message}`);
  }, [addMessage]);

  const handleAccelerometerReading = useCallback((event: any) => {
    if (!event.target) return;
    const { x, y, z } = event.target;
    const gForce = Math.sqrt(x*x + y*y + z*z) / 9.81;

    if (gForce > G_FORCE_THRESHOLD) {
      // Future Kalman filter logic can be implemented here.
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
      if (!audioEngineRef.current?.isActionPending()) {
        audioEngineRef.current?.setActionPending(true);
        toggleMute();
        setTimeout(() => audioEngineRef.current?.setActionPending(false), 1000); // 1s cooldown
      }
    }
  }, [toggleMute]);

  const startSensors = useCallback(async (): Promise<boolean> => {
    addMessage('Attempting to start sensors...');
    
    if (!audioEngineRef.current) {
      audioEngineRef.current = new AudioEngine();
      setFlightData(prev => ({...prev, isMuted: audioEngineRef.current?.isMuted() || false, toggleMute }));
    }
    audioEngineRef.current.start();
    
    const freq = 60;

    if ('Barometer' in window) {
      try {
        const barometer = new Barometer({ frequency: freq });
        barometer.addEventListener('reading', handleBarometerReading);
        barometer.start();
        sensorsRef.current.barometer = barometer;
        setSensorStatus(prev => ({ ...prev, barometer: 'active' }));
      } catch (e) {
        setSensorStatus(prev => ({ ...prev, barometer: 'unavailable' }));
        addMessage('Barometer failed. Vario will use GPS (less accurate).');
      }
    } else {
        addMessage('Barometer API not available.');
    }

    if ('Accelerometer' in window) {
        try {
            const accelerometer = new Accelerometer({ frequency: 10 });
            accelerometer.addEventListener('reading', handleAccelerometerReading);
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

    if ('geolocation' in navigator) {
        setSensorStatus(prev => ({...prev, gps: 'available'}));
        gpsWatcherRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                setSensorStatus(prev => ({...prev, gps: 'active'}));
                handleGPSUpdate(pos);
            }, 
            handleGPSError, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000,
        });
    } else {
        setSensorStatus(prev => ({...prev, gps: 'unavailable'}));
        addMessage('GPS not available.');
    }
    
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

    setSensorStatus(prev => ({...prev, permissionGranted: true}));
    return true;
  }, [toggleMute, addMessage, handleAccelerometerReading, handleBarometerReading, handleGPSError, handleGPSUpdate, handleLightSensorReading, handleProximityReading]);
  
  const stopSensors = useCallback(() => {
    Object.values(sensorsRef.current).forEach(sensor => sensor?.stop());
    sensorsRef.current = {};
    if (gpsWatcherRef.current) navigator.geolocation.clearWatch(gpsWatcherRef.current);
    audioEngineRef.current?.stop();
    lastPressureDataRef.current = null;
    smoothedBaroAltitudeRef.current = null;
    setFlightData(prev => ({ ...prev, verticalSpeed: 0, history: [], groundSpeed: 0, glideRatio: 0 }));
    setSensorStatus(prev => ({
        ...prev,
        barometer: prev.barometer === 'unavailable' ? 'unavailable' : 'available',
        gps: prev.gps === 'unavailable' ? 'unavailable' : 'available',
        imu: prev.imu === 'unavailable' ? 'unavailable' : 'available',
        light: prev.light === 'unavailable' ? 'unavailable' : 'available',
        proximity: prev.proximity === 'unavailable' ? 'unavailable' : 'available',
    }));
  }, []);

  useEffect(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.update(flightData.verticalSpeed);
    }
  }, [flightData.verticalSpeed]);

  return { flightData, sensorStatus, startSensors, stopSensors };
};