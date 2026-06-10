// Handles the Skyview page.
import React, { useState, useRef } from 'react';
import { formatAge, formatCoordinate, getDOPConfidenceHeight } from './utils/formatters';
import './Muirgen.css';

const Skyview = ({ liveTelemetry }) => {
  const skyview = liveTelemetry?.skyview;

  const [hoveredPrn, setHoveredPrn] = useState(null);
  const rowRefs = useRef({}); // To store references to table rows for scrolling

  const handleRadarClick = (prn) => {
    if (rowRefs.current[prn]) {
      rowRefs.current[prn].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Dead-Reckoning / Estimated Position stubs
  // ToDo: Implement once the Airmar DST810 PGNs are implemented.
  const estimatedPosition = null;
  const deadReckoning     = null;

  const renderRadarPlot = () => {
    if (!skyview || !skyview.satellites || skyview.satellites.length === 0) {
      return <div className="radar-empty">No Satellite Data</div>;
    }

    const radius = 100;
    const center = 110;

    return (
      <div className="radar-plot-container">
        <svg viewBox="0 0 220 220" className="radar-svg">
          {/* Subtle Embossed Compass Rose */}
          <circle cx={center} cy={center} r={radius} className="radar-grid-outer" />
          <circle cx={center} cy={center} r={radius * 0.66} className="radar-grid-inner" />
          <circle cx={center} cy={center} r={radius * 0.33} className="radar-grid-inner" />
          
          <line x1={center} y1="10" x2={center} y2="210" className="radar-axis" />
          <line x1="10" y1={center} x2="210" y2={center} className="radar-axis" />

          <text x={center} y="8" className="radar-label-n">N</text>

          {/* Overlay vessel heading if moving (using motion telemetry if available) */}
          {[...skyview.satellites]
            .sort((a, b) => (a.snr || 0) - (b.snr || 0))
            .map((satellite) => {
            if (satellite.elevation === null || satellite.azimuth === null) return null;
            // Zenith (90 degrees elevation) is center (r=0), horizon (0 deg)
            // is the edge (r=radius).
            const rad   = radius * (1 - (satellite.elevation / 90));
            const theta = satellite.azimuth * (Math.PI / 180);
            const x_pos = center + rad * Math.sin(theta);
            // The Y axis is inverted in SVG
            const y_pos = center - rad * Math.cos(theta);

            // If the SNT is strong, brighten the satellite. Weak is dim.
            const isStrong = satellite.snr !== null && satellite.snr > 30;
            return(
              <g 
                key={satellite.prn}
                onMouseEnter={() => setHoveredPrn(satellite.prn)}
                onMouseLeave={() => setHoveredPrn(null)}
                onClick={() => handleRadarClick(satellite.prn)}
                className={`radar-target-group ${hoveredPrn === satellite.prn ? 'hovered' : ''}`}
              >
                <circle cx={x_pos} cy={y_pos} r="3" className={`radar-satellite-dot ${isStrong ? 'satellite-strong' : 'satellite-weak'}`} />
                <text x={x_pos + 5} y={y_pos + 3} className="radar-satellite-bg">{satellite.prn}</text>
                <text x={x_pos + 5} y={y_pos + 3} className={`radar-satellite-text ${isStrong ? 'satellite-strong' : 'satellite-weak'}`}>{satellite.prn}</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderSNRBars = () => {
    if (!skyview || !skyview.satellites || skyview.satellites.length === 0) return null;

    // Sort satellites by PRN for consistency in the bar chart
    const sortedSats = [...skyview.satellites].sort((a, b) => a.prn - b.prn);

    return (
      <div className="snr-chart-wrapper">
        <div className="snr-chart-title">Signal to Noise Ratio (dB)</div>
        
        <div className="snr-chart-body">
          {/* Y Axis Labels */}
          <div className="snr-y-axis">
            <span>50</span>
            <span style={{ position: 'absolute', bottom: '60%', transform: 'translateY(50%)' }}>30</span>
            <span>0</span>
          </div>
          
          <div className="snr-chart-main">
            {/* The actual chart area (excludes PRN labels) */}
            <div className="snr-chart-graph-area">
              <div className="snr-grid-line" style={{ bottom: '100%' }} />
              <div className="snr-grid-line threshold" style={{ bottom: '60%' }} />
              <div className="snr-grid-line" style={{ bottom: '0%' }} />
              
              <div className="snr-bars-layer">
                {sortedSats.map(sat => {
                  const snrVal        = sat.snr || 0;
                  const heightPercent = Math.min((snrVal / 50) * 100, 100);
                  const isStrong      = sat.snr > 30;
                  return (
                    <div 
                      key={sat.prn} 
                      className={`snr-bar-container ${hoveredPrn === sat.prn ? 'hovered' : ''}`}
                      onMouseEnter={() => setHoveredPrn(sat.prn)}
                      onMouseLeave={() => setHoveredPrn(null)}
                    >
                      <div className={`snr-bar-fill ${isStrong ? 'strong' : ''}`} style={{ height: `${heightPercent}%`}} />
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* The X Axis (PRN labels) */}
            <div className="snr-x-axis">
              {sortedSats.map(sat => (
                <div key={sat.prn} className="snr-x-label">{sat.prn}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Accurately age the coordinates even if the sensor is spamming empty packets
  const positionAge = liveTelemetry?.position?._location_timestamp 
    ? (Date.now() - liveTelemetry.position._location_timestamp)
    : Infinity;
  const isStale = (skyview?._timestamp && (Date.now() - skyview._timestamp > 10000)) || positionAge > 10000;

  return (
    <div className="skyview-container">
      <div className="skyview-top-grid">
        <div className="skyview-radar-panel">
          {renderRadarPlot()}
        </div>

        <div className="skyview-data-panel">
          <div className="skyview-dop-header">
            <span>Sats: [{skyview?.satellites?.length || '--'}]</span>
            &nbsp; <span>
              HDOP: [{skyview?.horizontal_dop?.toFixed(2) || '--'}]
              <span className="skyview-confidence-meter" title="Accuracy Confidence">
                <span className="skyview-confidence-fill" style={{ height: `${getDOPConfidenceHeight(skyview?.horizontal_dop)}%`}}></span>
              </span>
            </span>
            &nbsp; <span>
              VDOP: [{skyview?.vertical_dop?.toFixed(2) || '--'}]
              <span className="skyview-confidence-meter" title="Accuracy Confidence">
                <span className="skyview-confidence-fill" style={{ height: `${getDOPConfidenceHeight(skyview?.vertical_dop)}%`}}></span>
              </span>
            </span>
            {/* TDOP is not useful for private vessels (nor most commercial vessels). While it is supported in the backend, it is not displayed. */}
            {/* &nbsp; <span>
              TDOP: [{skyview?.time_dop?.toFixed(2) || '--'}]
              <span className="skyview-confidence-meter" title="Accuracy Confidence">
                <span className="skyview-confidence-fill" style={{ height: `${getDOPConfidenceHeight(skyview?.time_dop)}%`}}></span>
              </span>
            </span> */}
          </div>

          {renderSNRBars()}

          <div className="skyview-table-container">
            <table className="skyview-table">
              <thead>
                <tr>
                  <th>PRN</th>
                  <th>Elevation</th>
                  <th>Azimuth</th>
                  <th>SNR</th>
                </tr>
              </thead>
              <tbody>
                {skyview?.satellites?.map(sat => (
                  <tr 
                    key={sat.prn}
                    ref={el => rowRefs.current[sat.prn] = el}
                    className={hoveredPrn === sat.prn ? 'row-hovered' : ''}
                    onMouseEnter={() => setHoveredPrn(sat.prn)}
                    onMouseLeave={() => setHoveredPrn(null)}
                  >
                    <td>{sat.prn}</td>
                    <td>{sat.elevation !== null ? sat.elevation.toFixed(0) + '°' : '--'}</td>
                    <td>{sat.azimuth !== null ? sat.azimuth.toFixed(0) + '°' : '--'}</td>
                    <td>{sat.snr !== null ? sat.snr.toFixed(1) : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="skyview-bottom-span">
        {/* We will enable the dead-reckoning and the estimated position later. For now, this is a placeholder
        <div className="skyview-dr-stubs">
           <div className="dr-stub">EP: [Awaiting DST810]</div>
           <div className="dr-stub">DR: [Awaiting DST810]</div>
        </div>*/}
        
        <div className={`skyview-latlon ${(isStale || (liveTelemetry?.position && liveTelemetry.position.latitude == null)) ? 'data-stale-hash' : ''}`}>
          {liveTelemetry?.position && liveTelemetry.position.latitude != null && !isStale ? (
            <div className="latlon-live">
              {formatCoordinate(liveTelemetry.position.latitude, true)}, {formatCoordinate(liveTelemetry.position.longitude, false)}
            </div>
          ) : (
            <div className="skyview-latlon-stale">
              {(positionAge !== Infinity) && <div className="skyview-stale-warning">[Warning: Stale Position] Last Fix: [{formatAge(positionAge)}] ago</div>}
              <div className="skyview-latlon-stale-coords">
                 {liveTelemetry?.position && liveTelemetry.position.latitude != null && liveTelemetry?.position?.longitude != null
                   ? `${formatCoordinate(liveTelemetry.position.latitude, true)}    ${formatCoordinate(liveTelemetry.position.longitude, false)}`
                   : "---° --.---' ---° --.---'"}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Skyview;
