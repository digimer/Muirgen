// Import the PGN parser
use crate::pgns::pgn_130311::Pgn130311;
use deku::DekuContainerRead;  // provides from_bytes()

pub fn route_pgns(pgn: u32, source: u32, data: &[u8]) {
    match pgn {
        // Environmental Parameters (deprecated in N2K)
        130311 => {
            match Pgn130311::from_bytes((data, 0)) {
                Ok((_rest, parsed)) => {
                    println!("PGN: 130311, Device: [{}], packet: [{:?}]", source, parsed);
                }
                Err(e) => {
                    eprintln!("PGN 1303100 Parser Failure! Error: [{:?}]", e);
                }
            }
        }

        // TODO: New PGN parsers to be added later

        // Catch un-parsed PGNs
        _ => {}
    }
}