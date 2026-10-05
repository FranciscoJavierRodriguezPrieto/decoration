// En release no abre consola en Windows. No quitar.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    planocasa_lib::run();
}
