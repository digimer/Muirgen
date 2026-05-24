// Import the PGN parser
use crate::db::DbMessage;
use crate::pgns::pgn_60928::Pgn60928;
use crate::pgns::pgn_130311::Pgn130311;
use deku::DekuContainerRead;  // provides from_bytes()

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
    data: &[u8],
    db_tx: &tokio::sync::mpsc::Sender<DbMessage>,
    vessel_uuid: uuid::Uuid
) {
    match pgn {
        // ISO Address Claim
        60928 => {
            if let Some(parsed) = parse_and_print!(Pgn60928, pgn, source, data) {
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
        // Environmental Parameters (deprecated in N2K)
        130311 => {
            parse_and_print!(Pgn130311, pgn, source, data);
        }

        // Catch un-parsed PGNs
        _ => {}
    }
}