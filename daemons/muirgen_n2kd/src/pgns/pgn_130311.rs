// This is the (deprecated) single frame Environmental Parameters PGN

use deku::prelude::*;

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
#[deku(endian = "little")]
pub struct Pgn130311 {
  pub seq_id: u8,

  #[deku(bits = "2")]
  pub temp_instance: u8, 

  #[deku(bits = "2")]
  pub humidity_instance: u8,

  #[deku(bits = "4")]
  pub reserved: u8,

  // The actual values
  pub temperature: u16,
  pub humidity: u16,
  pub atmospheric_pressure: u16,
}
