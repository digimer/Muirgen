// System Time
use deku::prelude::*;
use std::fmt;

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
#[deku(endian = "little")]
pub struct Pgn126992 {
    pub sid: u8,
    #[deku(bits = "4")]
    pub reserved: u8,
    #[deku(bits = "4")]
    pub time_source: u8,
    pub date: u16, // Days since 1970-01-01
    pub time: u32, // Seconds since midnight, 0.0001s resolution
}

impl Pgn126992 {
    // Return the time source string representation
    pub fn source_name(&self) -> &'static str {
        match self.time_source {
            0 => "GPS",
            1 => "GLONASS",
            2 => "Radio Station",
            3 => "Local Cesium Clock",
            4 => "Local Rubidium Clock",
            5 => "Local Crystal Clock",
            _ => "Unknown",
        }
    }

    // Convert date and time to a f64 Unix Timestamp. If there is no data, date
    // sets 0xFFFF and time sets 0xFFFFFFFF.
    pub fn unix_timestamp(&self) -> Option<f64> {
        if self.date == 0xFFFF || self.time == 0xFFFFFFFF {
            return None;
        }
        
        let days_seconds = (self.date as f64) * 86400.0;
        let time_seconds = (self.time as f64) * 0.0001;
        
        Some(days_seconds + time_seconds)
    }
}

impl fmt::Display for Pgn126992 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        let timestamp_string = match self.unix_timestamp() {
            Some(timestamp) => format!("{:.4}", timestamp),
            None => "Unavailable".to_string(),
        };
        write!(format, "Time Source: [{}], Unix Timestamp: [{}]", self.source_name(), timestamp_string)
    }
}
