const stops = [
  {hour:0, label:'Starry night', top:'#071126', horizon:'#202f53', cloud:'#77829d', sun:'#b9d4ff', daylight:0},
  {hour:5, label:'Starry night', top:'#0c1833', horizon:'#33365a', cloud:'#8f8b9d', sun:'#b9d4ff', daylight:0},
  {hour:6.5, label:'Sunrise', top:'#667fa9', horizon:'#f8b58e', cloud:'#f4c7ab', sun:'#ffd4a0', daylight:.45},
  {hour:8, label:'Daylight', top:'#3783cc', horizon:'#cce6f4', cloud:'#ffffff', sun:'#fff3d8', daylight:1},
  {hour:16, label:'Daylight', top:'#3783cc', horizon:'#cce6f4', cloud:'#ffffff', sun:'#fff3d8', daylight:1},
  {hour:18, label:'Sunset', top:'#596699', horizon:'#f7a074', cloud:'#f2bfa9', sun:'#ffb97c', daylight:.35},
  {hour:20, label:'Starry night', top:'#071126', horizon:'#202f53', cloud:'#77829d', sun:'#b9d4ff', daylight:0},
  {hour:24, label:'Starry night', top:'#071126', horizon:'#202f53', cloud:'#77829d', sun:'#b9d4ff', daylight:0},
];
export function atmosphereAt(hour) {
  hour = ((hour % 24) + 24) % 24;
  let i = 0; while (i < stops.length - 2 && hour > stops[i + 1].hour) i++;
  const a = stops[i], b = stops[i + 1], fraction = (hour - a.hour) / (b.hour - a.hour);
  const t = fraction * fraction * (3 - 2 * fraction);
  return {a,b,t,daylight:a.daylight+(b.daylight-a.daylight)*t,label:t < .5 ? a.label : b.label,hour};
}
export function localHour(date = new Date()) { return date.getHours() + date.getMinutes()/60 + date.getSeconds()/3600; }
