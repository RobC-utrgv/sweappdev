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
    created_by: String,
}

#[derive(Serialize)]
struct FriendRequest {
    id: i32,
    sender: String,
    receiver: String,
    status: String,
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

    conn.execute(
        "CREATE TABLE IF NOT EXISTS friend_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender TEXT NOT NULL,
            receiver TEXT NOT NULL,
            status TEXT NOT NULL,
            UNIQUE(sender, receiver)
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
        "SELECT id, name, organizer, date, description, building, created_by
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
            created_by: row.get(6)?,
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
        "SELECT id, name, organizer, date, description, building, created_by FROM events"
    ).unwrap();

    stmt.query_map([], |row| {
        Ok(Event {
            id: row.get(0)?,
            name: row.get(1)?,
            organizer: row.get(2)?,
            date: row.get(3)?,
            description: row.get(4)?,
            building: row.get(5)?,
            created_by: row.get(6)?,
        })
    })
    .unwrap()
    .filter_map(Result::ok)
    .collect()
}

#[tauri::command]
fn send_friend_request(
    app: tauri::AppHandle,
    sender: String,
    receiver: String,
) -> Response {
    if sender == receiver {
        return Response {
            success: false,
            message: "You cannot add yourself.".into(),
        };
    }

    let conn = init_db(&app);

    let result = conn.execute(
        "INSERT INTO friend_requests (sender, receiver, status)
         VALUES (?1, ?2, 'pending')",
        params![sender, receiver],
    );

    match result {
        Ok(_) => Response {
            success: true,
            message: "Friend request sent.".into(),
        },
        Err(_) => Response {
            success: false,
            message: "Request already exists.".into(),
        },
    }
}

#[tauri::command]
fn get_incoming_requests(
    app: tauri::AppHandle,
    username: String,
) -> Vec<FriendRequest> {
    let conn = init_db(&app);

    let mut stmt = conn.prepare(
        "SELECT id, sender, receiver, status
         FROM friend_requests
         WHERE receiver = ?1 AND status = 'pending'"
    ).unwrap();

    stmt.query_map(params![username], |row| {
        Ok(FriendRequest {
            id: row.get(0)?,
            sender: row.get(1)?,
            receiver: row.get(2)?,
            status: row.get(3)?,
        })
    })
    .unwrap()
    .filter_map(Result::ok)
    .collect()
}

#[tauri::command]
fn respond_to_friend_request(
    app: tauri::AppHandle,
    request_id: i32,
    accept: bool,
) -> Response {
    let conn = init_db(&app);

    let status = if accept { "accepted" } else { "rejected" };

    conn.execute(
        "UPDATE friend_requests SET status = ?1 WHERE id = ?2",
        params![status, request_id],
    ).unwrap();

    Response {
        success: true,
        message: "Request updated.".into(),
    }
}

//
// ⭐ ADDED FUNCTION — NOTHING ELSE CHANGED
//
#[tauri::command]
fn get_friends(app: tauri::AppHandle, username: String) -> Vec<String> {
    let conn = init_db(&app);

    let mut stmt = conn.prepare(
        "SELECT 
            CASE 
                WHEN sender = ?1 THEN receiver
                ELSE sender
            END AS friend
         FROM friend_requests
         WHERE (sender = ?1 OR receiver = ?1)
         AND status = 'accepted'"
    ).unwrap();

    stmt.query_map(params![username], |row| {
        let friend: String = row.get(0)?;
        Ok(friend)
    })
    .unwrap()
    .filter_map(Result::ok)
    .collect()
}

#[tauri::command]
fn delete_event(
    app: tauri::AppHandle,
    event_id: i32,
    username: String,
) -> Response {
    let conn = init_db(&app);

    let mut stmt = conn.prepare(
        "SELECT created_by FROM events WHERE id = ?1"
    ).unwrap();

    let mut rows = stmt.query(params![event_id]).unwrap();

    if let Some(row) = rows.next().unwrap() {
        let owner: String = row.get(0).unwrap();

        if owner != username {
            return Response {
                success: false,
                message: "You are not allowed to delete this event.".into(),
            };
        }

        conn.execute(
            "DELETE FROM events WHERE id = ?1",
            params![event_id],
        ).unwrap();

        return Response {
            success: true,
            message: "Event deleted.".into(),
        };
    }

    Response {
        success: false,
        message: "Event not found.".into(),
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            register_user,
            login_user,
            delete_user,
            add_event,
            get_all_events,
            get_events_for_building,
            send_friend_request,
            get_incoming_requests,
            respond_to_friend_request,
            get_friends,   // ⭐ ADDED HERE
            delete_event
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
