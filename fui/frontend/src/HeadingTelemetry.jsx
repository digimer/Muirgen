// Directional heading
import React from 'react';
import WireframeCompass from './WireframeCompass';
import './Muirgen.css';

const HeadingTelemetry = ({ liveTelemetry }) => {
  const motion = liveTelemetry?.motion;
  
  // Stale check
  const isStale = !motion?._timestamp || (Date.now() - motion._timestamp > 10000);

  // Math for True Heading
  const trueHeading = (motion?.heading_magnetic != null && motion?.magnetic_variation != null) 
    ? ((motion.heading_magnetic + motion.magnetic_variation + 360.0) % 360.0) 
    : null;

  const formatDir = (val) => val != null ? `${val.toFixed(0).padStart(3, '0')}°` : '---°';

  return (
    <div className="skyview-container">
      <div className="skyview-top-grid">
        {/* Left Column: Graphic */}
        <div className="skyview-radar-panel">
          <WireframeCompass 
            outerAngle={!isStale ? trueHeading : null} 
            innerAngle={!isStale ? motion?.heading_magnetic : null} 
            isStale={isStale} 
          />
        </div>

        {/* Right Column: Data */}
        <div className="skyview-data-panel">
          <div className="skyview-dop-header">
            <span>Heading Vectors</span>
          </div>

          <div className="skyview-table-wrapper">
            <table className="entity-data-table">
              <tbody>
                <tr>
                  <td className="entity-data-label">True:</td>
                  <td className={`entity-data-value ${isStale ? 'telemetry-dead' : ''}`}>
                    [{formatDir(trueHeading)}]
                  </td>
                </tr>
                <tr>
                  <td className="entity-data-label">Magnetic:</td>
                  <td className={`entity-data-value ${isStale ? 'telemetry-dead' : ''}`}>
                    [{formatDir(motion?.heading_magnetic)}]
                  </td>
                </tr>
                <tr>
                  <td className="entity-data-label">Variation:</td>
                  <td className={`entity-data-value ${isStale ? 'telemetry-dead' : ''}`}>
                    [{formatDir(motion?.magnetic_variation)}]
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

export default HeadingTelemetry;
