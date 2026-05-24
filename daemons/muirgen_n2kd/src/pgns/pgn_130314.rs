// Actual Pressure
use deku::prelude::*;
use std::fmt;

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
#[deku(endian = "little")]
pub struct Pgn130314 {
    pub seq_id: u8,
    pub instance: u8,
    pub source: u8,
    // Note: Pressure is an i32 in this modern PGN
    pub pressure: i32,
    pub reserved: u8,
}

impl Pgn130314 {
    // 0x7FFFFFFF is unavailable. 1 Pa resolution.
    pub fn pressure_pascals(&self) -> Option<i32> {
        if self.pressure == 0x7FFFFFFF { None } else { Some(self.pressure) }
    }
}

impl fmt::Display for Pgn130314 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        let pressure = self.pressure_pascals().map(|pascals| format!("{:.0} hPa", pascals as f32 / 100.0)).unwrap_or_else(|| "N/A".to_string());
        write!(format, "Pressure: [{}], Source: [{}]", pressure, self.source)
    }
}
