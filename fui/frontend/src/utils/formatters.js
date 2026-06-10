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

// This is used to have a consistent date format through out Muirgen; YYYY/MM/DD hh:mm
export const formatMuirgenDate = (dateString) => {
  const date = new Date(dateString); 
  
  // If the date returned NaN, return an empty string
  if (isNaN(date)) return '';

  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
