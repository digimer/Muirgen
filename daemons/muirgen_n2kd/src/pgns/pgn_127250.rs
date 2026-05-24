// Vessel Heading
use deku::prelude::*;
use std::fmt;

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
#[deku(endian = "little")]
pub struct Pgn127250 {
    pub seq_id: u8,
    pub heading: u16,
    pub deviation: i16,
    pub variation: i16,
    #[deku(bits = "2")]
    pub reference: u8,
    #[deku(bits = "6")]
    pub reserved: u8,
}

impl Pgn127250 {
    // 0xFFFF means the data is unavailable
    pub fn heading_radians(&self) -> Option<f32> {
        if self.heading == 0xFFFF { None } else { Some(self.heading as f32 * 0.0001) }
    }
    
    pub fn heading_degrees(&self) -> Option<f32> {
        self.heading_radians().map(|rad| rad.to_degrees())
    }
}

impl fmt::Display for Pgn127250 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        let heading   = self.heading_degrees().map(|data| format!("{:.1}°", data)).unwrap_or_else(|| "N/A".to_string());
        let reference = match self.reference {
            0 => "True",
            1 => "Magnetic",
            _ => "Unknown",
        };
        write!(format, "Heading: [{}], Reference: ({})", heading, reference)
    }
}
