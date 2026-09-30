const SUPABASE_URL = "https://xmbabihlrguuqewgilfo.supabase.co";
const SUPABASE_KEY="sb_publishable_fOgnuaVOZB_4SWGgx1zd2g_QVY84nIH";
const client=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let currentUser=null,currentProfile=null,scanner=null,latestShipment=null;

async function login() {

  const email =
    document.getElementById("email").value.trim();

  const password =
    document.getElementById("password").value;

  const message =
    document.getElementById("loginMessage");

  message.textContent = "Logging in...";
  message.className = "message";

  if (!email || !password) {
    message.textContent =
      "Enter email and password.";
    message.className =
      "message error";
    return;
  }

  try {

    const { data, error } =
      await client.auth.signInWithPassword({
        email: email,
        password: password
      });

    if (error) {
      console.error(error);

      message.textContent =
        error.message;

      message.className =
        "message error";

      return;
    }

    if (!data || !data.user) {
      message.textContent =
        "Login failed. User not returned.";

      message.className =
        "message error";

      return;
    }

    await loadUser();

  } catch (error) {

    console.error(error);

    message.textContent =
      "Login error: " + error.message;

    message.className =
      "message error";
  }
}
}
async function loadUser(){
 const {data:{user}}=await client.auth.getUser();
 if(!user){showLogin();return}
 currentUser=user;
 const {data:profile,error}=await client.from("profiles").select("id,full_name,role,active").eq("id",user.id).single();
 if(error||!profile){alert("Profile not found: "+(error?.message||""));await client.auth.signOut();return}
 if(!profile.active){alert("Your account is inactive.");await client.auth.signOut();return}
 currentProfile=profile;
 document.getElementById("userInfo").textContent=`${profile.full_name||user.email} • ${profile.role}`;
 showApp();
 if(profile.role!=="admin")document.getElementById("createShipmentMenu").classList.add("hidden");
 showSection("dashboard");
}
function showLogin(){document.getElementById("loginPage").classList.remove("hidden");document.getElementById("appPage").classList.add("hidden")}
function showApp(){document.getElementById("loginPage").classList.add("hidden");document.getElementById("appPage").classList.remove("hidden")}
async function logout(){await client.auth.signOut();currentUser=null;currentProfile=null;showLogin()}
function showSection(id){document.querySelectorAll(".section").forEach(x=>x.classList.add("hidden"));document.getElementById(id)?.classList.remove("hidden");if(id==="dashboard")loadDashboard();if(id==="shipments")loadShipments();if(id==="packets")loadPackets();if(id==="reports")loadReports()}
async function createShipment(){
 if(currentProfile?.role!=="admin"){showMessage("createMessage","Admin access required.",false);return}
 const customerName=document.getElementById("customerName").value.trim();
 if(!customerName){showMessage("createMessage","Enter customer name.",false);return}
 showMessage("createMessage","Creating shipment...",true);
 const {data,error}=await client.rpc("create_shipment",{p_customer_name:customerName});
 if(error){showMessage("createMessage",error.message,false);return}
 latestShipment=data;
 document.getElementById("createdShipment").classList.remove("hidden");
 document.getElementById("newAwb").textContent=data.awb_number;
 document.getElementById("newPacket").textContent=data.packet_id;
 document.getElementById("newStatus").textContent=data.status;
 showMessage("createMessage","Shipment created successfully.",true);
 document.getElementById("customerName").value="";
}
async function loadShipments(){
 const table=document.getElementById("shipmentTable");table.innerHTML="<tr><td colspan='5'>Loading...</td></tr>";
 const {data,error}=await client.from("orders").select("*").order("created_at",{ascending:false});
 if(error){table.innerHTML=`<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>`;return}
 if(!data?.length){table.innerHTML="<tr><td colspan='5'>No shipments found.</td></tr>";return}
 table.innerHTML=data.map(o=>`<tr><td><strong>${escapeHtml(o.awb_number)}</strong></td><td>${escapeHtml(o.customer_name||"-")}</td><td><span class="status">${escapeHtml(o.status)}</span></td><td>${formatDate(o.created_at)}</td><td>${currentProfile?.role==="admin"?`<button onclick="changeStatus('${escapeAttribute(o.awb_number)}')">Update</button><button onclick="prepareExistingLabel('${escapeAttribute(o.awb_number)}')">Print</button>`:""}</td></tr>`).join("");
}
async function changeStatus(awb){
 const status=prompt("Enter status:\nready / packed / linked / dispatched / delivered / cancelled","packed");if(!status)return;
 const {error}=await client.rpc("update_shipment_status",{p_awb:awb,p_status:status.trim().toLowerCase()});
 if(error){alert(error.message);return}alert("Shipment status updated.");loadShipments();loadDashboard();
}
async function prepareExistingLabel(awb){
 const {data:o,error}=await client.from("orders").select("*").eq("awb_number",awb).single();
 if(error){alert(error.message);return}
 const {data:s}=await client.from("packet_scans").select("packet_id").eq("awb_number",awb).maybeSingle();
 const {data:p}=await client.from("packets").select("packet_id").eq("packet_id",s?.packet_id||"").maybeSingle();
 latestShipment={awb_number:o.awb_number,packet_id:p?.packet_id||s?.packet_id||"",customer_name:o.customer_name||"",status:o.status};
 generateLabel();
}
async function loadPackets(){
 const table=document.getElementById("packetTable");table.innerHTML="<tr><td colspan='4'>Loading...</td></tr>";
 const {data,error}=await client.from("packets").select("*").order("created_at",{ascending:false});
 if(error){table.innerHTML=`<tr><td colspan="4">${escapeHtml(error.message)}</td></tr>`;return}
 if(!data?.length){table.innerHTML="<tr><td colspan='4'>No packets found.</td></tr>";return}
 table.innerHTML=data.map(p=>`<tr><td><strong>${escapeHtml(p.packet_id)}</strong></td><td>${escapeHtml(p.qr_value||"")}</td><td><span class="status">${escapeHtml(p.status)}</span></td><td>${formatDate(p.created_at)}</td></tr>`).join("");
}
async function loadDashboard(){
 const {data,error}=await client.from("orders").select("awb_number,customer_name,status,created_at").order("created_at",{ascending:false});
 if(error){console.error(error);return}
 document.getElementById("totalShipments").textContent=data.length;
 document.getElementById("readyShipments").textContent=data.filter(x=>x.status==="ready").length;
 document.getElementById("linkedShipments").textContent=data.filter(x=>x.status==="linked").length;
 document.getElementById("deliveredShipments").textContent=data.filter(x=>x.status==="delivered").length;
 const rows=data.slice(0,10);document.getElementById("recentShipments").innerHTML=!rows.length?"<p>No shipments yet.</p>":`<div class="table-container"><table><thead><tr><th>AWB</th><th>Customer</th><th>Status</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${escapeHtml(x.awb_number)}</td><td>${escapeHtml(x.customer_name||"-")}</td><td><span class="status">${escapeHtml(x.status)}</span></td></tr>`).join("")}</tbody></table></div>`;
}
async function startScanner(){
 if(scanner){try{await scanner.stop()}catch{}scanner=null}
 scanner=new Html5Qrcode("reader");
 try{await scanner.start({facingMode:"environment"},{fps:10,qrbox:{width:280,height:180}},decodedText=>handleScan(decodedText),()=>{})}
 catch(e){showMessage("scanResult","Camera error: "+e,false)}
}
function handleScan(value) {

  value = value.trim();

  console.log("SCANNED:", value);

  // --------------------------------
  // AWB BARCODE
  // --------------------------------

  if (value.startsWith("AWB-")) {

    document.getElementById("scanAwb").value = value;

    showMessage(
      "scanResult",
      "✓ AWB scanned: " + value,
      true
    );

    return;
  }


  // --------------------------------
  // PACKET ID
  // --------------------------------

  if (value.startsWith("PKT-")) {

    document.getElementById("scanPacket").value = value;

    showMessage(
      "scanResult",
      "✓ Packet ID scanned: " + value,
      true
    );

    return;
  }


  // --------------------------------
  // CUSTOMER TRACKING QR
  // --------------------------------

  try {

    const url = new URL(value);

    const awb =
      url.searchParams.get("awb");

    const packet =
      url.searchParams.get("packet");


    if (awb) {

      document.getElementById(
        "scanAwb"
      ).value = awb;

    }


    if (packet) {

      document.getElementById(
        "scanPacket"
      ).value = packet;

    }


    if (awb && packet) {

      showMessage(
        "scanResult",
        "✓ AWB + Packet ID scanned successfully",
        true
      );

      return;
    }


    if (awb) {

      showMessage(
        "scanResult",
        "✓ AWB scanned. Scan the Packet QR/barcode.",
        true
      );

      return;
    }

  } catch (error) {

    console.log(
      "Not a tracking URL"
    );

  }


  // --------------------------------
  // UNKNOWN CODE
  // --------------------------------

  showMessage(
    "scanResult",
    "Unknown barcode / QR code.",
    false
  );

}
}
async function verifyAndLink(){
 const awb=document.getElementById("scanAwb").value.trim(),packet=document.getElementById("scanPacket").value.trim();
 if(!awb||!packet){showMessage("scanResult","Scan both AWB and Packet ID.",false);return}
 const {data,error}=await client.rpc("link_packet",{p_awb:awb,p_packet:packet});
 if(error){showMessage("scanResult",error.message,false);return}
 showMessage("scanResult",`✓ Linked ${data.awb_number} ↔ ${data.packet_id}`,true);
 document.getElementById("scanAwb").value="";document.getElementById("scanPacket").value="";loadDashboard();
}
async function trackShipment(){
 const awb=document.getElementById("trackingAwb").value.trim(),result=document.getElementById("trackingResult");
 if(!awb){result.innerHTML="<div class='card'>Enter an AWB number.</div>";return}
 const {data,error}=await client.rpc("public_track_shipment",{p_awb:awb});
 if(error){result.innerHTML=`<div class="card error">${escapeHtml(error.message)}</div>`;return}
 result.innerHTML=trackingCard(data);
}
function trackingCard(data){return `<div class="card"><h2>Shipment Details</h2><p><strong>AWB:</strong> ${escapeHtml(data.awb_number)}</p><p><strong>Customer:</strong> ${escapeHtml(data.customer_name||"-")}</p><p><strong>Status:</strong> <span class="status">${escapeHtml(data.status)}</span></p><p><strong>Packet:</strong> ${escapeHtml(data.packet_id||"Not linked")}</p><p><strong>Created:</strong> ${formatDate(data.created_at)}</p></div>`}
async function loadReports(){
 const {data,error}=await client.from("orders").select("status");if(error)return;const c=s=>data.filter(x=>x.status===s).length;
 document.getElementById("reportReady").textContent=c("ready");document.getElementById("reportPacked").textContent=c("packed");document.getElementById("reportDispatched").textContent=c("dispatched");document.getElementById("reportDelivered").textContent=c("delivered");
}
function getTrackingUrl(awb, packet) {

  const url =
    new URL(
      "track.html",
      window.location.href
    );

  url.searchParams.set(
    "awb",
    awb
  );

  if (packet) {

    url.searchParams.set(
      "packet",
      packet
    );

  }

  return url.href;
}
function generateLabel() {

  if (!latestShipment) {

    alert(
      "Create or select a shipment first."
    );

    return;
  }


  const awb =
    latestShipment.awb_number;

  const packet =
    latestShipment.packet_id;


  // Customer name

  document.getElementById(
    "labelCustomer"
  ).textContent =
    latestShipment.customer_name || "";


  // AWB

  document.getElementById(
    "labelAwb"
  ).textContent =
    awb;


  // Packet

  document.getElementById(
    "labelPacket"
  ).textContent =
    packet || "Not linked";


  // Clear previous QR

  document.getElementById(
    "qrcode"
  ).innerHTML = "";


  // --------------------------------
  // QR CONTAINS BOTH AWB + PACKET
  // --------------------------------

  const trackingUrl =
    getTrackingUrl(
      awb,
      packet
    );


  new QRCode(
    document.getElementById("qrcode"),
    {
      text: trackingUrl,
      width: 180,
      height: 180,
      correctLevel: QRCode.CorrectLevel.M
    }
  );


  // --------------------------------
  // AWB CODE128 BARCODE
  // --------------------------------

  JsBarcode(
    "#barcode",
    awb,
    {
      format: "CODE128",
      width: 2,
      height: 70,
      displayValue: true,
      margin: 10
    }
  );


  showSection(
    "labelSection"
  );

}
function openCustomerTracking() {

  if (!latestShipment) {

    alert(
      "Create or select a shipment first."
    );

    return;
  }


  const url =
    getTrackingUrl(
      latestShipment.awb_number,
      latestShipment.packet_id
    );


  window.open(
    url,
    "_blank"
  );

}
function showMessage(id,msg,success){const e=document.getElementById(id);e.textContent=msg;e.className=success?"message success":"message error"}
function formatDate(d){return d?new Date(d).toLocaleString():"-"}
function escapeHtml(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function escapeAttribute(v){return String(v??"").replaceAll("\\","\\\\").replaceAll("'","\\'")}
client.auth.onAuthStateChange(async(_,session)=>{if(session?.user)await loadUser();else showLogin()});
(async()=>{const {data:{session}}=await client.auth.getSession();if(session?.user)await loadUser();else showLogin()})();
