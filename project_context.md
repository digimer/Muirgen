Muirgen Project Context

Project Goal: Open-source telemetry-heavy DB & UI for a 1981 C&C Landfall 38 (Electric Conversion). Design Priority: Safety > UX > Power Efficiency > 80s Cassette Futurism Aesthetic. Visuals: Monochrome Red (620nm filter compatible).

Hardware Stack:
* Compute: RPi4 (N2K I/O via PiCAN-M HAT) + RPi5 (PostgreSQL 18.1, Node.js/Vite/React UI, 1TB NVMe). Physical Ethernet link.
* Propulsion: STM32 G474RE Helm Controller (Dual CAN to Kelly KLS controllers). Motors: 10kW (Power) & 5kW (Range).
* Throttle: Single active helm module; supports redundant inputs (Port/Stbd/Remote) with manual failover.
* Peripherals: 3x STM32 C092KC modules (Compass Rose/LCD, Wind/Compass, Relay/Digital Switching, Battery/ABYC SoC Monitor).

Data Environment:
* Protocol: Pure NMEA 2000 (DST810, 200WX, IC-M510 AIS, B954 AIS). No NMEA 0183.
* Database: PostgreSQL schema handles active sensors + future-proofing for tank/lightning sensors.

User Profile:
* Background: SysAdmin / HA / Perl / Postgres.
* Learning: New to Node.js, React, and modern Vite-based web dev.
