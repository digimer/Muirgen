SET client_encoding = 'UTF8';
-- This doesn't work before 9.3 - CREATE SCHEMA IF NOT EXISTS history;
-- So we'll use the query below until (if) we upgrade.
DO $$
BEGIN
    IF NOT EXISTS(
        SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'history'
    )
    THEN
        EXECUTE 'CREATE SCHEMA history';
    END IF;
END
$$;

-- Enable Asynchronous IO, restart of postgresql required after changing.
ALTER SYSTEM SET io_method = 'io_uring';
ALTER SYSTEM SET effective_io_concurrency = 32;

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_raster;

-- Main vessel data
CREATE TABLE vessels (
        vessel_uuid                uuid           default uuidv7()    not null,
        vessel_name                text                               not null,
        vessel_official_number     text                               not null,
        vessel_hin                 text                               not null,
        vessel_keel_offset         real                               not null, -- Distance from the transducer to the keel (negative number)
        vessel_waterline_offset    real                               not null, -- Distance above the transducer to the waterline
        vessel_notes               text                               not null,
        modified_date              timestamptz    default now()       not null,
        
        PRIMARY KEY (vessel_uuid)
);
ALTER TABLE vessels OWNER TO admin;

CREATE TABLE history.vessels (
        history_id                 bigserial,
        vessel_uuid                uuid,
        vessel_name                text,
        vessel_official_number     text,
        vessel_hin                 text,
        vessel_keel_offset         real, 
        vessel_waterline_offset    real, 
        vessel_notes               text,
        modified_date              timestamptz,
        
        PRIMARY KEY(vessel_uuid)
);
ALTER TABLE history.vessels OWNER TO admin;

CREATE FUNCTION history_vessels() RETURNS trigger
AS $$
DECLARE
    history_vessels RECORD;
BEGIN
    SELECT INTO history_vessels * FROM vessels WHERE vessel_uuid = new.vessel_uuid;
    INSERT INTO history.vessels
        (vessel_uuid,
         vessel_name,
         vessel_official_number,
         vessel_hin,
         vessel_keel_offset, 
         vessel_waterline_offset, 
         vessel_notes,
         modified_date)
    VALUES
        (history_vessels.vessel_uuid,
         history_vessels.vessel_name,
         history_vessels.vessel_official_number,
         history_vessels.vessel_hin,
         history_vessels.vessel_keel_offset, 
         history_vessels.vessel_waterline_offset, 
         history_vessels.vessel_notes,
         history_vessels.modified_date);
    RETURN NULL;
END;
$$
LANGUAGE plpgsql;
ALTER FUNCTION history_vessels() OWNER TO admin;

CREATE TRIGGER trigger_vessels
    AFTER INSERT OR UPDATE ON vessels
    FOR EACH ROW EXECUTE PROCEDURE history_vessels();

-- User accounts
CREATE TABLE users (
        user_uuid        uuid           default uuidv7()    not null,
        user_name        text                               not null,
        user_password    text                               not null,
        user_salt        text                               not null,
        user_is_admin    boolean                            not null,
        user_note        text                               not null,
        modified_date    timestamptz    default now()       not null,
        
        PRIMARY KEY (user_uuid)
);
ALTER TABLE users OWNER TO admin;

CREATE TABLE history.users (
        history_id       bigserial,
        user_uuid        uuid,
        user_name        text,
        user_password    text,
        user_salt        text,
        user_is_admin    boolean,
        user_note        text,
        modified_date    timestamptz
);
ALTER TABLE history.users OWNER TO admin;

CREATE FUNCTION history_users() RETURNS trigger
AS $$
DECLARE
    history_users RECORD;
BEGIN
    SELECT INTO history_users * FROM users WHERE user_uuid = new.user_uuid;
    INSERT INTO history.users
        (user_uuid,
         user_name,
         user_password,
         user_salt,
         user_is_admin,
         user_note,
         modified_date)
    VALUES
        (history_users.user_uuid,
         history_users.user_name,
         history_users.user_password,
         history_users.user_salt,
         history_users.user_is_admin,
         history_users.user_note,
         history_users.modified_date);
    RETURN NULL;
END;
$$
LANGUAGE plpgsql;
ALTER FUNCTION history_users() OWNER TO admin;

CREATE TRIGGER trigger_users
    AFTER INSERT OR UPDATE ON users
    FOR EACH ROW EXECUTE PROCEDURE history_users();

-- Manually entered logs of weather, travel, etc.
CREATE TABLE ships_logs (
        ship_log_uuid                uuid    default uuidv7()    not null,
        ship_log_vessel_uuid         uuid                        not null,
        ship_log_user_uuid           uuid                        not null,
        ship_log_weather_snapshot    jsonb                       not null, -- Created by the UI using the average weather data since the last log entry
        ship_log_vessel_snapshot     jsonb                       not null, -- Created by the UI using the ship metrics; battery states, tank states, etc
        ship_log_location            geography(point, 4326)      not null, -- GPS coordinates when the log was saved.
        ship_log_vessel_status       text                        not null, -- underway, heave-to, at anchor, docked, etc.
        ship_log_sail_plan           text                        not null, -- Reefed, wing on wing, port tack, etc
        ship_log_sea_state           smallint                    not null, -- Beaufort scale; 0 ~ 12, extended to 17 - https://en.wikipedia.org/wiki/Beaufort_scale#Modern_scale
        ship_log_narrative           text                        not null, -- The free-form textual narrative of the log
        modified_date                timestamptz,
        
        PRIMARY KEY(ship_log_uuid),
        FOREIGN KEY(ship_log_vessel_uuid) REFERENCES vessels(vessel_uuid),
        FOREIGN KEY(ship_log_user_uuid) REFERENCES users(user_uuid)
);
ALTER TABLE ships_logs OWNER TO admin;

CREATE TABLE history.ship_logs (
        history_id                   bigserial,
        ship_log_uuid                uuid,
        ship_log_vessel_uuid         uuid, 
        ship_log_user_uuid           uuid, 
        ship_log_weather_snapshot    jsonb, 
        ship_log_vessel_snapshot     jsonb, 
        ship_log_location            geography(point, 4326), 
        ship_log_vessel_status       text, 
        ship_log_sail_plan           text, 
        ship_log_sea_state           smallint, 
        ship_log_narrative           text, 
        modified_date                timestamptz
);
ALTER TABLE history.ship_logs OWNER TO admin;

CREATE INDEX index_ship_logs_location ON ships_logs USING GIST (ship_log_location);
ALTER INDEX index_ship_logs_location OWNER TO admin;

CREATE FUNCTION history_ship_logs() RETURNS trigger
AS $$
DECLARE
    history_ship_logs RECORD;
BEGIN
    SELECT INTO history_ship_logs * FROM ship_logs WHERE ship_log_uuid = new.ship_log_uuid;
    INSERT INTO history.ship_logs
        (ship_log_uuid,
         ship_log_vessel_uuid,
         ship_log_user_uuid,
         ship_log_weather_snapshot,
         ship_log_vessel_snapshot,
         ship_log_location,
         ship_log_vessel_status,
         ship_log_sail_plan,
         ship_log_sea_state,
         ship_log_narrative,
         modified_date)
    VALUES
        (history_ship_logs.ship_log_uuid,
         history_ship_logs.ship_log_vessel_uuid,
         history_ship_logs.ship_log_user_uuid,
         history_ship_logs.ship_log_weather_snapshot,
         history_ship_logs.ship_log_vessel_snapshot,
         history_ship_logs.ship_log_location,
         history_ship_logs.ship_log_vessel_status,
         history_ship_logs.ship_log_sail_plan,
         history_ship_logs.ship_log_sea_state,
         history_ship_logs.ship_log_narrative,
         history_ship_logs.modified_date);
    RETURN NULL;
END;
$$
LANGUAGE plpgsql;
ALTER FUNCTION history_ship_logs() OWNER TO admin;

CREATE TRIGGER trigger_ship_logs
    AFTER INSERT OR UPDATE ON ship_logs
    FOR EACH ROW EXECUTE PROCEDURE history_ship_logs();

-- VHF Radios
CREATE TABLE radios (
        radio_uuid             uuid           default uuidv7()    not null,
        radio_vessel_uuid      uuid                               not null,
        radio_make             text                               not null,
        radio_model            text                               not null,
        radio_mmsi             text                               not null,
        radio_serial_number    text                               not null,
        radio_power            text                               not null,
        radio_has_dsc          boolean                            not null,
        radio_has_gps          boolean                            not null,
        radio_has_ais_rx       boolean                            not null,
        radio_has_ais_tx       boolean                            not null,
        radio_is_portable      boolean                            not null,
        radio_note             text                               not null,
        modified_date          timestamptz    default now()       not null,

        FOREIGN KEY(radio_vessel_uuid) REFERENCES vessels(vessel_uuid),
        PRIMARY KEY(radio_uuid)
);
ALTER TABLE radios OWNER TO admin;

CREATE TABLE history.radios (
        history_id             bigserial,
        radio_uuid             uuid,
        radio_vessel_uuid      uuid,
        radio_make             text,
        radio_model            text,
        radio_mmsi             text,
        radio_serial_number    text,
        radio_power            text,
        radio_has_dsc          boolean,
        radio_has_gps          boolean,
        radio_has_ais_rx       boolean,
        radio_has_ais_tx       boolean,
        radio_is_portable      boolean,
        radio_note             text,
        modified_date          timestamptz
);
ALTER TABLE history.radios OWNER TO admin;

CREATE FUNCTION history_radios() RETURNS trigger
AS $$
DECLARE
    history_radios RECORD;
BEGIN
    SELECT INTO history_radios * FROM radios WHERE radio_uuid = new.radio_uuid;
    INSERT INTO history.radios
        (radio_uuid,
         radio_vessel_uuid,
         radio_make,
         radio_model,
         radio_mmsi,
         radio_serial_number,
         radio_power,
         radio_has_dsc,
         radio_has_gps,
         radio_has_ais_rx,
         radio_has_ais_tx,
         radio_is_portable,
         radio_note,
         modified_date)
    VALUES
        (history_radios.radio_uuid,
         history_radios.radio_vessel_uuid,
         history_radios.radio_make,
         history_radios.radio_model,
         history_radios.radio_mmsi,
         history_radios.radio_serial_number,
         history_radios.radio_power,
         history_radios.radio_has_dsc,
         history_radios.radio_has_gps,
         history_radios.radio_has_ais_rx,
         history_radios.radio_has_ais_tx,
         history_radios.radio_is_portable,
         history_radios.radio_note,
         history_radios.modified_date);
    RETURN NULL;
END;
$$
LANGUAGE plpgsql;
ALTER FUNCTION history_radios() OWNER TO admin;

CREATE TRIGGER trigger_radios
    AFTER INSERT OR UPDATE ON radios
    FOR EACH ROW EXECUTE PROCEDURE history_radios();

-- Crew (separate from users)
CREATE TABLE crew (
        crew_uuid            uuid           default uuidv7()    not null,
        crew_vessel_uuid     uuid                               not null,
        crew_name            text                               not null,
        crew_image           text                               not null,
        crew_position        text                               not null,
        crew_contact_info    text                               not null,
        crew_disembarked     text                               not null,
        crew_note            text                               not null,
        modified_date        timestamptz    default now()       not null,

        FOREIGN KEY(crew_vessel_uuid) REFERENCES vessels(vessel_uuid),
        PRIMARY KEY(crew_uuid)
);
ALTER TABLE crew OWNER TO admin;

CREATE TABLE history.crew (
        history_id           bigserial,
        crew_uuid            uuid,
        crew_vessel_uuid     uuid,
        crew_name            text,
        crew_image           text,
        crew_position        text,
        crew_contact_info    text,
        crew_disembarked     text,
        crew_note            text,
        modified_date        timestamptz
);
ALTER TABLE history.crew OWNER TO admin;

CREATE FUNCTION history_crew() RETURNS trigger
AS $$
DECLARE
    history_crew RECORD;
BEGIN
    SELECT INTO history_crew * FROM crew WHERE crew_uuid = new.crew_uuid;
    INSERT INTO history.crew
        (crew_uuid,
         crew_vessel_uuid,
         crew_name,
         crew_image,
         crew_position,
         crew_contact_info, 
         crew_disembarked,
         crew_note,
         modified_date)
    VALUES
        (history_crew.crew_uuid,
         history_crew.crew_vessel_uuid,
         history_crew.crew_name,
         history_crew.crew_image,
         history_crew.crew_position,
         history_crew.crew_contact_info, 
         history_crew.crew_disembarked,
         history_crew.crew_note,
         history_crew.modified_date);
    RETURN NULL;
END;
$$
LANGUAGE plpgsql;
ALTER FUNCTION history_crew() OWNER TO admin;

-- Tables below here are frequently updated, so are handled differently and don't have history schema tables.

-- Store raw PGN traffic. This will generate a massive amount of data and we'll likely rarely ever read it
-- back, save for debugging. So no index and no WAL. Partiioned daily for faster/easier purging of old 
-- records.
CREATE TABLE n2k_traffic (
        n2k_traffic_uuid           uuid           default uuidv7()    not null,
        n2k_traffic_vessel_uuid    uuid                               not null,
        n2k_traffic_pgn            integer                            not null,
        n2k_traffic_source_id      smallint                           not null,
        n2k_traffic_priority       smallint                           not null,
        n2k_traffic_payload        bytea                              not null,
        time                       timestamptz    default now()       not null,

        -- PK must include the column used for partitioning
        PRIMARY KEY (time, n2k_traffic_uuid),
        FOREIGN KEY(n2k_traffic_vessel_uuid) REFERENCES vessels(vessel_uuid)
) PARTITION BY RANGE (time);
ALTER TABLE n2k_traffic OWNER TO admin;

-- This will be a fast growing table, so it is going to be partitioned the same as n2k_traffic
CREATE TABLE motions (
        motion_uuid                  uuid           default uuidv7()    not null,
        motion_vessel_uuid           uuid                               not null,
        motion_source                text                               not null,
        -- Accelerometer (m/s^2) - For Slamming and Heave
        motion_accelerometer_x       real                               not null, 
        motion_accelerometer_y       real                               not null, 
        motion_accelerometer_z       real                               not null,
        -- Gyroscope (deg/s) - Crucial for the Autopilot's "Rate of Turn"
        motion_gyroscope_x           real                               not null, 
        motion_gyroscope_y           real                               not null, 
        motion_gyroscope_z           real                               not null,
        -- Processed Orientation (Degrees)
        motion_pitch                 real                               not null,
        motion_roll                  real                               not null,
        motion_heading_magnetic      real                               not null,
        -- Other data from the 200WX
        motion_rate_of_turn          real                               not null,
        motion_speed_over_ground     real                               not null,
        motion_course_over_ground    real                               not null,
        motion_heave                 real                               not null,
        -- Possibly useful for diagnostics
        motion_gps_quality           jsonb                              not null,
        motion_sensor_voltage        real                               not null,
        time                         timestamptz    default now()       not null,

        PRIMARY KEY (time, motion_uuid),
        FOREIGN KEY(motion_vessel_uuid) REFERENCES vessels(vessel_uuid)
) PARTITION BY RANGE (time);
ALTER TABLE motions OWNER TO admin;

-- View to quickly access the most recent cell data.
CREATE OR REPLACE VIEW motions_current AS SELECT DISTINCT ON (motion_source) * FROM motions ORDER BY motion_source, time DESC;
ALTER VIEW motion_current OWNER TO admin;

-- This will be a fast growing table whenever under motor power. This stores motor (and it's controller) data. 
CREATE TABLE motors (
        motor_uuid                uuid             default uuidv7()    not null,
        motor_vessel_uuid         uuid                                 not null,
        motor_source              text                                 not null,
        motor_voltage             real                                 not null, -- Bus Voltage (V)
        motor_current_dc          real                                 not null, -- Positive = Consuming, Negative = Regen
        motor_watts               real GENERATED ALWAYS AS (motor_voltage * motor_current_dc) VIRTUAL,
        motor_current_phase       real                                 not null, -- Peak phase current (A)
        motor_gear_ratio          real                                 not null, -- 
        motor_rpm                 smallint                             not null, -- Positive = Forward, Negative = Reverse
        motor_throttle_raw        real                                 not null, -- Raw voltage (e.g., 0.0 to 5.0V)
        motor_throttle_percent    real                                 not null, -- Calculated -100% to +100%
        motor_speed_mode          text                                 not null, -- 'low', 'medium', 'high'
        motor_error_code          smallint                             not null, -- Diagnostic
        time                      timestamptz    default now()         not null,

        PRIMARY KEY (time, motor_uuid),
        FOREIGN KEY(motor_vessel_uuid) REFERENCES vessels(vessel_uuid)
) PARTITION BY RANGE (time);
ALTER TABLE motors OWNER TO admin;

-- View to quickly access the most recent cell data.
CREATE OR REPLACE VIEW motors_current AS SELECT DISTINCT ON (motor_source) * FROM motors ORDER BY motor_source, time DESC;
ALTER VIEW motor_current OWNER TO admin;

-- Calculate Shaft RPM for propeller analysis
-- Calculate Watts per Shaft Revolution (Load Metric)
CREATE OR REPLACE VIEW propulsion_efficiency AS
SELECT time, motor_source, (motor_rpm / motor_gear_ratio) AS shaft_rpm, ((motor_voltage * motor_current_dc) / NULLIF(ABS(motor_rpm / motor_gear_ratio), 0)) AS watts_per_rev FROM motors;

-- Motor:10kW:Controller
-- Motor:10kW:Winding
-- Motor:5kW:Controller
-- Motor:5kW:Winding
CREATE OR REPLACE VIEW motor_health_summary AS
SELECT m.time, m.motor_source, m.motor_voltage, m.motor_current_dc, m.motor_rpm, ct.temperature_value AS controller_temp, wt.temperature_value AS motor_temp
FROM motors m
-- Nearest Controller Temp
LEFT JOIN LATERAL (
    SELECT temperature_value 
    FROM temperatures t
    WHERE t.temperature_source = m.motor_source || ':Controller'
      AND t.time BETWEEN m.time - INTERVAL '5 seconds' AND m.time + INTERVAL '5 seconds'
    ORDER BY ABS(EXTRACT(EPOCH FROM (t.time - m.time))) ASC
    LIMIT 1
) ct ON true
-- Nearest Winding Temp
LEFT JOIN LATERAL (
    SELECT temperature_value 
    FROM temperatures t
    WHERE t.temperature_source = m.motor_source || ':Winding'
      AND t.time BETWEEN m.time - INTERVAL '5 seconds' AND m.time + INTERVAL '5 seconds'
    ORDER BY ABS(EXTRACT(EPOCH FROM (t.time - m.time))) ASC
    LIMIT 1
) wt ON true;

-- Depth sounder data
CREATE TABLE depths (
        depth_uuid            uuid           default uuidv7()    not null,
        depth_vessel_uuid     uuid                               not null,
        depth_source          text                               not null, -- ie: 'dst810:<serial_number>'
        depth_measured        real                               not null, -- Use vessel_keel_offset and vessel_waterline_offset to display depth below keel and water depth
        depth_quality         smallint                           not null, -- 0~100 (percent confidence), filter out values below 50.
        depth_sensor_roll     real                               not null, 
        depth_sensor_pitch    real                               not null,
        time                     timestamptz    default now()    not null,

        PRIMARY KEY(depth_uuid), 
        FOREIGN KEY(depth_vessel_uuid) REFERENCES vessels(vessel_uuid)
);
ALTER TABLE depths OWNER TO admin;

-- View to quickly access the most recent cell data.
CREATE OR REPLACE VIEW depths_current AS SELECT DISTINCT ON (depth_source) * FROM depths ORDER BY depth_source, time DESC;
ALTER VIEW depths_current OWNER TO admin;

-- Corrects for the sensor's tilt to find the true vertical depth
-- 1. depth_vertical        - Vertical correction for heel/pitch (Geometric depth)
-- 2. depth_below_keel      - Depth Below Keel (DBK) = Measured + (Negative Keel Offset)
-- 3. depth_below_waterline - Depth Below Waterline (DBW) = Measured + (Positive Waterline Offset)
CREATE OR REPLACE VIEW depth_navigator AS SELECT d.*, v.vessel_name,
    (d.depth_measured * cos(radians(d.depth_sensor_roll)) * cos(radians(d.depth_sensor_pitch))) AS depth_vertical,
    (d.depth_measured + v.vessel_keel_offset) AS depth_below_keel,
    (d.depth_measured + v.vessel_waterline_offset) AS depth_below_waterline
FROM depths d JOIN vessels v ON d.depth_vessel_uuid = v.vessel_uuid;
ALTER VIEW depth_corrected OWNER TO admin;

-- Indexing for spatial and time-series performance
CREATE INDEX index_depths_latest ON depths (depth_source, time DESC);
ALTER INDEX index_depths_latest OWNER TO admin;

-- Temperature Data
CREATE TABLE temperatures (
        temperature_uuid           uuid           not null,
        temperature_vessel_uuid    uuid           not null,
        temperature_source         text           not null, -- Source + Name
        temperature_value          real           not null, -- Celcius (converted from Kelvin, -273.15)
        time                       timestamptz    not null,

        PRIMARY KEY(time, temperature_vessel_uuid, temperature_source),
        FOREIGN KEY(temperature_vessel_uuid) REFERENCES vessels(vessel_uuid)
);
ALTER TABLE temperatures OWNER TO admin;

-- Use a View for your real-time dashboard
CREATE OR REPLACE VIEW temperatures_current AS SELECT DISTINCT ON (temperature_source) * FROM temperatures ORDER BY temperature_source, time DESC;
ALTER VIEW temperatures_current OWNER TO admin;

CREATE INDEX index_temperatures_latest ON temperatures (temperature_source, time DESC);
ALTER INDEX index_temperatures_latest OWNER TO admin;


-- Wind
-- Note: GRIB weather data uses ground speed/direction, so calculating our ground speed/direction allows us 
--       to compare, acts as a backup in case the speed wheel fouls and throws true off, and helps plan for
--       anchoring. Comparing true and ground also allows for calculating the current vector (delta is 
--       current).
-- ToDo: Corrolate the drift knots and compare against barrometric changes. This can be used to predict
--       storms.
CREATE TABLE winds (
        wind_uuid                  uuid           default uuidv7()    not null,
        wind_vessel_uuid           uuid                               not null,
        wind_source                text                               not null,
        wind_true_speed            real                               not null, -- Stored as m/s, relative to the speed over water
        wind_true_direction        real                               not null, -- 0~359 degree from true North, 0.1 degree resolution
        wind_ground_speed          real                               not null, -- Stored as m/s, relative to the speed over ground
        wind_ground_direction      real                               not null, -- 0~359 degrees from true North
        wind_apparent_speed        real                               not null, -- Stored as m/s
        wind_apparent_direction    real                               not null, -- 0~359 degree from the bow
        time                       timestamptz    default now()       not null,
        
        -- Constraints to prevent "impossible" sensor data
        CONSTRAINT check_true_direction CHECK (wind_true_direction >= 0 AND wind_true_direction < 360),
        CONSTRAINT check_apparent_direction  CHECK (wind_apparent_direction >= 0 AND wind_apparent_direction < 360),

        PRIMARY KEY(wind_uuid),
        FOREIGN KEY(wind_vessel_uuid) REFERENCES vessels(vessel_uuid)
);
ALTER TABLE winds OWNER TO admin;

-- Use a View for your real-time dashboard
CREATE OR REPLACE VIEW wind_current AS SELECT DISTINCT ON (wind_source) * FROM winds ORDER BY wind_source, time DESC;
ALTER VIEW wind_current OWNER TO admin;

CREATE INDEX index_winds_latest ON winds (wind_source, time DESC);
ALTER INDEX index_winds_latest OWNER TO admin;

-- Weather Data
CREATE TABLE weather (
        weather_uuid                 uuid                      default uuidv7()    not null,
        weather_vessel_uuid          uuid                                          not null,
        weather_source               text                                          not null, -- Likely to only be '200WX:<serial_number>', but this accounts for further weather sources in the future
        weather_location             geography(point, 4326)                        not null, -- GPS coordinates when the weather was read.
        weather_pressure             real                                          not null, -- In hpa, 0.1 hpa resolution
        weather_station_height       real                                          not null, -- In meters, height above the water line
        weather_air_temp             real                                          not null, -- In C, 0.1 degree
        weather_relative_humidity    real                                          not null, -- 0.1% resolution
        weather_dew_point            real                                          not null, -- In C
        weather_heat_index           real                                          not null, -- "Feels like" humidex
        weather_wind_chill           real                                          not null, -- "Feels like" wind chill
        weather_station_pitch        real                                          not null, -- +/- 1 degree accuracy
        weather_station_roll         real                                          not null, -- +/- 1 degree accuracy
        weather_station_heading      real                                          not null, -- GPS heading
        time                         timestamptz               default now()       not null,
        
        PRIMARY KEY(weather_uuid),
        FOREIGN KEY(weather_vessel_uuid) REFERENCES vessels(vessel_uuid)
);
ALTER TABLE weather OWNER TO admin;

-- View to quickly access the most recent weather data.
CREATE OR REPLACE VIEW weather_current AS SELECT DISTINCT ON (weather_source) * FROM weather ORDER BY weather_source, time DESC;
ALTER VIEW weather_current OWNER TO admin;

-- Indexing for spatial and time-series performance
CREATE INDEX index_weather_time ON weather (time DESC);
CREATE INDEX index_weather_location ON weather USING GIST(weather_location);
ALTER INDEX index_weather_time OWNER TO admin;
ALTER INDEX index_weather_location OWNER TO admin;

-- The 'Live' view for the FUI
CREATE VIEW weather_latest AS SELECT DISTINCT ON (weather_uuid) * FROM weather ORDER BY weather_uuid, time DESC;
ALTER VIEW weather_latest OWNER TO admin;

-- NOTE: Battery temperature data will be stored in the 'temperatures' table with the source being
--       'battery:<group>:<number>:sensor name'.
-- Battery Banks
CREATE TABLE batteries (
        battery_uuid                  uuid           default uuidv7()    not null,
        battery_vessel_uuid           uuid                               not null,
        battery_nominal_voltage       real                               not null, -- 12.8v or 51.2v
        battery_voltage               real                               not null, -- Current pack voltage
        battery_current               real                               not null, -- Current amperage, positive = discharge, negative = charge.
        battery_source                text                               not null, -- Propulsion:x, House:y, etc
        battery_note                  text                               not null, -- General comment section for notes
        battery_label_capacity        real                               not null, -- Capacity when new, ie: 280 (Ah)
        battery_last_capacity         real                               not null, -- The realised capacity at the last full discharge, used to calculate a more accurate estimated remaining charge
        battery_state_of_charge       real                               not null, -- The state of charge as reported by the BMS on the battery.
        time                          timestamptz    default now()       not null,

        PRIMARY KEY(battery_uuid),
        FOREIGN KEY(battery_vessel_uuid) REFERENCES vessels(vessel_uuid)
);
ALTER TABLE batteries OWNER TO admin;

-- View to quickly access the most recent battery pack data.
CREATE OR REPLACE VIEW batteries_current_data AS SELECT DISTINCT ON (battery_source) * FROM batteries ORDER BY battery_source, time DESC;
ALTER VIEW batteries_current_data OWNER TO admin;

-- Indexing for spatial and time-series performance
CREATE INDEX index_batteries_latest ON batteries (battery_source, time DESC);
ALTER INDEX index_batteries_latest OWNER TO admin;

-- Battery cells.
CREATE TABLE cells (
        cell_uuid            uuid           default uuidv7()    not null,
        cell_battery_uuid    uuid                               not null,
        cell_source          text                               not null, -- Generally the cell ID, ie: 6:1 for pack 6 cell 1
        cell_voltage         real                               not null, -- individual cell voltage, as reported by the BMS
        time                 timestamptz    default now()       not null, 
        
        PRIMARY KEY(cell_uuid),
        FOREIGN KEY(cell_battery_uuid) REFERENCES batteries(battery_uuid)
);
ALTER TABLE cells OWNER TO admin;

-- View to quickly access the most recent cell data.
CREATE OR REPLACE VIEW cells_current AS SELECT DISTINCT ON (cell_source) * FROM cells ORDER BY cell_source, time DESC;
ALTER VIEW cells_current OWNER TO admin;

-- Indexing for spatial and time-series performance
CREATE INDEX index_cells_latest ON cells (cell_source, time DESC);
ALTER INDEX index_cells_latest OWNER TO admin;

-- Liquid tanks
CREATE TABLE tanks (
        tank_uuid                uuid           default uuidv7()    not null,
        tank_vessel_uuid         uuid                               not null,
        tank_source              text                               not null, -- ie: 'Nav Area Diesel', 'Port Settee Water'
        tank_type                text                               not null, -- 'diesel', 'water', etc
        tank_level_litres        real                               not null,
        tank_capacity_litres     real                               not null,
        time                     timestamptz    default now()       not null,

        PRIMARY KEY(tank_uuid), 
        FOREIGN KEY(tank_vessel_uuid) REFERENCES vessels(vessel_uuid)
);
ALTER TABLE tanks OWNER TO admin;

-- View to quickly access the most recent cell data.
CREATE OR REPLACE VIEW tanks_current AS SELECT DISTINCT ON (tank_source) * FROM tanks ORDER BY tank_source, time DESC;
ALTER VIEW tanks_current OWNER TO admin;

-- Indexing for spatial and time-series performance
CREATE INDEX index_tanks_latest ON tanks (tank_source, time DESC);
ALTER INDEX index_tanks_latest OWNER TO admin;

-- This is not likely to be recorded to that often, so not creating indexes or views yet.
CREATE TABLE events (
        event_uuid           uuid           default uuidv7()    not null,
        event_vessel_uuid    uuid                               not null,
        event_source         text                               not null, -- ie: 'MR Autopilot'
        event_type           text                               not null, -- ie: 'calibration', 'tare', 'boot', etc
        event_details        jsonb                              not null, -- ie: {"pitch_offset": 2.1, "roll_offset": -0.5}
        time                 timestamptz    default now()       not null,

        PRIMARY KEY(event_uuid), 
        FOREIGN KEY(event_uuid) REFERENCES vessels(vessel_uuid)
);
ALTER TABLE events OWNER TO admin;
