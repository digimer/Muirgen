use futures_util::StreamExt;
use socketcan::EmbeddedFrame;
use socketcan::tokio::CanSocket;
use sqlx::postgres::PgPoolOptions;
use std::env;

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

    println!("Accessing central database... ");

    // Connect using the URL from the .env file.
    let pool = match PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
    {
        Ok(p) => p, 
        Err(e) => {
            eprintln!("Access Failure! Error: [{}]", e);
            std::process::exit(1);
        }
    };
    println!("Access granted.");

    // Connect to the NMEA2000 network interface
    println!("Binding to the NMEA2000 hardware interface: [{}]... ", n2k_device);

    // Open the socket asynchronously
    let mut socket = match CanSocket::open(&n2k_device) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed! Error: [{}]", e);
            std::process::exit(1);
        }
    };
    println!("Success. Ready to process NMEA2000 PGNs.");

    // Enter the infinite listener loop.
    while let Some(Ok(frame)) = socket.next().await {
        // DEBUG: Stream the PGNs to STDOUT
        //println!("PGN Frame: [{:?}]", frame);

        // Make sure this is an NMEA2000 extended 29-bit CAN frame
        if let socketcan::Id::Extended(ext_id) = frame.id() {
            // Get the 29-bit integer
            let id_val = ext_id.as_raw();

            // Extract the J1939 fields using bitwise shifts
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

            // Pull out the simple GPS coordinates
            if pgn == 129025 {
                println!("Device: [{}] sent GPS coordinates: [{:?}]", source_address, frame.data());
            }
        }
    }

    Ok(())
}