import { useState, useEffect } from 'react';
import useInterval from './useInterval'; // Import our new hook
import './App.css';

function ButtonTank() {
  function ClickTank() {
    alert('Showing Tank Data...');
  }

  return (
    <button onClick={ClickTank}>Tanks</button>
  );
}

function ButtonBatteries() {
  const [count, setCount] = useState(0);
  
  function ClickBatteries() {
    setCount(count + 1);
  }
  return (
    <button onClick={ClickBatteries}>Batteries Click: {count}</button>
  );
}

function App() {
  const [dbData, setDbData] = useState({ status: 'Connecting...', serverTime: '' });
  const [vessel, setVessel] = useState({ vesselName: 'Loading...' });

  const fetchData = async () => {
    try {
      const [statusRes, vesselRes] = await Promise.all([
        fetch('http://mr-scifi-ui:5000/api/test-db'),
        fetch('http://mr-scifi-ui:5000/api/get-vessel')
      ]);
      
      const statusData = await statusRes.json();
      const vesselData = await vesselRes.json();

      setDbData(statusData);
      setVessel(vesselData);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  // 1. Initial load
  useEffect(() => { fetchData(); }, []);

  // 2. Poll every 1000ms (1 second)
  useInterval(fetchData, 1000);

  return (
    <div className="App">
      <div className="crt-overlay" />
      
      {/* dual grid background. */}
      <div className="grid-container">
        <div className="wireframe-grid sky" />
        <div className="wireframe-grid ground" />
      </div>

      {/* The main container now handles centering */}
      <main className="main-layout">
        <div className="content-container">
          <h2 className="flicker">Core Database: {dbData.status}</h2>
          
          <div className="vessel-box">
            <p>Date/Time: {dbData.serverTime || 'Loading...'}</p>
            <p>Vessel: {vessel.vesselName}</p>
            <p>Official Number: {vessel.vesselOfficialNumber}</p>
            
            <div className="button-row">
              <ButtonBatteries /> <ButtonTank />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

