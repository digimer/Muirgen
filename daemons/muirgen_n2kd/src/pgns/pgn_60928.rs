// ISO Address Claim
use deku::prelude::*;
use std::fmt;

#[derive(Debug, PartialEq, DekuRead)]
#[deku(endian = "little")]
pub struct Pgn60928 {
    // The entire 64-bit ISO Address Claim NAME
    pub name: u64,
}

impl Pgn60928 {
    // Extract the 21-bit Unique Number (Often the Serial Number)
    pub fn unique_number(&self) -> u32 {
        (self.name & 0x1FFFFF) as u32
    }

    // Extract the 11-bit Manufacturer Code
    pub fn manufacturer_code(&self) -> u16 {
        ((self.name >> 21) & 0x7FF) as u16
    }

    // Extract the 8-bit Device Instance (Lower 3 bits + Upper 5 bits)
    pub fn device_instance(&self) -> u8 {
        ((self.name >> 32) & 0xFF) as u8
    }

    // Extract the 8-bit Device Function
    pub fn device_function(&self) -> u8 {
        ((self.name >> 40) & 0xFF) as u8
    }

    // Extract the 7-bit Device Class (Skipping bit 48 which is reserved)
    pub fn device_class(&self) -> u8 {
        ((self.name >> 49) & 0x7F) as u8
    }
}

// Human-readable formatted version of the data.
impl fmt::Display for Pgn60928 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            format, 
            "Name: [{}] - Manufacturer: [{}], Class: [{}], Function: [{}], Instance: [{}], Unique ID: [{}]", 
            self.name,
            self.manufacturer_code(),
            self.device_class(),
            self.device_function(),
            self.device_instance(),
            self.unique_number()
        )
    }
}
