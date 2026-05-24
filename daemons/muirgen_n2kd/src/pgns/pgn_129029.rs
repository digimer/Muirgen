use deku::prelude::*;
use std::fmt;

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
#[deku(endian = "little")]
pub struct Pgn129029 {
    pub sid: u8,
    pub days_since_1970: u16,
    pub seconds_since_midnight_raw: u32,
    pub latitude_raw: i64,
    pub longitude_raw: i64,
    pub altitude_raw: i64,
    
    // Lower 4 bits: GNSS type, Upper 4 bits: GNSS method
    pub gnss_type_method: u8, 
    
    // Lower 2 bits: Integrity, Upper 6 bits: reserved
    pub integrity: u8,        
    
    pub n_satellites: u8,
    pub hdop_raw: i16,
    pub pdop_raw: i16,
    pub geoidal_separation_raw: i32,
    pub n_reference_stations: u8,
}

impl Pgn129029 {
    pub fn satellites_in_view(&self) -> Option<u8> {
        // 0xFF is the N2K standard for 'Data Not Available' on 8-bit integers
        if self.n_satellites == 0xFF { None } else { Some(self.n_satellites) }
    }
    
    pub fn gnss_method(&self) -> &'static str {
        // Shift right 4 bits to get the method
        let method = (self.gnss_type_method >> 4) & 0x0F;
        match method {
            0 => "No GNSS Fix",      // GNSS = Global Navigation Satellite System
            1 => "GNSS Fix",
            2 => "DGNSS Fix (WAAS)", // Wide Area Augmentation System
            3 => "Precise GNSS",
            4 => "RTK Fixed",        // Real-Time Kinematic
            5 => "RTK Float",
            6 => "Estimated (DR)",   // Dead reckoning
            7 => "Manual Input",
            8 => "Simulated",
            _ => "Unknown",
        }
    }

    // Helper functions 
    pub fn latitude(&self) -> Option<f64> {
        if self.latitude_raw == 0x7FFFFFFFFFFFFFFF { None } else { Some(self.latitude_raw as f64 * 1e-16) }
    }
    
    pub fn longitude(&self) -> Option<f64> {
        if self.longitude_raw == 0x7FFFFFFFFFFFFFFF { None } else { Some(self.longitude_raw as f64 * 1e-16) }
    }

    pub fn altitude(&self) -> Option<f64> {
        if self.altitude_raw == 0x7FFFFFFFFFFFFFFF { None } else { Some(self.altitude_raw as f64 * 1e-6) }
    }
}

// Formatted for human readability.
impl fmt::Display for Pgn129029 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        let sats_in_view = match self.satellites_in_view() {
            Some(count) => count.to_string(),
            None => "Unknown".to_string(),
        };
        write!(format, "Status: [{}], Satellites in View: [{}]", self.gnss_method(), sats_in_view)
    }
}
