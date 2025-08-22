
import { FlightData } from '../types';

function toIGCDateTime(timestamp: number): { date: string, time: string } {
    const d = new Date(timestamp);
    const date = `${d.getUTCDate().toString().padStart(2, '0')}${ (d.getUTCMonth() + 1).toString().padStart(2, '0')}${d.getUTCFullYear().toString().slice(-2)}`;
    const time = `${d.getUTCHours().toString().padStart(2, '0')}${d.getUTCMinutes().toString().padStart(2, '0')}${d.getUTCSeconds().toString().padStart(2, '0')}`;
    return { date, time };
}

function toIGCLat(lat: number): string {
    const hemisphere = lat >= 0 ? 'N' : 'S';
    lat = Math.abs(lat);
    const deg = Math.floor(lat);
    const min = ((lat - deg) * 60).toFixed(3).replace('.', '').padStart(5, '0');
    return `${deg.toString().padStart(2, '0')}${min}${hemisphere}`;
}

function toIGCLon(lon: number): string {
    const hemisphere = lon >= 0 ? 'E' : 'W';
    lon = Math.abs(lon);
    const deg = Math.floor(lon);
    const min = ((lon - deg) * 60).toFixed(3).replace('.', '').padStart(5, '0');
    return `${deg.toString().padStart(3, '0')}${min}${hemisphere}`;
}


export function exportToIGC(trackLog: FlightData[]) {
    if (trackLog.length === 0) return;

    const { date, time } = toIGCDateTime(trackLog[0].timestamp);
    let igcContent = `AXXAVarioSpaciodnso\r\n`;
    igcContent += `HFDTE${date}\r\n`;
    igcContent += `HFPLTPILOT:Unknown\r\n`;
    igcContent += `HFGTYGLIDERTYPE:Unknown\r\n`;
    igcContent += `HFGIDGLIDERID:Unknown\r\n`;
    igcContent += `HFFRSSECURITY:None\r\n`;
    igcContent += `I013638FXA\r\n`; // Fix accuracy extension

    trackLog.forEach(point => {
        const { time: bTime } = toIGCDateTime(point.timestamp);
        const lat = toIGCLat(point.latitude);
        const lon = toIGCLon(point.longitude);
        const altBaro = Math.round(point.altitudeBaro).toString().padStart(5, '0');
        const altGps = Math.round(point.altitudeGPS).toString().padStart(5, '0');

        const bRecord = `B${bTime}${lat}${lon}A${altBaro}${altGps}\r\n`;
        igcContent += bRecord;
    });
    
    igcContent += `GEND\r\n`;

    const blob = new Blob([igcContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flight_${date}_${time}.igc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
