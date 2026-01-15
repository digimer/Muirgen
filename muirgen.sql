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

-- Password storage
CREATE EXTENSION pgcrypto;

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_raster;

-- Main vessel data
CREATE TABLE vessels (
        uuid                uuid           default uuidv7()    not null,
        name                text                               not null,
        flag_nation         text                               not null,
        port_of_registry    text                               not null,
        build_details       text                               not null, -- Year, Make, Model
        official_number     text                               not null,
        hull_id_number      text                               not null,
        keel_offset         real                               not null, -- Distance from the transducer to the keel (negative number)
        waterline_offset    real                               not null, -- Distance above the transducer to the waterline
        modified_date       timestamptz    default now()       not null,
        
        PRIMARY KEY (uuid)
);
ALTER TABLE vessels OWNER TO admin;

CREATE TABLE history.vessels (
        history_id          bigint GENERATED ALWAYS AS IDENTITY,
        uuid                uuid,
        name                text,
        flag_nation         text,
        port_of_registry    text,
        build_details       text,
        official_number     text,
        hull_id_number      text,
        keel_offset         real, 
        waterline_offset    real, 
        modified_date       timestamptz
);
ALTER TABLE history.vessels OWNER TO admin;

CREATE OR REPLACE FUNCTION history_vessels() RETURNS trigger AS $$
BEGIN
    INSERT INTO history.vessels (
        uuid, 
        name, 
        flag_nation,
        port_of_registry,
        build_details,
        official_number, 
        hull_id_number,
        keel_offset, 
        waterline_offset, 
        modified_date)
    VALUES (
        NEW.uuid, 
        NEW.name, 
        NEW.flag_nation,
        NEW.port_of_registry,
        NEW.build_details,
        NEW.official_number, 
        NEW.hull_id_number,
        NEW.keel_offset, 
        NEW.waterline_offset, 
        NEW.modified_date);
    RETURN NULL;
END; $$ LANGUAGE plpgsql;
ALTER FUNCTION history_vessels() OWNER TO admin;

CREATE TRIGGER trigger_vessels
    AFTER INSERT OR UPDATE ON vessels
    FOR EACH ROW EXECUTE PROCEDURE history_vessels();

-- User accounts
CREATE TABLE users (
        uuid             uuid           default uuidv7()    not null,
        name             text                               not null,
        password_hash    text                               not null, -- Stored using pgcrypto's crypt() function, which embeds a salt
        is_admin         boolean                            not null,
        modified_date    timestamptz    default now()       not null,
        
        PRIMARY KEY (uuid)
);
ALTER TABLE users OWNER TO admin;

CREATE TABLE history.users (
        history_id       bigint GENERATED ALWAYS AS IDENTITY,
        uuid             uuid,
        name             text,
        password_hash    text,
        is_admin         boolean,
        modified_date    timestamptz
);
ALTER TABLE history.users OWNER TO admin;

CREATE OR REPLACE FUNCTION history_users() RETURNS trigger AS $$
BEGIN
    INSERT INTO history.users (
        uuid, 
        name, 
        password_hash,
        is_admin,
        modified_date)
    VALUES (
        NEW.uuid, 
        NEW.name, 
        NEW.password_hash,
        NEW.is_admin,
        NEW.modified_date);
    RETURN NULL;
END; $$ LANGUAGE plpgsql;
ALTER FUNCTION history_users() OWNER TO admin;

CREATE TRIGGER trigger_users
    AFTER INSERT OR UPDATE ON users
    FOR EACH ROW EXECUTE PROCEDURE history_users();

-- Config values, generic for future use
CREATE TABLE configs (
        uuid              uuid    default uuidv7()    not null,
        vessel_uuid       uuid,                                 -- If this config is for a vessel, this will be the vessels -> uuis
        user_uuid         uuid,                                 -- If this config is for a user, this will be their users -> uuid
        variable_name     text                        not null, 
        variable_value    text                        not null, 
        description       text                        not null,
        modified_date     timestamptz                 not null,

        PRIMARY KEY(uuid),
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid),
        FOREIGN KEY(user_uuid) REFERENCES users(uuid)
);
ALTER TABLE configs OWNER TO admin;

CREATE TABLE history.configs (
        history_id        bigint GENERATED ALWAYS AS IDENTITY,
        uuid              uuid,
        vessel_uuid       uuid,
        user_uuid         uuid,
        variable_name     text,
        variable_value    text,
        description       text,
        modified_date     timestamptz,
        
        PRIMARY KEY(uuid)
);
ALTER TABLE history.configs OWNER TO admin;

CREATE OR REPLACE FUNCTION history_configs() RETURNS trigger AS $$
BEGIN
    INSERT INTO history.configs (
        uuid, 
        vessel_uuid,
        user_uuid,
        variable_name,
        variable_value,
        description,
        modified_date)
    VALUES (
        NEW.uuid, 
        NEW.vessel_uuid,
        NEW.user_uuid,
        NEW.variable_name,
        NEW.variable_value,
        NEW.description,
        NEW.modified_date);
    RETURN NULL;
END; $$ LANGUAGE plpgsql;
ALTER FUNCTION history_configs() OWNER TO admin;

CREATE TRIGGER trigger_configs
    AFTER INSERT OR UPDATE ON configs
    FOR EACH ROW EXECUTE PROCEDURE history_configs();

-- Notes that can be attached to anything.
CREATE TABLE notes (
        uuid              uuid    default uuidv7()    not null,
        vessel_uuid       uuid                        not null, -- The vessel the note is linked to
        user_uuid         uuid                        not null, -- The user who created or last edited the note.
        note_source       text                        not null, -- This is a reference to find this note. Generally '<table>:<tanle uuid>'
        note_name         text                        not null, -- This is a free-form name for the note, meant to find a note in a list
        note_body         text                        not null, -- This is the main body of the note.
        modified_date     timestamptz                 not null,

        PRIMARY KEY(uuid),
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid),
        FOREIGN KEY(user_uuid) REFERENCES users(uuid)
);
ALTER TABLE notes OWNER TO admin;

CREATE TABLE history.notes (
        history_id        bigint GENERATED ALWAYS AS IDENTITY,
        uuid              uuid,
        vessel_uuid       uuid,
        user_uuid         uuid,
        note_source       text,
        note_name         text,
        note_body         text,
        modified_date     timestamptz
);
ALTER TABLE history.notes OWNER TO admin;

CREATE OR REPLACE FUNCTION history_notes() RETURNS trigger AS $$
BEGIN
    INSERT INTO history.notes (
        uuid, 
        vessel_uuid,
        user_uuid,
        note_source,
        note_name,
        note_body,
        modified_date)
    VALUES (
        NEW.uuid, 
        NEW.vessel_uuid,
        NEW.user_uuid,
        NEW.note_source,
        NEW.note_name,
        NEW.note_body,
        NEW.modified_date);
    RETURN NULL;
END; $$ LANGUAGE plpgsql;
ALTER FUNCTION history_notes() OWNER TO admin;

CREATE TRIGGER trigger_notes
    AFTER INSERT OR UPDATE ON notes
    FOR EACH ROW EXECUTE PROCEDURE history_notes();
    
-- Config values, generic for future use
CREATE TABLE images (
        uuid               uuid    default uuidv7()    not null,
        image_source       text                        not null, -- This is used to connect an image to a source. Ie: 'vessel:<uuid>:1', 'mmsi:<mmsi>:3', etc
        image_directory    text                        not null, -- This is the relative directory the image is saved to
        file_name          text                        not null, -- This is the file name of the image.
        metadata           jsonb,                                -- This can contain the mime type, when the picture was take, the size, etc.
        modified_date      timestamptz                 not null,

        PRIMARY KEY(uuid)
);
ALTER TABLE images OWNER TO admin;

CREATE TABLE history.images (
        history_id         bigint GENERATED ALWAYS AS IDENTITY,
        uuid               uuid,
        image_source       text,
        image_directory    text,
        file_name          text,
        metadata           jsonb,
        modified_date      timestamptz
);
ALTER TABLE history.images OWNER TO admin;

CREATE OR REPLACE FUNCTION history_images() RETURNS trigger AS $$
BEGIN
    INSERT INTO history.images (
        uuid, 
        image_source,
        image_directory,
        file_name,
        metadata,
        modified_date)
    VALUES (
        NEW.uuid, 
        NEW.image_source,
        NEW.image_directory,
        NEW.file_name,
        NEW.metadata,
        NEW.modified_date);
    RETURN NULL;
END; $$ LANGUAGE plpgsql;
ALTER FUNCTION history_images() OWNER TO admin;

CREATE TRIGGER trigger_images
    AFTER INSERT OR UPDATE ON images
    FOR EACH ROW EXECUTE PROCEDURE history_images();

-- Manually entered logs of weather, travel, etc.
CREATE TABLE ship_logs (
        uuid                uuid    default uuidv7()    not null,
        vessel_uuid         uuid                        not null,
        user_uuid           uuid                        not null,
        weather_snapshot    jsonb                       not null, -- Created by the UI using the average weather data since the last log entry
        vessel_snapshot     jsonb                       not null, -- Created by the UI using the ship metrics; battery states, tank states, etc
        location            geography(point, 4326)      not null, -- GPS coordinates when the log was saved.
        vessel_status       text                        not null, -- underway, heave-to, at anchor, docked, etc.
        sail_plan           text                        not null, -- Reefed, wing on wing, port tack, etc
        sea_state           smallint                    not null, -- Beaufort scale; 0 ~ 12, extended to 17 - https://en.wikipedia.org/wiki/Beaufort_scale#Modern_scale
        narrative           text                        not null, -- The free-form textual narrative of the log
        modified_date       timestamptz                 not null,
        
        PRIMARY KEY(uuid),
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid),
        FOREIGN KEY(user_uuid) REFERENCES users(uuid)
);
ALTER TABLE ship_logs OWNER TO admin;

CREATE TABLE history.ship_logs (
        history_id          bigint GENERATED ALWAYS AS IDENTITY,
        uuid                uuid,
        vessel_uuid         uuid, 
        user_uuid           uuid, 
        weather_snapshot    jsonb, 
        vessel_snapshot     jsonb, 
        location            geography(point, 4326), 
        vessel_status       text, 
        sail_plan           text, 
        sea_state           smallint, 
        narrative           text, 
        modified_date       timestamptz
);
ALTER TABLE history.ship_logs OWNER TO admin;

CREATE INDEX index_ship_logs_location ON ship_logs USING GIST (location);
ALTER INDEX index_ship_logs_location OWNER TO admin;

CREATE OR REPLACE FUNCTION history_ship_logs() RETURNS trigger AS $$
BEGIN
    INSERT INTO history.ship_logs (
        uuid, 
        vessel_uuid, 
        user_uuid, 
        weather_snapshot, 
        vessel_snapshot, 
        location, 
        vessel_status, 
        sail_plan, 
        sea_state, 
        narrative, 
        modified_date)
    VALUES (
        NEW.uuid, 
        NEW.vessel_uuid, 
        NEW.user_uuid, 
        NEW.weather_snapshot, 
        NEW.vessel_snapshot, 
        NEW.location, 
        NEW.vessel_status, 
        NEW.sail_plan, 
        NEW.sea_state, 
        NEW.narrative, 
        NEW.modified_date);
    RETURN NULL;
END; $$ LANGUAGE plpgsql;
ALTER FUNCTION history_ship_logs() OWNER TO admin;

CREATE TRIGGER trigger_ship_logs
    AFTER INSERT OR UPDATE ON ship_logs
    FOR EACH ROW EXECUTE PROCEDURE history_ship_logs();

-- VHF Radios
CREATE TABLE radios (
        uuid             uuid           default uuidv7()    not null,
        vessel_uuid      uuid                               not null,
        make             text                               not null, -- The make/brand of the radio
        model            text                               not null, -- The model of the radio
        mmsi             text                               not null, -- The MMSI number 
        serial_number    text                               not null, -- The serial number of the radio
        tx_power         text                               not null, -- The transmit power, in watts
        has_dsc          boolean                            not null, -- Set to true if the radio is equipped with digital selective calling
        has_gps          boolean                            not null, -- Set to true if the radio is equipped with GPS
        has_ais_rx       boolean                            not null, -- Set to true if the radio is equipped with AIS. If this radio is also a transmitter, create a second entry in the ais_transponders table.
        is_portable      boolean                            not null, -- Set the true if the radio is a portable / hand-held radio
        is_active        boolean                            not null, -- Set to false if the radio is lost or destroyed
        modified_date    timestamptz    default now()       not null,

        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid),
        PRIMARY KEY(uuid)
);
ALTER TABLE radios OWNER TO admin;

CREATE TABLE history.radios (
        history_id       bigint GENERATED ALWAYS AS IDENTITY,
        uuid             uuid,
        vessel_uuid      uuid,
        make             text,
        model            text,
        mmsi             text,
        serial_number    text,
        tx_power         text,
        has_dsc          boolean,
        has_gps          boolean,
        has_ais_rx       boolean,
        is_portable      boolean,
        modified_date    timestamptz
);
ALTER TABLE history.radios OWNER TO admin;

CREATE OR REPLACE FUNCTION history_radios() RETURNS trigger AS $$
BEGIN
    INSERT INTO history.radios (
        uuid, 
        vessel_uuid, 
        make,
        model,
        mmsi,
        serial_number,
        tx_power,
        has_dsc,
        has_gps,
        has_ais_rx,
        is_portable,
        modified_date)
    VALUES (
        NEW.uuid, 
        NEW.vessel_uuid, 
        NEW.make,
        NEW.model,
        NEW.mmsi,
        NEW.serial_number,
        NEW.tx_power,
        NEW.has_dsc,
        NEW.has_gps,
        NEW.has_ais_rx,
        NEW.is_portable,
        NEW.modified_date);
    RETURN NULL;
END; $$ LANGUAGE plpgsql;
ALTER FUNCTION history_radios() OWNER TO admin;

CREATE TRIGGER trigger_radios
    AFTER INSERT OR UPDATE ON radios
    FOR EACH ROW EXECUTE PROCEDURE history_radios();

-- AIS Transponders
CREATE TABLE ais_transponders (
        uuid                 uuid           default uuidv7()    not null,
        vessel_uuid          uuid                               not null,
        make                 text                               not null, -- The make/brand of the radio
        model                text                               not null, -- The model of the radio
        mmsi                 text                               not null, -- This will match the fixed radio's MMSI generally (in Canada at least)
        serial_number        text                               not null, -- The serial number of the radio
        ais_class            text                               not null, -- 'Class B SOTDMA' for B954
        transmit_power       real                               not null, -- 5.0 (Watts) for B954
        wifi_mac_address     text                               not null, -- If the AIS has wifi, this is its MAC address
        bluetooth_address    text                               not null, -- If the AIS has bluetooth, this is the BD_ADDR
        vhf_splitter         text                               not null, -- If this uses a splitter to share the VHF antenna, set this to the make and model. If it's an internal splitter, set this to 'internal'
        external_gps         text                               not null, -- If there is an external GPS antenna, set this to the model number of the antenna
        silent_mode          boolean                            not null, -- This is set true if transmissions are turned off and its only receiving. 
        last_health_check    jsonb,                                       -- Store internal VSWR or supply voltage
        modified_date        timestamptz    default now()       not null,

        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid),
        PRIMARY KEY(uuid)
);
ALTER TABLE ais_transponders OWNER TO admin;

CREATE TABLE history.ais_transponders (
        history_id           bigint GENERATED ALWAYS AS IDENTITY,
        uuid                 uuid,
        vessel_uuid          uuid,
        make                 text,
        model                text,
        mmsi                 text,
        serial_number        text,
        ais_class            text,
        transmit_power       real,
        wifi_mac_address     text,
        bluetooth_address    text,
        vhf_splitter         text,
        external_gps         text,
        silent_mode          boolean,
        last_health_check    jsonb,
        modified_date        timestamptz
);
ALTER TABLE history.ais_transponders OWNER TO admin;

CREATE OR REPLACE FUNCTION history_ais_transponders() RETURNS trigger AS $$
BEGIN
    INSERT INTO history.ais_transponders (
        uuid, 
        vessel_uuid, 
        make,
        model,
        mmsi,
        serial_number,
        ais_class,
        transmit_power,
        wifi_mac_address,
        bluetooth_address,
        vhf_splitter,
        external_gps,
        silent_mode,
        last_health_check,
        modified_date)
    VALUES (
        NEW.uuid, 
        NEW.vessel_uuid, 
        NEW.make,
        NEW.model,
        NEW.mmsi,
        NEW.serial_number,
        NEW.ais_class,
        NEW.transmit_power,
        NEW.wifi_mac_address,
        NEW.bluetooth_address,
        NEW.vhf_splitter,
        NEW.external_gps,
        NEW.silent_mode,
        NEW.last_health_check,
        NEW.modified_date);
    RETURN NULL;
END; $$ LANGUAGE plpgsql;
ALTER FUNCTION history_ais_transponders() OWNER TO admin;

CREATE TRIGGER trigger_ais_transponders
    AFTER INSERT OR UPDATE ON ais_transponders
    FOR EACH ROW EXECUTE PROCEDURE history_ais_transponders();

-- This records whenever we transmit data over VHF or AIS
CREATE TABLE vessel_transmissions (
        uuid                   uuid           default uuidv7()    not null,
        vessel_uuid            uuid                               not null,
        transmission_source    text                               not null, -- This is the '<table>:<uuid>' referencing the AIS or VHF device sending the transmission
        transmission_type      text                               not null, -- 'AIS', 'VHF_VOICE', or 'DSC'
        channel                text                               not null, -- 'A', 'B', or '16', '72', etc.
        power_watts            real                               not null, -- 25, 5, 1
        dsc_message_type       text                               not null, -- 'Distress', 'Individual', etc.
        vswr                   real                               not null, -- Antenna health
        time                   timestamptz    DEFAULT now()       not null,

        -- PK must include the column used for partitioning
        PRIMARY KEY (time, uuid),
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid)
) PARTITION BY RANGE (time);
ALTER TABLE vessel_transmissions OWNER TO admin;

-- Crew (separate from users)
CREATE TABLE crew (
        uuid             uuid           default uuidv7()    not null,
        vessel_uuid      uuid                               not null,
        name             text                               not null,
        position         text                               not null,
        contact_info     text                               not null,
        disembarked      text                               not null,
        modified_date    timestamptz    default now()       not null,

        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid),
        PRIMARY KEY(uuid)
);
ALTER TABLE crew OWNER TO admin;

CREATE TABLE history.crew (
        history_id       bigint GENERATED ALWAYS AS IDENTITY,
        uuid             uuid,
        vessel_uuid      uuid,
        name             text,
        position         text,
        contact_info     text,
        disembarked      text,
        modified_date    timestamptz
);
ALTER TABLE history.crew OWNER TO admin;

CREATE OR REPLACE FUNCTION history_crew() RETURNS trigger AS $$
BEGIN
    INSERT INTO history.crew (
        uuid, 
        vessel_uuid, 
        name,
        position,
        contact_info,
        disembarked,
        modified_date)
    VALUES (
        NEW.uuid, 
        NEW.vessel_uuid, 
        NEW.name,
        NEW.position,
        NEW.contact_info,
        NEW.disembarked,
        NEW.modified_date);
    RETURN NULL;
END; $$ LANGUAGE plpgsql;
ALTER FUNCTION history_crew() OWNER TO admin;

CREATE TRIGGER trigger_crew
    AFTER INSERT OR UPDATE ON crew
    FOR EACH ROW EXECUTE PROCEDURE history_crew();

-- Store raw PGN traffic. This will generate a massive amount of data and we'll likely rarely ever read it
-- back, save for debugging. So no index and no WAL. Partiioned daily for faster/easier purging of old 
-- records.
CREATE TABLE n2k_traffic (
        uuid           uuid           default uuidv7()    not null,
        vessel_uuid    uuid                               not null,
        pgn            integer                            not null,
        source_id      smallint                           not null,
        priority       smallint                           not null,
        payload        bytea                              not null,
        time           timestamptz    default now()       not null,

        -- PK must include the column used for partitioning
        PRIMARY KEY (time, uuid),
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid)
) PARTITION BY RANGE (time);
ALTER TABLE n2k_traffic OWNER TO admin;

-- This will be a fast growing table, so it is going to be partitioned the same as n2k_traffic
CREATE TABLE motions (
        uuid                  uuid           default uuidv7()    not null,
        vessel_uuid           uuid                               not null,
        sensor_source         text                               not null,
        -- Accelerometer (m/s^2) - For Slamming and Heave
        accelerometer_x       real                               not null, 
        accelerometer_y       real                               not null, 
        accelerometer_z       real                               not null,
        -- Gyroscope (deg/s) - Crucial for the Autopilot's "Rate of Turn"
        gyroscope_x           real                               not null, 
        gyroscope_y           real                               not null, 
        gyroscope_z           real                               not null,
        -- Processed Orientation (Degrees)
        pitch                 real                               not null,
        roll                  real                               not null,
        heading_magnetic      real                               not null,
        -- Other data from the 200WX
        rate_of_turn          real                               not null,
        speed_over_ground     real                               not null,
        course_over_ground    real                               not null,
        heave                 real                               not null,
        -- Possibly useful for diagnostics
        gps_quality           jsonb                              not null,
        sensor_voltage        real                               not null,
        time                  timestamptz    default now()       not null,

        PRIMARY KEY (time, uuid),
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid)
) PARTITION BY RANGE (time);
ALTER TABLE motions OWNER TO admin;

-- View to quickly access the most recent cell data.
CREATE OR REPLACE VIEW motions_current AS SELECT DISTINCT ON (sensor_source) * FROM motions ORDER BY sensor_source, time DESC;
ALTER VIEW motions_current OWNER TO admin;

-- Temperature Data
CREATE TABLE temperatures (
        uuid             uuid           not null,
        vessel_uuid      uuid           not null,
        sensor_source    text           not null, -- Source + Name
        sensor_value     real           not null, -- Celcius (converted from Kelvin, -273.15)
        time                       timestamptz    not null,

        PRIMARY KEY(time, vessel_uuid, sensor_source),
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid)
);
ALTER TABLE temperatures OWNER TO admin;

-- Use a View for your real-time dashboard
CREATE OR REPLACE VIEW temperatures_current AS SELECT DISTINCT ON (sensor_source) * FROM temperatures ORDER BY sensor_source, time DESC;
ALTER VIEW temperatures_current OWNER TO admin;

CREATE INDEX index_temperatures_latest ON temperatures (sensor_source, time DESC);
ALTER INDEX index_temperatures_latest OWNER TO admin;

-- This will be a fast growing table whenever under motor power. This stores motor (and it's controller) data. 
CREATE TABLE motors (
        uuid                uuid             default uuidv7()    not null,
        vessel_uuid         uuid                                 not null,
        motor_source        text                                 not null,
        voltage             real                                 not null, -- Bus Voltage (V)
        current_dc          real                                 not null, -- Positive = Consuming, Negative = Regen
        watts               real GENERATED ALWAYS AS (voltage * current_dc) VIRTUAL,
        current_phase       real                                 not null, -- Peak phase current (A)
        gear_ratio          real                                 not null, -- 
        rpm                 smallint                             not null, -- Positive = Forward, Negative = Reverse
        throttle_raw        real                                 not null, -- Raw voltage (e.g., 0.0 to 5.0V)
        throttle_percent    real                                 not null, -- Calculated -100% to +100%
        speed_mode          text                                 not null, -- 'low', 'medium', 'high'
        error_code          smallint                             not null, -- Diagnostic
        time                timestamptz    default now()         not null,

        PRIMARY KEY (time, uuid),
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid)
) PARTITION BY RANGE (time);
ALTER TABLE motors OWNER TO admin;

-- View to quickly access the most recent cell data.
CREATE OR REPLACE VIEW motor_current AS SELECT DISTINCT ON (motor_source) * FROM motors ORDER BY motor_source, time DESC;
ALTER VIEW motor_current OWNER TO admin;

-- Calculate Shaft RPM for propeller analysis
-- Calculate Watts per Shaft Revolution (Load Metric)
CREATE OR REPLACE VIEW propulsion_efficiency AS
SELECT time, motor_source, (rpm / gear_ratio) AS shaft_rpm, ((voltage * current_dc) / NULLIF(ABS(rpm / gear_ratio), 0)) AS watts_per_rev FROM motors;

-- Motor:10kW:Controller
-- Motor:10kW:Winding
-- Motor:5kW:Controller
-- Motor:5kW:Winding
CREATE OR REPLACE VIEW health_summary AS
SELECT m.time, m.motor_source, m.voltage, m.current_dc, m.rpm, ct.sensor_value AS controller_temp, wt.sensor_value AS temp
FROM motors m
-- Nearest Controller Temp
LEFT JOIN LATERAL (
    SELECT sensor_value 
    FROM temperatures t
    WHERE t.sensor_source = m.motor_source || ':Controller'
      AND t.time BETWEEN m.time - INTERVAL '5 seconds' AND m.time + INTERVAL '5 seconds'
    ORDER BY ABS(EXTRACT(EPOCH FROM (t.time - m.time))) ASC
    LIMIT 1
) ct ON true
-- Nearest Winding Temp
LEFT JOIN LATERAL (
    SELECT sensor_value 
    FROM temperatures t
    WHERE t.sensor_source = m.motor_source || ':Winding'
      AND t.time BETWEEN m.time - INTERVAL '5 seconds' AND m.time + INTERVAL '5 seconds'
    ORDER BY ABS(EXTRACT(EPOCH FROM (t.time - m.time))) ASC
    LIMIT 1
) wt ON true;

-- Depth sounder data
CREATE TABLE depths (
        uuid             uuid           default uuidv7()    not null,
        vessel_uuid      uuid                               not null,
        sensor_source    text                               not null, -- ie: 'dst810:<serial_number>'
        measured         real                               not null, -- Use vessel_keel_offset and vessel_waterline_offset to display depth below keel and water depth
        quality          smallint                           not null, -- 0~100 (percent confidence), filter out values below 50.
        sensor_roll      real                               not null, 
        sensor_pitch     real                               not null,
        time             timestamptz    default now()       not null,

        PRIMARY KEY(uuid), 
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid)
);
ALTER TABLE depths OWNER TO admin;

-- View to quickly access the most recent cell data.
CREATE OR REPLACE VIEW depths_current AS SELECT DISTINCT ON (sensor_source) * FROM depths ORDER BY sensor_source, time DESC;
ALTER VIEW depths_current OWNER TO admin;

-- Corrects for the sensor's tilt to find the true vertical depth
-- 1. vertical        - Vertical correction for heel/pitch (Geometric depth)
-- 2. below_keel      - Depth Below Keel (DBK) = Measured + (Negative Keel Offset)
-- 3. below_waterline - Depth Below Waterline (DBW) = Measured + (Positive Waterline Offset)
CREATE OR REPLACE VIEW corrected_depth AS SELECT d.*, v.name,
    (d.measured * cos(radians(d.sensor_roll)) * cos(radians(d.sensor_pitch))) AS vertical,
    (d.measured + v.keel_offset) AS below_keel,
    (d.measured + v.waterline_offset) AS below_waterline
FROM depths d JOIN vessels v ON d.vessel_uuid = v.uuid;
ALTER VIEW corrected_depth OWNER TO admin;

-- Indexing for spatial and time-series performance
CREATE INDEX index_depths_latest ON depths (sensor_source, time DESC);
ALTER INDEX index_depths_latest OWNER TO admin;

-- Wind
-- Note: GRIB weather data uses ground speed/direction, so calculating our ground speed/direction allows us 
--       to compare, acts as a backup in case the speed wheel fouls and throws true off, and helps plan for
--       anchoring. Comparing true and ground also allows for calculating the current vector (delta is 
--       current).
-- ToDo: Corrolate the drift knots and compare against barrometric changes. This can be used to predict
--       storms.
CREATE TABLE winds (
        uuid                  uuid           default uuidv7()    not null,
        vessel_uuid           uuid                               not null,
        sensor_source         text                               not null,
        true_speed            real                               not null, -- Stored as m/s, relative to the speed over water
        true_direction        real                               not null, -- 0~359 degree from true North, 0.1 degree resolution
        ground_speed          real                               not null, -- Stored as m/s, relative to the speed over ground
        ground_direction      real                               not null, -- 0~359 degrees from true North
        apparent_speed        real                               not null, -- Stored as m/s
        apparent_direction    real                               not null, -- 0~359 degree from the bow
        time                  timestamptz    default now()       not null,
        
        -- Constraints to prevent "impossible" sensor data
        CONSTRAINT check_true_direction CHECK (true_direction >= 0 AND true_direction < 360),
        CONSTRAINT check_apparent_direction  CHECK (apparent_direction >= 0 AND apparent_direction < 360),

        PRIMARY KEY(uuid),
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid)
);
ALTER TABLE winds OWNER TO admin;

-- Use a View for your real-time dashboard
CREATE OR REPLACE VIEW current_winds AS SELECT DISTINCT ON (sensor_source) * FROM winds ORDER BY sensor_source, time DESC;
ALTER VIEW current_winds OWNER TO admin;

CREATE INDEX index_winds_latest ON winds (sensor_source, time DESC);
ALTER INDEX index_winds_latest OWNER TO admin;

-- Weather Data
CREATE TABLE weather (
        uuid                 uuid                      default uuidv7()    not null,
        vessel_uuid          uuid                                          not null,
        sensor_source        text                                          not null, -- Likely to only be '200WX:<serial_number>', but this accounts for further weather sources in the future
        location             geography(point, 4326)                        not null, -- GPS coordinates when the weather was read.
        pressure             real                                          not null, -- In hpa, 0.1 hpa resolution
        station_height       real                                          not null, -- In meters, height above the water line
        air_temp             real                                          not null, -- In C, 0.1 degree
        relative_humidity    real                                          not null, -- 0.1% resolution
        dew_point            real                                          not null, -- In C
        heat_index           real                                          not null, -- "Feels like" humidex
        wind_chill           real                                          not null, -- "Feels like" wind chill
        station_pitch        real                                          not null, -- +/- 1 degree accuracy
        station_roll         real                                          not null, -- +/- 1 degree accuracy
        station_heading      real                                          not null, -- GPS heading
        time                         timestamptz               default now()       not null,
        
        PRIMARY KEY(uuid),
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid)
);
ALTER TABLE weather OWNER TO admin;

-- View to quickly access the most recent weather data.
CREATE OR REPLACE VIEW current_weather AS SELECT DISTINCT ON (sensor_source) * FROM weather ORDER BY sensor_source, time DESC;
ALTER VIEW current_weather OWNER TO admin;

-- Indexing for spatial and time-series performance
CREATE INDEX index_time ON weather (time DESC);
CREATE INDEX index_location ON weather USING GIST(location);
ALTER INDEX index_time OWNER TO admin;
ALTER INDEX index_location OWNER TO admin;

-- The 'Live' view for the FUI
CREATE VIEW latest_weather AS SELECT DISTINCT ON (uuid) * FROM weather ORDER BY uuid, time DESC;
ALTER VIEW latest_weather OWNER TO admin;

-- NOTE: Battery temperature data will be stored in the 'temperatures' table with the source being
--       'battery:<group>:<number>:sensor name'.
-- Battery Banks
CREATE TABLE batteries (
        uuid               uuid           default uuidv7()    not null,
        vessel_uuid        uuid                               not null,
        nominal_voltage    real                               not null, -- 12.8v or 51.2v
        pack_voltage       real                               not null, -- Current pack voltage
        pack_current       real                               not null, -- Current amperage, positive = discharge, negative = charge.
        pack_source        text                               not null, -- Propulsion:x, House:y, etc
        label_capacity     real                               not null, -- Capacity when new, ie: 280 (Ah)
        last_capacity      real                               not null, -- The realised capacity at the last full discharge, used to calculate a more accurate estimated remaining charge
        state_of_charge    real                               not null, -- The state of charge as reported by the BMS on the battery.
        time               timestamptz    default now()       not null,

        PRIMARY KEY(uuid),
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid)
);
ALTER TABLE batteries OWNER TO admin;

-- View to quickly access the most recent battery pack data.
CREATE OR REPLACE VIEW batteries_current_data AS SELECT DISTINCT ON (pack_source) * FROM batteries ORDER BY pack_source, time DESC;
ALTER VIEW batteries_current_data OWNER TO admin;

-- Indexing for spatial and time-series performance
CREATE INDEX index_batteries_latest ON batteries (pack_source, time DESC);
ALTER INDEX index_batteries_latest OWNER TO admin;

-- Battery cells.
CREATE TABLE cells (
        uuid            uuid           default uuidv7()    not null,
        battery_uuid    uuid                               not null,
        cell_source     text                               not null, -- Generally the cell ID, ie: 6:1 for pack 6 cell 1
        cell_voltage    real                               not null, -- individual cell voltage, as reported by the BMS
        time            timestamptz    default now()       not null, 
        
        PRIMARY KEY(uuid),
        FOREIGN KEY(battery_uuid) REFERENCES batteries(uuid)
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
        uuid                uuid           default uuidv7()    not null,
        vessel_uuid         uuid                               not null,
        tank_source         text                               not null, -- ie: 'Nav Area Diesel', 'Port Settee Water'
        tank_type           text                               not null, -- 'diesel', 'water', etc
        level_litres        real                               not null,
        capacity_litres     real                               not null,
        time                timestamptz    default now()       not null,

        PRIMARY KEY(uuid), 
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid)
);
ALTER TABLE tanks OWNER TO admin;

-- View to quickly access the most recent cell data.
CREATE OR REPLACE VIEW tanks_current AS SELECT DISTINCT ON (tank_source) * FROM tanks ORDER BY tank_source, time DESC;
ALTER VIEW tanks_current OWNER TO admin;

-- Indexing for spatial and time-series performance
CREATE INDEX index_tanks_latest ON tanks (tank_source, time DESC);
ALTER INDEX index_tanks_latest OWNER TO admin;

-- NOTE: https://emsa.europa.eu/cise-documentation/cise-data-model-1.5.3/model/guidelines/687507181.html
-- Records of AIS targets, static data
CREATE TABLE ais_targets (
        mmsi           text                               not null,
        vessel_uuid    uuid                               not null,
        imo            text                               not null, -- When available
        name           text                               not null, -- Vessel name or call sign
        length         real                               not null, -- Vessel length
        beam           real                               not null, -- Vessel width
        vessel_type    text                               not null, -- cargo, tanker, passenger, pleasure, etc
        time           timestamptz    default now()       not null,

        PRIMARY KEY(mmsi), -- NOTE: This is different from other tables! The MMSI acts as the UUID for locating records
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid)
);
ALTER TABLE ais_targets OWNER TO admin;

-- View to quickly access the most recent cell data.
CREATE OR REPLACE VIEW ais_targets_current AS SELECT DISTINCT ON (mmsi) * FROM ais_targets ORDER BY mmsi, time DESC;
ALTER VIEW ais_targets_current OWNER TO admin;

-- Indexing for spatial and time-series performance
CREATE INDEX index_ais_targets_latest ON ais_targets (mmsi, time DESC);
ALTER INDEX index_ais_targets_latest OWNER TO admin;

-- Records the dynamic, potentially fast changing data about AIS targets.
CREATE TABLE ais_dynamics (
        uuid                  uuid           default uuidv7()    not null,
        ais_target_mmsi       text                               not null,
        location              geography(point, 4326)             not null,
        speed_over_ground     real                               not null,
        course_over_ground    real                               not null,
        heading               real                               not null,
        rate_of_turn          real                               not null,
        navigation_status     smallint                           not null, -- 
        data                  jsonb                              not null, -- JSON of destination, ETA, static draght, cargo category, etc
        time                  timestamptz    default now()       not null,

        PRIMARY KEY(uuid), 
        FOREIGN KEY(ais_target_mmsi) REFERENCES ais_targets(mmsi)
);
ALTER TABLE ais_dynamics OWNER TO admin;

-- View to quickly access the most recent cell data.
CREATE OR REPLACE VIEW ais_dynamics_current AS SELECT DISTINCT ON (ais_target_mmsi) * FROM ais_dynamics ORDER BY ais_target_mmsi, time DESC;
ALTER VIEW ais_dynamics_current OWNER TO admin;

-- Indexing for spatial and time-series performance
CREATE INDEX index_ais_dynamics_latest ON ais_dynamics (ais_target_mmsi, time DESC);
CREATE INDEX index_ais_dynamics_spatial ON ais_dynamics USING GIST (location);
ALTER INDEX index_ais_dynamics_latest OWNER TO admin;
ALTER INDEX index_ais_dynamics_spatial OWNER TO admin;

-- This is not likely to be recorded to that often, so not creating indexes or views yet.
CREATE TABLE events (
        uuid            uuid           default uuidv7()    not null,
        vessel_uuid     uuid                               not null,
        event_source    text                               not null, -- ie: 'MR Autopilot'
        event_type      text                               not null, -- ie: 'calibration', 'tare', 'boot', etc
        details         jsonb                              not null, -- ie: {"pitch_offset": 2.1, "roll_offset": -0.5}
        time            timestamptz    default now()       not null,

        PRIMARY KEY(uuid), 
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid)
);
ALTER TABLE events OWNER TO admin;

-- These were created automatically
ALTER TABLE spatial_ref_sys OWNER TO admin;
ALTER VIEW geography_columns OWNER TO admin;
ALTER VIEW geometry_columns OWNER TO admin;
ALTER VIEW health_summary OWNER TO admin;
ALTER VIEW propulsion_efficiency OWNER TO admin;
ALTER VIEW raster_columns OWNER TO admin;
ALTER VIEW raster_overviews OWNER TO admin;
