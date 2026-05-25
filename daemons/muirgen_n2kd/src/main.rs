// Muirgen NMEA2000 daemon and router
// 
// Madison Kelly (digimer) - digital.mermaid@gmail.com
// 

use futures_util::StreamExt;
use socketcan::{CanFrame, Id, ExtendedId};
use socketcan::EmbeddedFrame;
use socketcan::tokio::CanSocket;
use sqlx::postgres::PgPoolOptions;
use std::collections::HashMap;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::mpsc;

extern crate serde_json;

// Modules
mod db;
mod fast_packet;
mod health;
mod pgns;
mod router;

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {
    // Load the .env DB access file
    dotenvy::dotenv().ok();

    // Pull variables out of the .env file
    // Database connection string.
    let db_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be defined in the .env file.");

    // NMEA2000 (CAN bus) network interface. Note that though it's usually 
    // can0, be do not default to it. If this is missing, the .env needs 
    // review by the user.
    let n2k_device = env::var("N2K_DEV")
        .expect("N2K_DEV must be defined in the .env file. Hint: Usualled 'can0'.");

    // Make sure we have a UUID for the vessel (we'll validate it after the DB
    // comes up)
    let env_vessel_uuid = env::var("VESSEL_UUID")
        .expect("VESSEL_UUID must be set to the host vessel's 'vessel_uuid'.");
    
    // Get the unique DEV_ID we'll use to identify ourself in the database.
    let device_id = env::var("DEV_ID")
        .expect("DEV_ID must be set to a unique identification string for this device.");
    
    // Pull out the NMEA data needed to build our ID.
    let manufacturer_code: u64 = env::var("MANUFACTURER_CODE")
        .expect("MANUFACTURER_CODE must be set to an NMEA manufacturer code (assigned, or unused like 1999)")
        .parse()
        .expect("MANUFACTURER_CODE must be a valid number. If unsure, use 1999");
    let serial_number: u64 = env::var("SERIAL_NUMBER")
        .expect("SERIAL_NUMBER must be set and it must be unique.")
        .parse()
        .expect("SERIAL_NUMBER must be a valid number, and it must be unique.");
    let device_class: u64 = env::var("DEVICE_CLASS")
        .expect("DEVICE_CLASS needs to be set. If you're unsure, set to '25' (Inter/Intranet Device).")
        .parse()
        .expect("DEVICE_CLASS needs must be a valid number. If unsure, set to '25' (Inter/Intranet Device).");
    let device_function: u64 = env::var("DEVICE_FUNCTION")
        .expect("DEVICE_FUNCTION needs to be set. If you're unsure, set to '130' (PC Gateway).")
        .parse()
        .expect("DEVICE_FUNCTION must be a number. If you're unsure, set to '130' (PC Gateway).");

    // Assemble the NMEA2000 'name' for this device.
    let mut my_name: u64 = 0;
    my_name |= serial_number      & 0x1FFFFF;     // 21 bits
    my_name |= (manufacturer_code & 0x7FF) << 21; // 11 bits
    my_name |= (device_function   & 0xFF) << 40;  // 8 bits
    my_name |= (device_class      & 0x7F) << 49;  // 7 bits
    my_name |= 1 << 63;                           // Arbitrary Address Capable

    // Pick a default Source Address
    let my_address = 45;
    
    // Pull out the queue depth.
    let pgn_queue_depth: usize = env::var("PGN_CACHE")
        .expect("PGN_CACHE must be set. Use '10_000_000' if unsure (1GiB of cached PGNs)")
        .replace(",", "")
        .parse()
        .expect("PGN_CACHE must be a valid integer! Recommended: '10,000,000'.");

    // Verify the vessel_uuid is a valid UUID.
    let vessel_uuid = uuid::Uuid::parse_str(&env_vessel_uuid).expect("Invalid UUID");

    // Connect using the URL from the .env file.
    println!("Accessing central database... ");
    let pool = match PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
    {
        Ok(connected_pool) => connected_pool, 
        Err(pg_error) => {
            eprintln!("Access Failure! Error: [{}]", pg_error);
            std::process::exit(1);
        }
    };
    println!("Access granted.");

    // TODO: Verify that the vessel_uuid maps to a vessel and that it is active.

    // Create the MPSC (multi-producer, single consumer) channel to the DB. 
    let (db_tx, db_rx) = mpsc::channel::<db::DbMessage>(pgn_queue_depth);

    // Spawn the database writer thread.
    tokio::spawn(db::run_db_thread(pool.clone(), db_rx));

    // Setup the shared watchdog timestamp.
    let last_pgn_time = Arc::new(AtomicU64::new(
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs()
    ));

    // Spawn the watchdog thread
    tokio::spawn(health::run_n2k_watchdog(
        Arc::clone(&last_pgn_time),
        db_tx.clone(),
        vessel_uuid, 
        n2k_device.clone(),
        device_id.clone(),
    ));

    // Track the alarm state for the N2K_DEVICE. Cleared intially
    let mut alarm_n2k_000001_active = false;

    // Self-healing network loop
    println!("Binding to the NMEA2000 hardware interface: [{}]... ", n2k_device);
    loop {
        // Open the socket asynchronously
        let mut socket = match CanSocket::open(&n2k_device) {
            Ok(connected_socket) => {
                // Connected successfully, clear any N2K down alarm, if present
                if alarm_n2k_000001_active {
                    // Alarm was active, clear it.
                    let _ = db_tx.send(db::DbMessage::ClearAlarm {
                        vessel_uuid, 
                        set_by: format!("{}:{}", device_id, n2k_device),
                        code: "N2K-000001".to_string(),
                    }).await;
                    alarm_n2k_000001_active = false;
                }

                // Return the socket
                connected_socket
            },
            Err(bind_err) => {
                // Failed, set the alarm if this is the first time.
                if !alarm_n2k_000001_active {
                    let _ = db_tx.send(db::DbMessage::SetAlarm {
                        vessel_uuid,
                        set_by: format!("{}:{}", device_id, n2k_device),
                        code: "N2K-000001".to_string(),
                        title: "NMEA2000 Interface Down".to_string(),
                        description: format!("The NMEA2000 device: [{}] failed to open. Error: [{}]. Hint: check can0_n2k service status or N2K_DEVICE status in ip.", n2k_device, bind_err), 
                        level: 2, 
                    }).await;

                    // Set the alarm state
                    alarm_n2k_000001_active = true;
                }
                eprintln!("N2K_DEVICE binding Failed! Error: [{}]. Trying again in 5 seconds.", bind_err);
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                continue;
            }
        };
        println!("Success. Ready to process NMEA2000 PGNs.");

        // Broadcast PGN 60928 (ISO Address Claim)
        // CAN ID = Priority(6) | PGN(60928) | Source(45)
        println!("Broadcasting ISO Address Claim...");
        let claim_id_value = (6 << 26) | (60928 << 8) | my_address;
        let claim_id       = Id::Extended(ExtendedId::new(claim_id_value).unwrap());
        let claim_frame    = CanFrame::new(claim_id, &my_name.to_le_bytes()).unwrap();
        socket.write_frame(claim_frame).await
            .expect("Comms Failure: Unable to broadcast address claim!");

        // Broadcast PGN 59904 (ISO request) for PGN 60928
        // CAN ID = Priority(6) | PGN(59904) | Dest(255 Global) | Source(45)
        println!("Requesting network topology...");
        let req_id_value = (6 << 26) | (59904 << 8) | 255 << 8 | my_address;
        let req_id       = Id::Extended(ExtendedId::new(req_id_value).unwrap());
        // Payload is the requested PGN in little-endian (60928 = 0x00EE00)
        let req_frame    = CanFrame::new(req_id, &[0x00, 0xEE, 0x00]).unwrap();
        socket.write_frame(req_frame).await
            .expect("Comms Failure: Unable to broadcast ISO Request");
        
        // Initialize the Fast Packet engine.
        let mut fp_engine = fast_packet::FastPacketReassembler::new();

        // Create the (N2K) Address to ISO name map
        let mut n2k_address_map: HashMap<u8, u64> = HashMap::new();

        // Broadcast ISO request for PGN 126996 (Product Information). It is in
        // hex 0x01F014, little endian bytes: [0x14, 0xF0, 0x01]
        println!("Explicitly requesting product information (PGN 126996)...");
        let req_prod_frame = CanFrame::new(req_id, &[0x14, 0xF0, 0x01]).unwrap();
        socket.write_frame(req_prod_frame).await
            .expect("Comms Failure: Unable to broadcast Product Info request!");

        // Make sure we're in the n2k_devices table.
        let _ = db_tx.send(db::DbMessage::UpdateN2kDevice {
            vessel_uuid,
            device_name: my_name,
            source_address: my_address as u8,
            manufacturer_code: manufacturer_code as u16,
            device_class: device_class as u8,
            device_function: device_function as u8,
            device_instance: 0,
        }).await;
        
        let _ = db_tx.send(db::DbMessage::UpdateN2kProductInfo {
            vessel_uuid,
            device_name: my_name,
            model_id: "Muirgen N2K Ingestion Server m1".to_string(),
            software_version: env!("CARGO_PKG_VERSION").to_string(),
            serial_code: serial_number.to_string(),
        }).await;
        
        // N2K_DEVICE connection up, ready to watch for PGNs. 
        while let Some(result) = socket.next().await {
            match result {
                Ok(frame) => {
                    // Update the watchdog timestamp
                    last_pgn_time.store(
                        SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(), 
                        Ordering::Relaxed
                    );

                    // Make sure this is an NMEA2000 extended 29-bit CAN frame
                    if let socketcan::Id::Extended(ext_id) = frame.id() {
                        // Get the 29-bit integer
                        let id_val = ext_id.as_raw();

                        // Extract the J1939 fields using bitwise shifts
                        let priority       = (id_val >> 26) & 0x07;
                        let pdu_format     = (id_val >> 16) & 0xFF;
                        let pdu_specific   = (id_val >> 8)  & 0xFF;
                        let data_page      = (id_val >> 24) & 0x01;
                        let source_address = id_val & 0xFF;

                        // Calculate the PGN
                        let pgn = if pdu_format < 240 {
                            (data_page << 16) | (pdu_format << 8)
                        } else {
                            (data_page << 16) | (pdu_format << 8) | pdu_specific
                        };

                        // Hand off raw PGNs off to the router
                        router::route_pgns(
                            pgn, 
                            source_address as u32, 
                            priority as u8, 
                            frame.data(), 
                            &db_tx, 
                            vessel_uuid, 
                            &mut fp_engine, 
                            &mut n2k_address_map
                        ).await;
                    }
                },
                Err(frame_err) => {
                    // The N2K_DEV is or has gone down or vanished.
                    eprintln!("ALARM: The NMEA2000 interface: [{}] is down! Reason: {}", n2k_device, frame_err);

                    // Break this loop and return until the N2K_DEVICE interface 
                    // returns.
                    break; 
                }
            }
        }
    }
}
