// Magnetic Variation
use deku::prelude::*;
use std::fmt;

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
#[deku(endian = "little")]
pub struct Pgn127258 {
    pub seq_id: u8,
    #[deku(bits = "4")]
    pub reserved1: u8,
    #[deku(bits = "4")]
    pub source: u8,
    pub date_of_variation: u16,
    pub variation: i16,
    pub reserved2: u16,
}

impl Pgn127258 {
    // 0x7FFF means the data is unavailable
    pub fn variation_radians(&self) -> Option<f32> {
        if self.variation == 0x7FFF { None } else { Some(self.variation as f32 * 0.0001) }
    }
    pub fn variation_degrees(&self) -> Option<f32> {
        self.variation_radians().map(|rad| rad.to_degrees())
    }
}

impl fmt::Display for Pgn127258 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        let variation = self.variation_degrees().map(|data| format!("{:.1}°", data)).unwrap_or_else(|| "N/A".to_string());
        write!(format, "Variation: [{}]", variation)
    }
}
