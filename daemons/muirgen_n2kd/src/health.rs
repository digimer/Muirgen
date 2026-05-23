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
    device_id: String,
) {
    println!("Health: NMEA2000 Watchdog thread started.");

    // Alarm tracking
    // Interface link is down
    let mut alarm_n2k_000002_active = false;
    // Packet flow stopped
    let mut alarm_n2k_000003_active = false;

    loop {
        // Sleep 10 seconds between checks
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

        let now  = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        let last = last_pgn_time.load(Ordering::Relaxed);

        // Check the Linux kernel flags for the interface
        let flags_path        = format!("/sys/class/net/{}/flags", n2k_device);
        let interface_is_down = match std::fs::read_to_string(&flags_path) {
            Ok(flags_string) => {
                // Extract the hex flags. The last bit is the link state 
                // (ie: 0x40080 == down, 0x40081 == up)
                let flags_value = u32::from_str_radix(flags_string.trim().trim_start_matches("0x"), 16).unwrap_or(0);
                (flags_value & 1) == 0
            }
            Err(_) => {
                // If the file is missing, so is the interface, which 
                // N2K-000001 in main.rs should handle.
                true
            }
        };

        // Is the interface down?
        if interface_is_down {
            // Yes, do we need to set the alarm?
            if !alarm_n2k_000002_active {
                let _ = db_tx.send(DbMessage::SetAlarm {
                    vessel_uuid,
                    set_by: format!("{}:{}", device_id, n2k_device),
                    code: "N2K-000002".to_string(),
                    title: "NMEA2000 Interface DOWN".to_string(),
                    description: format!("The NMEA2000 device: [{}] exists, but it is DOWN. Hint: Is the 'can0-n2k' service up? Try 'ip link set {} up'.", n2k_device, n2k_device),
                    level: 2,
                }).await;
                alarm_n2k_000002_active = true;
            }
        } else {
            // The interface is up. Is there an alarm to clear?
            if alarm_n2k_000002_active {
                let _ = db_tx.send(DbMessage::ClearAlarm {
                    vessel_uuid, 
                    set_by: format!("{}:{}", device_id, n2k_device),
                    code: "N2K-000002".to_string(),
                }).await;
                alarm_n2k_000002_active = false;
            }
        }

        // This watches for the arrival of actual packets, independent of the 
        // link existence and state.
        if now - last >= 10 {
            // PGNs have stopped arriving. Likely a bus failure outside the 
            // host. Is this new?
            if !alarm_n2k_000003_active {
                // Yes, set the alarm.
                let _ = db_tx.send(DbMessage::SetAlarm {
                    vessel_uuid,
                    set_by: format!("{}:{}", device_id, n2k_device),
                    code: "N2K-000003".to_string(),
                    title: "N2K Data Flow Lost".to_string(),
                    description: format!("N2K_DEV device: [{}] is UP, but PGN packet flow has stopped (no packets in >10 seconds). Hint: Check NMEA2000 cable, backbone or power tap.", n2k_device),
                    level: 2,
                }).await;

                // Log that this alarm is active.
                alarm_n2k_000003_active = true;
            }
        } else {
            // PGNs arriving. Is this new?
            if alarm_n2k_000003_active {
                // Yes, clear the alarm
                let _ = db_tx.send(DbMessage::ClearAlarm {
                    vessel_uuid, 
                    set_by: format!("{}:{}", device_id, n2k_device),
                    code: "N2K-000003".to_string(),
                }).await;

                // Log that this alarm is no longer active.
                alarm_n2k_000003_active = false;
            }
        }
    }
}
