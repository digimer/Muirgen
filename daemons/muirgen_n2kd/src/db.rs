// Database thread handler

use sqlx::PgPool;

// The types of messages we can send to the database thread
pub enum DbMessage {
    SetAlarm {
        vessel_uuid: uuid::Uuid,
        code: String, 
        title: String,
        description: String,
        level: i16,
    },
    ClearAlarm {
        vessel_uuid: uuid::Uuid,
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
            DbMessage::SetAlarm { vessel_uuid, code, title, description, level } => {
                let result = sqlx::query!(
                    r#"
                    INSERT INTO alarms (vessel_uuid, code, title, description, level, is_active)
                    VALUES ($1, $2, $3, $4, $5, TRUE)
                    "#,
                    vessel_uuid, code, title, description, level
                )
                .execute(&pool)
                .await;

                if let Err(e) = result {
                    eprintln!("Alarm Set Failed! [{}:{}] -> [{}] failed! Error: [{:?}]", code, title, description, e);
                } else {
                    println!("Alarm Set: [{}:{}] -> [{}]", code, title, description);
                }
            }
            DbMessage::ClearAlarm { vessel_uuid, code } => {
                let result = sqlx::query!(
                    r#"
                    UPDATE alarms SET is_active = FALSE WHERE vessel_uuid = $1 AND code = $2 AND is_active = TRUE
                    "#,
                    vessel_uuid, code
                )
                .execute(&pool)
                .await;
                
                if let Err(e) = result {
                    eprintln!("Alarm Clear failed! Code: [{}]. Error: [{:?}]", code, e);
                } else {
                    println!("Alarm Cleared. Code: [{}]", code);
                }
            }
        }
    }
}
