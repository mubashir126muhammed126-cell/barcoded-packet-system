const SUPABASE_URL =
  "https://xmbabihlrguuqewgilfo.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_fOgnuaVOZB_4SWGgx1zd2g_QVY84nIH";

const client = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


let currentUser = null;
let currentProfile = null;
let scanner = null;
let latestShipment = null;


/* =========================
   LOGIN
========================= */

async function login() {

  const email =
    document.getElementById("email").value.trim();

  const password =
    document.getElementById("password").value;

  const message =
    document.getElementById("loginMessage");

  message.className = "message";
  message.textContent = "Logging in...";

  const { error } =
    await client.auth.signInWithPassword({
      email,
      password
    });

  if (error) {

    message.className = "message error";
    message.textContent = error.message;

    return;
  }

  await loadUser();

}


/* =========================
   LOAD USER
========================= */

async function loadUser() {

  const {
    data: {
      user
    }
  } = await client.auth.getUser();

  if (!user) {

    showLogin();

    return;
  }

  currentUser = user;

  const {
    data: profile,
    error
  } = await client
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", user.id)
    .single();

  if (error || !profile) {

    alert("Profile not found.");

    await client.auth.signOut();

    return;
  }

  if (!profile.active) {

    alert("Your account is inactive.");

    await client.auth.signOut();

    return;
  }

  currentProfile = profile;

  document.getElementById("userInfo").textContent =
    `${profile.full_name || user.email} • ${profile.role}`;

  showApp();

  if (profile.role !== "admin") {

    document.getElementById(
      "createShipmentMenu"
    ).classList.add("hidden");

  }

  showSection("dashboard");

}


/* =========================
   APP / LOGIN VIEW
========================= */

function showLogin() {

  document
    .getElementById("loginPage")
    .classList.remove("hidden");

  document
    .getElementById("appPage")
    .classList.add("hidden");

}


function showApp() {

  document
    .getElementById("loginPage")
    .classList.add("hidden");

  document
    .getElementById("appPage")
    .classList.remove("hidden");

}


async function logout() {

  await client.auth.signOut();

  currentUser = null;
  currentProfile = null;

  showLogin();

}


/* =========================
   NAVIGATION
========================= */

function showSection(id) {

  document
    .querySelectorAll(".section")
    .forEach(section => {
      section.classList.add("hidden");
    });

  const section =
    document.getElementById(id);

  if (section) {
    section.classList.remove("hidden");
  }

  if (id === "dashboard")
    loadDashboard();

  if (id === "shipments")
    loadShipments();

  if (id === "packets")
    loadPackets();

  if (id === "reports")
    loadReports();

}


/* =========================
   CREATE SHIPMENT
========================= */

async function createShipment() {

  if (currentProfile?.role !== "admin") {

    showMessage(
      "createMessage",
      "Admin access required.",
      false
    );

    return;
  }

  const customerName =
    document
      .getElementById("customerName")
      .value
      .trim();

  if (!customerName) {

    showMessage(
      "createMessage",
      "Enter customer name.",
      false
    );

    return;
  }

  showMessage(
    "createMessage",
    "Creating shipment...",
    true
  );

  const {
    data,
    error
  } = await client.rpc(
    "create_shipment",
    {
      p_customer_name: customerName
    }
  );

  if (error) {

    showMessage(
      "createMessage",
      error.message,
      false
    );

    console.error(error);

    return;
  }

  latestShipment = data;

  document
    .getElementById("createdShipment")
    .classList.remove("hidden");

  document.getElementById("newAwb").textContent =
    data.awb_number;

  document.getElementById("newPacket").textContent =
    data.packet_id;

  document.getElementById("newStatus").textContent =
    data.status;

  showMessage(
    "createMessage",
    "Shipment created successfully.",
    true
  );

  document
    .getElementById("customerName")
    .value = "";

  await loadDashboard();

}


/* =========================
   SHIPMENTS
========================= */

async function loadShipments() {

  const table =
    document.getElementById("shipmentTable");

  table.innerHTML =
    "<tr><td colspan='5'>Loading...</td></tr>";

  const {
    data,
    error
  } = await client
    .from("orders")
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) {

    table.innerHTML =
      `<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>`;

    return;
  }

  if (!data.length) {

    table.innerHTML =
      "<tr><td colspan='5'>No shipments found.</td></tr>";

    return;
  }

  table.innerHTML = data.map(order => {

    return `
      <tr>

        <td>
          <strong>${escapeHtml(order.awb_number)}</strong>
        </td>

        <td>
          ${escapeHtml(order.customer_name || "-")}
        </td>

        <td>
          <span class="status">
            ${escapeHtml(order.status)}
          </span>
        </td>

        <td>
          ${formatDate(order.created_at)}
        </td>

        <td>

          ${
            currentProfile?.role === "admin"
            ? `
              <button onclick="changeStatus('${escapeAttribute(order.awb_number)}')">
                Update
              </button>
            `
            : ""
          }

        </td>

      </tr>
    `;

  }).join("");

}


/* =========================
   UPDATE STATUS
========================= */

async function changeStatus(awb) {

  const status =
    prompt(
      "Enter status:\nready / packed / linked / dispatched / delivered / cancelled",
      "packed"
    );

  if (!status) return;

  const {
    error
  } = await client.rpc(
    "update_shipment_status",
    {
      p_awb: awb,
      p_status: status.trim().toLowerCase()
    }
  );

  if (error) {

    alert(error.message);

    return;
  }

  alert("Shipment status updated.");

  await loadShipments();
  await loadDashboard();

}


/* =========================
   PACKETS
========================= */

async function loadPackets() {

  const table =
    document.getElementById("packetTable");

  table.innerHTML =
    "<tr><td colspan='4'>Loading...</td></tr>";

  const {
    data,
    error
  } = await client
    .from("packets")
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) {

    table.innerHTML =
      `<tr><td colspan="4">${escapeHtml(error.message)}</td></tr>`;

    return;
  }

  if (!data.length) {

    table.innerHTML =
      "<tr><td colspan='4'>No packets found.</td></tr>";

    return;
  }

  table.innerHTML = data.map(packet => {

    return `
      <tr>

        <td>
          <strong>${escapeHtml(packet.packet_id)}</strong>
        </td>

        <td>
          ${escapeHtml(packet.qr_value)}
        </td>

        <td>
          <span class="status">
            ${escapeHtml(packet.status)}
          </span>
        </td>

        <td>
          ${formatDate(packet.created_at)}
        </td>

      </tr>
    `;

  }).join("");

}


/* =========================
   DASHBOARD
========================= */

async function loadDashboard() {

  const {
    data,
    error
  } = await client
    .from("orders")
    .select("awb_number, customer_name, status, created_at")
    .order("created_at", {
      ascending: false
    });

  if (error) {

    console.error(error);

    return;
  }

  document.getElementById("totalShipments")
    .textContent = data.length;

  document.getElementById("readyShipments")
    .textContent =
    data.filter(x => x.status === "ready").length;

  document.getElementById("linkedShipments")
    .textContent =
    data.filter(x => x.status === "linked").length;

  document.getElementById("deliveredShipments")
    .textContent =
    data.filter(x => x.status === "delivered").length;


  const recent =
    document.getElementById("recentShipments");

  const rows =
    data.slice(0, 10);

  if (!rows.length) {

    recent.innerHTML =
      "<p>No shipments yet.</p>";

    return;
  }

  recent.innerHTML = `
    <div class="table-container">

      <table>

        <thead>

          <tr>
            <th>AWB</th>
            <th>Customer</th>
            <th>Status</th>
          </tr>

        </thead>

        <tbody>

          ${rows.map(x => `
            <tr>

              <td>
                ${escapeHtml(x.awb_number)}
              </td>

              <td>
                ${escapeHtml(x.customer_name || "-")}
              </td>

              <td>
                <span class="status">
                  ${escapeHtml(x.status)}
                </span>
              </td>

            </tr>
          `).join("")}

        </tbody>

      </table>

    </div>
  `;

}


/* =========================
   SCANNER
========================= */

async function startScanner() {

  if (scanner) {

    try {
      await scanner.stop();
    } catch {}

    scanner = null;
  }

  scanner =
    new Html5Qrcode("reader");

  const formats = [

    Html5QrcodeSupportedFormats.QR_CODE,

    Html5QrcodeSupportedFormats.CODE_128,

    Html5QrcodeSupportedFormats.CODE_39,

    Html5QrcodeSupportedFormats.EAN_13,

    Html5QrcodeSupportedFormats.EAN_8

  ];


  try {

    await scanner.start(

      {
        facingMode: "environment"
      },

      {
        fps: 10,

        qrbox: {
          width: 280,
          height: 180
        },

        formatsToSupport: formats

      },

      decodedText => {

        handleScan(decodedText);

      },

      () => {}

    );

  } catch (error) {

    document.getElementById(
      "scanResult"
    ).textContent =
      "Camera error: " + error;

  }

}


function handleScan(value) {

  value =
    value.trim();

  if (value.startsWith("AWB-")) {

    document.getElementById(
      "scanAwb"
    ).value = value;

    showMessage(
      "scanResult",
      "AWB scanned: " + value,
      true
    );

    return;
  }


  if (value.startsWith("PKT-")) {

    document.getElementById(
      "scanPacket"
    ).value = value;

    showMessage(
      "scanResult",
      "Packet scanned: " + value,
      true
    );

    return;
  }

}


/* =========================
   VERIFY & LINK
========================= */

async function verifyAndLink() {

  const awb =
    document
      .getElementById("scanAwb")
      .value
      .trim();

  const packet =
    document
      .getElementById("scanPacket")
      .value
      .trim();

  if (!awb || !packet) {

    showMessage(
      "scanResult",
      "Scan both AWB and Packet ID.",
      false
    );

    return;
  }


  showMessage(
    "scanResult",
    "Verifying...",
    true
  );


  const {
    data,
    error
  } = await client.rpc(
    "link_packet",
    {
      p_awb: awb,
      p_packet: packet
    }
  );


  if (error) {

    showMessage(
      "scanResult",
      error.message,
      false
    );

    return;
  }


  showMessage(
    "scanResult",
    `✓ Linked ${data.awb_number} ↔ ${data.packet_id}`,
    true
  );


  document.getElementById(
    "scanAwb"
  ).value = "";

  document.getElementById(
    "scanPacket"
  ).value = "";

  await loadDashboard();

}


/* =========================
   TRACKING
========================= */

async function trackShipment() {

  const awb =
    document
      .getElementById("trackingAwb")
      .value
      .trim();

  const result =
    document.getElementById(
      "trackingResult"
    );


  if (!awb) {

    result.innerHTML =
      "<div class='card'>Enter an AWB number.</div>";

    return;
  }


  const {
    data,
    error
  } = await client
    .from("orders")
    .select("*")
    .eq("awb_number", awb)
    .maybeSingle();


  if (error) {

    result.innerHTML =
      `<div class="card error">${escapeHtml(error.message)}</div>`;

    return;
  }


  if (!data) {

    result.innerHTML =
      "<div class='card'>AWB not found.</div>";

    return;
  }


  const {
    data: link
  } = await client
    .from("packet_scans")
    .select("packet_id, status, scanned_at")
    .eq("awb_number", awb)
    .maybeSingle();


  result.innerHTML = `

    <div class="card">

      <h2>Shipment Details</h2>

      <p>
        <strong>AWB:</strong>
        ${escapeHtml(data.awb_number)}
      </p>

      <p>
        <strong>Customer:</strong>
        ${escapeHtml(data.customer_name || "-")}
      </p>

      <p>
        <strong>Status:</strong>
        ${escapeHtml(data.status)}
      </p>

      <p>
        <strong>Packet:</strong>
        ${escapeHtml(link?.packet_id || "Not linked")}
      </p>

      <p>
        <strong>Created:</strong>
        ${formatDate(data.created_at)}
      </p>

    </div>

  `;

}


/* =========================
   REPORTS
========================= */

async function loadReports() {

  const {
    data,
    error
  } = await client
    .from("orders")
    .select("status");

  if (error) return;

  const count =
    status =>
      data.filter(
        x => x.status === status
      ).length;

  document.getElementById("reportReady")
    .textContent = count("ready");

  document.getElementById("reportPacked")
    .textContent = count("packed");

  document.getElementById("reportDispatched")
    .textContent = count("dispatched");

  document.getElementById("reportDelivered")
    .textContent = count("delivered");

}


/* =========================
   LABEL
========================= */

function generateLabel() {

  if (!latestShipment) {

    alert("Create a shipment first.");

    return;
  }


  document.getElementById(
    "labelAwb"
  ).textContent =
    latestShipment.awb_number;


  document.getElementById(
    "labelPacket"
  ).textContent =
    latestShipment.packet_id;


  document.getElementById(
    "qrcode"
  ).innerHTML = "";


  new QRCode(
    document.getElementById("qrcode"),
    {
      text: latestShipment.packet_id,
      width: 150,
      height: 150
    }
  );


  JsBarcode(
    "#barcode",
    latestShipment.awb_number,
    {
      format: "CODE128",
      width: 2,
      height: 65,
      displayValue: true,
      margin: 10
    }
  );


  showSection("labelSection");

}


/* =========================
   HELPERS
========================= */

function showMessage(
  id,
  message,
  success
) {

  const element =
    document.getElementById(id);

  element.textContent =
    message;

  element.className =
    success
      ? "message success"
      : "message error";

}


function formatDate(date) {

  if (!date) return "-";

  return new Date(date)
    .toLocaleString();
}


function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function escapeAttribute(value) {

  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'");

}


/* =========================
   STARTUP
========================= */

client.auth.onAuthStateChange(
  async (event, session) => {

    if (session?.user) {

      await loadUser();

    } else {

      showLogin();

    }

  }
);


(async function () {

  const {
    data: {
      session
    }
  } = await client.auth.getSession();

  if (session?.user) {

    await loadUser();

  } else {

    showLogin();

  }

})();
