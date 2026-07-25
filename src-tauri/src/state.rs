use std::sync::Mutex;
use rusqlite::Connection;

pub struct AppState {
    pub db: Mutex<Option<Connection>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            db: Mutex::new(None),
        }
    }
}
