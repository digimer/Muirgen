// Compass Rose rendering
import React from 'react';

const WireFrameCompass = ({ outerAngle, innerAngle, isStale }) => {
  const outerRef = React.useRef(null);
  const innerRef = React.useRef(null);

  // SVG will render at 1000x1000px, but CSS will scale as needed.
  const compassCenterX = 500;
  const compassCenterY = 500;
  const ringOuter      = 400; // North, South, East, West
  const ringMiddle     = 350; // NE, SE, SW, NW
  const ringInner      = 300; // 22.5 degre either side of ringMiddle points
  const centerVoid     = 60;  // Keeps the center empty

  // Math helper
  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  // Generate star points.
  const drawTriangle = (angle, tipRadius, baseRadius, baseWidth) => {
    const tip       = polarToCartesian(compassCenterX, compassCenterY, tipRadius, angle);
    const leftBase  = polarToCartesian(compassCenterX, compassCenterY, baseRadius, angle - baseWidth);
    const rightBase = polarToCartesian(compassCenterX, compassCenterY, baseRadius, angle + baseWidth);
    return `${tip.x},${tip.y} ${leftBase.x},${leftBase.y} ${rightBase.x},${rightBase.y}`;
  };

  // Pointers;
  // Outer pointer (▽) pointing to the center
  const getOuterPointer = (angle) => {
    const tip       = polarToCartesian(compassCenterX, compassCenterY, ringOuter + 20, angle);
    const leftBase  = polarToCartesian(compassCenterX, compassCenterY, ringOuter + 70, angle - 3);
    const rightBase = polarToCartesian(compassCenterX, compassCenterY, ringOuter + 70, angle + 3);
    return `${tip.x},${tip.y} ${leftBase.x},${leftBase.y} ${rightBase.x},${rightBase.y}`;
  };
  
  // Inner pointer (△) pointing away from the center
  const getInnerPointer = (angle) => {
    const tip       = polarToCartesian(compassCenterX, compassCenterY, ringOuter - 40, angle);
    const leftBase  = polarToCartesian(compassCenterX, compassCenterY, ringOuter - 90, angle - 4);
    const rightBase = polarToCartesian(compassCenterX, compassCenterY, ringOuter - 90, angle + 4);
    return `${tip.x},${tip.y} ${leftBase.x},${leftBase.y} ${rightBase.x},${rightBase.y}`;
  };

  // Helper to compute continuous rotation angle without 360-deg wrap-around snapping
  const getContinuousAngle = (targetAngle, ref) => {
    if (targetAngle == null) return null;
    if (ref.current == null) {
      ref.current = targetAngle;
      return targetAngle;
    }
    
    let delta = targetAngle - (ref.current % 360);
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    
    ref.current += delta;
    return ref.current;
  };

  const displayOuter = getContinuousAngle(outerAngle, outerRef);
  const displayInner = getContinuousAngle(innerAngle, innerRef);

  return (
    <div className={`wireframe-compass-container ${isStale ? 'telemetry-dead-compass' : ''}`}>
      <svg viewBox="0 0 1000 1000" className="wireframe-compass-svg">
        
        {/* Radar Rings */}
        <circle cx={compassCenterX} cy={compassCenterY} r={ringOuter} className="compass-ring" />
        <circle cx={compassCenterX} cy={compassCenterY} r={ringMiddle} className="compass-ring" />
        <circle cx={compassCenterX} cy={compassCenterY} r={ringInner} className="compass-ring" />
        
        {/* Compass Star Layers */}
        {/* Inner layer (22.5 deg offsets) */}
        {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map(a => (
          <polygon key={`inner-${a}`} points={drawTriangle(a, ringInner, centerVoid, 10)} className="compass-star-inner" />
        ))}
        
        {/* Middle layer (45 deg offsets) */}
        {[45, 135, 225, 315].map(a => (
          <polygon key={`mid-${a}`} points={drawTriangle(a, ringMiddle, centerVoid, 15)} className="compass-star-mid" />
        ))}
        
        {/* Outer layer (Cardinal N/S/E/W) */}
        {[0, 90, 180, 270].map(a => (
          <polygon key={`outer-${a}`} points={drawTriangle(a, ringOuter, centerVoid, 20)} className="compass-star-outer" />
        ))}
        {/* N S E W Labels */}
        <text x={compassCenterX} y={compassCenterY - ringOuter - 35} className="compass-label" textAnchor="middle" alignmentBaseline="middle">N</text>
        <text x={compassCenterX} y={compassCenterY + ringOuter + 45} className="compass-label" textAnchor="middle" alignmentBaseline="middle">S</text>
        <text x={compassCenterX + ringOuter + 45} y={compassCenterY + 10} className="compass-label" textAnchor="middle" alignmentBaseline="middle">E</text>
        <text x={compassCenterX - ringOuter - 45} y={compassCenterY + 10} className="compass-label" textAnchor="middle" alignmentBaseline="middle">W</text>
        {/* Dynamic Targeting Pointers */}
        {displayOuter !== null && (
          <polygon 
            points={getOuterPointer(0)} 
            className="compass-pointer-outer" 
            style={{ 
              transform: `rotate(${displayOuter}deg)`, 
              transformOrigin: `${compassCenterX}px ${compassCenterY}px`,
              transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)' 
            }}
          />
        )}
        
        {displayInner !== null && (
          <polygon 
            points={getInnerPointer(0)} 
            className="compass-pointer-inner" 
            style={{ 
              transform: `rotate(${displayInner}deg)`, 
              transformOrigin: `${compassCenterX}px ${compassCenterY}px`,
              transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)' 
            }}
          />
        )}
      </svg>
    </div>
  );
};

export default WireFrameCompass;
