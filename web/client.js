/* Minimal browser client that uses WebRTC to talk to OpenAI's Realtime API.
 * Flow:
 * 1) Ask the backend for an ephemeral session (POST /realtime/session)
 * 2) Create RTCPeerConnection, attach mic track
 * 3) Send offer SDP to OpenAI Realtime endpoint using the session's client_secret
 * 4) Set answer SDP, play audio track from the assistant
 */
const logEl = document.getElementById("log");
const connectBtn = document.getElementById("connectBtn");
const hangupBtn = document.getElementById("hangupBtn");
const instructionsEl = document.getElementById("instructions");
const assistantAudio = document.getElementById("assistantAudio");

let pc;
let abortController;

function log(msg) {
  console.log(msg);
  logEl.textContent += `\n${msg}`;
}

async function connect() {
  connectBtn.disabled = true;
  hangupBtn.disabled = false;
  abortController = new AbortController();

  try {
    const payload = {};
    if (instructionsEl.value.trim()) payload.instructions = instructionsEl.value.trim();

    // 1) Mint ephemeral session
    const sessionResp = await fetch("/realtime/session", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
      signal: abortController.signal
    });
    const session = await sessionResp.json();
    if (!session.client_secret?.value) throw new Error("No client_secret in session response");
    const EPHEMERAL_KEY = session.client_secret.value;
    log("✅ Got ephemeral session.");

    // 2) WebRTC setup
    pc = new RTCPeerConnection();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      assistantAudio.srcObject = remoteStream;
    };

    // Optional: Data channel for events
    const dc = pc.createDataChannel("oai-events");
    dc.onmessage = (e) => log(`event: ${e.data}`);

    // 3) Create offer and exchange SDP with OpenAI
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
    await pc.setLocalDescription(offer);

    const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(session.model)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp"
      },
      body: offer.sdp
    });
    if (!sdpResponse.ok) {
      const err = await sdpResponse.text();
      throw new Error(err);
    }
    const answer = { type: "answer", sdp: await sdpResponse.text() };
    await pc.setRemoteDescription(answer);
    log("🔊 Connected — start speaking to Ava.");

  } catch (err) {
    log(`❌ ${err}`);
    connectBtn.disabled = false;
    hangupBtn.disabled = true;
  }
}

async function hangup() {
  try {
    if (abortController) abortController.abort();
  } catch {}
  if (pc) {
    pc.getSenders().forEach(s => s.track && s.track.stop());
    pc.close();
    pc = null;
  }
  connectBtn.disabled = false;
  hangupBtn.disabled = true;
  log("👋 Disconnected.");
}

connectBtn.addEventListener("click", connect);
hangupBtn.addEventListener("click", hangup);
