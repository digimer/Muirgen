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
GRANT USAGE ON SCHEMA history TO admin;

-- Halt on error while loading this schema
\set ON_ERROR_STOP on

-- Enable TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
SET search_path TO public, "$user";

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
        handle           text                               not null, -- Nickname
        name             text                               not null, -- Real name
        password_hash    text                               not null, -- Stored using pgcrypto's crypt() function, which embeds a salt
        is_admin         boolean                            not null, -- If set, user can configure things
        modified_date    timestamptz    default now()       not null,
        
        PRIMARY KEY (uuid)
);
ALTER TABLE users OWNER TO admin;

CREATE TABLE history.users (
        history_id       bigint GENERATED ALWAYS AS IDENTITY,
        uuid             uuid,
        handle           text,
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
        handle, 
        name, 
        password_hash,
        is_admin,
        modified_date)
    VALUES (
        NEW.uuid, 
        NEW.handle, 
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

-- Motor Controllers. These are the source of much of our data, so this table will be "parent" to the 
-- 'motors' table.
-- NOTE: Controllers can have a wide array of config options, like max current uncooled, max current cooled, 
--       etc. To provide the best flexibility, we'll use the 'configs' table for that. 
-- TODO: We'll need some way to map what configs apply to what motor controllers. Probably a "profile" file.
CREATE TABLE motor_controllers (
        uuid             uuid           default uuidv7()    not null,
        vessel_uuid      uuid                               not null,
        make             text                               not null, -- The controller brand (ie: Kelly Controls)
        model            text                               not null, -- The specific model number (ie: 'KLS 72100NC')
        serial_number    text                               not null, -- The SN, needed to identify when two of the same model are in use
        modified_date    timestamptz    default now()       not null,

        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid),
        PRIMARY KEY(uuid)
);
ALTER TABLE motor_controllers OWNER TO admin;

CREATE TABLE history.motor_controllers (
        history_id       bigint GENERATED ALWAYS AS IDENTITY,
        uuid             uuid,
        vessel_uuid      uuid,
        make             text, 
        model            text, 
        serial_number    text, 
        modified_date    timestamptz
);
ALTER TABLE history.motor_controllers OWNER TO admin;

CREATE OR REPLACE FUNCTION history_motor_controllers() RETURNS trigger AS $$
BEGIN
    INSERT INTO history.motor_controllers (
        uuid, 
        vessel_uuid, 
        make, 
        model, 
        serial_number, 
        modified_date)
    VALUES (
        NEW.uuid, 
        NEW.vessel_uuid, 
        NEW.make, 
        NEW.model, 
        NEW.serial_number, 
        NEW.modified_date);
    RETURN NULL;
END; $$ LANGUAGE plpgsql;
ALTER FUNCTION history_motor_controllers() OWNER TO admin;

CREATE TRIGGER trigger_motor_controllers
    AFTER INSERT OR UPDATE ON motor_controllers
    FOR EACH ROW EXECUTE PROCEDURE history_motor_controllers();

-- Motors. This will act as the parent to motor_data, temperature, and other time-series data streams.
-- NOTE: If calculating the historic prop RPM, make sure that the motor_data columns reference the 
--       closest 'gear_ratio' from the history schema. This will allow accurate calculations in cases
--       where the gear ratio was changed.
CREATE TABLE motors (
        uuid                     uuid           default uuidv7()    not null,
        motor_controller_uuid    uuid                               not null, -- This is the motor controller controlling this motor.
        make                     text                               not null, -- The motor manufacturer (ie: Golden motor)
        model                    text                               not null, -- The model of the motor. 
        serial_number            text                               not null, -- The serial number, if available. Use '' if n/a.
        gear_ratio               real                               not null, -- Used to calculate the prop RPM.
        modified_date            timestamptz    default now()       not null,

        FOREIGN KEY(motor_controller_uuid) REFERENCES motor_controllers(uuid),
        PRIMARY KEY(uuid)
);
ALTER TABLE motors OWNER TO admin;

CREATE TABLE history.motors (
        history_id               bigint GENERATED ALWAYS AS IDENTITY,
        uuid                     uuid,
        motor_controller_uuid    uuid, 
        make                     text, 
        model                    text, 
        serial_number            text, 
        modified_date            timestamptz
);
ALTER TABLE history.motors OWNER TO admin;

CREATE OR REPLACE FUNCTION history_motors() RETURNS trigger AS $$
BEGIN
    INSERT INTO history.motors (
        uuid, 
        motor_controller_uuid, 
        make, 
        model, 
        serial_number, 
        modified_date)
    VALUES (
        NEW.uuid, 
        NEW.motor_controller_uuid, 
        NEW.make, 
        NEW.model, 
        NEW.serial_number, 
        NEW.modified_date);
    RETURN NULL;
END; $$ LANGUAGE plpgsql;
ALTER FUNCTION history_motors() OWNER TO admin;

CREATE TRIGGER trigger_motors
    AFTER INSERT OR UPDATE ON motors
    FOR EACH ROW EXECUTE PROCEDURE history_motors();

-- These are the batteries on the boat. The data here should come from their BMS. This is a balance between
-- consumer batteries and DIY batteries. For DIY, the make/model/serial refers to the BMS. This table is not
-- used to store transient data, that will be too high rate of change.
CREATE TABLE batteries (
        uuid               uuid           default uuidv7()    not null,
        vessel_uuid        uuid                               not null,
        make               text                               not null, -- The BMS or premade Battery make
        model              text                               not null, -- The BMS or premade Battery model
        serial_number      text                               not null, -- The BMS or premade Battery SN
        nominal_voltage    real                               not null, -- Generally 12.8, 25.6, or 51.2
        capacity           real                               not null, -- Capacity in Ah
        last_capacity      real                               not null, -- The realised capacity at the last full discharge, used to calculate a more accurate estimated remaining charge and track pack degredation over time
        chemistry          text                               not null, -- LiFePO4, NMC, etc
        modified_date      timestamptz    default now()       not null,

        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid),
        PRIMARY KEY(uuid)
);
ALTER TABLE batteries OWNER TO admin;

CREATE TABLE history.batteries (
        history_id         bigint GENERATED ALWAYS AS IDENTITY,
        uuid               uuid,
        vessel_uuid        uuid,
        make               text, 
        model              text, 
        serial_number      text, 
        nominal_voltage    real, 
        capacity           real, 
        last_capacity      real, 
        chemistry          text, 
        modified_date      timestamptz
);
ALTER TABLE history.batteries OWNER TO admin;

CREATE OR REPLACE FUNCTION history_batteries() RETURNS trigger AS $$
BEGIN
    INSERT INTO history.batteries (
        uuid, 
        vessel_uuid, 
        make, 
        model, 
        serial_number, 
        nominal_voltage, 
        capacity, 
        last_capacity, 
        chemistry, 
        modified_date)
    VALUES (
        NEW.uuid, 
        NEW.vessel_uuid, 
        NEW.make, 
        NEW.model, 
        NEW.serial_number, 
        NEW.nominal_voltage, 
        NEW.capacity, 
        NEW.last_capacity, 
        NEW.chemistry, 
        NEW.modified_date);
    RETURN NULL;
END; $$ LANGUAGE plpgsql;
ALTER FUNCTION history_batteries() OWNER TO admin;

CREATE TRIGGER trigger_batteries
    AFTER INSERT OR UPDATE ON batteries
    FOR EACH ROW EXECUTE PROCEDURE history_batteries();

-- These are the liquid tanks on the boat.
CREATE TABLE tanks (
        uuid               uuid           default uuidv7()    not null,
        vessel_uuid        uuid                               not null,
        liquid_type        text                               not null, -- This will be 'water', 'diesel', etc.
        capacity           real                               not null, -- Capacity in liters
        location           text                               not null, -- Textual description of the tank location, (ie: 'Port Settee')
        modified_date      timestamptz    default now()       not null,

        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid),
        PRIMARY KEY(uuid)
);
ALTER TABLE tanks OWNER TO admin;

CREATE TABLE history.tanks (
        history_id         bigint GENERATED ALWAYS AS IDENTITY,
        uuid               uuid,
        vessel_uuid        uuid,
        liquid_type        text, 
        capacity           real, 
        location           text, 
        modified_date      timestamptz
);
ALTER TABLE history.tanks OWNER TO admin;

CREATE OR REPLACE FUNCTION history_tanks() RETURNS trigger AS $$
BEGIN
    INSERT INTO history.tanks (
        uuid, 
        vessel_uuid, 
        liquid_type, 
        capacity, 
        location, 
        modified_date)
    VALUES (
        NEW.uuid, 
        NEW.vessel_uuid, 
        NEW.liquid_type, 
        NEW.capacity, 
        NEW.location, 
        NEW.modified_date);
    RETURN NULL;
END; $$ LANGUAGE plpgsql;
ALTER FUNCTION history_tanks() OWNER TO admin;

CREATE TRIGGER trigger_tanks
    AFTER INSERT OR UPDATE ON tanks
    FOR EACH ROW EXECUTE PROCEDURE history_tanks();

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

-- NOTE: https://emsa.europa.eu/cise-documentation/cise-data-model-1.5.3/model/guidelines/687507181.html
-- Records of AIS targets, static data. This will grow over time, but not enough to justify a hypertable,
-- Even if it did, it can't be one, as 'aid_dynamics' has a foreign key pointing here.
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
CREATE OR REPLACE VIEW current_ais_targets AS SELECT DISTINCT ON (mmsi) * FROM ais_targets ORDER BY mmsi, time DESC;
ALTER VIEW current_ais_targets OWNER TO admin;

-- Indexing for spatial and time-series performance
CREATE INDEX index_ais_targets_latest ON ais_targets (mmsi, time DESC);
ALTER INDEX index_ais_targets_latest OWNER TO admin;

-- ### Below here are (potentially) high rate of change tables. These use hypertables to better handle their
-- ### large volume of time-series data.

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
);
ALTER TABLE vessel_transmissions OWNER TO admin;
SELECT create_hypertable('vessel_transmissions', 'time', chunk_time_interval => INTERVAL '1 day');
ALTER TABLE vessel_transmissions SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'vessel_uuid',
  timescaledb.compress_orderby = 'time DESC, uuid'
);
SELECT add_retention_policy('vessel_transmissions', INTERVAL '30 days');
SELECT add_compression_policy('vessel_transmissions', INTERVAL '1 day');

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
);
ALTER TABLE n2k_traffic OWNER TO admin;
SELECT create_hypertable('n2k_traffic', 'time', chunk_time_interval => INTERVAL '1 day');
ALTER TABLE n2k_traffic SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'vessel_uuid',
  timescaledb.compress_orderby = 'time DESC, uuid'
);
SELECT add_retention_policy('n2k_traffic', INTERVAL '30 days');
SELECT add_compression_policy('n2k_traffic', INTERVAL '1 day');

-- This will record all sensor data related to the motion of the boat (in 3D space and over the planet).
CREATE TABLE motion_data (
        uuid                  uuid           default uuidv7()    not null,
        vessel_uuid           uuid                               not null,
        sensor_source         text                               not null,
        accelerometer_x       real                               not null, -- Accelerometer (m/s^2) - For Slamming and Heave
        accelerometer_y       real                               not null, 
        accelerometer_z       real                               not null,
        gyroscope_x           real                               not null, -- Gyroscope (deg/s) - Crucial for the Autopilot's "Rate of Turn"
        gyroscope_y           real                               not null, 
        gyroscope_z           real                               not null,
        pitch                 real                               not null, -- Processed Orientation (Degrees)
        roll                  real                               not null,
        heading_magnetic      real                               not null,
        rate_of_turn          real                               not null, -- Other data from the 200WX
        speed_over_ground     real                               not null,
        course_over_ground    real                               not null,
        heave                 real                               not null,
        gps_quality           jsonb                              not null, -- Possibly useful for diagnostics
        sensor_voltage        real                               not null,
        time                  timestamptz    default now()       not null,

        PRIMARY KEY (time, uuid),
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid)
);
ALTER TABLE motion_data OWNER TO admin;
SELECT create_hypertable('motion_data', 'time', chunk_time_interval => INTERVAL '1 day');
ALTER TABLE motion_data SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'vessel_uuid',
  timescaledb.compress_orderby = 'time DESC, uuid'
);
SELECT add_retention_policy('motion_data', INTERVAL '30 days');
SELECT add_compression_policy('motion_data', INTERVAL '1 day');

-- View to quickly access the most recent cell data.
CREATE OR REPLACE VIEW current_motion_data AS SELECT DISTINCT ON (sensor_source) * FROM motion_data ORDER BY sensor_source, time DESC;
ALTER VIEW current_motion_data OWNER TO admin;

-- NOTE: We don't use a uuid here as we're sorting records by vessel_uuid + sensor_uuid.
-- Temperature Data
CREATE TABLE temperature_data (
        vessel_uuid      uuid           not null,
        sensor_source    text           not null, -- Source + Name
        sensor_value     real           not null, -- Celcius (converted from Kelvin, -273.15)
        time             timestamptz    not null,

        PRIMARY KEY(time, vessel_uuid, sensor_source),
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid)
);
ALTER TABLE temperature_data OWNER TO admin;
SELECT create_hypertable('temperature_data', 'time', chunk_time_interval => INTERVAL '1 day');
ALTER TABLE temperature_data SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'vessel_uuid, sensor_source',
  timescaledb.compress_orderby = 'time DESC'
);
SELECT add_retention_policy('temperature_data', INTERVAL '30 days');
SELECT add_compression_policy('temperature_data', INTERVAL '1 day');

-- Use a View for your real-time dashboard
CREATE OR REPLACE VIEW current_temperature_data AS SELECT DISTINCT ON (sensor_source) * FROM temperature_data ORDER BY sensor_source, time DESC;
ALTER VIEW current_temperature_data OWNER TO admin;

CREATE INDEX index_temperature_data_latest ON temperature_data (sensor_source, time DESC);
ALTER INDEX index_temperature_data_latest OWNER TO admin;

-- Thos records the power and performance data for the given motor. 
-- NOTE: We reference the motor instead of the motor controller. This is intentional so that, if a motor is
--       ever replaced, the data stays linked to the actual motor. We can track back to the controller via
--       the motor's table foreign key if we want to know which controller generated this data.
CREATE TABLE motor_data (
        uuid                uuid             default uuidv7()    not null,
        motor_uuid          uuid                                 not null,
        voltage             real                                 not null, -- Bus Voltage (V)
        current_dc          real                                 not null, -- Positive = Consuming, Negative = Regen
        watts               real GENERATED ALWAYS AS (voltage * current_dc) VIRTUAL, -- This is a virtual table used to get the wattage easier.
        current_phase       real                                 not null, -- Peak phase current (A)
        rpm                 smallint                             not null, -- Positive = Forward, Negative = Reverse
        throttle_raw        real                                 not null, -- Raw voltage (e.g., 0.0 to 5.0V)
        throttle_percent    real                                 not null, -- Calculated -100% to +100%
        speed_mode          text                                 not null, -- 'low', 'medium', 'high'
        error_code          text                                 not null, -- Diagnostic data. Uses 'text' as we can't guarantee all motor controllers use numeric error codes.
        time                timestamptz    default now()         not null,

        PRIMARY KEY (time, uuid),
        FOREIGN KEY(motor_uuid) REFERENCES motors(uuid)
);
ALTER TABLE motor_data OWNER TO admin;
SELECT create_hypertable('motor_data', 'time', chunk_time_interval => INTERVAL '1 day');
ALTER TABLE motor_data SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'motor_uuid',
  timescaledb.compress_orderby = 'time DESC, uuid'
);
SELECT add_retention_policy('motor_data', INTERVAL '30 days');
SELECT add_compression_policy('motor_data', INTERVAL '1 day');

-- View to quickly access the most recent cell data.
CREATE OR REPLACE VIEW current_motor_data AS SELECT DISTINCT ON (motor_uuid) * FROM motor_data ORDER BY motor_uuid, time DESC;
ALTER VIEW current_motor_data OWNER TO admin;

-- TODO: The gear ration has moved to the 'motors' table, so this needs to be reworked to pull the data from there.
-- Calculate Shaft RPM for propeller analysis
-- Calculate Watts per Shaft Revolution (Load Metric)
--CREATE OR REPLACE VIEW propulsion_efficiency AS
--SELECT time, motor_uuid, (rpm / gear_ratio) AS shaft_rpm, ((voltage * current_dc) / NULLIF(ABS(rpm / gear_ratio), 0)) AS watts_per_rev FROM motor_data;

-- TODO: The motor is now referenced to the motors table, so these need to be reworked to replace 'motor_source'.
-- Motor:10kW:Controller
-- Motor:10kW:Winding
-- Motor:5kW:Controller
-- Motor:5kW:Winding
-- CREATE OR REPLACE VIEW health_summary AS
-- SELECT m.time, m.motor_source, m.voltage, m.current_dc, m.rpm, ct.sensor_value AS controller_temp, wt.sensor_value AS temp
-- FROM motors m
-- -- Nearest Controller Temp
-- LEFT JOIN LATERAL (
--     SELECT sensor_value 
--     FROM temperatures t
--     WHERE t.sensor_source = m.motor_source || ':Controller'
--       AND t.time BETWEEN m.time - INTERVAL '5 seconds' AND m.time + INTERVAL '5 seconds'
--     ORDER BY ABS(EXTRACT(EPOCH FROM (t.time - m.time))) ASC
--     LIMIT 1
-- ) ct ON true
-- -- Nearest Winding Temp
-- LEFT JOIN LATERAL (
--     SELECT sensor_value 
--     FROM temperatures t
--     WHERE t.sensor_source = m.motor_source || ':Winding'
--       AND t.time BETWEEN m.time - INTERVAL '5 seconds' AND m.time + INTERVAL '5 seconds'
--     ORDER BY ABS(EXTRACT(EPOCH FROM (t.time - m.time))) ASC
--     LIMIT 1
-- ) wt ON true;

-- Depth sounder data
CREATE TABLE depth_data (
        uuid             uuid           default uuidv7()    not null,
        vessel_uuid      uuid                               not null,
        sensor_source    text                               not null, -- ie: 'dst810:<serial_number>'
        measured         real                               not null, -- Use vessel_keel_offset and vessel_waterline_offset to display depth below keel and water depth
        quality          smallint                           not null, -- 0~100 (percent confidence), filter out values below 50.
        sensor_roll      real                               not null, 
        sensor_pitch     real                               not null,
        time             timestamptz    default now()       not null,

        PRIMARY KEY(time, uuid), 
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid)
);
ALTER TABLE depth_data OWNER TO admin;
SELECT create_hypertable('depth_data', 'time', chunk_time_interval => INTERVAL '1 day');
ALTER TABLE depth_data SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'vessel_uuid',
  timescaledb.compress_orderby = 'time DESC, uuid'
);
SELECT add_retention_policy('depth_data', INTERVAL '30 days');
SELECT add_compression_policy('depth_data', INTERVAL '1 day');

-- View to quickly access the most recent cell data.
CREATE OR REPLACE VIEW current_depth_data AS SELECT DISTINCT ON (sensor_source) * FROM depth_data ORDER BY sensor_source, time DESC;
ALTER VIEW current_depth_data OWNER TO admin;

-- Corrects for the sensor's tilt to find the true vertical depth
-- 1. vertical        - Vertical correction for heel/pitch (Geometric depth)
-- 2. below_keel      - Depth Below Keel (DBK) = Measured + (Negative Keel Offset)
-- 3. below_waterline - Depth Below Waterline (DBW) = Measured + (Positive Waterline Offset)
CREATE OR REPLACE VIEW corrected_depth AS SELECT d.*, v.name,
    (d.measured * cos(radians(d.sensor_roll)) * cos(radians(d.sensor_pitch))) AS vertical,
    (d.measured + v.keel_offset) AS below_keel,
    (d.measured + v.waterline_offset) AS below_waterline
FROM depth_data d JOIN vessels v ON d.vessel_uuid = v.uuid;
ALTER VIEW corrected_depth OWNER TO admin;

-- Indexing for spatial and time-series performance
CREATE INDEX index_depth_data_latest ON depth_data (sensor_source, time DESC);
ALTER INDEX index_depth_data_latest OWNER TO admin;

-- Wind
-- Note: GRIB weather data uses ground speed/direction, so calculating our ground speed/direction allows us 
--       to compare, acts as a backup in case the speed wheel fouls and throws true off, and helps plan for
--       anchoring. Comparing true and ground also allows for calculating the current vector (delta is 
--       current).
-- ToDo: Corrolate the drift knots and compare against barrometric changes. This can be used to predict
--       storms.
CREATE TABLE wind_data (
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

        PRIMARY KEY(time, uuid),
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid)
);
ALTER TABLE wind_data OWNER TO admin;
SELECT create_hypertable('wind_data', 'time', chunk_time_interval => INTERVAL '1 day');
ALTER TABLE wind_data SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'vessel_uuid',
  timescaledb.compress_orderby = 'time DESC, uuid'
);
SELECT add_retention_policy('wind_data', INTERVAL '30 days');
SELECT add_compression_policy('wind_data', INTERVAL '1 day');

-- Use a View for your real-time dashboard
CREATE OR REPLACE VIEW current_wind_data AS SELECT DISTINCT ON (sensor_source) * FROM wind_data ORDER BY sensor_source, time DESC;
ALTER VIEW current_wind_data OWNER TO admin;

CREATE INDEX index_wind_data_latest ON wind_data (sensor_source, time DESC);
ALTER INDEX index_wind_data_latest OWNER TO admin;

-- Weather Data
CREATE TABLE weather_data (
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
        time                 timestamptz               default now()       not null,
        
        PRIMARY KEY(time, uuid),
        FOREIGN KEY(vessel_uuid) REFERENCES vessels(uuid)
);
ALTER TABLE weather_data OWNER TO admin;
SELECT create_hypertable('weather_data', 'time', chunk_time_interval => INTERVAL '1 day');
ALTER TABLE weather_data SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'vessel_uuid',
  timescaledb.compress_orderby = 'time DESC, uuid'
);
SELECT add_retention_policy('weather_data', INTERVAL '30 days');
SELECT add_compression_policy('weather_data', INTERVAL '1 day');

-- View to quickly access the most recent weather data.
CREATE OR REPLACE VIEW current_weather_data AS SELECT DISTINCT ON (sensor_source) * FROM weather_data ORDER BY sensor_source, time DESC;
ALTER VIEW current_weather_data OWNER TO admin;

-- Indexing for spatial and time-series performance
CREATE INDEX index_weather_data_time ON weather_data (time DESC);
CREATE INDEX index_weather_data_location ON weather_data USING GIST(location);
ALTER INDEX index_weather_data_time OWNER TO admin;
ALTER INDEX index_weather_data_location OWNER TO admin;

-- The 'Live' view for the FUI
CREATE VIEW latest_weather_data AS SELECT DISTINCT ON (uuid) * FROM weather_data ORDER BY uuid, time DESC;
ALTER VIEW latest_weather_data OWNER TO admin;

-- Battery data
CREATE TABLE battery_data (
        uuid               uuid           default uuidv7()    not null,
        battery_uuid       uuid                               not null, -- batteries -> uuid
        nominal_voltage    real                               not null, -- 12.8v or 51.2v
        pack_voltage       real                               not null, -- Current pack voltage
        pack_current       real                               not null, -- Current amperage, positive = discharge, negative = charge.
        state_of_charge    real                               not null, -- The state of charge as reported by the BMS on the battery.
        time               timestamptz    default now()       not null,

        PRIMARY KEY(time, uuid),
        FOREIGN KEY(battery_uuid) REFERENCES batteries(uuid)
);
ALTER TABLE battery_data OWNER TO admin;
SELECT create_hypertable('battery_data', 'time', chunk_time_interval => INTERVAL '1 day');
ALTER TABLE battery_data SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'battery_uuid',
  timescaledb.compress_orderby = 'time DESC, uuid'
);
SELECT add_retention_policy('battery_data', INTERVAL '30 days');
SELECT add_compression_policy('battery_data', INTERVAL '1 day');

-- View to quickly access the most recent battery pack data.
CREATE OR REPLACE VIEW current_battery_data AS SELECT DISTINCT ON (battery_uuid) * FROM battery_data ORDER BY battery_uuid, time DESC;
ALTER VIEW current_battery_data OWNER TO admin;

-- Indexing for spatial and time-series performance
CREATE INDEX index_battery_data_latest ON battery_data (battery_uuid, time DESC);
ALTER INDEX index_battery_data_latest OWNER TO admin;

-- NOTE: It's entirely possible cell data won't be available for some batteries.
-- Battery Cell data
CREATE TABLE battery_cell_data (
        uuid               uuid           default uuidv7()    not null,
        battery_uuid       uuid                               not null, -- batteries -> uuid
        cell_id            smallint                           not null, -- This is the cell number, generall 1 ~ 16. Cells in parallel are treated as one.
        cell_voltage       real                               not null, -- Current pack voltage
        time               timestamptz    default now()       not null,

        PRIMARY KEY(time, uuid),
        FOREIGN KEY(battery_uuid) REFERENCES batteries(uuid)
);
ALTER TABLE battery_cell_data OWNER TO admin;
SELECT create_hypertable('battery_cell_data', 'time', chunk_time_interval => INTERVAL '1 day');
ALTER TABLE battery_cell_data SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'battery_uuid',
  timescaledb.compress_orderby = 'time DESC, uuid'
);
SELECT add_retention_policy('battery_cell_data', INTERVAL '30 days');
SELECT add_compression_policy('battery_cell_data', INTERVAL '1 day');

-- Indexing for spatial and time-series performance
CREATE INDEX index_battery_cell_data_latest ON battery_cell_data (battery_uuid, cell_id, time DESC);
ALTER INDEX index_battery_cell_data_latest OWNER TO admin;

-- Liquid tanks
CREATE TABLE tank_data (
        uuid                uuid           default uuidv7()    not null,
        tank_uuid           uuid                               not null,
        tank_type           text                               not null, -- 'diesel', 'water', etc
        level_litres        real                               not null,
        capacity_litres     real                               not null,
        time                timestamptz    default now()       not null,

        PRIMARY KEY(time, uuid), 
        FOREIGN KEY(tank_uuid) REFERENCES tanks(uuid)
);
ALTER TABLE tank_data OWNER TO admin;
SELECT create_hypertable('tank_data', 'time', chunk_time_interval => INTERVAL '1 day');
ALTER TABLE tank_data SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'tank_uuid',
  timescaledb.compress_orderby = 'time DESC, uuid'
);
SELECT add_retention_policy('tank_data', INTERVAL '30 days');
SELECT add_compression_policy('tank_data', INTERVAL '1 day');

-- View to quickly access the most recent cell data.
CREATE OR REPLACE VIEW current_tank_data AS SELECT DISTINCT ON (tank_uuid) * FROM tank_data ORDER BY tank_uuid, time DESC;
ALTER VIEW current_tank_data OWNER TO admin;

-- Indexing for spatial and time-series performance
CREATE INDEX index_tank_data_latest ON tank_data (tank_uuid, time DESC);
ALTER INDEX index_tank_data_latest OWNER TO admin;

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

        PRIMARY KEY(time, uuid), 
        FOREIGN KEY(ais_target_mmsi) REFERENCES ais_targets(mmsi)
);
ALTER TABLE ais_dynamics OWNER TO admin;
SELECT create_hypertable('ais_dynamics', 'time', chunk_time_interval => INTERVAL '1 day');
ALTER TABLE ais_dynamics SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'ais_target_mmsi',
  timescaledb.compress_orderby = 'time DESC, uuid'
);
SELECT add_retention_policy('ais_dynamics', INTERVAL '30 days');
SELECT add_compression_policy('ais_dynamics', INTERVAL '1 day');

-- View to quickly access the most recent cell data.
CREATE OR REPLACE VIEW current_ais_dynamics AS SELECT DISTINCT ON (ais_target_mmsi) * FROM ais_dynamics ORDER BY ais_target_mmsi, time DESC;
ALTER VIEW current_ais_dynamics OWNER TO admin;

-- Indexing for spatial and time-series performance
CREATE INDEX index_ais_dynamics_latest ON ais_dynamics (ais_target_mmsi, time DESC);
CREATE INDEX index_ais_dynamics_spatial ON ais_dynamics USING GIST (location);
ALTER INDEX index_ais_dynamics_latest OWNER TO admin;
ALTER INDEX index_ais_dynamics_spatial OWNER TO admin;

-- These were created automatically
ALTER TABLE spatial_ref_sys OWNER TO admin;
ALTER VIEW geography_columns OWNER TO admin;
ALTER VIEW geometry_columns OWNER TO admin;
-- ALTER VIEW health_summary OWNER TO admin;
-- ALTER VIEW propulsion_efficiency OWNER TO admin;
ALTER VIEW raster_columns OWNER TO admin;
ALTER VIEW raster_overviews OWNER TO admin;

-- Make sure 'admin' can do everything in this database.
GRANT USAGE ON SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA history TO admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA history TO admin;
