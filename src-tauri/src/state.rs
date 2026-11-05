use std::sync::Mutex;

use rusqlite::Connection;

use crate::backup::ProjectContext;

pub struct AppState {
    pub db: Mutex<Option<Connection>>,
    /// Datos del proyecto abierto: identifican su carpeta de backups y
    /// permiten saber si hay cambios sin respaldar.
    ///
    /// Regla de bloqueo: cuando haga falta tomar ambos mutexes, se toma
    /// siempre `db` antes que `project`, nunca al reves. Asi no puede
    /// producircse un interbloqueo.
    pub project: Mutex<Option<ProjectContext>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            db: Mutex::new(None),
            project: Mutex::new(None),
        }
    }
}
