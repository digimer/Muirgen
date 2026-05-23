// Logic related to health monitoring and self-healing.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::mpsc;
use crate::db::DbMessage;

pub async fn run_n2k_watchdog(
    last_pgn_time: Arc<AtomicU64>,
    db_tx: mpsc::Sender<DbMessage>, 
    vessel_uuid: uuid::Uuid,
    n2k_device: String,
) {
    println!("Health: NMEA2000 Watchdog thread started.");

    loop {
        // Sleep 10 seconds between checks
        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;

        let now  = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        let last = last_pgn_time.load(Ordering::Relaxed);

        if now - last >= 10 {
            // PGNs have stopped arriving. Likely a bus failure outside the host
            let _ = db_tx.send(DbMessage::SetAlarm {
                vessel_uuid,
                code: "N2K-000002".to_string(),
                title: "N2K Data Flow Lost".to_string(),
                description: format!("N2K_DEV device: [{}] is UP, but PGN packet flow has stopped (no packets in >10 seconds). Hint: Check NMEA2000 cable, backbone or power tap.", n2k_device),
                level: 2,
            }).await;
        } else {
            // PGNs arriving. Clear an alarm, if previously set.
            let _ = db_tx.send(DbMessage::ClearAlarm {
                vessel_uuid, 
                code: "N2K-000002".to_string(),
            }).await;
        }
    }
}