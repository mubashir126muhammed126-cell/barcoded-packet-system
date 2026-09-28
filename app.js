const SUPABASE_URL = "https://xmbabihlrguuqewgilfo.supabase.co";
const SUPABASE_KEY = "PASTE-YOUR-SUPABASE-PUBLISHABLE-KEY-HERE";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const SITE_URL = "https://ir126muhammed126-cell.github.io/barcoded-packet-system/";
let currentUser = null;
let currentProfile = null;
let scanner = null;
let latestShipment = null;

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function attr(v){return String(v??"").replaceAll("\\","\\\\").replaceAll("'","\\'")}
function fmt(v){return v?new Date(v).toLocaleString():"-"}
function msg(id,text,ok=true){const e=document.getElementById(id);e.textContent=text;e.className=ok?"message success":"message error"}

async function login(){
  const email=document.getElementById("email").value.trim();
  const password=document.getElementById("password").value;
  msg("loginMessage","Logging in...",true);
  const {error}=await client.auth.signInWithPassword({email,password});
  if(error){msg("loginMessage",error.message,false);return}
  await loadUser();
}

async function loadUser(){
  const {data:{user}}=await client.auth.getUser();
  if(!user){showLogin();return}
  currentUser=user;
  const {data:profile,error}=await client.from("profiles").select("id,full_name,role,active").eq("id",user.id).single();
  if(error||!profile){alert("Profile not found for this login.");await client.auth.signOut();return}
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

function showSection(id){
  document.querySelectorAll(".section").forEach(x=>x.classList.add("hidden"));
  document.getElementById(id)?.classList.remove("hidden");
  if(id==="dashboard")loadDashboard();
  if(id==="shipments")loadShipments();
  if(id==="packets")loadPackets();
  if(id==="reports")loadReports();
}

async function createShipment(){
  if(currentProfile?.role!=="admin"){msg("createMessage","Admin access required.",false);return}
  const customerName=document.getElementById("customerName").value.trim();
  if(!customerName){msg("createMessage","Enter customer name.",false);return}
  msg("createMessage","Creating shipment...",true);
  const {data,error}=await client.rpc("create_shipment",{p_customer_name:customerName});
  if(error){msg("createMessage",error.message,false);return}
  latestShipment={...data,customer_name:customerName};
  document.getElementById("createdShipment").classList.remove("hidden");
  document.getElementById("newAwb").textContent=data.awb_number;
  document.getElementById("newPacket").textContent=data.packet_id;
  document.getElementById("newTracking").textContent=data.tracking_code;
  document.getElementById("newStatus").textContent=data.status;
  msg("createMessage","Shipment created successfully.",true);
  document.getElementById("customerName").value="";
  loadDashboard();
}

async function loadShipments(){
  const table=document.getElementById("shipmentTable");
  table.innerHTML="<tr><td colspan='5'>Loading...</td></tr>";
  const {data,error}=await client.from("orders").select("*").order("created_at",{ascending:false});
  if(error){table.innerHTML=`<tr><td colspan="5">${esc(error.message)}</td></tr>`;return}
  if(!data.length){table.innerHTML="<tr><td colspan='5'>No shipments found.</td></tr>";return}
  table.innerHTML=data.map(o=>`<tr><td><strong>${esc(o.awb_number)}</strong></td><td>${esc(o.customer_name||"-")}</td><td><span class="status">${esc(o.status)}</span></td><td>${fmt(o.created_at)}</td><td>${currentProfile?.role==="admin"?`<button onclick="changeStatus('${attr(o.awb_number)}')">Update</button>`:""}</td></tr>`).join("");
}

async function changeStatus(awb){
  const status=prompt("Enter status: ready / packed / linked / dispatched / delivered / cancelled","packed");
  if(!status)return;
  const {error}=await client.rpc("update_shipment_status",{p_awb:awb,p_status:status.trim().toLowerCase()});
  if(error){alert(error.message);return}
  alert("Shipment status updated.");
  loadShipments();loadDashboard();
}

async function loadPackets(){
  const table=document.getElementById("packetTable");
  table.innerHTML="<tr><td colspan='4'>Loading...</td></tr>";
  const {data,error}=await client.from("packets").select("*").order("created_at",{ascending:false});
  if(error){table.innerHTML=`<tr><td colspan="4">${esc(error.message)}</td></tr>`;return}
  if(!data.length){table.innerHTML="<tr><td colspan='4'>No packets found.</td></tr>";return}
  table.innerHTML=data.map(p=>`<tr><td><strong>${esc(p.packet_id)}</strong></td><td>${esc(p.qr_value)}</td><td><span class="status">${esc(p.status)}</span></td><td>${fmt(p.created_at)}</td></tr>`).join("");
}

async function loadDashboard(){
  const {data,error}=await client.from("orders").select("awb_number,customer_name,status,created_at").order("created_at",{ascending:false});
  if(error){console.error(error);return}
  document.getElementById("totalShipments").textContent=data.length;
  document.getElementById("readyShipments").textContent=data.filter(x=>x.status==="ready").length;
  document.getElementById("linkedShipments").textContent=data.filter(x=>x.status==="linked").length;
  document.getElementById("deliveredShipments").textContent=data.filter(x=>x.status==="delivered").length;
  const rows=data.slice(0,10);
  document.getElementById("recentShipments").innerHTML=!rows.length?"<p>No shipments yet.</p>":`<div class="table-container"><table><thead><tr><th>AWB</th><th>Customer</th><th>Status</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.awb_number)}</td><td>${esc(x.customer_name||"-")}</td><td><span class="status">${esc(x.status)}</span></td></tr>`).join("")}</tbody></table></div>`;
}

async function startScanner(){
  if(scanner){try{await scanner.stop()}catch{}scanner=null}
  scanner=new Html5Qrcode("reader");
  try{
    await scanner.start({facingMode:"environment"},{fps:10,qrbox:{width:280,height:180},formatsToSupport:[Html5QrcodeSupportedFormats.QR_CODE,Html5QrcodeSupportedFormats.CODE_128,Html5QrcodeSupportedFormats.CODE_39]},decoded=>handleScan(decoded),()=>{});
  }catch(e){msg("scanResult","Camera error: "+e,false)}
}

function handleScan(value){
  value=value.trim();
  if(value.startsWith("AWB-")){document.getElementById("scanAwb").value=value;msg("scanResult","AWB scanned: "+value,true);return}
  if(value.startsWith("PKT-")){document.getElementById("scanPacket").value=value;msg("scanResult","Packet scanned: "+value,true);return}
}

async function verifyAndLink(){
  const awb=document.getElementById("scanAwb").value.trim();
  const packet=document.getElementById("scanPacket").value.trim();
  if(!awb||!packet){msg("scanResult","Scan both AWB and Packet ID.",false);return}
  msg("scanResult","Verifying...",true);
  const {data,error}=await client.rpc("link_packet",{p_awb:awb,p_packet:packet});
  if(error){msg("scanResult",error.message,false);return}
  msg("scanResult",`✓ Linked ${data.awb_number} ↔ ${data.packet_id}`,true);
  document.getElementById("scanAwb").value="";
  document.getElementById("scanPacket").value="";
  loadDashboard();
}

async function trackShipment(){
  const code=document.getElementById("trackingCode").value.trim();
  const result=document.getElementById("trackingResult");
  if(!code){result.innerHTML="<div class='card'>Enter tracking code.</div>";return}
  const {data,error}=await client.rpc("public_track",{p_tracking_code:code});
  if(error){result.innerHTML="<div class='card error'>Shipment not found.</div>";return}
  const events=data.events||[];
  result.innerHTML=`<div class="card"><h2>${esc(data.awb_number)}</h2><p><strong>Status:</strong> ${esc(data.status)}</p><p><strong>Created:</strong> ${fmt(data.created_at)}</p><h3>Tracking History</h3>${events.map(e=>`<div class="timeline-item"><div class="dot"></div><div><strong>${esc(e.status)}</strong><p>${esc(e.note||"")}</p><span class="small">${fmt(e.created_at)}</span></div></div>`).join("")}</div>`;
}

async function loadReports(){
  const {data,error}=await client.from("orders").select("status");
  if(error)return;
  const c=s=>data.filter(x=>x.status===s).length;
  document.getElementById("reportReady").textContent=c("ready");
  document.getElementById("reportPacked").textContent=c("packed");
  document.getElementById("reportDispatched").textContent=c("dispatched");
  document.getElementById("reportDelivered").textContent=c("delivered");
}

function generateLabel(){
  if(!latestShipment){alert("Create a shipment first.");return}
  const trackingUrl=`${SITE_URL}track.html?code=${encodeURIComponent(latestShipment.tracking_code)}`;
  document.getElementById("labelCustomer").textContent=latestShipment.customer_name||"";
  document.getElementById("labelAwb").textContent=latestShipment.awb_number;
  document.getElementById("labelPacket").textContent=latestShipment.packet_id;
  document.getElementById("labelTracking").textContent=trackingUrl;
  document.getElementById("qrcode").innerHTML="";
  new QRCode(document.getElementById("qrcode"),{text:trackingUrl,width:170,height:170});
  JsBarcode("#barcode",latestShipment.awb_number,{format:"CODE128",width:2,height:65,displayValue:true,margin:10});
  showSection("labelSection");
  setTimeout(()=>window.print(),500);
}

client.auth.onAuthStateChange((event,session)=>{if(session?.user)loadUser();else showLogin()});
(async()=>{const {data:{session}}=await client.auth.getSession();if(session?.user)await loadUser();else showLogin()})();
