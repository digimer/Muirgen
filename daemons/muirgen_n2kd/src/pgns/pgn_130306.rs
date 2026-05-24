// Wind Data
use deku::prelude::*;
use std::fmt;

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
#[deku(endian = "little")]
pub struct Pgn130306 {
    pub seq_id: u8,
    pub wind_speed: u16,
    pub wind_direction: u16,
    #[deku(bits = "5")]
    pub reserved: u8,
    #[deku(bits = "3")]
    pub reference: u8,
}

impl Pgn130306 {
    // 0xFFFF means unavailable. Speed is in 0.01 m/s resolution
    pub fn wind_speed_mps(&self) -> Option<f32> {
        if self.wind_speed == 0xFFFF { None } else { Some(self.wind_speed as f32 * 0.01) }
    }
    
    // Direction is in 0.0001 radians resolution
    pub fn wind_direction_radians(&self) -> Option<f32> {
        if self.wind_direction == 0xFFFF { None } else { Some(self.wind_direction as f32 * 0.0001) }
    }
    
    pub fn wind_direction_degrees(&self) -> Option<f32> {
        self.wind_direction_radians().map(|rad| rad.to_degrees())
    }
}

impl fmt::Display for Pgn130306 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        let speed     = self.wind_speed_mps().map(|spd| format!("{:.2} m/s", spd)).unwrap_or_else(|| "N/A".to_string());
        let direction = self.wind_direction_degrees().map(|deg| format!("{:.1}°", deg)).unwrap_or_else(|| "N/A".to_string());
        let reference = match self.reference {
            0 => "True North (Ground)",
            1 => "Magnetic North (Ground)",
            2 => "Apparent",
            3 => "True (Boat)",
            4 => "True (Water)",
            _ => "Unknown",
        };
        write!(format, "Wind Speed: [{}], Direction: [{}], Reference: [{}]", speed, direction, reference)
    }
}
