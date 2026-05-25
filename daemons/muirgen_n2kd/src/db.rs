// Database thread handler

use sqlx::PgPool;
use tokio::net::UnixDatagram;

// Structs (specifically for chrony)
#[repr(C)] 
struct Timeval {
    tv_sec: i64,
    tv_usec: i64,
}

#[repr(C)] 
struct SockSample {
    tv: Timeval,
    offset: f64,
    pulse: i32,
    leap: i32,
    _pad: i32,
    magic: i32,
}

impl SockSample {
    fn as_bytes(&self) -> &[u8] {
        // Rust requires 'unsafe {}' to tell it we're intentionally directly 
        // accessing memory pointers.
        unsafe {
            std::slice::from_raw_parts(
                (self as *const SockSample) as *const u8,
                std::mem::size_of::<SockSample>(),
            )
        }
    }
}

// The types of messages we can send to the database thread
pub enum DbMessage {
    ClearAlarm {
        vessel_uuid: uuid::Uuid,
        set_by: String,
        code: String,
    },
    InsertMotionData {
        vessel_uuid: uuid::Uuid,
        device_name: u64,
        pitch: Option<f64>,
        roll: Option<f64>,
        heading_magnetic: Option<f64>,
        magnetic_variation: Option<f64>,
        rate_of_turn: Option<f64>,
        course_over_ground: Option<f64>,
        speed_over_ground: Option<f64>,
    },
    InsertPositionData {
        vessel_uuid: uuid::Uuid,
        device_name: u64,
        latitude: Option<f64>,
        longitude: Option<f64>,
        altitude: Option<f64>,
        satellites_in_view: Option<u8>,
        gnss_method: Option<String>,
    },
    InsertRawTraffic {
        vessel_uuid: uuid::Uuid,
        pgn: u32,
        device_name: u64,
        priority: u8,
        payload: Vec<u8>,
    },
    InsertSkyviewData {
        vessel_uuid: uuid::Uuid,
        device_name: u64,
        // Dilution of Precision
        horizontal_dop: Option<f64>,
        vertical_dop: Option<f64>,
        time_dop: Option<f64>,
        satellites: Option<serde_json::Value>,
    },
    InsertWeatherData {
        vessel_uuid: uuid::Uuid,
        device_name: u64,
        pressure: Option<f64>,
        air_temp: Option<f64>,
        humidity: Option<f64>,
    },
    InsertWindData {
        vessel_uuid: uuid::Uuid,
        device_name: u64,
        true_speed: Option<f64>,
        true_direction: Option<f64>,
        ground_speed: Option<f64>,
        ground_direction: Option<f64>,
        apparent_speed: Option<f64>,
        apparent_direction: Option<f64>,
    },
    SetAlarm {
        vessel_uuid: uuid::Uuid,
        set_by: String,
        code: String, 
        title: String,
        description: String,
        level: i16,
    },
    UpdateN2kDevice {
        vessel_uuid: uuid::Uuid,
        source_address: u8,
        device_name: u64,
        manufacturer_code: u16,
        device_class: u8,
        device_function: u8,
        device_instance: u8,
    }, 
    UpdateN2kProductInfo {
        vessel_uuid: uuid::Uuid,
        device_name: u64,
        model_id: String,
        software_version: String,
        serial_code: String,
    },
    UpdateSystemTime {
        n2k_unix_timestamp: f64,
        local_unix_timestamp: f64,
    }
}

// Dedicated background database writer task
pub async fn run_db_thread(
    pool: PgPool,
    mut receiver: tokio::sync::mpsc::Receiver<DbMessage>
) {
    println!("Database: Writer thread started.");

    // Open an unbound datagram socket for chronyd time sync.
    let chrony_sock = UnixDatagram::unbound().ok();

    // Listen for messages to arrive on the MPSC channel indefinitely.
    while let Some(msg) = receiver.recv().await {
        match msg {
            DbMessage::SetAlarm { vessel_uuid, set_by, code, title, description, level } => {
                let result = sqlx::query!(
                    r#"
                    INSERT INTO alarms (vessel_uuid, set_by, code, title, description, level, is_active)
                    VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                    ON CONFLICT (vessel_uuid, set_by, code)
                    DO UPDATE SET
                        is_active = TRUE,
                        title = EXCLUDED.title, 
                        description = EXCLUDED.description, 
                        level = EXCLUDED.level
                    "#,
                    vessel_uuid, set_by, code, title, description, level
                )
                .execute(&pool)
                .await;

                if let Err(db_err) = result {
                    eprintln!("Alarm Set Failed! [{}:{}], [{}] -> [{}] failed! Error: [{:?}]", set_by, code, title, description, db_err);
                } else {
                    println!("Alarm Set: [{}:{}], [{}] -> [{}]", set_by, code, title, description);
                }
            }
            DbMessage::ClearAlarm { vessel_uuid, set_by, code } => {
                let result = sqlx::query!(
                    r#"
                    UPDATE alarms SET is_active = FALSE WHERE vessel_uuid = $1 AND set_by = $2 AND code = $3 AND is_active = TRUE
                    "#,
                    vessel_uuid, set_by, code
                )
                .execute(&pool)
                .await;
                
                if let Err(db_err) = result {
                    eprintln!("Alarm Clear failed! Code: [{}:{}]. Error: [{:?}]", set_by, code, db_err);
                } else {
                    println!("Alarm Cleared. Code: [{}:{}]", set_by, code);
                }
            }
            DbMessage::InsertMotionData { vessel_uuid, device_name, pitch, roll, heading_magnetic, magnetic_variation, rate_of_turn, speed_over_ground, course_over_ground } => {
                let sensor_source          = format!("n2k:{}", device_name);
                let pitch_f32              = pitch.map(|pitch| pitch as f32);
                let roll_f32               = roll.map(|roll| roll as f32);
                let heading_f32            = heading_magnetic.map(|heading| heading as f32);
                let variation_f32          = magnetic_variation.map(|var| var as f32);
                let rate_of_turn_f32       = rate_of_turn.map(|rot| rot as f32);
                let speed_over_ground_f32  = speed_over_ground.map(|sog| sog as f32);
                let course_over_ground_f32 = course_over_ground.map(|cog| cog as f32);

                let result = sqlx::query!(
                    r#"
                    INSERT INTO motion_data (vessel_uuid, sensor_source, pitch, roll, heading_magnetic, magnetic_variation, rate_of_turn, speed_over_ground, course_over_ground)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    "#,
                    vessel_uuid, sensor_source, pitch_f32, roll_f32, heading_f32, variation_f32, rate_of_turn_f32, speed_over_ground_f32, course_over_ground_f32
                )
                .execute(&pool).await;

                if let Err(db_err) = result {
                    eprintln!("Database: Motion data insert failed! Error: [{:?}]", db_err);
                }
            }
            DbMessage::InsertPositionData { vessel_uuid, device_name, latitude, longitude, altitude, satellites_in_view, gnss_method } => {
                let sensor_source  = format!("n2k:{}", device_name);
                let satellites_i16 = satellites_in_view.map(|sats| sats as i16);
                let altitude_f32   = altitude.map(|alt| alt as f32);
                
                // We only create a PostGIS point if we actually have both Latitude and Longitude!
                let result = if let (Some(lat), Some(lon)) = (latitude, longitude) {
                    sqlx::query!(
                        r#"
                        INSERT INTO position_data (vessel_uuid, sensor_source, location, altitude, satellites_in_view, gnss_method)
                        VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3::float8, $4::float8), 4326), $5, $6, $7)
                        "#,
                        vessel_uuid, sensor_source, lon, lat, altitude_f32, satellites_i16, gnss_method
                    )
                    .execute(&pool).await
                } else {
                    // No GPS fix yet, insert the other GNSS metadata with a NULL location
                    sqlx::query!(
                        r#"
                        INSERT INTO position_data (vessel_uuid, sensor_source, altitude, satellites_in_view, gnss_method)
                        VALUES ($1, $2, $3, $4, $5)
                        "#,
                        vessel_uuid, sensor_source, altitude_f32, satellites_i16, gnss_method
                    )
                    .execute(&pool).await
                };

                if let Err(db_err) = result {
                    eprintln!("Database: Position data insert failed! Error: [{:?}]", db_err);
                }
            }
            DbMessage::InsertRawTraffic { vessel_uuid, pgn, device_name, priority, payload } => {
                let device_name_i64 = device_name as i64;
                let priority_i16    = priority as i16;
                let pgn_i32         = pgn as i32;
                
                let result = sqlx::query!(
                    r#"
                    INSERT INTO n2k_traffic (vessel_uuid, pgn, device_name, priority, payload)
                    VALUES ($1, $2, $3, $4, $5)
                    "#,
                    vessel_uuid, pgn_i32, device_name_i64, priority_i16, payload
                )
                .execute(&pool)
                .await;

                if let Err(db_err) = result {
                    eprintln!("Database: Raw PGN traffic insert failed for PGN: [{}] failed! Error: [{:?}]", pgn, db_err);
                }
            }
            DbMessage::InsertSkyviewData { vessel_uuid, device_name, horizontal_dop, vertical_dop, time_dop, satellites } => {
                let sensor_source      = format!("n2k:{}", device_name);
                // Dilution of Precision
                let horizontal_dop_f32 = horizontal_dop.map(|val| val as f32);
                let vertical_dop_f32   = vertical_dop.map(|val| val as f32);
                let time_dop_f32       = time_dop.map(|val| val as f32);

                let result = sqlx::query!(
                    r#"
                    INSERT INTO gnss_skyview (vessel_uuid, sensor_source, horizontal_dop, vertical_dop, time_dop, satellites)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    "#,
                    vessel_uuid, sensor_source, horizontal_dop_f32, vertical_dop_f32, time_dop_f32, satellites
                )
                .execute(&pool).await;

                if let Err(db_err) = result {
                    eprintln!("Database: Skyview data insert failed! Error: [{:?}]", db_err);
                }
            }
            DbMessage::InsertWeatherData { vessel_uuid, device_name, pressure, air_temp, humidity } => {
                let sensor_source = format!("n2k:{}", device_name);
                // Convert f64 to f32 to match 'real' in the Postgres schema
                let pressure_f32  = pressure.map(|prs| prs as f32);
                let temp_f32      = air_temp.map(|tmp| tmp as f32);
                let humidity_f32  = humidity.map(|hmd| hmd as f32);
                
                let result = sqlx::query!(
                    r#"
                    INSERT INTO weather_data (vessel_uuid, sensor_source, pressure, air_temp, relative_humidity)
                    VALUES ($1, $2, $3, $4, $5)
                    "#,
                    vessel_uuid, sensor_source, pressure_f32, temp_f32, humidity_f32
                )
                .execute(&pool).await;

                if let Err(db_err) = result {
                    eprintln!("Database: Weather data insert failed! Error: [{:?}]", db_err);
                }
            }
            DbMessage::InsertWindData { vessel_uuid, device_name, true_speed, true_direction, ground_speed, ground_direction, apparent_speed, apparent_direction } => {
                let sensor_source          = format!("n2k:{}", device_name);
                let true_speed_f32         = true_speed.map(|vel| vel as f32);
                let true_direction_f32     = true_direction.map(|vec| vec as f32);
                let ground_speed_f32       = ground_speed.map(|vel| vel as f32);
                let ground_direction_f32   = ground_direction.map(|vec| vec as f32);
                let apparent_speed_f32     = apparent_speed.map(|vel| vel as f32);
                let apparent_direction_f32 = apparent_direction.map(|vec| vec as f32);

                let result = sqlx::query!(
                    r#"
                    INSERT INTO wind_data (vessel_uuid, sensor_source, true_speed, true_direction, ground_speed, ground_direction, apparent_speed, apparent_direction)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    "#,
                    vessel_uuid, sensor_source, true_speed_f32, true_direction_f32, ground_speed_f32, ground_direction_f32, apparent_speed_f32, apparent_direction_f32
                )
                .execute(&pool).await;

                if let Err(db_err) = result {
                    eprintln!("Database: Wind data insert failed! Error: [{:?}]", db_err);
                }
            }
            DbMessage::UpdateN2kDevice { vessel_uuid, device_name, source_address, manufacturer_code, device_class, device_function, device_instance } => {
                // PostgreSQL natively uses signed integers, so we cast here.
                let device_name_i64    = device_name as i64;
                let source_address_i16 = source_address as i16;
                let mfg_code_i32       = manufacturer_code as i32;
                let d_class_i32        = device_class as i32;
                let d_func_i32         = device_function as i32;
                let d_inst_i32         = device_instance as i32;
                
                let result = sqlx::query!(
                    r#"
                    INSERT INTO n2k_devices (vessel_uuid, device_name, source_address, manufacturer_code, device_class, device_function, device_instance, last_seen)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, now())
                    ON CONFLICT (vessel_uuid, device_name) DO UPDATE SET source_address = EXCLUDED.source_address, last_seen = now()
                    "#,
                    vessel_uuid, device_name_i64, source_address_i16, mfg_code_i32, d_class_i32, d_func_i32, d_inst_i32
                )
                .execute(&pool)
                .await;

                if let Err(db_err) = result {
                    eprintln!("Database Registration Failed! N2K Device [{}]. Error: [{:?}]", device_name, db_err);
                } else {
                    println!("Database: Registered N2K Device [{}] successfully.", device_name);
                }
            }
            DbMessage::UpdateN2kProductInfo { vessel_uuid, device_name, model_id, software_version, serial_code } => {
                let device_name_i64 = device_name as i64;
                let result          = sqlx::query!(
                    r#"
                    UPDATE n2k_devices 
                    SET model_id = $1, software_version = $2, serial_code = $3 
                    WHERE vessel_uuid = $4 AND device_name = $5
                    "#,
                    model_id, software_version, serial_code, vessel_uuid, device_name_i64
                )
                .execute(&pool)
                .await;

                if let Err(db_err) = result {
                    eprintln!("Database Update Failed! N2K Product info for device name: [{}]. Error: [{:?}]", device_name, db_err);
                } else {
                    println!("Updated Product info for device name: [{}] successfully.", device_name);
                }
            }
            DbMessage::UpdateSystemTime { n2k_unix_timestamp, local_unix_timestamp } => {
                // Offset = the difference between true time and local time
                let offset  = n2k_unix_timestamp - local_unix_timestamp;
                let tv_sec  = local_unix_timestamp.trunc() as i64;
                let tv_usec = (local_unix_timestamp.fract() * 1_000_000.0) as i64;
                
                let sample = SockSample {
                    tv: Timeval { tv_sec, tv_usec },
                    offset,
                    pulse: 0,
                    leap: 0,
                    _pad: 0,
                    magic: 0x534f434b, // "SOCK"
                };
                if let Some(sock) = &chrony_sock {
                    // Send to chrony via its socket.
                    match sock.send_to(sample.as_bytes(), "/var/run/chrony/chrony.n2k.sock").await {
                        Ok(_) => println!("Socket - Sent time sample to chronyd successfully."),
                        Err(socket_err) => eprintln!("Socket Error! Failed to send to chronyd socket. Error: [{}]", socket_err),
                    }
                }
            }
        }
    }
}
