use deku::prelude::*;
use std::fmt;

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
#[deku(endian = "little")]
pub struct Pgn126996 {
    pub n2k_version: u16,
    pub product_code: u16,
    
    // NMEA 2000 strings are 32 bytes, padded with 0xFF or 0x00
    pub model_id_bytes: [u8; 32],
    pub software_version_bytes: [u8; 32],
    pub model_version_bytes: [u8; 32],
    pub serial_code_bytes: [u8; 32],
    pub certification_level: u8,
    pub load_equivalency: u8,
}

impl Pgn126996 {
    // Helper function to safely extract padded NMEA 2000 strings
    fn clean_string(bytes: &[u8]) -> String {
        let clean_bytes: Vec<u8> = bytes.iter()
            .copied()
            .take_while(|&b| b != 0x00 && b != 0xFF) // Stop at the padding
            .collect();
        String::from_utf8_lossy(&clean_bytes).trim().to_string()
    }

    pub fn model_id(&self) -> String {
        Self::clean_string(&self.model_id_bytes)
    }

    pub fn software_version(&self) -> String {
        Self::clean_string(&self.software_version_bytes)
    }

    pub fn serial_code(&self) -> String {
        Self::clean_string(&self.serial_code_bytes)
    }
}

// Human-readable formatted string
impl fmt::Display for Pgn126996 {
    fn fmt(&self, format: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            format, 
            "Model: [{}], Software: [{}], Serial: [{}]", 
            self.model_id(),
            self.software_version(),
            self.serial_code()
        )
    }
}
