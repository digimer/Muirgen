// Dilution of Precision
use deku::prelude::*;
use std::fmt;

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
#[deku(endian = "little")]
pub struct Pgn129539 {
    pub seq_id: u8,
    #[deku(bits = "2")]
    pub reserved: u8,
    #[deku(bits = "3")]
    pub operating_mode: u8,
    #[deku(bits = "3")]
    pub set_mode: u8,
    pub horizontal_dop: i16,
    pub vertical_dop: i16,
    pub time_dop: i16,
}

impl Pgn129539 {
    // 0x7FFF is unavailable. 0.01 resolution.
    pub fn get_horizontal_dop(&self) -> Option<f32> {
        if self.horizontal_dop == 0x7FFF { None } else { Some(self.horizontal_dop as f32 * 0.01) }
    }
    pub fn get_vertical_dop(&self) -> Option<f32> {
        if self.vertical_dop == 0x7FFF { None } else { Some(self.vertical_dop as f32 * 0.01) }
    }
    pub fn get_time_dop(&self) -> Option<f32> {
        if self.time_dop == 0x7FFF { None } else { Some(self.time_dop as f32 * 0.01) }
    }
}

impl fmt::Display for Pgn129539 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        let horizontal_dop = self.get_horizontal_dop().map(|val| format!("{:.2}", val)).unwrap_or_else(|| "N/A".to_string());
        let vertical_dop   = self.get_vertical_dop().map(|val| format!("{:.2}", val)).unwrap_or_else(|| "N/A".to_string());
        let time_dop       = self.get_time_dop().map(|val| format!("{:.2}", val)).unwrap_or_else(|| "N/A".to_string());
        write!(format, "GNSS Dilution of Precision; Horizontal: [{}], Vertical: [{}], Time: [{}]", horizontal_dop, vertical_dop, time_dop)
    }
}
