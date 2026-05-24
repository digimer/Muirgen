// Position, Rapid Update
use deku::prelude::*;
use std::fmt;

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
#[deku(endian = "little")]
pub struct Pgn129025 {
    pub latitude_raw: i32,
    pub longitude_raw: i32,
}

impl Pgn129025 {
    pub fn latitude(&self) -> Option<f64> {
        // 0x7FFFFFFF is the NMEA 2000 standard for "Data Not Available"
        if self.latitude_raw == 0x7FFFFFFF {
            None
        } else {
            // NMEA 2000 resolution is 1e-7 degrees
            Some(self.latitude_raw as f64 * 1e-7)
        }
    }

    pub fn longitude(&self) -> Option<f64> {
        if self.longitude_raw == 0x7FFFFFFF {
            None
        } else {
            Some(self.longitude_raw as f64 * 1e-7)
        }
    }
}

// Human-readable formatted string
impl fmt::Display for Pgn129025 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        let latitude_string = match self.latitude() {
            Some(latitude_string) => format!("{:.7}°", latitude_string),
            None => "No Sat Lock!".to_string(),
        };
        let longitude_string = match self.longitude() {
            Some(longitude_string) => format!("{:.7}°", longitude_string),
            None => "No Sat Lock!".to_string(),
        };

        write!(format, "Lat: [{}], Lon: [{}]", latitude_string, longitude_string)
    }
}
