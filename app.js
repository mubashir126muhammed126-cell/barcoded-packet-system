function linkPacket() {

  const awb = document.getElementById("awb").value.trim();
  const packet = document.getElementById("packet").value.trim();
  const message = document.getElementById("message");

  if (!awb || !packet) {
    message.innerHTML = "Please scan both AWB and Packet ID.";
    message.style.background = "#ffe5e5";
    return;
  }

  message.innerHTML =
    "AWB and Packet ID received. Supabase verification will be connected next.";

  message.style.background = "#e5f8eb";
}
