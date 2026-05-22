use futures_util::StreamExt;
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
        println!("PGN Frame: [{:?}]", frame);
    }

    Ok(())
}