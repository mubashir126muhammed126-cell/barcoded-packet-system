// =====================================================
// BARCODED PACKET SYSTEM
// SUPABASE CONFIGURATION
// =====================================================

const SUPABASE_URL =
  "https://xmbabihlrguuqewgilfo.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_fOgnuaVOZB_4SWGgx1zd2g_QVY84nIH";


// =====================================================
// SUPABASE CLIENT
// =====================================================

const supabaseScript =
  document.createElement("script");

supabaseScript.src =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

supabaseScript.onload = function () {

  window.supabaseClient =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );

  console.log(
    "Supabase connected"
  );

  loadRecentScans();

};

document.head.appendChild(
  supabaseScript
);


// =====================================================
// MESSAGE
// =====================================================

function showMessage(
  text,
  type = "success"
) {

  const box =
    document.getElementById("message");

  box.style.display = "block";

  box.innerHTML = text;

  if (type === "success") {

    box.style.background = "#e5f8eb";
    box.style.color = "#17652d";

  } else {

    box.style.background = "#ffe5e5";
    box.style.color = "#9d2020";

  }

}


// =====================================================
// FOCUS SCANNER
// =====================================================

function focusAWB() {

  document
    .getElementById("awb")
    .focus();

}


function focusPacket() {

  document
    .getElementById("packet")
    .focus();

}


// =====================================================
// LINK PACKET
// =====================================================

async function linkPacket() {

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
      "⚠️ Please scan both AWB and Packet ID.",
      "error"
    );

    return;

  }


  if (!window.supabaseClient) {

    showMessage(
      "⚠️ Supabase is not ready.",
      "error"
    );

    return;

  }


  showMessage(
    "🔄 Checking AWB and Packet..."
  );


  try {


    // =================================================
    // CHECK AWB
    // =================================================

    const {
      data: order,
      error: orderError

    } = await window.supabaseClient

      .from("orders")

      .select("*")

      .eq(
        "awb_number",
        awb
      )

      .maybeSingle();


    if (orderError) {

      console.error(orderError);

      showMessage(
        "❌ Error checking AWB.",
        "error"
      );

      return;

    }


    if (!order) {

      showMessage(
        "❌ AWB number not found.",
        "error"
      );

      return;

    }


    // =================================================
    // CHECK PACKET
    // =================================================

    const {
      data: packetData,
      error: packetError

    } = await window.supabaseClient

      .from("packets")

      .select("*")

      .eq(
        "packet_id",
        packet
      )

      .maybeSingle();


    if (packetError) {

      console.error(packetError);

      showMessage(
        "❌ Error checking Packet ID.",
        "error"
      );

      return;

    }


    if (!packetData) {

      showMessage(
        "❌ Packet ID not found.",
        "error"
      );

      return;

    }


    // =================================================
    // CHECK PACKET STATUS
    // =================================================

    if (
      packetData.status !==
      "available"
    ) {

      showMessage(
        "❌ This packet is already linked.",
        "error"
      );

      return;

    }


    // =================================================
    // CHECK AWB DUPLICATE
    // =================================================

    const {
      data: previousScan,
      error: previousError

    } = await window.supabaseClient

      .from("packet_scans")

      .select("*")

      .eq(
        "awb_number",
        awb
      )

      .limit(1);


    if (previousError) {

      console.error(previousError);

      showMessage(
        "❌ Error checking previous scans.",
        "error"
      );

      return;

    }


    if (
      previousScan &&
      previousScan.length > 0
    ) {

      showMessage(
        "❌ This AWB is already linked.",
        "error"
      );

      return;

    }


    // =================================================
    // INSERT SCAN
    // =================================================

    const {
      error: scanError

    } = await window.supabaseClient

      .from("packet_scans")

      .insert({

        awb_number: awb,

        packet_id: packet,

        status: "linked"

      });


    if (scanError) {

      console.error(scanError);

      showMessage(
        "❌ Could not save scan.",
        "error"
      );

      return;

    }


    // =================================================
    // UPDATE PACKET
    // =================================================

    const {
      error: updateError

    } = await window.supabaseClient

      .from("packets")

      .update({

        status: "linked"

      })

      .eq(
        "packet_id",
        packet
      );


    if (updateError) {

      console.error(updateError);

      showMessage(
        "⚠️ Scan saved but packet status failed.",
        "error"
      );

      return;

    }


    // =================================================
    // SUCCESS
    // =================================================

    showMessage(
      "✅ AWB and Packet successfully linked!",
      "success"
    );


    document
      .getElementById("awb")
      .value = "";

    document
      .getElementById("packet")
      .value = "";


    loadRecentScans();


  }

  catch (error) {

    console.error(error);

    showMessage(
      "❌ Unexpected error occurred.",
      "error"
    );

  }

}


// =====================================================
// RECENT SCANS
// =====================================================

async function loadRecentScans() {

  if (!window.supabaseClient) {
    return;
  }


  const {
    data,
    error

  } = await window.supabaseClient

    .from("packet_scans")

    .select("*")

    .order(
      "scanned_at",
      {
        ascending: false
      }
    )

    .limit(20);


  if (error) {

    console.error(error);

    return;

  }


  const body =
    document.getElementById(
      "historyBody"
    );


  if (
    !data ||
    data.length === 0
  ) {

    body.innerHTML = `
      <tr>
        <td colspan="4">
          No scans yet
        </td>
      </tr>
    `;

    return;

  }


  body.innerHTML =
    data.map(scan => `

      <tr>

        <td>
          ${scan.awb_number}
        </td>

        <td>
          ${scan.packet_id}
        </td>

        <td>
          ${scan.status}
        </td>

        <td>
          ${new Date(
            scan.scanned_at
          ).toLocaleString()}
        </td>

      </tr>

    `).join("");

}


// =====================================================
// ENTER KEY
// =====================================================

document.addEventListener(
  "keydown",
  function (event) {

    if (
      event.key === "Enter"
    ) {

      const active =
        document.activeElement;


      if (
        active &&
        (
          active.id === "awb" ||
          active.id === "packet"
        )
      ) {

        linkPacket();

      }

    }

  }
);
