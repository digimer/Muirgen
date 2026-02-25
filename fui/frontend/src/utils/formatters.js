// This is used to have a consistent date format through out Muirgen; YYYY/MM/DD hh:mm

export const formatMuirgenDate = (dateString) => {
  const date = new Date(dateString); 
  
  // If the date returned NaN, return an empty string
  if (isNaN(date)) return '';

  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
