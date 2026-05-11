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
const addEventPage = document.getElementById("addEventPage");
const goToAddEventBtn = document.getElementById("goToAddEventBtn");
const buildingLayers = {};

let map = null;
let currentUser = null;

function hideAll() {
  auth.classList.add("hidden");
  register.classList.add("hidden");
  dashboard.classList.add("hidden");
  addEventPage.classList.add("hidden");
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

    const buildingSelect = document.getElementById("eventBuilding");
    buildingSelect.innerHTML = '<option value="">Select Building</option>';

    L.geoJSON(data, {
      style: feature => ({
        color: "#f97316",
        weight: 2,
        fillColor: "#fdba74",
        fillOpacity: 0.6
      }),
      onEachFeature: (feature, layer) => {
        
        const buildingName = feature.properties.name || "Unnamed Building";
        buildingLayers[buildingName] = layer;

        const option = document.createElement("option");
        option.value = buildingName;
        option.textContent = buildingName;
        buildingSelect.appendChild(option);

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
  loadAllEvents();
}

function focusBuilding(event) {
  const layer = buildingLayers[event.building];
  if (!layer) {
    alert("Building not found on map.");
    return;
  }

  map.fitBounds(layer.getBounds());

  layer.openPopup(`
    <strong>${event.name}</strong><br>
    ${event.date}<br>
    ${event.organizer}<br><br>
    ${event.description}
  `);
}

function initTheme() {
  const storedTheme = localStorage.getItem("theme") || "light";
  root.setAttribute("data-theme", storedTheme);
  themeToggle.checked = storedTheme === "dark";
}


async function handleLocateEvents(buildingName) {
  const events = await invoke("get_events_for_building", { building: buildingName });

  if (!events.length) {
    alert("No events found for this building.");
    return;
  }

  alert(
    events.map(e =>
      `${e.name}\n${e.date}\nOrganizer: ${e.organizer}\n${e.description}`
    ).join("\n\n")
  );
}


settingsBtn.onclick = () => {
  settingsDropdown.style.display =
    settingsDropdown.style.display === "block" ? "none" : "block";
};

async function loadAllEvents() {
  const events = await invoke("get_all_events");
  const container = document.getElementById("eventItems");

  container.innerHTML = "";

  if (!events.length) {
    container.innerHTML = "<p style='font-size:12px'>No events</p>";
    return;
  }

  events.forEach(event => {
    const div = document.createElement("div");
    div.style.padding = "6px";
    div.style.cursor = "pointer";
    div.style.borderBottom = "1px solid #e5e7eb";

    div.innerHTML = `
      <strong>${event.name}</strong><br>
      <span style="font-size:12px">${event.date}</span>
    `;

    div.onclick = () => focusBuilding(event);

    container.appendChild(div);
  });
}


document.getElementById("submitEventBtn").onclick = async () => {
  const response = await invoke("add_event", {
    name: eventName.value,
    organizer: eventOrganizer.value,
    date: eventDate.value,
    description: eventDescription.value,
    building: eventBuilding.value,
    createdBy: currentUser
  });

  alert(response.message);

  if (response.success) {
    showDashboard(currentUser);
  }
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
goToAddEventBtn.onclick = () => {
  hideAll();
  addEventPage.classList.remove("hidden");
};

document.getElementById("cancelEventBtn").onclick = () => {
  showDashboard(currentUser);
};

document.getElementById("loginBtn").onclick = login;
document.getElementById("submitRegisterBtn").onclick = registerUser;
document.getElementById("goToRegisterBtn").onclick = showRegister;
document.getElementById("backToLoginBtn").onclick = showLogin;
document.getElementById("logoutBtn").onclick = showLogin;
initTheme();
showLogin();