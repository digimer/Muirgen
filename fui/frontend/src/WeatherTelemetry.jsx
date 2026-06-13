// Weather data
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import './Muirgen.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, zoomPlugin);

const WeatherTelemetry = ({ liveTelemetry, vessel }) => {
  const weather                           = liveTelemetry?.weather;
  const isStale                           = !weather?._timestamp || (Date.now() - weather._timestamp > 10000);
  const [historyData, setHistoryData]     = useState([]);
  const [timeRange, setTimeRange]         = useState(24);
  const [activeDataset, setActiveDataset] = useState('pressure'); // Default to pressure
  const chartRef                          = useRef(null);

  const fetchHistory = useCallback(async () => {
    if (!vessel?.uuid) return;
    
    try {
      const token    = localStorage.getItem('muirgen_token');
      const url      = `/api/vessels/${vessel.uuid}/telemetry/weather/history?points=1440&hours=${timeRange}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) setHistoryData(result.data);
    } catch (err) {
      console.error("Failed to fetch weather history", err);
    }
  }, [vessel, timeRange]);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 60000);

    return () => clearInterval(interval);
  }, [fetchHistory]);

  const handleZoomReset = (hours) => {
    setTimeRange(hours);
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  };

  const DATASET_LABELS = useMemo(() => ({
    air_temp: 'Air Temp (°C)',
    water_temp: 'Water Temp (°C)',
    pressure: 'Pressure (hPa)',
    humidity: 'Humidity (%)',
    dew_point: 'Dew Point (°C)'
  }), []);
  const chartData = useMemo(() => {
    const data = [];
    
    // The backend buckets to 800 points. Calculate the expected chronological gap between points.
    const expectedBucketMs = Math.max(1, Math.floor((timeRange * 3600) / 800)) * 1000;
    const maxAllowedGap    = expectedBucketMs * 3; // If a gap is > 3 buckets, the sensor was offline.

    for (let i = 0; i < historyData.length; i++) {
      const d = historyData[i];
      let y = null;
      switch(activeDataset) {
        case 'air_temp':   y = d.air_temp != null ? d.air_temp - 273.15 : null; break;
        case 'water_temp': y = d.water_temp != null ? d.water_temp - 273.15 : null; break;
        case 'pressure':   y = d.pressure; break;
        case 'humidity':   y = d.relative_humidity; break;
        case 'dew_point':  y = d.dew_point != null ? d.dew_point - 273.15 : null; break;
      }

      const currentX = new Date(d.time).getTime();

      // If the gap between this point and the last is too large, explicitly sever the line.
      if (i > 0) {
        const prevX = new Date(historyData[i-1].time).getTime();
        if ((currentX - prevX) > maxAllowedGap) {
          data.push({ x: prevX + 1, y: null });
        }
      }

      data.push({ x: currentX, y: y });
    }

    // Anchor the left edge exactly to the requested time horizon
    data.unshift({ x: Date.now() - (timeRange * 3600 * 1000), y: null });

    // Anchor the right edge of the graph to NOW so missing real-time data is visually obvious.
    data.push({ x: Date.now(), y: null });
    return {
      datasets: [{
        label: DATASET_LABELS[activeDataset],
        data: data,
        borderColor: '#ff0000',
        backgroundColor: '#ff0000',
        borderWidth: 2,
        pointRadius: 0,
        spanGaps: false,
        yAxisID: 'yAxis'
      }]
    };
  }, [historyData, activeDataset, DATASET_LABELS]);
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false, // Disables animations for instant retro snapping
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#000000',
        titleColor: '#ff0000',
        bodyColor: '#ff0000',
        borderColor: '#ff0000',
        borderWidth: 1,
        cornerRadius: 0,
        titleFont: { family: 'monospace' },
        bodyFont: { family: 'monospace' },
        animation: false,
        callbacks: {
          title: function(tooltipItems) {
            const d = new Date(tooltipItems[0].parsed.x);
              return timeRange > 24 
                ? d.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
                : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
          }
        }
      },
      zoom: {
        pan: { enabled: true, mode: 'x' },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
        limits: {
          x: { minRange: 3600000 } // 1 hour minimum zoom in milliseconds
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        bounds: 'data',
        display: true,
        grid: { 
          color: 'rgba(255, 0, 0, 0.25)'
        },
        ticks: { 
          color: '#ff0000', 
          font: { family: 'monospace' },
          autoSkip: true,
          maxTicksLimit: 7,
          maxRotation: 0,
          callback: function(value) {
            const d = new Date(value);
            return timeRange > 24 
              ? d.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
              : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
          }
        }
      },
      yAxis: {
        type: 'linear',
        position: 'left',
        title: { 
          display: true, 
          text: DATASET_LABELS[activeDataset] || '', 
          color: '#ff0000', 
          font: { family: 'monospace' } 
        },
        grid: { color: 'rgba(255, 0, 0, 0.25)' },
        ticks: { color: '#ff0000', font: { family: 'monospace' } }
      }
    }
  }), [activeDataset, DATASET_LABELS, timeRange]);

  const formatTemp  = (val) => val != null ? `${(val - 273.15).toFixed(1)}°C` : '---.-°C';
  const formatPress = (val) => val != null ? `${val.toFixed(1)} hPa` : '----.- hPa';
  const formatRH    = (val) => val != null ? `${val.toFixed(1)}%` : '--.-%';

  return (
    <div className="skyview-container weather-telemetry-container">
      {/* Top Grid: Live Data */}
      <div className="skyview-data-panel weather-top-panel">
        <div className="skyview-dop-header">
          <span>Live Weather Sensors</span>
        </div>
        <div className="skyview-table-wrapper">
          <table className="entity-data-table weather-top-table">
            <tbody>
              <tr>
                <td className="entity-data-label">Air Temp:</td>
                <td className={`entity-data-value ${isStale ? 'telemetry-dead' : ''}`}>[{formatTemp(weather?.air_temp)}]</td>
                <td className="entity-data-label">Water Temp:</td>
                <td className={`entity-data-value ${isStale ? 'telemetry-dead' : ''}`}>[{formatTemp(weather?.water_temp)}]</td>
              </tr>
              <tr>
                <td className="entity-data-label">Dew Point:</td>
                <td className={`entity-data-value ${isStale ? 'telemetry-dead' : ''}`}>[{formatTemp(weather?.dew_point)}]</td>
                <td className="entity-data-label">Rel Humidity:</td>
                <td className={`entity-data-value ${isStale ? 'telemetry-dead' : ''}`}>[{formatRH(weather?.relative_humidity)}]</td>
              </tr>
              <tr>
                <td className="entity-data-label">Pressure:</td>
                <td className={`entity-data-value ${isStale ? 'telemetry-dead' : ''}`}>[{formatPress(weather?.pressure)}]</td>
                <td className="entity-data-label">Status:</td>
                <td className={`entity-data-value ${isStale ? 'telemetry-dead' : ''}`}>
                  [{isStale ? 'STALE' : 'LIVE'}]
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Grid: Historical Chart */}
      <div className="skyview-data-panel weather-chart-panel">
        <div className="skyview-dop-header weather-chart-header">
          <div className="weather-chart-controls">
            <button className={`weather-zoom-button ${activeDataset === 'air_temp' ? 'active' : ''}`} onClick={() => setActiveDataset('air_temp')}>Air Temp</button>
            <button className={`weather-zoom-button ${activeDataset === 'water_temp' ? 'active' : ''}`} onClick={() => setActiveDataset('water_temp')}>Water Temp</button>
            <button className={`weather-zoom-button ${activeDataset === 'pressure' ? 'active' : ''}`} onClick={() => setActiveDataset('pressure')}>Pressure</button>
            <button className={`weather-zoom-button ${activeDataset === 'humidity' ? 'active' : ''}`} onClick={() => setActiveDataset('humidity')}>Humidity</button>
            <button className={`weather-zoom-button ${activeDataset === 'dew_point' ? 'active' : ''}`} onClick={() => setActiveDataset('dew_point')}>Dew Point</button>
          </div>
          <div className="weather-chart-controls">
            <button className={`weather-zoom-button ${timeRange === 3 ? 'active' : ''}`} onClick={() => handleZoomReset(3)}>3h</button>
            <button className={`weather-zoom-button ${timeRange === 24 ? 'active' : ''}`} onClick={() => handleZoomReset(24)}>24h</button>
            <button className={`weather-zoom-button ${timeRange === 72 ? 'active' : ''}`} onClick={() => handleZoomReset(72)}>3d</button>
            <button className={`weather-zoom-button ${timeRange === 168 ? 'active' : ''}`} onClick={() => handleZoomReset(168)}>7d</button>
            <button className={`weather-zoom-button ${timeRange === 720 ? 'active' : ''}`} onClick={() => handleZoomReset(720)}>30d</button>
          </div>
        </div>
        
        <div className="weather-chart-wrapper">
          {historyData.length > 0 ? (
            <Line ref={chartRef} data={chartData} options={chartOptions} />
          ) : (
            <div className="weather-loading-text">[ Waiting for database buffer... ]</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeatherTelemetry;
