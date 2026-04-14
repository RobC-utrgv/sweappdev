// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::Manager;
use rusqlite::{Connection, params};
use serde::Serialize;
use bcrypt::{hash, verify, DEFAULT_COST};
use tauri::path::BaseDirectory;

#[derive(Serialize)]
struct Response {
    success: bool,
    message: String,
}

// Function to initialize database
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
    ).expect("Failed to create table");

    conn
}

// path of database: C:\Users\<User>\AppData\Roaming\<YourApp>\users.db

#[tauri::command]
fn register_user(app: tauri::AppHandle, username: String, password: String) -> Response {
    let conn = init_db(&app);

    // Hash the password
    let hashed = hash(password, DEFAULT_COST).unwrap();

    let result = conn.execute(
        "INSERT INTO users (username, password) VALUES (?1, ?2)",
        params![username, hashed]
    );

    match result {
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
            return Response { 
                success: true, 
                message: "Login successful!".into() 
            };
        }
    }

    Response { 
        success: false, 
        message: "Incorrect user or password. Register if not already.".into() 
    }
}

fn main() {

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![register_user, login_user])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}