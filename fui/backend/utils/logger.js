// Handles logging records to the audit_log table.
export const auditLog = async (pool, vesselUuid, userUuid, task, details) => {
  try {
    await pool.query(
      'INSERT INTO audit_logs (vessel_uuid, user_uuid, task, details) VALUES ($1, $2, $3, $4);', 
      [vesselUuid || null, userUuid || null, task, details]
    );
  } catch (err) {
    console.error('Critical: Auditing failed! Error: ', err.message);
  }
};
