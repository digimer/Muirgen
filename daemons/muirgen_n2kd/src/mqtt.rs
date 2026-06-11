// Handles sending update notifications to MQTT
use rumqttc::{AsyncClient, MqttOptions, QoS};
use serde_json::json;
use std::time::Duration;
use tokio::sync::mpsc;

pub async fn run_mqtt_thread(mut receiver: mpsc::Receiver<crate::db::DbMessage>, mqtt_host: String) {
    let mut mqttoptions = MqttOptions::new("muirgen_n2kd", mqtt_host, 1883);
    mqttoptions.set_keep_alive(Duration::from_secs(5));
    
    let (client, mut eventloop) = AsyncClient::new(mqttoptions, 1000);

    tokio::spawn(async move {
        loop {
            match eventloop.poll().await {
                Ok(_) => {}
                Err(con_err) => {
                    eprintln!("MQTT Comms Error! Error: [{:?}]. Reconnecting...", con_err);
                    tokio::time::sleep(Duration::from_secs(2)).await;
                }
            }
        }
    });

    println!("MQTT Thread Connected to Broker. Awaiting telemetry...");

    while let Some(msg) = receiver.recv().await {
        match msg {
            crate::db::DbMessage::InsertPositionData { vessel_uuid, latitude, longitude, satellites_in_view, gnss_method, .. } => {
                let payload = json!({
                    "vessel_uuid": vessel_uuid.to_string(),
                    "latitude": latitude,
                    "longitude": longitude,
                    "satellites_in_view": satellites_in_view,
                    "gnss_method": gnss_method
                });
                let topic = format!("muirgen/telemetry/{}/position", vessel_uuid);
                let _     = client.publish(topic, QoS::AtMostOnce, false, payload.to_string()).await;
            }
            crate::db::DbMessage::InsertSkyviewData { vessel_uuid, horizontal_dop, vertical_dop, time_dop, satellites, .. } => {
                let payload = json!({
                    "vessel_uuid": vessel_uuid.to_string(),
                    "horizontal_dop": horizontal_dop,
                    "vertical_dop": vertical_dop,
                    "time_dop": time_dop,
                    "satellites": satellites
                });
                let topic = format!("muirgen/telemetry/{}/skyview", vessel_uuid);
                let _     = client.publish(topic, QoS::AtMostOnce, false, payload.to_string()).await;
            }
            crate::db::DbMessage::InsertDepthData { vessel_uuid, depth, offset, .. } => {
                let payload = json!({
                    "vessel_uuid": vessel_uuid.to_string(),
                    "depth": depth,
                    "offset": offset
                });
                let topic = format!("muirgen/telemetry/{}/depth", vessel_uuid);
                let _     = client.publish(topic, QoS::AtMostOnce, false, payload.to_string()).await;
            }
            crate::db::DbMessage::InsertMotionData { vessel_uuid, pitch, roll, heading_magnetic, speed_through_water, course_over_ground, speed_over_ground, .. } => {
                let payload = json!({
                    "vessel_uuid": vessel_uuid.to_string(),
                    "pitch": pitch,
                    "roll": roll,
                    "heading_magnetic": heading_magnetic,
                    "speed_through_water": speed_through_water, 
                    "course_over_ground": course_over_ground,
                    "speed_over_ground": speed_over_ground
                });
                let topic = format!("muirgen/telemetry/{}/motion", vessel_uuid);
                let _     = client.publish(topic, QoS::AtMostOnce, false, payload.to_string()).await;
            }
            crate::db::DbMessage::InsertWeatherData { vessel_uuid, air_temp, pressure, humidity, .. } => {
                let payload = json!({
                    "vessel_uuid": vessel_uuid.to_string(),
                    "air_temp": air_temp,
                    "pressure": pressure,
                    "humidity": humidity
                });
                let topic = format!("muirgen/telemetry/{}/weather", vessel_uuid);
                let _     = client.publish(topic, QoS::AtMostOnce, false, payload.to_string()).await;
            }
            crate::db::DbMessage::InsertWindData { vessel_uuid, true_speed, true_direction, apparent_speed, apparent_direction, .. } => {
                let payload = json!({
                    "vessel_uuid": vessel_uuid.to_string(),
                    "true_speed": true_speed,
                    "true_direction": true_direction,
                    "apparent_speed": apparent_speed,
                    "apparent_direction": apparent_direction
                });
                let topic = format!("muirgen/telemetry/{}/wind", vessel_uuid);
                let _     = client.publish(topic, QoS::AtMostOnce, false, payload.to_string()).await;
            }
            crate::db::DbMessage::SetAlarm { vessel_uuid, code, description, .. } => {
                let payload = json!({
                    "vessel_uuid": vessel_uuid.to_string(),
                    "code": code,
                    "message": description,
                    "status": "active"
                });
                let topic = format!("muirgen/telemetry/{}/alarm/{}", vessel_uuid, code);
                let _     = client.publish(topic, QoS::AtMostOnce, false, payload.to_string()).await;
            }
            crate::db::DbMessage::ClearAlarm { vessel_uuid, code, .. } => {
                let payload = json!({
                    "vessel_uuid": vessel_uuid.to_string(),
                    "code": code,
                    "status": "cleared"
                });
                let topic = format!("muirgen/telemetry/{}/alarm/{}", vessel_uuid, code);
                let _     = client.publish(topic, QoS::AtMostOnce, false, payload.to_string()).await;
            }

            // Ignore Device Registration events
            _ => {}
        }
    }
}
