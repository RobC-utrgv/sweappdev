import { invoke } from "@tauri-apps/api/core";
import L from "leaflet";

import "leaflet/dist/leaflet.css";



const auth = document.getElementById("auth");
const register = document.getElementById("register");
const dashboard = document.getElementById("dashboard");
const themeToggle = document.getElementById("themeToggle");
const root = document.documentElement;
const message = document.getElementById("message");
const registerMessage = document.getElementById("registerMessage");
const welcome = document.getElementById("welcome");
const settingsBtn = document.getElementById("settingsBtn");
const settingsDropdown = document.getElementById("settingsDropdown");
const deleteAccountBtn = document.getElementById("deleteAccountBtn");


let map = null;
let currentUser = null;

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
    currentUser = username;
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
}

function initMap() {
  if (map) return; 
  const utrgvCenter = [26.304551, -98.174165];

  
  const utrgvBounds = L.latLngBounds(
    [26.298, -98.182], 
    [26.312, -98.165]  
  );

  map = L.map("map", {
    center: utrgvCenter,
    zoom: 16,
    minZoom: 15,
    maxZoom: 19,
    maxBounds: utrgvBounds,
    maxBoundsViscosity: 1.0,
    zoomControl: true,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  fetch("./assets/utrgv_buildings.geojson")
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      style: feature => ({
        color: "#f97316",
        weight: 2,
        fillColor: "#fdba74",
        fillOpacity: 0.6
      }),
      onEachFeature: (feature, layer) => {
        
        const buildingName = feature.properties.name || "Unnamed Building";

        const popupHtml = `
          <div style="min-width:150px">
            <strong>${buildingName}</strong><br><br>
            <button 
              class="locate-events-btn"
              data-building="${buildingName}"
              style="
                padding:6px 10px;
                border-radius:6px;
                border:none;
                background:#f97316;
                color:white;
                cursor:pointer;
                width:100%;
              "
            >
              Locate Events 
            </button>
          </div>
        `;

        layer.bindPopup(popupHtml);

      }
    }).addTo(map);
  })
  .catch(err => console.error("Failed to load GeoJSON:", err));

  // Main campus marker
  L.marker(utrgvCenter)
    .addTo(map)
    .bindPopup("<strong>UTRGV Edinburg Campus</strong>")
    .openPopup();
}

function showDashboard(username) {
  hideAll();
  dashboard.classList.remove("hidden");

  welcome.textContent = `Welcome, ${username}!`;

  // Give the DOM a moment to render before creating map
  setTimeout(initMap, 0);
}

function initTheme() {
  const storedTheme = localStorage.getItem("theme") || "light";
  root.setAttribute("data-theme", storedTheme);
  themeToggle.checked = storedTheme === "dark";
}


function handleLocateEvents(buildingName) {
  alert(`Finding events in: ${buildingName}`);
}


settingsBtn.onclick = () => {
  settingsDropdown.style.display =
    settingsDropdown.style.display === "block" ? "none" : "block";
};

document.addEventListener("click", (e) => {
  if (!e.target.closest(".settings-container")) {
    settingsDropdown.style.display = "none";
  }
  if (e.target.classList.contains("locate-events-btn")) {
    const building = e.target.dataset.building;
    handleLocateEvents(building);
  }
});

deleteAccountBtn.onclick = async () => {
  if (!currentUser) {
    alert("No user session found. Please log in again.");
    showLogin();
    return;
  }

  const confirmed = confirm(
    "This will permanently delete your account.\n\nThis action cannot be undone."
  );
  if (!confirmed) return;

  try {
    console.log("Deleting account for:", currentUser);

    const response = await invoke("delete_user", {
      username: currentUser
    });

    console.log("Delete response:", response);

    if (response.success) {
      alert("Account deleted.");
      currentUser = null;
      showLogin();
    } else {
      alert(response.message);
    }
  } catch (err) {
    console.error("Delete account failed:", err);
    alert("Failed to delete account. See console for details.");
  }
};

themeToggle.addEventListener("change", () => {
  const theme = themeToggle.checked ? "dark" : "light";
  root.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
});
``


document.getElementById("loginBtn").onclick = login;
document.getElementById("submitRegisterBtn").onclick = registerUser;
document.getElementById("goToRegisterBtn").onclick = showRegister;
document.getElementById("backToLoginBtn").onclick = showLogin;
document.getElementById("logoutBtn").onclick = showLogin;
initTheme();
showLogin();