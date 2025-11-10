/* Minimal browser client that uses WebRTC to talk to OpenAI's Realtime API.
 * Now supports two modes:
 *  - Stutter: Only optional instructions; returns structured stutter feedback via tool call.
 *  - Phonological: Adds targeted transcript and returns pronunciation feedback via tool call.
 */
const logEl = document.getElementById("log");
const feedbackEl = document.getElementById("feedback");
const connectBtn = document.getElementById("connectBtn");
const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");
const hangupBtn = document.getElementById("hangupBtn");
const instructionsEl = document.getElementById("instructions");
const assistantAudio = document.getElementById("assistantAudio");
const modeSelect = document.getElementById("modeSelect");
const targetScriptRow = document.getElementById("targetScriptRow");
const targetScriptEl = document.getElementById("targetScript");

// If the UI is served from a port other than 8000, use the API at localhost:8000.
// When UI is served by the FastAPI app on 8000, keep relative path.
const API_BASE = (location.port === "8000" ? "" : "http://localhost:8000");

let pc;
let dc;
let abortController;
let toolArgsBuffer = "";
let currentMode = "stutter";
let textBuffer = "";
let micStream = null;
let micSender = null;
let state = 'idle'; // 'idle' | 'recording' | 'waiting_commit'
let commitWaitTimer = null;
let take = 0;

function log(msg) {
  console.log(msg);
  logEl.textContent += `\n${msg}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderStutter(feedback) {
  const contentSummary = escapeHtml(feedback.content_summary || "");
  const summary = escapeHtml(feedback.overall_summary || "");
  const strengths = (feedback.strengths || []).map(s => `<li>${escapeHtml(s)}</li>`).join("");
  const areas = (feedback.areas_for_improvement || []).map(s => `<li>${escapeHtml(s)}</li>`).join("");
  const tips = (feedback.practice_tips || []).map(s => `<li>${escapeHtml(s)}</li>`).join("");
  const motivation = escapeHtml(feedback.motivation || "");
  return `
    ${contentSummary ? `<div class="summary"><strong>What you talked about:</strong> ${contentSummary}</div>` : ''}
    <div class="summary">${summary}</div>
    <h4>Strengths</h4>
    <ul>${strengths || '<li class="muted">None listed</li>'}</ul>
    <h4>Areas for Improvement</h4>
    <ul>${areas || '<li class="muted">None listed</li>'}</ul>
    <h4>Practice Tips</h4>
    <ul>${tips || '<li class="muted">None listed</li>'}</ul>
    <h4>Motivation</h4>
    <div>${motivation || '<span class="muted">—</span>'}</div>
  `;
}

function renderPhonological(feedback) {
  const contentSummary = escapeHtml(feedback.content_summary || "");
  const summary = escapeHtml(feedback.summary || "");
  const scores = feedback.scores || {};
  const scoreHtml = `
    <div class="scores">
      <div class="score">Pronunciation: ${scores.pronunciation ?? '—'}</div>
      <div class="score">Intelligibility: ${scores.intelligibility ?? '—'}</div>
    </div>`;
  const diffs = (feedback.differences || []).map(d => {
    const type = escapeHtml(d.type || "");
    const ref = escapeHtml(d.reference || "");
    const obs = escapeHtml(d.observed || "");
    const note = escapeHtml(d.note || "");
    return `<div class="diff-item"><span class="badge">${type}</span> <strong>${ref}</strong> → <em>${obs}</em><br/><span class="muted">${note}</span></div>`;
  }).join("");
  const tips = (feedback.practice_tips || []).map(s => `<li>${escapeHtml(s)}</li>`).join("");
  return `
    ${contentSummary ? `<div class="summary"><strong>What you talked about:</strong> ${contentSummary}</div>` : ''}
    <div class="summary">${summary}</div>
    ${scoreHtml}
    <h4>Differences</h4>
    <div>${diffs || '<div class="muted">No differences detected</div>'}</div>
    <h4>Practice Tips</h4>
    <ul>${tips || '<li class="muted">None listed</li>'}</ul>
  `;
}

function cardWrap(innerHtml) {
  const time = new Date().toLocaleTimeString();
  const modeLabel = currentMode === 'phonological' ? 'Phonological' : 'Stutter';
  return `<div class="feedback-card">
    <div class="meta">${modeLabel} • ${time}</div>
    ${innerHtml}
  </div>`;
}

function setFeedback(objOrString) {
  try {
    const data = (typeof objOrString === 'string') ? JSON.parse(objOrString) : objOrString;
    let html;
    if (currentMode === 'phonological' || (data && data.differences)) {
      html = renderPhonological(data);
    } else {
      html = renderStutter(data);
    }
    feedbackEl.insertAdjacentHTML('afterbegin', cardWrap(html));
  } catch {
    const text = typeof objOrString === 'string' ? objOrString : JSON.stringify(objOrString, null, 2);
    feedbackEl.insertAdjacentHTML('afterbegin', cardWrap(`<pre>${escapeHtml(text)}</pre>`));
  }
}

// Toggle targeted transcript input for phonological mode
modeSelect.addEventListener("change", () => {
  targetScriptRow.style.display = modeSelect.value === "phonological" ? "block" : "none";
});

async function connect() {
  connectBtn.disabled = true;
  hangupBtn.disabled = false;
  recordBtn.disabled = true; // enable after peer connection is ready
  stopBtn.disabled = true;
  abortController = new AbortController();

  try {
    const payload = {};
    if (instructionsEl.value.trim()) payload.instructions = instructionsEl.value.trim();
    const mode = modeSelect.value;
    payload.mode = mode;
    currentMode = mode;
    const targetScript = (targetScriptEl?.value || "").trim();
    if (mode === "phonological" && targetScript) payload.target_script = targetScript;

    // 1) Mint ephemeral session
    const sessionResp = await fetch(`${API_BASE}/realtime/session`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
      signal: abortController.signal
    });
    const session = await sessionResp.json();
    if (!session.client_secret?.value) throw new Error("No client_secret in session response");
    const EPHEMERAL_KEY = session.client_secret.value;
    log("? Got ephemeral session.");

    // 2) WebRTC setup (no mic track yet — we add it when Record is clicked)
    pc = new RTCPeerConnection();
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      assistantAudio.srcObject = remoteStream;
    };

    // Data channel for events and control messages
    dc = pc.createDataChannel("oai-events");
    dc.onopen = () => {
      // If phonological mode, send target sentence as a user message for reference
      if (mode === "phonological" && targetScript) {
        const msg = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: `Target sentence: ${targetScript}` }]
          }
        };
        dc.send(JSON.stringify(msg));
        log("sent target sentence to session");
      }
    };
    dc.onmessage = (e) => {
      // Keep the log brief; avoid dumping raw JSON
      try {
        const evt = JSON.parse(e.data);
        const t = evt?.type;
        if (t === 'input_audio_buffer.speech_started') {
          log('Speech started');
        } else if (t === 'input_audio_buffer.speech_stopped') {
          log('Speech stopped');
        } else if (t === 'input_audio_buffer.committed') {
          log('Audio committed');
          if (state === 'waiting_commit') {
            maybeRequestFeedback();
          }
        }
        if (t === "response.function_call_arguments.delta") {
          toolArgsBuffer += evt.delta || "";
        } else if (t === "response.function_call_arguments.done" || t === "response.done") {
          if (toolArgsBuffer) {
            try {
              const parsed = JSON.parse(toolArgsBuffer);
              setFeedback(parsed);
            } catch {
              setFeedback(toolArgsBuffer);
            }
            toolArgsBuffer = "";
          }
        } else if (t === "response.text.delta" || t === "response.output_text.delta") {
          textBuffer += evt.delta || "";
        } else if (t === "response.text.done" || t === "response.output_text.done") {
          if (textBuffer) {
            const raw = textBuffer;
            textBuffer = "";
            try { setFeedback(JSON.parse(raw)); } catch { /* ignore non-JSON */ }
          }
        }
      } catch {}
    };

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
    log("Connected. Click Record to start, Stop for feedback.");
    recordBtn.disabled = false;

  } catch (err) {
    log(`? ${err}`);
    connectBtn.disabled = false;
    hangupBtn.disabled = true;
  }
}

async function startRecording() {
  try {
    if (!pc) return;
    // Fresh capture each take to avoid stale or muted tracks
    if (micStream) {
      micStream.getTracks().forEach(t => t.stop());
      micStream = null;
    }
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    const track = micStream.getAudioTracks()[0];
    if (micSender) {
      await micSender.replaceTrack(track);
    } else {
      micSender = pc.addTrack(track, micStream);
    }
    toolArgsBuffer = ""; textBuffer = ""; // fresh buffer for this take
    state = 'recording';
    log("Recording… Speak now.");
    recordBtn.disabled = true;
    stopBtn.disabled = false;
  } catch (e) {
    log(`Record error: ${e}`);
  }
}

function maybeRequestFeedback() {
  state = 'idle';
  if (commitWaitTimer) { clearTimeout(commitWaitTimer); commitWaitTimer = null; }
  if (dc && dc.readyState === "open") {
    const toolName = currentMode === 'phonological' ? 'pronunciation_feedback' : 'stutter_feedback';
    // Nudge the model to analyze only the latest take
    const msg = { type: 'response.create', response: {
      modalities: ['text'],
      tool_choice: { type: 'function', name: toolName },
      instructions: `Analyze only the most recent spoken take (ignore previous turns). Take #${take}. Return only the function call. Always respond in English (US).`
    } };
    dc.send(JSON.stringify(msg));
    log("Processing your recording…");
  }
}

function stopRecording() {
  try {
    if (micSender) {
      // Stop sending mic and release resources
      micSender.replaceTrack(null).catch(() => {});
    }
    if (micStream) {
      micStream.getTracks().forEach(t => t.stop());
      micStream = null;
    }
    // Wait for the server to commit the last speech segment, then request feedback.
    state = 'waiting_commit';
    take += 1;
    // Explicitly request commit to make sure the server finalizes the buffer
    if (dc && dc.readyState === 'open') {
      dc.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    }
    // Fallback: allow time for finalization, then request anyway
    if (commitWaitTimer) clearTimeout(commitWaitTimer);
    commitWaitTimer = setTimeout(() => {
      if (state === 'waiting_commit') {
        log('Finalizing audio… requesting feedback.');
        maybeRequestFeedback();
      }
    }, 900);
    stopBtn.disabled = true;
    recordBtn.disabled = false;
  } catch (e) {
    log(`Stop error: ${e}`);
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
  dc = null;
  toolArgsBuffer = "";
  textBuffer = "";
  micStream = null;
  micSender = null;
  connectBtn.disabled = false;
  recordBtn.disabled = true;
  stopBtn.disabled = true;
  hangupBtn.disabled = true;
  log("Disconnected.");
}

connectBtn.addEventListener("click", connect);
recordBtn.addEventListener("click", startRecording);
stopBtn.addEventListener("click", stopRecording);
hangupBtn.addEventListener("click", hangup);
