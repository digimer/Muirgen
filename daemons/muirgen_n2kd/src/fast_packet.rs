// Fastpacket handling (multi-packet messages)
use std::collections::HashMap;

pub struct FastPacketBuffer {
    sequence_id: u8,
    total_bytes: usize,
    data: Vec<u8>,
}

pub struct FastPacketReassembler {
    // Maps (source address, PGN) to active buffer
    buffers: HashMap<(u8, u32), FastPacketBuffer>,
}

impl FastPacketReassembler {
    pub fn new() -> Self {
        Self {
            buffers: HashMap::new(),
        }
    }

    // Process an incoming CAN frame.
    pub fn process_frame(&mut self, source_address: u8, pgn: u32, data: &[u8]) -> Option<Vec<u8>> {
        if data.is_empty() { return None; }

        // Fast Packet framing byte:
        // High 3 bits = Sequence Counter
        // Low 5 bits  = Frame index (0 to 31)
        let sequence_id = (data[0] & 0xE0) >> 5;
        let frame_index = data[0] & 0x1F;
        let key         = (source_address, pgn);

        if frame_index == 0 {
            // First frame. The first byte indicates the total fast packet 
            // size, followed by 6 data bytes.
            if data.len() < 2 { return None; }
            let total_bytes = data[1] as usize;
            let mut payload = Vec::with_capacity(total_bytes);
            
            // Append bytes 2+
            payload.extend_from_slice(&data[2..]);

            // Handle the off chance the entire fast packet was <6 bytes.
            if total_bytes <= payload.len() {
                payload.truncate(total_bytes);
                return Some(payload);
            }

            self.buffers.insert(key, FastPacketBuffer {
                sequence_id, 
                total_bytes, 
                data: payload,
            });
        } else {
            // Subsequent frames for an open FastPacket. Each frame is up to 7
            // bytes.
            if let Some(mut buffer) = self.buffers.remove(&key) {
                // Ensure this is part of the same sequence
                if buffer.sequence_id == sequence_id {
                    buffer.data.extend_from_slice(&data[1..]);

                    if buffer.data.len() >= buffer.total_bytes {
                        // Target size reached. Truncate padding bytes.
                        buffer.data.truncate(buffer.total_bytes);
                        return Some(buffer.data);
                    } else {
                        // Not done yet.
                        self.buffers.insert(key, buffer);
                    }
                }
            }
        }

        // Not done yet.
        None
    }
}
