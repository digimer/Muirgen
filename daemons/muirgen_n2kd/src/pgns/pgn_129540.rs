// Satellites in View
use deku::prelude::*;
use std::fmt;
use serde_json::{json, Value};

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
// Let this inherit the endianess
#[deku(endian = "little")]
pub struct SatelliteInfo {
    pub prn: u8,
    pub elevation: i16,
    pub azimuth: u16,
    pub snr: i16,
    pub range_residuals: i32,
    #[deku(bits = "4")]
    pub prn_status: u8,
    #[deku(bits = "4")]
    pub elevation_status: u8,
}

// Endianess not devices as all u8 and causes conflicts with above.
#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
pub struct Pgn129540 {
    pub seq_id: u8,
    #[deku(bits = "6")]
    pub reserved1: u8,
    #[deku(bits = "2")]
    pub mode: u8,
    // svs = space vehicles
    pub number_of_svs: u8,
    #[deku(count = "number_of_svs")]
    pub svs: Vec<SatelliteInfo>,
}

impl Pgn129540 {
    // Pack the satellite data into a JSONB-ready structure
    pub fn to_json(&self) -> Value {
        let satellites: Vec<Value> = self.svs.iter().map(|sat| {
            let elevation = if sat.elevation == 0x7FFF { None } else { Some((sat.elevation as f32 * 0.0001).to_degrees()) };
            let azimuth   = if sat.azimuth == 0xFFFF { None } else { Some((sat.azimuth as f32 * 0.0001).to_degrees()) };
            let snr       = if sat.snr == 0x7FFF { None } else { Some(sat.snr as f32 * 0.01) };
            
            json!({
                "prn": sat.prn,
                "elevation": elevation,
                "azimuth": azimuth,
                "snr": snr,
                "status": sat.prn_status,
            })
        }).collect();
        
        json!(satellites)
    }
}

impl fmt::Display for Pgn129540 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(format, "GNSS Skyview; Satellite Vehicles in View: [{}]", self.number_of_svs)
    }
}
