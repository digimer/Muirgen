# General Notes
Using 'rustup' instead if rpms via dnf to get access to latest toolchains and cross-compiled simplicity.

## Environment Setup
OS: AlmaLinux 10 on an raspberry pi 4 with the Copperhill PICAN-M HAT

## PICAN-M HAT Setup

To enable the Raspberry Pi's SPI layer, update /boot/config.txt and append under '[all]' the following;

 dtparam=spi=on
 dtoverlay=mcp2515-can0,oscillator=16000000,interrupt=25

Reboot after adding these lines.

Verify that there is now a 'can0' device when running 'ip addr list can0'. 

 ip addr list can0
 3: can0: <NOARP,ECHO> mtu 16 qdisc noop state DOWN group default qlen 10
    link/can 

If the adapter is there, enable it.

 ip link set can0 up type can bitrate 250000
 ip addr list can0

Verify that state is now UP.

3: can0: <NOARP,UP,LOWER_UP,ECHO> mtu 16 qdisc pfifo_fast state UP group default qlen 10
    link/can 

Connect to the N2K bus with a device that is transmitting and verify that the device can see N2K PGNs;

 candump can0
  can0  18EEFF23   [8]  EB 9D E1 10 00 B4 A0 C0
  can0  0DF11923   [8]  00 FF 7F FF 7F FF 7F FF
  can0  09F11323   [8]  00 FF FF FF 7F FF FF FF
  can0  09F80123   [8]  FF FF FF 7F FF FF FF 7F
  can0  09F80223   [8]  FF FC FF FF FF FF FF FF
  can0  0DF80523   [8]  00 2B FF FF FF FF FF FF
(Press ctrl + c to end stream)

### Almalinux 10 base OS setup
Dependencies to install;

 dnf install epel-release
 /usr/bin/crb enable
 dnf groupinstall development
 dnf install pkgconf openssl-devel can-utils

## Rust general notes
Create an unprivileged user. These notes assume 'admin'

### Directory structure
/home/admin/.rustup       # - Metadata
/home/admin/.cargo        # - cargo (extension/library) home directory
/home/admin/.cargo/bin    # - cargo binaries

### Rust install

 curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
Accept the defaults;
====
  default host triple: aarch64-unknown-linux-gnu
  default toolchain: stable (default)
  profile: default
  modify PATH variable: yes
====

# Project Notes

## Setup the project (muirgen_n2kd)

As 'admin':

 cd ~
 if [ ! -d ~/daemons ]; then mkdir daemons; fi
 cd ~/daemons
 cargo new muirgen-n2kd
 cd ~/daemons/muirgen-n2kd

The main config for the program is in Cargo.toml (define dependencies here, for example). The program's root is in the 'src' sub directory.

 cd ~/daemons/muirgen-n2kd/src

There is a sample program called 'main.rs' that you can compile and run;

  cargo run

This will compile and run the program. The compiled output is stored under '~/daemons/muirgen-n2kd/target/debug/'.

## Application notes

Update the ~/daemons/muirgen_n2kd/.env to have the proper DB connection details and authentication.