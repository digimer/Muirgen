/* 
 * This is the main User management window. It lists known users (displayed as Operators), 
 * provides edit buttons for them, and a button to register new users. 
 */

const UserManagement = ({ users, onView, onModify, onRegister }) => {
  // Track the target user waiting to have an action confirmed
  const sortedUsers = [...users].sort((a, b) => a.handle.localeCompare(b.handle));
  
  return (
    <div className="management-container">
      <div className="task-header-wrapper">
        <h2 className="flicker">VSM // Operator Index</h2>
      </div>
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
          {sortedUsers.map((user, index) => (
            <tr 
              key={user.uuid} 
              className={`entity-pointer ${user.is_active ? 'entity-active' : 'entity-inactive'}`}
              onClick={() => onView(sortedUsers, index)}
            >
              <td className="status-cell">
                {user.is_active ? (
                  <span>╠ Active ╣</span>
                ) : (
                  <span>╔ Deactivated ╗</span>
                )}
              </td>
              <td>
                {user.is_admin ? '◈ ' : '◇ '}{user.handle}
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