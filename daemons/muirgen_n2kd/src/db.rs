// Database thread handler

use sqlx::PgPool;

// The types of messages we can send to the database thread
pub enum DbMessage {
    ClearAlarm {
        vessel_uuid: uuid::Uuid,
        set_by: String,
        code: String,
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
        device_name: u64,
        source_address: u8,
        manufacturer_code: u16,
        device_class: u8,
        device_function: u8,
        device_instance: u8,
    }
}

// Dedicated background database writer task
pub async fn run_db_thread(
    pool: PgPool,
    mut receiver: tokio::sync::mpsc::Receiver<DbMessage>
) {
    println!("Database: Writer thread started.");

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
        }
    }
}
