// Humidity
use deku::prelude::*;
use std::fmt;

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
#[deku(endian = "little")]
pub struct Pgn130313 {
    pub seq_id: u8,
    pub instance: u8,
    pub source: u8,
    pub actual_humidity: u16,
    pub set_humidity: u16,
    pub reserved: u8,
}

impl Pgn130313 {
    // 0xFFFF is unavailable. 0.004 % resolution.
    pub fn humidity_percent(&self) -> Option<f32> {
        if self.actual_humidity == 0xFFFF { None } else { Some(self.actual_humidity as f32 * 0.004) }
    }
}

impl fmt::Display for Pgn130313 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        let humidity = self.humidity_percent().map(|hum| format!("{:.1}%", hum)).unwrap_or_else(|| "N/A".to_string());
        write!(format, "Humidity: [{}], Source: [{}]", humidity, self.source)
    }
}
