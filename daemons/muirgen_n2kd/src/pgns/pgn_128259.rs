// Speed (Water referenced / Ground referenced)
// 
// TODO: Needs to be tested when vessel launches
//
use deku::prelude::*;
use std::fmt;

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
#[deku(endian = "little")]
pub struct Pgn128259 {
    pub seq_id: u8,
    pub speed_water_ref: u16,
    pub speed_ground_ref: u16,
    pub speed_type: u8,
}

impl Pgn128259 {
    // 0xFFFF means the data is unavailable. Resolution is 0.01 m/s
    pub fn speed_water_mps(&self) -> Option<f32> {
        if self.speed_water_ref == 0xFFFF { None } else { Some(self.speed_water_ref as f32 * 0.01) }
    }
    
    pub fn speed_ground_mps(&self) -> Option<f32> {
        if self.speed_ground_ref == 0xFFFF { None } else { Some(self.speed_ground_ref as f32 * 0.01) }
    }
}

impl fmt::Display for Pgn128259 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        let stw = self.speed_water_mps().map(|s| format!("{:.2} m/s", s)).unwrap_or_else(|| "N/A".to_string());
        let sog = self.speed_ground_mps().map(|s| format!("{:.2} m/s", s)).unwrap_or_else(|| "N/A".to_string());
        write!(format, "Speed Through Water: [{}], Speed Over Ground: [{}]", stw, sog)
    }
}
