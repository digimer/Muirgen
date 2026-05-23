# All alarm entries must have a unique code, and that code must be recorded here.

Alarm code format is: "XXX-yyyyyy". See "Alarm Prefixes" for defined options. The suffix is a six digit simple sequence. 

To avoid collisions, please create a PR to add new codes. 

# Alarm Levels

Alarm levels are set to a numeric value between 1 and 4. The higher the number, the more severe the alarm. Be mindful of alarm fatigue when choosing higher alarm levels. 

1 = Minor / maintenance. 
    Examples; check filter, lowest alert level for tanks, batteries, etc.
2 = Urgent but not critical. 
    Examples: Data aquistion issues that could cause navigation issues (but not collisions). Warning for individual tanks / batteries where peers still have sufficient capacity, etc.
3 = Critical / time sensitive. 
    Example: All tanks / packs low. Data acquisition or processing issues that take safety systems offline, etc.
4 = LIFE CRTIICAL. Use very sparingly, must be extremely urgent!
    Examples; Bilge high water alarms, smoke/fire/co2 alarms, imminent collision risk, etc.


# Alarm prefix

Prefixes for defined alarm types. To add new prefixes, please create a PR. 

- BAT - Battery related alarms (separate from other power systems)
- ENV - Environmental / weather related alarms
- MGN - Muirgen related alarms.
- N2K - NMEA2000 bus related alarms.
- NET - Standard ethernet alarms.
- NAV - Navigation related alarms.
- PRP - Propulsion related alarms.
- PWR - Power systems alarms (separate from battery storage)
- TNK - Liquid/gas tank alarms.

# Defined Alarms

TODO: Move this to YAML and write a tool to inject the YAML to populate the human-readible list below.

NMEA2000 related alarms

## N2K 

N2K-000000 - RESERVED
N2K-000001 - NMEA2000 network device DOWN. Hint: check .env's 'N2K_DEVICE' variable, the can0-n2k systemd service, or the can0/N2K_DEVICE interface.
N2K-000002 - PGN packets no longer arriving. Hint: Cable or bus failure?
