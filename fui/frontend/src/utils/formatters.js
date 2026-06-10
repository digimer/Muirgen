// Convert raw milliseconds into a cleaner d/h/m/s format.
export const formatAge = (ms) => {
  if (ms === Infinity || ms == null) return 'Unknown';
  
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
};

// Format raw decimal lat/lon degrees to maritime standards
export const formatCoordinate = (decimalValue, isLatitude) => {
  if (decimalValue === null || decimalValue === undefined) return '';

  const absVal  = Math.abs(decimalValue);
  const degrees = Math.floor(absVal);
  const minutes = ((absVal - degrees) * 60).toFixed(3);

  const cardinal = isLatitude 
    ? (decimalValue >= 0 ? 'N' : 'S')
    : (decimalValue >= 0 ? 'E' : 'W');

  const degreeString = isLatitude ? degrees.toString().padStart(2, '0') : degrees.toString().padStart(3, '0');
  const minuteString = minutes.padStart(6, '0'); 

  return `${degreeString}° ${minuteString}' ${cardinal}`;
}

// This is used to have a consistent date format through out Muirgen; YYYY/MM/DD hh:mm
export const formatMuirgenDate = (dateString) => {
  const date = new Date(dateString); 
  
  // If the date returned NaN, return an empty string
  if (isNaN(date)) return '';

  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
