// Rate of Turn
use deku::prelude::*;
use std::fmt;

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
#[deku(endian = "little")]
pub struct Pgn127251 {
    pub seq_id: u8,
    pub rate: i32,
    pub reserved1: u8,
    pub reserved2: u16,
}

impl Pgn127251 {
    // 0x7FFFFFFF means the data is unavailable. The resolution is 
    // 1/32,000,000 radians/sec.
    pub fn rate_radians_per_sec(&self) -> Option<f32> {
        if self.rate == 0x7FFFFFFF { None } else { Some(self.rate as f32 * 0.00000003125) }
    }
    
    pub fn rate_degrees_per_sec(&self) -> Option<f32> {
        self.rate_radians_per_sec().map(|rad| rad.to_degrees())
    }
}

impl fmt::Display for Pgn127251 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        let rate_of_turn = self.rate_degrees_per_sec().map(|deg| format!("{:.2}°/s", deg)).unwrap_or_else(|| "N/A".to_string());
        write!(format, "Rate of Turn: [{}]", rate_of_turn)
    }
}
