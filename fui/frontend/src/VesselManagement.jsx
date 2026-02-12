/* 
 * This is the main Vessel management window for vessels. It lists knows ones, provides edit buttons for 
 * them, and a button the register new vessels. Given the simplicity, no imports are needed.
 */

const VesselManagement = ({ vessels, onModify, onRegister }) => {
  // Track the target vessel waiting to have an action confirmed
  const sortedVessels = [...vessels].sort((a, b) => a.name.localeCompare(b.name));
  
  return (
    <div className="management-container">
     <h3 className="flicker-subtle">Edit Existing // Register New</h3>
      
      <table className="data-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Reg. Name</th>
            <th>Hull ID</th>
            <th>Official Number</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedVessels.map((vessel) => (
            <tr key={vessel.uuid} className={vessel.is_active ? 'vessel-active' : 'vessel-inactive'}>
              <td className="status-cell">
                {vessel.is_active ? (
                  <span>╠ Active ╣</span>
                ) : (
                  <span>╔ Deactivated ╗</span>
                )}
              </td>
              <td>{vessel.name}</td>
              <td>{vessel.hull_id_number || '◬ HIN Missing ◬' }</td>
              <td>{vessel.official_number || '◬ ON Missing ◬' }</td>
              <td className="actions-cell">
                <button className="touch-button" onClick={() => onModify(vessel)}>
                  Edit
                </button>
                <span className="large-icon">⌬</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Active Footer for adding new vessels */}
      <div className="action-bar">
        <span className="cursor-prompt">⌲</span>
        <button className="touch-button" onClick={onRegister}>
          Register New Vessel
        </button>
      </div>
    </div>
  );
}

export default VesselManagement;
