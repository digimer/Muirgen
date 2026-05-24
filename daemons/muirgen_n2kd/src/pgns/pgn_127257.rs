// Attitude
use deku::prelude::*;
use std::fmt;

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
#[deku(endian = "little")]
pub struct Pgn127257 {
    pub seq_id: u8,
    pub yaw: i16,
    pub pitch: i16,
    pub roll: i16,
    pub reserved: u8,
}

impl Pgn127257 {
    // 0x7FFF means the data is unavailable
    pub fn pitch_radians(&self) -> Option<f32> {
        if self.pitch == 0x7FFF { None } else { Some(self.pitch as f32 * 0.0001) }
    }
    pub fn pitch_degrees(&self) -> Option<f32> {
        self.pitch_radians().map(|rad| rad.to_degrees())
    }
    pub fn roll_radians(&self) -> Option<f32> {
        if self.roll == 0x7FFF { None } else { Some(self.roll as f32 * 0.0001) }
    }
    pub fn roll_degrees(&self) -> Option<f32> {
        self.roll_radians().map(|rad| rad.to_degrees())
    }
}

impl fmt::Display for Pgn127257 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        let pitch = self.pitch_degrees().map(|deg| format!("{:.1}°", deg)).unwrap_or_else(|| "N/A".to_string());
        let roll  = self.roll_degrees().map(|deg| format!("{:.1}°", deg)).unwrap_or_else(|| "N/A".to_string());
        write!(format, "Pitch: [{}], Roll: [{}]", pitch, roll)
    }
}
