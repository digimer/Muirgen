/* 
 * This is the main User management window. It lists known users (displayed as Operators), 
 * provides edit buttons for them, and a button to register new users. 
 */

const UserManagement = ({ users, onModify, onRegister }) => {
  // Track the target user waiting to have an action confirmed
  const sortedUsers = [...users].sort((a, b) => a.handle.localeCompare(b.handle));
  
  return (
    <div className="management-container">
     <h3 className="flicker-subtle">Edit Existing // Register New</h3>
      
      <table className="data-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Handle</th>
            <th>Name</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedUsers.map((user) => (
            <tr key={user.uuid} className={user.is_active ? 'vessel-active' : 'vessel-inactive'}>
              <td className="status-cell">
                {user.is_active ? (
                  <span>╠ Active ╣</span>
                ) : (
                  <span>╔ Deactivated ╗</span>
                )}
              </td>
              <td style={{ color: user.is_admin ? 'var(--neon-green)' : 'inherit' }}>
                {user.handle} {user.is_admin && '[SysOp]'}
              </td>
              <td>{user.name}</td>
              <td className="actions-cell">
                <div className="actions-wrapper">
                  <button className="touch-button" onClick={() => onModify(user)}>
                    Edit
                  </button>
                  <span className="large-icon">⌬</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Active Footer for adding new users */}
      <div className="action-bar">
        <span className="cursor-prompt">⌲</span>
        <button className="touch-button" onClick={onRegister}>
          Register Operator
        </button>
      </div>
    </div>
  );
}

export default UserManagement;