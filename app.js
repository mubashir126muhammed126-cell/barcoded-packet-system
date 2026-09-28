/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL =
  "https://xmbabihlrguuqewgilfo.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_fOgnuaVOZB_4SWGgx1zd2g_QVY84nIH";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );


/* =========================================================
   GLOBALS
========================================================= */

let currentUser = null;
let currentProfile = null;

let html5QrCode = null;
let awbScanner = null;

let reportData = [];


/* =========================================================
   START
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    const {
      data: {
        session
      }
    } =
      await supabaseClient.auth.getSession();

    if (session) {

      currentUser =
        session.user;

      await loadProfile();

    } else {

      showLogin();

    }

  }
);


/* =========================================================
   AUTH
========================================================= */

async function login() {

  const email =
    document
      .getElementById("email")
      .value
      .trim();

  const password =
    document
      .getElementById("password")
      .value;

  if (!email || !password) {

    showMessage(
      "loginMsg",
      "Enter email and password.",
      "error"
    );

    return;
  }


  const {
    data,
    error
  } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });


  if (error) {

    showMessage(
      "loginMsg",
      "❌ " + error.message,
      "error"
    );

    return;
  }


  currentUser =
    data.user;

  await loadProfile();
}


async function logout() {

  stopScanner();
  stopAWBScanner();

  await supabaseClient.auth.signOut();

  currentUser = null;
  currentProfile = null;

  showLogin();
}


function showLogin() {

  document
    .getElementById("loginView")
    .classList.remove("hidden");

  document
    .getElementById("appView")
    .classList.add("hidden");
}


function showApp() {

  document
    .getElementById("loginView")
    .classList.add("hidden");

  document
    .getElementById("appView")
    .classList.remove("hidden");
}


/* =========================================================
   PROFILE
========================================================= */

async function loadProfile() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();


  if (error || !data) {

    alert(
      "Your account has no profile. Contact administrator."
    );

    await supabaseClient.auth.signOut();

    showLogin();

    return;
  }


  currentProfile = data;

  document
    .getElementById("staffName")
    .textContent =
      `${data.full_name || "User"} • ${data.role}`;


  applyRolePermissions();

  showApp();
}


function applyRolePermissions() {

  const admin =
    currentProfile &&
    currentProfile.role === "admin";


  document
    .querySelectorAll(".admin-only")
    .forEach(element => {

      if (admin) {

        element.classList.remove("hidden");

      } else {

        element.classList.add("hidden");

      }

    });
}


/* =========================================================
   TABS
========================================================= */

function showTab(tabName) {

  if (
    ["dashboard", "reports", "labels"]
      .includes(tabName)
    &&
    currentProfile?.role !== "admin"
  ) {

    alert("Admin access required.");

    return;
  }


  document
    .querySelectorAll(".tab")
    .forEach(section =>
      section.classList.add("hidden")
    );


  const section =
    document.getElementById(tabName);

  if (section) {

    section.classList.remove("hidden");

  }


  if (tabName === "history") {
    loadMyScans();
  }


  if (tabName === "dashboard") {
    loadDashboard();
  }


  if (tabName === "reports") {
    loadReports();
  }

}


/* =========================================================
   QR SCANNER
========================================================= */

function startScanner() {

  if (html5QrCode) {
    return;
  }


  html5QrCode =
    new Html5Qrcode("reader");


  html5QrCode.start(

    {
      facingMode: "environment"
    },

    {
      fps: 10,

      qrbox: {
        width: 250,
        height: 250
      },

      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE
      ]
    },

    function(decodedText) {

      document
        .getElementById("packet")
        .value = decodedText;


      showMessage(
        "scanMsg",
        "✅ Packet QR scanned: " + decodedText,
        "success"
      );


      stopScanner();

    },

    function() {}

  )
  .catch(function(error) {

    showMessage(
      "scanMsg",
      "❌ Camera error: " + error,
      "error"
    );

  });
}


function stopScanner() {

  if (!html5QrCode) {
    return;
  }


  html5QrCode
    .stop()
    .then(() => {

      html5QrCode.clear();

      html5QrCode = null;

    })
    .catch(error => {

      console.log(error);

      html5QrCode = null;

    });

}


/* =========================================================
   AWB BARCODE SCANNER
========================================================= */

function startAWBScanner() {

  if (awbScanner) {
    return;
  }


  awbScanner =
    new Html5Qrcode("awbReader");


  awbScanner.start(

    {
      facingMode: "environment"
    },

    {
      fps: 10,

      qrbox: {
        width: 300,
        height: 120
      },

      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8
      ]
    },

    function(decodedText) {

      document
        .getElementById("awb")
        .value = decodedText;


      showMessage(
        "scanMsg",
        "✅ AWB barcode scanned: " + decodedText,
        "success"
      );


      stopAWBScanner();

    },

    function() {}

  )
  .catch(function(error) {

    showMessage(
      "scanMsg",
      "❌ Unable to start AWB scanner.",
      "error"
    );

  });
}


function stopAWBScanner() {

  if (!awbScanner) {
    return;
  }


  awbScanner
    .stop()
    .then(() => {

      awbScanner.clear();

      awbScanner = null;

    })
    .catch(error => {

      console.log(error);

      awbScanner = null;

    });

}


/* =========================================================
   SECURE VERIFY + LINK
========================================================= */

async function verifyAndLink() {

  const awb =
    document
      .getElementById("awb")
      .value
      .trim();


  const packet =
    document
      .getElementById("packet")
      .value
      .trim();


  if (!awb || !packet) {

    showMessage(
      "scanMsg",
      "⚠️ Scan both AWB and Packet.",
      "error"
    );

    return;
  }


  showMessage(
    "scanMsg",
    "🔎 Verifying...",
    "info"
  );


  const {
    data,
    error
  } =
    await supabaseClient
      .rpc(
        "link_packet",
        {
          p_awb: awb,
          p_packet: packet
        }
      );


  if (error) {

    let message =
      error.message || "Verification failed.";


    if (message.includes("AWB_NOT_FOUND")) {

      message =
        "❌ AWB not found.";

    }

    else if (
      message.includes("PACKET_NOT_FOUND")
    ) {

      message =
        "❌ Packet not found.";

    }

    else if (
      message.includes("PACKET_ALREADY_LINKED")
    ) {

      message =
        "❌ Packet is already linked.";

    }

    else if (
      message.includes("AWB_ALREADY_LINKED")
    ) {

      message =
        "❌ AWB is already linked.";

    }

    else if (
      message.includes("LOGIN_REQUIRED")
    ) {

      message =
        "❌ Please login again.";

    }


    showMessage(
      "scanMsg",
      message,
      "error"
    );

    return;
  }


  showMessage(
    "scanMsg",
    "✅ VERIFIED & LINKED SUCCESSFULLY",
    "success"
  );


  document
    .getElementById("awb")
    .value = "";


  document
    .getElementById("packet")
    .value = "";


  loadMyScans();
}


/* =========================================================
   MY SCANS
========================================================= */

async function loadMyScans() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("packet_scans")
      .select("*")
      .eq("scanned_by", currentUser.id)
      .order(
        "scanned_at",
        {
          ascending: false
        }
      )
      .limit(100);


  const body =
    document.getElementById("historyBody");


  if (error) {

    body.innerHTML = `
      <tr>
        <td colspan="4">
          ${error.message}
        </td>
      </tr>
    `;

    return;
  }


  if (!data || data.length === 0) {

    body.innerHTML = `
      <tr>
        <td colspan="4">
          No scans yet.
        </td>
      </tr>
    `;

    return;
  }


  body.innerHTML =
    data.map(row => `

      <tr>

        <td>
          ${escapeHtml(row.awb_number)}
        </td>

        <td>
          ${escapeHtml(row.packet_id)}
        </td>

        <td>
          ${escapeHtml(row.status)}
        </td>

        <td>
          ${new Date(
            row.scanned_at
          ).toLocaleString()}
        </td>

      </tr>

    `).join("");
}


/* =========================================================
   ADMIN DASHBOARD
========================================================= */

async function loadDashboard() {

  if (currentProfile?.role !== "admin") {
    return;
  }


  const orders =
    await supabaseClient
      .from("orders")
      .select("*", {
        count: "exact",
        head: true
      });


  const packets =
    await supabaseClient
      .from("packets")
      .select("*", {
        count: "exact",
        head: true
      });


  const linked =
    await supabaseClient
      .from("packets")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq("status", "linked");


  const available =
    await supabaseClient
      .from("packets")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq("status", "available");


  const scans =
    await supabaseClient
      .from("packet_scans")
      .select("*", {
        count: "exact",
        head: true
      });


  document
    .getElementById("totalOrders")
    .textContent =
      orders.count || 0;


  document
    .getElementById("totalPackets")
    .textContent =
      packets.count || 0;


  document
    .getElementById("linkedPackets")
    .textContent =
      linked.count || 0;


  document
    .getElementById("availablePackets")
    .textContent =
      available.count || 0;


  document
    .getElementById("totalScans")
    .textContent =
      scans.count || 0;


  const {
    data,
    error
  } =
    await supabaseClient
      .from("packet_scans")
      .select("*")
      .order(
        "scanned_at",
        {
          ascending: false
        }
      )
      .limit(20);


  const body =
    document.getElementById("dashboardBody");


  if (error) {

    body.innerHTML = `
      <tr>
        <td colspan="5">
          ${error.message}
        </td>
      </tr>
    `;

    return;
  }


  if (!data || data.length === 0) {

    body.innerHTML = `
      <tr>
        <td colspan="5">
          No scans.
        </td>
      </tr>
    `;

    return;
  }


  body.innerHTML =
    data.map(row => `

      <tr>

        <td>
          ${escapeHtml(row.awb_number)}
        </td>

        <td>
          ${escapeHtml(row.packet_id)}
        </td>

        <td>
          ${escapeHtml(row.status)}
        </td>

        <td>
          ${escapeHtml(row.scanned_by || "-")}
        </td>

        <td>
          ${new Date(
            row.scanned_at
          ).toLocaleString()}
        </td>

      </tr>

    `).join("");
}


/* =========================================================
   REPORTS
========================================================= */

async function loadReports() {

  if (currentProfile?.role !== "admin") {
    return;
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from("packet_scans")
      .select("*")
      .order(
        "scanned_at",
        {
          ascending: false
        }
      );


  const body =
    document.getElementById("reportsBody");


  if (error) {

    body.innerHTML = `
      <tr>
        <td colspan="5">
          ${error.message}
        </td>
      </tr>
    `;

    return;
  }


  reportData =
    data || [];


  if (!reportData.length) {

    body.innerHTML = `
      <tr>
        <td colspan="5">
          No reports.
        </td>
      </tr>
    `;

    return;
  }


  body.innerHTML =
    reportData.map(row => `

      <tr>

        <td>
          ${escapeHtml(row.awb_number)}
        </td>

        <td>
          ${escapeHtml(row.packet_id)}
        </td>

        <td>
          ${escapeHtml(row.status)}
        </td>

        <td>
          ${escapeHtml(row.scanned_by || "-")}
        </td>

        <td>
          ${new Date(
            row.scanned_at
          ).toLocaleString()}
        </td>

      </tr>

    `).join("");
}


/* =========================================================
   CSV
========================================================= */

function exportCSV() {

  if (!reportData.length) {

    alert("No report data.");

    return;
  }


  const headers = [
    "AWB",
    "Packet ID",
    "Status",
    "Staff ID",
    "Scanned At"
  ];


  const rows =
    reportData.map(row => [

      row.awb_number,
      row.packet_id,
      row.status,
      row.scanned_by || "",
      row.scanned_at

    ]);


  const csv =
    [
      headers,
      ...rows
    ]
      .map(row =>
        row.map(value =>
          `"${String(value)
            .replace(/"/g, '""')}"`
        ).join(",")
      )
      .join("\n");


  const blob =
    new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8;"
      }
    );


  const url =
    URL.createObjectURL(blob);


  const link =
    document.createElement("a");


  link.href = url;

  link.download =
    "packet-scan-report.csv";


  document.body.appendChild(link);

  link.click();

  link.remove();


  URL.revokeObjectURL(url);
}


/* =========================================================
   LABEL GENERATOR
========================================================= */

function generateLabel() {

  const awb =
    document
      .getElementById("labelAwb")
      .value
      .trim();


  const packet =
    document
      .getElementById("labelPacket")
      .value
      .trim();


  if (!awb || !packet) {

    alert(
      "Enter AWB and Packet ID."
    );

    return;
  }


  document
    .getElementById("labelAwbText")
    .textContent = awb;


  document
    .getElementById("labelPacketText")
    .textContent = packet;


  const qrBox =
    document.getElementById("qrcode");


  qrBox.innerHTML = "";


  new QRCode(
    qrBox,
    {
      text: packet,
      width: 160,
      height: 160
    }
  );


  JsBarcode(
    "#awbBarcode",
    awb,
    {
      format: "CODE128",
      width: 2,
      height: 70,
      displayValue: true
    }
  );
}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
  elementId,
  message,
  type
) {

  const element =
    document.getElementById(elementId);


  if (!element) {
    return;
  }


  element.textContent =
    message;


  element.style.background =
    type === "success"
      ? "#dcfce7"
      : type === "info"
      ? "#dbeafe"
      : "#fee2e2";


  element.style.color =
    "#111827";
}


/* =========================================================
   HTML SAFETY
========================================================= */

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
    }
