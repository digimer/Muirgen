// Wind (True and Apparent) telemetry 
import React from 'react'; 
import WireframeCompass from './WireframeCompass';
import './Muirgen.css';

const WindTelemetry = ({ liveTelemetry }) => {
  const wind = liveTelemetry?.wind;

  // Staleness check
  const isStale = !wind?._timestamp || (Date.now() - wind._timestamp > 10000);

  // Fallback missing data to --.-
  const formatSpeed     = (value) => value != null ? (value * 1.94384).toFixed(1) : '--.-';
  const formatDirection = (value) => value != null ? `${value.toFixed(0).padStart(3, '0')}°` : '---°';

  return (
    <div className="skyview-container">
      <div className="skyview-top-grid">
        {/* Left Column: Graphic */}
        <div className="skyview-radar-wrapper">
          <div className="skyview-radar-panel">
            <WireframeCompass 
              outerAngle={!isStale ? (wind?.true_direction ?? wind?.ground_direction) : null} 
              innerAngle={!isStale ? wind?.apparent_direction : null} 
              isStale={isStale} 
            />
          </div>
          <div className="compass-legend">
            Outer: True<br />
            Inner: Apparent
          </div>
        </div>
        {/* Right Column: Data */}
        <div className="skyview-data-panel">
          <div className="skyview-dop-header">
            <span>Wind Vectors</span>
          </div>
          <div className="skyview-table-wrapper">
            <table className="entity-data-table">
              <tbody>
                <tr>
                  <td className="entity-data-label">True:</td>
                  <td className={`entity-data-value ${isStale ? 'telemetry-dead' : ''}`}>
                    [{formatDirection(wind?.true_direction ?? wind?.ground_direction)}] at: [{formatSpeed(wind?.true_speed ?? wind?.ground_speed)} kts]
                  </td>
                </tr>
                <tr>
                  <td className="entity-data-label">Apparent:</td>
                  <td className={`entity-data-value ${isStale ? 'telemetry-dead' : ''}`}>
                    [{formatDirection(wind?.apparent_direction)}] at: [{formatSpeed(wind?.apparent_speed)} kts]
                  </td>
                </tr>
                <tr>
                  <td className="entity-data-label">Status:</td>
                  <td className={`entity-data-value ${isStale ? 'telemetry-dead' : ''}`}>
                    [{isStale ? 'STALE' : 'LIVE'}]
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="entity-data-label" style={{marginTop: '20px', textAlign: 'center'}}>
            [ Historical Graphs Pending ]
          </div>
        </div>
      </div>
    </div>
  );
};

export default WindTelemetry;
