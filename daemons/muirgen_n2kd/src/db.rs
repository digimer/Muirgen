// Database thread handler

use sqlx::PgPool;

// The types of messages we can send to the database thread
pub enum DbMessage {
    SetAlarm {
        vessel_uuid: uuid::Uuid,
        set_by: String,
        code: String, 
        title: String,
        description: String,
        level: i16,
    },
    ClearAlarm {
        vessel_uuid: uuid::Uuid,
        set_by: String,
        code: String,
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
                    vessel_uuid, code, title, description, level
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
        }
    }
}
