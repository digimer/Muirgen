// This is the (deprecated) single frame Environmental Parameters PGN

use deku::prelude::*;
use std::fmt;

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
#[deku(endian = "little")]
pub struct Pgn130311 {
    pub seq_id: u8,

    #[deku(bits = "2")]
    pub temp_instance: u8, 

    #[deku(bits = "2")]
    pub humidity_instance: u8,

    #[deku(bits = "4")]
    pub reserved: u8,

    // The actual values
    pub temperature: u16,
    pub humidity: u16,
    pub atmospheric_pressure: u16,
}

// Parse atmospheric data
impl Pgn130311 {
    // Note: 0xFFFF means an invalid / corrupt value and should be ignored.
    // Return the temperature in Kelvin, 0.01 K precision
    pub fn temperature_kelvin(&self) -> Option<f32> {
        if self.temperature >= 0xFFFE { None } else { Some(self.temperature as f32 * 0.01) }
    }

    // Return the humidity as a percentage, precision is 0.004%.
    pub fn humidity_percent(&self) -> Option<f32> {
        if self.humidity >= 0xFFFE { None } else { Some(self.humidity as f32 * 0.004) }
    }

    // Atmospheric pressure in Pascals, resolution is 100 Pa.
    pub fn pressure_pascals(&self) -> Option<f32> {
        if self.atmospheric_pressure >= 0xFFFE { None } else { Some(self.atmospheric_pressure as f32 * 100.0) }
    }
}

// Convert to human-readible values for display only.
impl fmt::Display for Pgn130311 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Convert K to C
        let say_temp_c = self.temperature_kelvin()
            .map(|kelvin| format!("{:.2}°C", kelvin - 273.15))
            .unwrap_or_else(|| "N/A".to_string());
        
        // Just append a % sign
        let say_humidity = self.humidity_percent()
            .map(|humidity| format!("{:.1}%", humidity))
            .unwrap_or_else(|| "N/A".to_string());
        
        // Convert Pascals to hPa (Pascals / 100)
        let say_pressure = self.pressure_pascals()
            .map(|pascals| format!("{:.0} hPa", pascals / 100.0))
            .unwrap_or_else(|| "N/A".to_string());

        // Log the reading to the console.
        write!(format, "Temperature: [{}]/[{}], Humidity: [{}]/[{}], Pressure: [{}]", self.temperature, say_temp_c, self.humidity, say_humidity, say_pressure)
    }
}
