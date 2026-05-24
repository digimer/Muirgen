// Import the PGN parser
use crate::db::DbMessage;
use crate::pgns::pgn_60928::Pgn60928;
use crate::pgns::pgn_126996::Pgn126996;
use crate::pgns::pgn_129025::Pgn129025;
use crate::pgns::pgn_129029::Pgn129029;
use crate::pgns::pgn_130311::Pgn130311;
use deku::DekuContainerRead;

// Macro for PGN parsing boilerplate
macro_rules! parse_and_print {
    ($type:ty, $pgn:expr, $source:expr, $data:expr) => {
        match <$type>::from_bytes(($data, 0)) {
            Ok((_rest, parsed)) => {
                println!("PGN: [{}], Device: [{}], packet: [{}]", $pgn, $source, parsed);
                Some(parsed)
            }
            Err(parse_err) => {
                eprintln!("PGN {} Parser Failure! Error: [{:?}]", $pgn, parse_err);
                None
            }
        }
    };
}

pub async fn route_pgns(
    pgn: u32, 
    source: u32, 
    priority: u8,
    data: &[u8],
    db_tx: &tokio::sync::mpsc::Sender<DbMessage>,
    vessel_uuid: uuid::Uuid,
    fp_engine: &mut crate::fast_packet::FastPacketReassembler, 
    address_map: &mut std::collections::HashMap<u8, u64>
) {
    let source_u8 = source as u8;

    // Try to resolve the 64-bit device name from the 8-bit source ID.
    let device_name = match address_map.get(&source_u8) {
        Some(&name) => name,
        None => {
            // PGNs from unknown devices aren't worth archiving. The only PGN 
            // from an unknown source that we care about is the Address Claim
            // (PGN 60928), of course.
            if pgn != 60928 { return; }
            // Keep the compiler happy 
            0
        }
    };

    match pgn {
        // ISO Address Claim
        60928 => {
            if let Some(parsed) = parse_and_print!(Pgn60928, pgn, source, data) {
                // Update the memory map
                address_map.insert(source_u8, parsed.name);
                
                // Record in the DB
                let _ = db_tx.send(DbMessage::UpdateN2kDevice {
                    vessel_uuid,
                    device_name: parsed.name,
                    source_address: source as u8,
                    manufacturer_code: parsed.manufacturer_code(),
                    device_class: parsed.device_class(),
                    device_function: parsed.device_function(),
                    device_instance: parsed.device_instance(),
                }).await;
            }
        }
        // Product Information (Fast Packet)
        126996 => {
            // Feed the CAN frame into the Fast Packet parser. It will return
            // the 134-byte payload when done.
            if let Some(reassembled_payload) = fp_engine.process_frame(source as u8, pgn, data) {
                // Pass the reassembled payload (as a slice) into the macro. 
                // If successful, update the database.
                if let Some(parsed) = parse_and_print!(Pgn126996, pgn, source, &reassembled_payload) {
                    let _ = db_tx.send(DbMessage::UpdateN2kProductInfo {
                        vessel_uuid,
                        device_name,
                        model_id: parsed.model_id(),
                        software_version: parsed.software_version(),
                        serial_code: parsed.serial_code(),
                    }).await;
                }
            }
        }
        // Position, Rapid Update (10 Hz)
        129025 => {
            if let Some(parsed) = parse_and_print!(Pgn129025, pgn, source, data) {
                // 129025 is the fast update, single packet data. It doesn't 
                // contain altitude, sats in view or gnss method.
                let _ = db_tx.send(DbMessage::InsertPositionData {
                    vessel_uuid,
                    device_name,
                    latitude: parsed.latitude(),
                    longitude: parsed.longitude(),
                    altitude: None, 
                    satellites_in_view: None,
                    gnss_method: None,
                }).await;
            }
        }
        // GNSS Position Data (Fast Packet!)
        129029 => {
            if let Some(reassembled_payload) = fp_engine.process_frame(source as u8, pgn, data) {
                // Pass the reassembled payload to the macro
                if let Some(parsed) = parse_and_print!(Pgn129029, pgn, source, &reassembled_payload) {
                    // This is the extended data for the GNSS data.
                    let _ = db_tx.send(DbMessage::InsertPositionData {
                        vessel_uuid,
                        device_name,
                        latitude: parsed.latitude(),
                        longitude: parsed.longitude(),
                        altitude: parsed.altitude(), 
                        satellites_in_view: parsed.satellites_in_view(),
                        gnss_method: Some(parsed.gnss_method().to_string()),
                    }).await;
                }
            }
        }
        // Environmental Parameters (deprecated in N2K)
        130311 => {
            // Convert Pascals to hPa
            if let Some(parsed) = parse_and_print!(Pgn130311, pgn, source, data) {
                let _ = db_tx.send(DbMessage::InsertWeatherData {
                    vessel_uuid,
                    device_name,
                    pressure: parsed.pressure_pascals().map(|pascals| (pascals / 100.0) as f64),
                    air_temp: parsed.temperature_kelvin().map(|temp| temp as f64),
                    humidity: parsed.humidity_percent().map(|humidity| humidity as f64),
                }).await;
            }
        }

        // Catch un-parsed PGNs (stored in n2k_traffic)
        _ => {
            let _ = db_tx.send(DbMessage::InsertRawTraffic {
                vessel_uuid,
                pgn,
                device_name,
                priority,
                payload: data.to_vec(),
            }).await;
        }
    }
}
