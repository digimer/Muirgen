// Temperature
use deku::prelude::*;
use std::fmt;

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
#[deku(endian = "little")]
pub struct Pgn130312 {
    pub seq_id: u8,
    pub instance: u8,
    pub source: u8,
    pub actual_temperature: u16,
    pub set_temperature: u16,
    pub reserved: u8,
}

impl Pgn130312 {
    // 0xFFFF is unavailable. 0.01 K resolution.
    pub fn temperature_kelvin(&self) -> Option<f32> {
        if self.actual_temperature == 0xFFFF { None } else { Some(self.actual_temperature as f32 * 0.01) }
    }
}

impl fmt::Display for Pgn130312 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        let temperature = self.temperature_kelvin().map(|kelvin| format!("{:.2}°C", kelvin - 273.15)).unwrap_or_else(|| "N/A".to_string());
        write!(format, "Temperature: [{}], Source [{}]", temperature, self.source)
    }
}
