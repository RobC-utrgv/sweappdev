// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::Manager;
use rusqlite::{Connection, params};
use serde::Serialize;
use bcrypt::{hash, verify, DEFAULT_COST};

#[derive(Serialize)]
struct Response {
    success: bool,
    message: String,
}

#[derive(Serialize)]
struct Event {
    id: i32,
    name: String,
    organizer: String,
    date: String,
    description: String,
    building: String,
}

fn init_db(app: &tauri::AppHandle) -> Connection {
    let db_path = app
        .path()
        .resolve("users.db", tauri::path::BaseDirectory::AppData)
        .expect("Failed to resolve DB path");

    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).unwrap();
    }

    let conn = Connection::open(db_path).expect("Failed to open DB");

    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )",
        [],
    ).unwrap();
// path of database: C:\Users\<User>\AppData\Roaming\<YourApp>\users.db
    conn.execute(
        "CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            organizer TEXT NOT NULL,
            date TEXT NOT NULL,
            description TEXT,
            building TEXT NOT NULL,
            created_by TEXT NOT NULL
        )",
        [],
    ).unwrap();

    conn
}

#[tauri::command]
fn register_user(app: tauri::AppHandle, username: String, password: String) -> Response {
    let conn = init_db(&app);
    let hashed = hash(password, DEFAULT_COST).unwrap();

    match conn.execute(
        "INSERT INTO users (username, password) VALUES (?1, ?2)",
        params![username, hashed],
    ) {
        Ok(_) => Response { success: true, message: "User registered!".into() },
        Err(e) => Response { success: false, message: format!("Error: {}", e) },
    }
}

#[tauri::command]
fn login_user(app: tauri::AppHandle, username: String, password: String) -> Response {
    let conn = init_db(&app);

    let mut stmt = conn.prepare("SELECT password FROM users WHERE username = ?1").unwrap();
    let mut rows = stmt.query(params![username]).unwrap();

    if let Ok(Some(row)) = rows.next() {
        let stored_hash: String = row.get(0).unwrap();
        if verify(password, &stored_hash).unwrap() {
            return Response { success: true, message: "Login successful!".into() };
        }
    }

    Response { success: false, message: "Incorrect user or password.".into() }
}

#[tauri::command]
fn delete_user(app: tauri::AppHandle, username: String) -> Response {
    let conn = init_db(&app);

    match conn.execute("DELETE FROM users WHERE username = ?1", params![username]) {
        Ok(_) => Response { success: true, message: "Account deleted.".into() },
        Err(e) => Response { success: false, message: e.to_string() },
    }
}

#[tauri::command]
fn add_event(
    app: tauri::AppHandle,
    name: String,
    organizer: String,
    date: String,
    description: String,
    building: String,
    created_by: String,
) -> Response {
    let conn = init_db(&app);

    match conn.execute(
        "INSERT INTO events (name, organizer, date, description, building, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![name, organizer, date, description, building, created_by],
    ) {
        Ok(_) => Response { success: true, message: "Event added.".into() },
        Err(e) => Response { success: false, message: e.to_string() },
    }
}

#[tauri::command]
fn get_events_for_building(app: tauri::AppHandle, building: String) -> Vec<Event> {
    let conn = init_db(&app);

    let mut stmt = conn.prepare(
        "SELECT id, name, organizer, date, description, building
         FROM events WHERE building = ?1"
    ).unwrap();

    stmt.query_map(params![building], |row| {
        Ok(Event {
            id: row.get(0)?,
            name: row.get(1)?,
            organizer: row.get(2)?,
            date: row.get(3)?,
            description: row.get(4)?,
            building: row.get(5)?,
        })
    })
    .unwrap()
    .filter_map(Result::ok)
    .collect()
}

#[tauri::command]
fn get_all_events(app: tauri::AppHandle) -> Vec<Event> {
    let conn = init_db(&app);

    let mut stmt = conn.prepare(
        "SELECT id, name, organizer, date, description, building FROM events"
    ).unwrap();

    stmt.query_map([], |row| {
        Ok(Event {
            id: row.get(0)?,
            name: row.get(1)?,
            organizer: row.get(2)?,
            date: row.get(3)?,
            description: row.get(4)?,
            building: row.get(5)?,
        })
    })
    .unwrap()
    .filter_map(Result::ok)
    .collect()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            register_user,
            login_user,
            delete_user,
            add_event,
            get_all_events,
            get_events_for_building
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}