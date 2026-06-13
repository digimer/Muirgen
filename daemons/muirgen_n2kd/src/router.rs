// Import the PGN parser
use crate::db::DbMessage;
use crate::pgns::pgn_60928::Pgn60928;
use crate::pgns::pgn_126992::Pgn126992;
use crate::pgns::pgn_126996::Pgn126996;
use crate::pgns::pgn_127250::Pgn127250;
use crate::pgns::pgn_127251::Pgn127251;
use crate::pgns::pgn_127257::Pgn127257;
use crate::pgns::pgn_127258::Pgn127258;
use crate::pgns::pgn_128259::Pgn128259;
use crate::pgns::pgn_128267::Pgn128267;
use crate::pgns::pgn_129025::Pgn129025;
use crate::pgns::pgn_129026::Pgn129026;
use crate::pgns::pgn_129029::Pgn129029;
use crate::pgns::pgn_129539::Pgn129539;
use crate::pgns::pgn_129540::Pgn129540;
use crate::pgns::pgn_130306::Pgn130306;
use crate::pgns::pgn_130311::Pgn130311;
use crate::pgns::pgn_130312::Pgn130312;
use crate::pgns::pgn_130313::Pgn130313;
use crate::pgns::pgn_130314::Pgn130314;
use deku::DekuContainerRead;
use std::time::{SystemTime, UNIX_EPOCH};

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
    mqtt_tx: &tokio::sync::mpsc::Sender<crate::db::DbMessage>, 
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

    // Note that we send all parsed PGNs to both the DB and the MQTT channels. 
    // This is why we define 'message' via DbMessage and clone it to MQTT.
    match pgn {
        // ISO Address Claim
        60928 => {
            if let Some(parsed) = parse_and_print!(Pgn60928, pgn, source, data) {
                // Update the memory map
                address_map.insert(source_u8, parsed.name);
                
                // Prepare the message to send to the DB and MQTT channels.
                let message = DbMessage::UpdateN2kDevice {
                    vessel_uuid,
                    device_name: parsed.name,
                    source_address: source as u8,
                    manufacturer_code: parsed.manufacturer_code(),
                    device_class: parsed.device_class(),
                    device_function: parsed.device_function(),
                    device_instance: parsed.device_instance(),
                };

                // Now send the message to the DB, cloning it so we can send it
                // as well to MQTT.
                let _ = db_tx.send(message.clone()).await;
                let _ = mqtt_tx.send(message).await;
            }
        }
        // System Time
        126992 => {
            if let Some(parsed) = parse_and_print!(Pgn126992, pgn, source, data) {
                if let Some(n2k_unix_timestamp) = parsed.unix_timestamp() {
                    // Grab the exact system time when we received this PGN
                    let local_unix_timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs_f64();
                    
                    // Prepare the message
                    let message = DbMessage::UpdateSystemTime {
                        n2k_unix_timestamp,
                        local_unix_timestamp,
                    };

                    // Send it to DB and MQTT channels
                    let _ = db_tx.send(message.clone()).await;
                    let _ = mqtt_tx.send(message).await;
                }
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
                    // Prepare the message
                    let message = DbMessage::UpdateN2kProductInfo {
                        vessel_uuid,
                        device_name,
                        model_id: parsed.model_id(),
                        software_version: parsed.software_version(),
                        serial_code: parsed.serial_code(),
                    };

                    // Send it to DB and MQTT channels
                    let _ = db_tx.send(message.clone()).await;
                    let _ = mqtt_tx.send(message).await;
                }
            }
        }
        // Vessel Heading
        127250 => {
            if let Some(parsed) = parse_and_print!(Pgn127250, pgn, source, data) {
                // Prepare the message
                let message = DbMessage::InsertMotionData {
                    vessel_uuid,
                    device_name,
                    pitch: None,
                    roll: None,
                    heading_magnetic: parsed.heading_degrees().map(|heading| heading as f64),
                    magnetic_variation: parsed.variation_degrees().map(|var| var as f64),
                    rate_of_turn: None,
                    speed_through_water: None,
                    course_over_ground: None,
                    speed_over_ground: None,
                };

                // Send it to DB and MQTT channels
                let _ = db_tx.send(message.clone()).await;
                let _ = mqtt_tx.send(message).await;
            }
        }
        // Rate of Turn
        127251 => {
            if let Some(parsed) = parse_and_print!(Pgn127251, pgn, source, data) {
                // Prepare the message
                 let message = DbMessage::InsertMotionData {
                    vessel_uuid,
                    device_name,
                    pitch: None,
                    roll: None,
                    heading_magnetic: None,
                    magnetic_variation: None,
                    rate_of_turn: parsed.rate_degrees_per_sec().map(|rot| rot as f64),
                    speed_through_water: None, 
                    course_over_ground: None,
                    speed_over_ground: None,
                };

                // Send it to DB and MQTT channels
                let _ = db_tx.send(message.clone()).await;
                let _ = mqtt_tx.send(message).await;
            }
        }
        // Attitude
        127257 => {
            if let Some(parsed) = parse_and_print!(Pgn127257, pgn, source, data) {
                // Prepare the message
                 let message = DbMessage::InsertMotionData {
                    vessel_uuid,
                    device_name,
                    pitch: parsed.pitch_degrees().map(|pitch| pitch as f64),
                    roll: parsed.roll_degrees().map(|roll| roll as f64),
                    heading_magnetic: None,
                    magnetic_variation: None,
                    rate_of_turn: None,
                    speed_through_water: None, 
                    course_over_ground: None,
                    speed_over_ground: None,
                };

                // Send it to DB and MQTT channels
                let _ = db_tx.send(message.clone()).await;
                let _ = mqtt_tx.send(message).await;
            }
        }
        // Magnetic Variation
        127258 => {
            if let Some(parsed) = parse_and_print!(Pgn127258, pgn, source, data) {
                // Prepare the message
                let message = DbMessage::InsertMotionData {
                    vessel_uuid,
                    device_name,
                    pitch: None,
                    roll: None,
                    heading_magnetic: None,
                    magnetic_variation: parsed.variation_degrees().map(|var| var as f64),
                    rate_of_turn: None,
                    speed_through_water: None,
                    course_over_ground: None,
                    speed_over_ground: None,
                };

                // Send it to DB and MQTT channels
                let _ = db_tx.send(message.clone()).await;
                let _ = mqtt_tx.send(message).await;
            }
        }
        // Speed (Water referenced / Ground referenced)
        128259 => {
            if let Some(parsed) = parse_and_print!(Pgn128259, pgn, source, data) {
                let message = DbMessage::InsertMotionData {
                    vessel_uuid,
                    device_name,
                    pitch: None,
                    roll: None,
                    heading_magnetic: None,
                    magnetic_variation: None,
                    rate_of_turn: None,
                    course_over_ground: None,
                    speed_over_ground: parsed.speed_ground_mps().map(|s| s as f64),
                    speed_through_water: parsed.speed_water_mps().map(|s| s as f64),
                };
                let _ = db_tx.send(message.clone()).await;
                let _ = mqtt_tx.send(message).await;
            }
        }
        // Water Depth
        128267 => {
            if let Some(parsed) = parse_and_print!(Pgn128267, pgn, source, data) {
                let message = DbMessage::InsertDepthData {
                    vessel_uuid,
                    device_name,
                    depth: parsed.depth_meters().map(|d| d as f64),
                    offset: parsed.offset_meters().map(|o| o as f64),
                };
                let _ = db_tx.send(message.clone()).await;
                let _ = mqtt_tx.send(message).await;
            }
        }
        // Position, Rapid Update (10 Hz)
        129025 => {
            if let Some(parsed) = parse_and_print!(Pgn129025, pgn, source, data) {
                // 129025 is the fast update, single packet data. It doesn't 
                // contain altitude, sats in view or gnss method.
                // Prepare the message
                let message = DbMessage::InsertPositionData {
                    vessel_uuid,
                    device_name,
                    latitude: parsed.latitude(),
                    longitude: parsed.longitude(),
                    altitude: None, 
                    satellites_in_view: None,
                    gnss_method: None,
                };

                // Send it to DB and MQTT channels
                let _ = db_tx.send(message.clone()).await;
                let _ = mqtt_tx.send(message).await;
            }
        }
        // Course and Speed over Ground, Rapid Update
        129026 => {
            if let Some(parsed) = parse_and_print!(Pgn129026, pgn, source, data) {
                // Prepare the message
                let message = DbMessage::InsertMotionData {
                    vessel_uuid, 
                    device_name,
                    pitch: None, 
                    roll: None, 
                    heading_magnetic: None, 
                    magnetic_variation: None, 
                    rate_of_turn: None,
                    speed_through_water: None,
                    course_over_ground: parsed.course_over_ground_degrees().map(|cog| cog as f64),
                    speed_over_ground: parsed.speed_over_ground_mps().map(|sog| sog as f64),
                };

                // Send it to DB and MQTT channels
                let _ = db_tx.send(message.clone()).await;
                let _ = mqtt_tx.send(message).await;
            }
        }
        // GNSS Position Data (Fast Packet!)
        129029 => {
            if let Some(reassembled_payload) = fp_engine.process_frame(source as u8, pgn, data) {
                // Pass the reassembled payload to the macro
                if let Some(parsed) = parse_and_print!(Pgn129029, pgn, source, &reassembled_payload) {
                    // This is the extended data for the GNSS data.
                    // Prepare the message
                    let message = DbMessage::InsertPositionData {
                        vessel_uuid,
                        device_name,
                        latitude: parsed.latitude(),
                        longitude: parsed.longitude(),
                        altitude: parsed.altitude(), 
                        satellites_in_view: parsed.satellites_in_view(),
                        gnss_method: Some(parsed.gnss_method().to_string()),
                    };

                    // Send it to DB and MQTT channels
                    let _ = db_tx.send(message.clone()).await;
                    let _ = mqtt_tx.send(message).await;
                }
            }
        }
        // Local Time Offset - Redundant static config, drop it
        129033 => {}
        // Datum - Always WGS84, drop it
        129044 => {}
        // GNSS Dilution of Precision
        129539 => {
            if let Some(parsed) = parse_and_print!(Pgn129539, pgn, source, data) {
                // Prepare the message
                let message = DbMessage::InsertSkyviewData {
                    vessel_uuid, 
                    device_name,
                    horizontal_dop: parsed.get_horizontal_dop().map(|val| val as f64),
                    vertical_dop: parsed.get_vertical_dop().map(|val| val as f64),
                    time_dop: parsed.get_time_dop().map(|val| val as f64),
                    satellites: None,
                };

                // Send it to DB and MQTT channels
                let _ = db_tx.send(message.clone()).await;
                let _ = mqtt_tx.send(message).await;
            }
        }
        // GNSS Sats in View (Fast Packet)
        129540 => {
            if let Some(reassembled_payload) = fp_engine.process_frame(source as u8, pgn, data) {
                if let Some(parsed) = parse_and_print!(Pgn129540, pgn, source, &reassembled_payload) {
                    // Prepare the message
                    let message = DbMessage::InsertSkyviewData {
                        vessel_uuid, 
                        device_name,
                        horizontal_dop: None, 
                        vertical_dop: None, 
                        time_dop: None,
                        satellites: Some(parsed.to_json()),
                    };

                    // Send it to DB and MQTT channels
                    let _ = db_tx.send(message.clone()).await;
                    let _ = mqtt_tx.send(message).await;
                }
            }
        }
        // Wind Data
        130306 => {
            if let Some(parsed) = parse_and_print!(Pgn130306, pgn, source, data) {
                let speed     = parsed.wind_speed_mps().map(|spd| spd as f64);
                let direction = parsed.wind_direction_degrees().map(|dir| dir as f64);
                
                let mut true_speed     = None; let mut true_direction = None;
                let mut ground_speed   = None; let mut ground_direction = None;
                let mut apparent_speed = None; let mut apparent_direction = None;

                match parsed.reference {
                    2 => { apparent_speed = speed; apparent_direction = direction; }
                    // True North or Magnetic North
                    0 | 1 => { ground_speed = speed; ground_direction = direction; }
                    // Boat or Water referenced
                    3 | 4 => { true_speed = speed; true_direction = direction; }
                    _ => {}
                }
                
                // Prepare the message
                let message = DbMessage::InsertWindData {
                    vessel_uuid, 
                    device_name,
                    true_speed, 
                    true_direction,
                    ground_speed, 
                    ground_direction,
                    apparent_speed, 
                    apparent_direction,
                };

                // Send it to DB and MQTT channels
                let _ = db_tx.send(message.clone()).await;
                let _ = mqtt_tx.send(message).await;
            }
        }
        // Environmental Parameters (deprecated in N2K)
        130311 => {
            // Convert Pascals to hPa
            if let Some(parsed) = parse_and_print!(Pgn130311, pgn, source, data) {
                let air_temp = parsed.temperature_kelvin().map(|temp| temp as f64);
                let humidity = parsed.humidity_percent().map(|hum| hum as f64);
                
                // Calculate Dew Point (Kelvin) from Air Temp (Kelvin) and Humidity (%) using the Magnus formula
                let dew_point = if let (Some(t_k), Some(h)) = (air_temp, humidity) {
                    if h > 0.0 && h <= 100.0 {
                        let t_c = t_k - 273.15;
                        let alpha = ((17.27 * t_c) / (237.7 + t_c)) + (h / 100.0).ln();
                        let dp_c = (237.7 * alpha) / (17.27 - alpha);
                        Some(dp_c + 273.15)
                    } else { None }
                } else { None };

                // Prepare the message
                let message = DbMessage::InsertWeatherData {
                    vessel_uuid,
                    device_name,
                    pressure: parsed.pressure_pascals().map(|pascals| (pascals / 100.0) as f64),
                    air_temp,
                    humidity,
                    dew_point,
                };

                // Send it to DB and MQTT channels
                let _ = db_tx.send(message.clone()).await;
                let _ = mqtt_tx.send(message).await;
            }
        }
        // Temperature (Source 1 = Outside Air)
        130312 => {
            if let Some(parsed) = parse_and_print!(Pgn130312, pgn, source, data) {
                if parsed.source == 1 {
                    // Prepare the message
                    let message = DbMessage::InsertWeatherData {
                        vessel_uuid, 
                        device_name,
                        pressure: None, 
                        humidity: None,
                        dew_point: None,
                        air_temp: parsed.temperature_kelvin().map(|temp| temp as f64),
                    };

                    // Send it to DB and MQTT channels
                    let _ = db_tx.send(message.clone()).await;
                    let _ = mqtt_tx.send(message).await;
                }
            }
        }
        // Humidity (Source 1 = Outside)
        130313 => {
            if let Some(parsed) = parse_and_print!(Pgn130313, pgn, source, data) {
                if parsed.source == 1 {
                    // Prepare the message
                    let message = DbMessage::InsertWeatherData {
                        vessel_uuid, 
                        device_name,
                        pressure: None, 
                        air_temp: None,
                        dew_point: None,
                        humidity: parsed.humidity_percent().map(|hum| hum as f64),
                    };

                    // Send it to DB and MQTT channels
                    let _ = db_tx.send(message.clone()).await;
                    let _ = mqtt_tx.send(message).await;
                }
            }
        }
        // Actual Pressure (Source 0 = Atmospheric)
        130314 => {
            if let Some(parsed) = parse_and_print!(Pgn130314, pgn, source, data) {
                if parsed.source == 0 {
                    // Prepare the message
                    let message = DbMessage::InsertWeatherData {
                        vessel_uuid, 
                        device_name,
                        air_temp: None, 
                        humidity: None,
                        dew_point: None,
                        pressure: parsed.pressure_pascals().map(|psr| (psr as f64) / 100.0),
                    };

                    // Send it to DB and MQTT channels
                    let _ = db_tx.send(message.clone()).await;
                    let _ = mqtt_tx.send(message).await;
                }
            }
        }
        // Meteorological Station Data (Fast Packet)
        // This is a legacy PGN that duplicates 130306, 130312, 130313, 130314.
        130323 => {
            // Duplicate - Drop and ignore.
        }
        // Manufacturer Proprietary Diagnostics (Fast Packet)
        // Reassemble the packet, then dump the complete payload to traffic log
        130945 => {
            if let Some(reassembled_payload) = fp_engine.process_frame(source as u8, pgn, data) {
                // Prepare the message
                let message = DbMessage::InsertRawTraffic {
                    vessel_uuid,
                    pgn,
                    device_name,
                    priority,
                    payload: reassembled_payload,
                };

                // Send it to DB and MQTT channels
                let _ = db_tx.send(message.clone()).await;
                let _ = mqtt_tx.send(message).await;
            }
        }

        // Catch un-parsed PGNs (stored in n2k_traffic)
        _ => {
            // It's unlikely that we'll want to see unknown PGNs on the MQTT 
            // channel, but it's not impossible. If this generates too much 
            // traffic, the mqtt_tx can be commented out.
            // Prepare the message
            let message = DbMessage::InsertRawTraffic {
                vessel_uuid,
                pgn,
                device_name,
                priority,
                payload: data.to_vec(),
            };

            // Send it to DB and MQTT channels
            let _ = db_tx.send(message.clone()).await;
            let _ = mqtt_tx.send(message).await;
        }
    }
}
