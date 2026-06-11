// Water Depth
// 
// TODO: Needs to be tested when vessel launches
//
use deku::prelude::*;
use std::fmt;

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
#[deku(endian = "little")]
pub struct Pgn128267 {
    pub seq_id: u8,
    pub depth: u32,
    pub offset: i16,
    pub range_reserved: u8,
}

impl Pgn128267 {
    // Depth is in 0.01 m resolution. 0xFFFFFFFF means unavailable.
    pub fn depth_meters(&self) -> Option<f32> {
        if self.depth == 0xFFFFFFFF { None } else { Some(self.depth as f32 * 0.01) }
    }

    // Offset is in 0.001 m resolution. >0 is transducer to waterline. <0 is transducer to keel.
    pub fn offset_meters(&self) -> Option<f32> {
        if self.offset == 0x7FFF { None } else { Some(self.offset as f32 * 0.001) }
    }
}

impl fmt::Display for Pgn128267 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        let depth  = self.depth_meters().map(|d| format!("{:.2} m", d)).unwrap_or_else(|| "N/A".to_string());
        let offset = self.offset_meters().map(|o| format!("{:.3} m", o)).unwrap_or_else(|| "N/A".to_string());
        write!(format, "Depth: [{}], Offset: [{}]", depth, offset)
    }
}
