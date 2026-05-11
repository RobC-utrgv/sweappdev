import { invoke } from "@tauri-apps/api/core";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const auth = document.getElementById("auth");
const register = document.getElementById("register");
const dashboard = document.getElementById("dashboard");
const friendsPage = document.getElementById("friendsPage");
const addEventPage = document.getElementById("addEventPage");

const message = document.getElementById("message");
const registerMessage = document.getElementById("registerMessage");
const welcome = document.getElementById("welcome");

const settingsBtn = document.getElementById("settingsBtn");
const settingsDropdown = document.getElementById("settingsDropdown");
const deleteAccountBtn = document.getElementById("deleteAccountBtn");

const goToAddEventBtn = document.getElementById("goToAddEventBtn");
const goToFriendsBtn = document.getElementById("goToFriendsBtn");

const friendUsernameInput = document.getElementById("friendUsernameInput");
const friendsList = document.getElementById("friendsList");
const incomingRequests = document.getElementById("incomingRequests");

const buildingLayers = {};
let friendMarkers = [];

let map = null;
let currentUser = null;

function hideAll() {
  auth.classList.add("hidden");
  register.classList.add("hidden");
  dashboard.classList.add("hidden");
  friendsPage.classList.add("hidden");
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
    .then((res) => res.json())
    .then((data) => {
      const buildingSelect = document.getElementById("eventBuilding");
      buildingSelect.innerHTML = '<option value="">Select Building</option>';

      L.geoJSON(data, {
        style: () => ({
          color: "#f97316",
          weight: 2,
          fillColor: "#fdba74",
          fillOpacity: 0.6,
        }),
        onEachFeature: (feature, layer) => {
          const buildingName = feature.properties.name || "Unnamed Building";
          buildingLayers[buildingName] = layer;

          const option = document.createElement("option");
          option.value = buildingName;
          option.textContent = buildingName;
          buildingSelect.appendChild(option);

          layer.bindPopup(`
            <div style="min-width:150px">
              <strong>${buildingName}</strong><br><br>
              <button class="locate-events-btn" data-building="${buildingName}">
                Locate Events
              </button>
            </div>
          `);
        },
      }).addTo(map);
    })
    .catch((err) => console.error("Failed to load GeoJSON:", err));

  L.marker(utrgvCenter)
    .addTo(map)
    .bindPopup("<strong>UTRGV Edinburg Campus</strong>")
    .openPopup();
}

function showDashboard(username) {
  hideAll();
  dashboard.classList.remove("hidden");

  welcome.textContent = `Welcome, ${username}!`;

  setTimeout(() => {
    initMap();
    loadAllEvents();
    loadFriendsOnMap();
  }, 0);
}

async function loadAllEvents() {
  const events = await invoke("get_all_events");
  const container = document.getElementById("eventItems");

  container.innerHTML = "";

  if (!events.length) {
    container.innerHTML = "<p style='font-size:12px'>No events</p>";
    return;
  }

  events.forEach((event) => {
    const div = document.createElement("div");
    div.className = "event-card";

    div.innerHTML = `
      <strong>${event.name}</strong><br>
      <span>${event.date}</span><br>
      <small>by ${event.created_by}</small>
    `;

    if (event.created_by === currentUser) {
      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.className = "small-btn";

      delBtn.onclick = async (e) => {
        e.stopPropagation();

        const confirmed = confirm("Delete this event permanently?");
        if (!confirmed) return;

        const res = await invoke("delete_event", {
          eventId: event.id,
          username: currentUser,
        });

        alert(res.message);
        loadAllEvents();
      };

      div.appendChild(delBtn);
    }

    div.onclick = () => focusBuilding(event);
    container.appendChild(div);
  });
}

function focusBuilding(event) {
  const layer = buildingLayers[event.building];

  if (!layer) {
    alert("Building not found on map.");
    return;
  }

  map.fitBounds(layer.getBounds());

  let popupContent = `
    <strong>${event.name}</strong><br>
    ${event.date}<br>
    Organizer: ${event.organizer}<br>
    Created by: ${event.created_by}<br><br>
    ${event.description}
  `;

  if (event.created_by === currentUser) {
    popupContent += `<br><br><button id="deleteEventPopupBtn">Delete Event</button>`;
  }

  layer.openPopup(popupContent);

  map.once("popupopen", () => {
    const btn = document.getElementById("deleteEventPopupBtn");
    if (!btn) return;

    btn.onclick = async () => {
      const confirmed = confirm("Delete this event?");
      if (!confirmed) return;

      const res = await invoke("delete_event", {
        eventId: event.id,
        username: currentUser,
      });

      alert(res.message);
      loadAllEvents();
      map.closePopup();
    };
  });
}

async function handleLocateEvents(buildingName) {
  const events = await invoke("get_events_for_building", {
    building: buildingName,
  });

  if (!events.length) {
    alert("No events found for this building.");
    return;
  }

  alert(
    events
      .map(
        (e) =>
          `${e.name}\n${e.date}\nOrganizer: ${e.organizer}\nCreated by: ${e.created_by}\n\n${e.description}`
      )
      .join("\n\n")
  );
}

async function loadIncomingRequests() {
  incomingRequests.innerHTML = "";

  const requests = await invoke("get_incoming_requests", {
    username: currentUser,
  });

  if (!requests.length) {
    incomingRequests.innerHTML = "<p>No requests.</p>";
    return;
  }

  requests.forEach((req) => {
    const div = document.createElement("div");
    div.className = "friend-card";

    div.innerHTML = `
      <strong>${req.sender}</strong>
      <button data-id="${req.id}" data-accept="true">Accept</button>
      <button data-id="${req.id}" data-accept="false">Reject</button>
    `;

    incomingRequests.appendChild(div);
  });
}

async function loadFriendsList() {
  console.log("Loading friends for:", currentUser);

  friendsList.innerHTML = "";

  const friends = await invoke("get_friends", {
    username: currentUser,
  });

  console.log("Friends returned:", friends);

  const title = document.createElement("h3");
  title.textContent = "Your Friends";
  friendsList.appendChild(title);

  if (!friends.length) {
    friendsList.innerHTML += "<p>No friends yet.</p>";
    return;
  }

  friends.forEach((friend) => {
    const div = document.createElement("div");
    div.style.padding = "10px";
    div.style.marginTop = "8px";
    div.style.border = "1px solid #f97316";
    div.style.borderRadius = "10px";
    div.style.background = "#111827";
    div.style.color = "white";
    div.innerHTML = `<strong>${friend}</strong><br><span>📍 On campus</span>`;

    friendsList.appendChild(div);
  });
}

function clearFriendMarkers() {
  friendMarkers.forEach((marker) => map.removeLayer(marker));
  friendMarkers = [];
}

async function loadFriendsOnMap() {
  if (!map || !currentUser) return;

  clearFriendMarkers();

  const friends = await invoke("get_friends", {
    username: currentUser,
  });

  friends.forEach((friend, index) => {
    const fakeLocations = [
      [26.3048, -98.1741],
      [26.3057, -98.1727],
      [26.3036, -98.1752],
      [26.3063, -98.1738],
    ];

    const location = fakeLocations[index % fakeLocations.length];

    const marker = L.marker(location)
      .addTo(map)
      .bindPopup(`
        <strong>${friend}</strong><br>
        <span>📍 On campus</span><br>
        <span>💬 Status: Studying</span>
      `);

    friendMarkers.push(marker);
  });
}

settingsBtn.onclick = () => {
  settingsDropdown.style.display =
    settingsDropdown.style.display === "block" ? "none" : "block";
};

goToFriendsBtn.onclick = async () => {
  hideAll();

  friendsPage.classList.remove("hidden");

  alert("Friends page loaded");

  await loadIncomingRequests();
  await loadFriendsList();

  console.log("friendsList element:", friendsList);
  console.log("friendsList innerHTML:", friendsList.innerHTML);
};

document.getElementById("sendFriendRequestBtn").onclick = async () => {
  const receiver = friendUsernameInput.value.trim();

  if (!receiver) return alert("Enter a username.");

  const res = await invoke("send_friend_request", {
    sender: currentUser,
    receiver,
  });

  alert(res.message);
  friendUsernameInput.value = "";
};

document.getElementById("backToDashboardBtn").onclick = () => {
  showDashboard(currentUser);
};

document.getElementById("submitEventBtn").onclick = async () => {
  const response = await invoke("add_event", {
    name: eventName.value,
    organizer: eventOrganizer.value,
    date: eventDate.value,
    description: eventDescription.value,
    building: eventBuilding.value,
    createdBy: currentUser,
  });

  alert(response.message);

  if (response.success) {
    showDashboard(currentUser);
  }
};

document.addEventListener("click", async (e) => {
  if (e.target.dataset.id && e.target.dataset.accept) {
    const res = await invoke("respond_to_friend_request", {
      requestId: parseInt(e.target.dataset.id),
      accept: e.target.dataset.accept === "true",
    });

    alert(res.message);

    await loadIncomingRequests();
    await loadFriendsList();
    await loadFriendsOnMap();
  }
});

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

  const confirmed = confirm("This will permanently delete your account.");
  if (!confirmed) return;

  const response = await invoke("delete_user", {
    username: currentUser,
  });

  alert(response.message);

  if (response.success) {
    currentUser = null;
    showLogin();
  }
};

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

showLogin();