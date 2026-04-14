import { invoke } from "@tauri-apps/api/core";
import L from "leaflet";

import "leaflet/dist/leaflet.css";



const auth = document.getElementById("auth");
const register = document.getElementById("register");
const dashboard = document.getElementById("dashboard");

const message = document.getElementById("message");
const registerMessage = document.getElementById("registerMessage");
const welcome = document.getElementById("welcome");
let map = null;

function hideAll() {
  auth.classList.add("hidden");
  register.classList.add("hidden");
  dashboard.classList.add("hidden");
}

function showLogin() {
  hideAll();
  auth.classList.remove("hidden");
  message.textContent = "";
  message.className = "";
}

function showRegister() {
  hideAll();
  register.classList.remove("hidden");
  registerMessage.textContent = "";
  registerMessage.className = "";
}


async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    message.textContent = "Username and password are required.";
    message.className = "error";
    return;
  }

  const response = await invoke("login_user", { username, password });

  message.textContent = response.message;
  message.className = response.success ? "success" : "error";

  if (response.success) {
    showDashboard(username);
  }
}

async function registerUser() {
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;

  if (!username || !password) {
    registerMessage.textContent = "Username and password are required.";
    registerMessage.className = "error";
    return;
  }

  const response = await invoke("register_user", { username, password });

  registerMessage.textContent = response.message;
  registerMessage.className = response.success ? "success" : "error";

  if (response.success) {
    setTimeout(showLogin, 800);
  }
}

function initMap() {
  if (map) return; // Prevent re-initialization

  map = L.map("map").setView([26.3017, -98.1633], 13); // Edinburg, TX

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  L.marker([26.3017, -98.1633])
    .addTo(map)
    .bindPopup("You are here")
}

function showDashboard(username) {
  hideAll();
  dashboard.classList.remove("hidden");

  welcome.textContent = `Welcome, ${username}!`;

  // Give the DOM a moment to render before creating map
  setTimeout(initMap, 0);
}


document.getElementById("loginBtn").onclick = login;
document.getElementById("submitRegisterBtn").onclick = registerUser;
document.getElementById("goToRegisterBtn").onclick = showRegister;
document.getElementById("backToLoginBtn").onclick = showLogin;
document.getElementById("logoutBtn").onclick = showLogin;

showLogin();