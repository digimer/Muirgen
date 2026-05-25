// Course and Speed over Ground
use deku::prelude::*;
use std::fmt;

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
#[deku(endian = "little")]
pub struct Pgn129026 {
    pub seq_id: u8,
    #[deku(bits = "6")]
    pub reserved: u8,
    #[deku(bits = "2")]
    pub cog_reference: u8,
    pub cog: u16,
    pub sog: u16,
}

impl Pgn129026 {
    // 0xFFFF means unavailable. 0.0001 radians resolution.
    pub fn course_over_ground_radians(&self) -> Option<f32> {
        if self.cog == 0xFFFF { None } else { Some(self.cog as f32 * 0.0001) }
    }
    
    pub fn course_over_ground_degrees(&self) -> Option<f32> {
        self.course_over_ground_radians().map(|rad| rad.to_degrees())
    }
    
    // 0xFFFF means unavailable. 0.01 m/s resolution.
    pub fn speed_over_ground_mps(&self) -> Option<f32> {
        if self.sog == 0xFFFF { None } else { Some(self.sog as f32 * 0.01) }
    }
}

impl fmt::Display for Pgn129026 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        let course_over_ground = self.course_over_ground_degrees().map(|deg| format!("{:.1}°", deg)).unwrap_or_else(|| "N/A".to_string());
        let speed_over_ground  = self.speed_over_ground_mps().map(|mps| format!("{:.2} m/s", mps)).unwrap_or_else(|| "N/A".to_string());

        let reference = match self.cog_reference {
            0 => "True",
            1 => "Magnetic",
            _ => "Unknown",
        };
        write!(format, "Speed over Ground: [{}], Course over Ground: [{}], Reference: [{}]", speed_over_ground, course_over_ground, reference)
    }
}
