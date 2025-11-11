/* Realtime browser client with Record/Stop flow, mode selection,
 * intake debug (transcription/target), and replay of last take. */

const logEl = document.getElementById("log");
const feedbackEl = document.getElementById("feedback");
const connectBtn = document.getElementById("connectBtn");
const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");
const replayBtn = document.getElementById("replayBtn");
const hangupBtn = document.getElementById("hangupBtn");
const instructionsEl = document.getElementById("instructions");
const assistantAudio = document.getElementById("assistantAudio");
const modeSelect = document.getElementById("modeSelect");
const targetScriptRow = document.getElementById("targetScriptRow");
const targetScriptEl = document.getElementById("targetScript");
const vuBar = document.getElementById("vuBar");
const userPlayback = document.getElementById("userPlayback");

// Auto-target backend if UI served on a different port
const API_BASE = (location.port === "8000" ? "" : "http://localhost:8000");

let pc, dc, abortController;
let toolArgsBuffer = "";
let textBuffer = "";
let currentMode = "stutter";
let micStream = null, micSender = null;
let state = "idle"; // idle | recording | waiting_commit
let commitWaitTimer = null;
let take = 0;
let sawSpeechThisTake = false;
let mediaRecorder = null, recordedChunks = [];
let audioCtx = null, analyser = null, rafId = null;
let lastBlobUrl = null;
let ephemeralKey = "";
let sessionModel = "";
let currentTakeTexts = [];
let lastRequestInstructions = "";
let lastTargetScript = "";

function log(msg) {
  const pretty = prettifyStatus(String(msg));
  console.log(msg);
  if (logEl) logEl.textContent += `\n${pretty}`;
}

function prettifyStatus(s) {
  const map = [
    [/Got ephemeral session\./, 'Ready to connect to Ava'],
    [/Connected\. Click Record to start, Stop for feedback\./, 'Connected — press Record to begin'],
    [/Sent target sentence to session/, 'Target sentence added'],
    [/Renegotiated with mic track\./, 'Microphone connected'],
    [/Recording… Speak now\./, 'Recording — speak when ready'],
    [/Finalizing audio… requesting feedback\./, 'Analyzing your recording…'],
    [/Received REST analysis feedback\./, 'Feedback ready'],
    [/Warning: server VAD did not detect speech in this take\./, "Didn't catch speech — try a slightly longer take"],
    [/Connect error:/, 'Could not connect — using quick analysis instead'],
  ];
  for (const [re, nice] of map) {
    if (re.test(s)) return nice;
  }
  return s;
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
    <div>${motivation || '<span class="muted">-</span>'}</div>
  `;
}

function renderPhonological(feedback) {
  const contentSummary = escapeHtml(feedback.content_summary || "");
  const summary = escapeHtml(feedback.summary || "");
  const scores = feedback.scores || {};
  const scoreHtml = `
    <div class="scores">
      <div class="score">Pronunciation: ${scores.pronunciation ?? '-'}</div>
      <div class="score">Intelligibility: ${scores.intelligibility ?? '-'}</div>
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

function renderIntake(debug) {
  const parts = [];
  if (debug?.audio_url) {
    parts.push(`<div style="margin:6px 0"><audio controls src="${escapeHtml(debug.audio_url)}"></audio></div>`);
  }
  if (debug?.intake_text) parts.push(`<div><strong>Transcribed/target text:</strong> ${escapeHtml(debug.intake_text)}</div>`);
  if (debug?.assistant_transcript) parts.push(`<div><strong>Assistant transcript:</strong> ${escapeHtml(debug.assistant_transcript)}</div>`);
  if (debug?.target_script) parts.push(`<div><strong>Target sentence:</strong> ${escapeHtml(debug.target_script)}</div>`);
  // intentionally hide request_instructions and other debug noise
  return parts.length ? `<div class="muted" style="margin:8px 0">${parts.join('')}</div>` : '';
}

function setFeedback(objOrString, debug) {
  try {
    const data = (typeof objOrString === 'string') ? JSON.parse(objOrString) : objOrString;
    const html = (currentMode === 'phonological' || (data && data.differences))
      ? renderPhonological(data)
      : renderStutter(data);
    feedbackEl.insertAdjacentHTML('afterbegin', cardWrap(renderIntake(debug) + html));
  } catch {
    const text = (typeof objOrString === 'string') ? objOrString.trim() : JSON.stringify(objOrString, null, 2);
    if (text && text.length) {
      feedbackEl.insertAdjacentHTML('afterbegin', cardWrap(renderIntake(debug) + `<pre>${escapeHtml(text)}</pre>`));
    } else {
      feedbackEl.insertAdjacentHTML('afterbegin', cardWrap(renderIntake(debug)));
    }
  }
}

modeSelect.addEventListener("change", () => {
  targetScriptRow.style.display = modeSelect.value === "phonological" ? "block" : "none";
});

async function connect() {
  connectBtn.disabled = true;
  hangupBtn.disabled = false;
  recordBtn.disabled = true;
  stopBtn.disabled = true;
  abortController = new AbortController();
  try {
    const payload = {};
    if (instructionsEl.value.trim()) payload.instructions = instructionsEl.value.trim();
    currentMode = modeSelect.value;
    payload.mode = currentMode;
    const targetScript = (targetScriptEl?.value || "").trim();
    if (currentMode === "phonological" && targetScript) payload.target_script = targetScript;
    lastTargetScript = targetScript;

    const sessionResp = await fetch(`${API_BASE}/realtime/session`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
      signal: abortController.signal
    });
    const session = await sessionResp.json();
    if (!session.client_secret?.value) throw new Error("No client_secret in session response");
    ephemeralKey = session.client_secret.value;
    sessionModel = session.model || (modeSelect.value === 'phonological' ? 'gpt-4o-realtime-preview' : 'gpt-4o-realtime-preview');
    log("Got ephemeral session.");

    pc = new RTCPeerConnection();
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      assistantAudio.srcObject = remoteStream;
    };

    dc = pc.createDataChannel("oai-events");
    dc.onopen = () => {
      if (currentMode === "phonological" && targetScript) {
        const msg = { type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: `Target sentence: ${targetScript}` }] } };
        dc.send(JSON.stringify(msg));
        log("Sent target sentence to session");
      }
    };
    dc.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        const t = evt?.type;
        if (t === 'input_audio_buffer.speech_started') { log('Speech started'); sawSpeechThisTake = true; }
        else if (t === 'input_audio_buffer.speech_stopped') { log('Speech stopped'); }
        else if (t === 'input_audio_buffer.committed') { log('Audio committed'); if (state === 'waiting_commit') maybeRequestFeedback(); }

        if (t === 'conversation.item.created' && evt.item?.role === 'user' && Array.isArray(evt.item?.content)) {
          evt.item.content.forEach(part => {
            if (part?.type === 'input_text' && part?.text) currentTakeTexts.push(String(part.text));
            if (part?.type === 'input_audio' && part?.transcript) currentTakeTexts.push(String(part.transcript));
          });
        }

        if (t === "response.function_call_arguments.delta") {
          toolArgsBuffer += evt.delta || "";
        } else if (t === "response.function_call_arguments.done" || t === "response.done") {
          if (toolArgsBuffer) {
            const raw = toolArgsBuffer; toolArgsBuffer = "";
            try { setFeedback(JSON.parse(raw), { mode: currentMode, take, request_instructions: lastRequestInstructions, target_script: lastTargetScript, intake_text: currentTakeTexts.join(' \n') }); }
            catch { setFeedback(raw, { mode: currentMode, take, request_instructions: lastRequestInstructions, target_script: lastTargetScript, intake_text: currentTakeTexts.join(' \n') }); }
          }
        } else if (t === "response.text.delta" || t === "response.output_text.delta") {
          textBuffer += evt.delta || "";
        } else if (t === "response.text.done" || t === "response.output_text.done") {
          if (textBuffer) {
            const raw = textBuffer; textBuffer = "";
            try { setFeedback(JSON.parse(raw), { mode: currentMode, take, request_instructions: lastRequestInstructions, target_script: lastTargetScript, intake_text: currentTakeTexts.join(' \n') }); }
            catch { setFeedback(raw, { mode: currentMode, take, request_instructions: lastRequestInstructions, target_script: lastTargetScript, intake_text: currentTakeTexts.join(' \n') }); }
          }
        }
      } catch {}
    };

    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
    await pc.setLocalDescription(offer);
    const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(session.model)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ephemeralKey}`, "Content-Type": "application/sdp", "OpenAI-Beta": "realtime=v1" },
      body: offer.sdp
    });
    if (!sdpResponse.ok) throw new Error(await sdpResponse.text());
    const answer = { type: "answer", sdp: await sdpResponse.text() };
    await pc.setRemoteDescription(answer);
    log("Connected. Click Record to start, Stop for feedback.");
    recordBtn.disabled = false;
  } catch (err) {
    log(`Connect error: ${err}`);
    // Allow REST analyze path without realtime
    recordBtn.disabled = false;
    hangupBtn.disabled = true;
    connectBtn.disabled = false;
    log("Proceeding with Record/Stop using REST analyze only.");
  }
}

async function startRecording() {
  try {
    if (!pc) return;
    // Capture current UI selections at the moment of recording
    currentMode = modeSelect.value;
    lastTargetScript = (targetScriptEl?.value || "").trim();
    if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const track = micStream.getAudioTracks()[0];
    if (micSender) await micSender.replaceTrack(track); else micSender = pc.addTrack(track, micStream);

    // Renegotiate so the new track is included in the session
    const offer2 = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
    await pc.setLocalDescription(offer2);
    const sdpResponse2 = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(sessionModel || session.model)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ephemeralKey}`, "Content-Type": "application/sdp", "OpenAI-Beta": "realtime=v1" },
      body: offer2.sdp
    });
    if (!sdpResponse2.ok) throw new Error(await sdpResponse2.text());
    const answer2 = { type: "answer", sdp: await sdpResponse2.text() };
    await pc.setRemoteDescription(answer2);
    log("Renegotiated with mic track.");

    // local recorder for replay
    recordedChunks = [];
    try { mediaRecorder = new MediaRecorder(micStream, { mimeType: 'audio/webm' }); } catch { mediaRecorder = new MediaRecorder(micStream); }
    mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      try {
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
        lastBlobUrl = URL.createObjectURL(blob);
        userPlayback.src = lastBlobUrl; userPlayback.style.display = '';
        replayBtn.disabled = false;
      } catch {}
    };
    try { mediaRecorder.start(); } catch {}

    startMeter(micStream);
    toolArgsBuffer = ""; textBuffer = ""; currentTakeTexts = [];
    state = 'recording'; sawSpeechThisTake = false;
    log("Recording… Speak now.");
    recordBtn.disabled = true; stopBtn.disabled = false;
  } catch (e) { log(`Record error: ${e}`); }
}

function maybeRequestFeedback() {
  state = 'idle';
  if (commitWaitTimer) { clearTimeout(commitWaitTimer); commitWaitTimer = null; }
  if (dc && dc.readyState === "open") {
    const toolName = currentMode === 'phonological' ? 'pronunciation_feedback' : 'stutter_feedback';
    const tools = currentMode === 'phonological'
      ? [{
          type: 'function',
          name: 'pronunciation_feedback',
          description: 'Compare the spoken audio to the target and return concise pronunciation feedback.',
          parameters: {
            type: 'object', additionalProperties: false,
            required: ['content_summary','summary','differences','practice_tips','scores'],
            properties: {
              content_summary: { type: 'string' },
              summary: { type: 'string' },
              scores: { type: 'object', additionalProperties: false, properties: { pronunciation: { type: 'integer' }, intelligibility: { type: 'integer' } } },
              differences: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['type','reference','observed','note'], properties: { type: { type: 'string' }, reference: { type: 'string' }, observed: { type: 'string' }, note: { type: 'string' } } } },
              practice_tips: { type: 'array', items: { type: 'string' } }
            }
          }
        }]
      : [{
          type: 'function',
          name: 'stutter_feedback',
          description: 'Return structured stuttering/fluency feedback including counts and practice tips.',
          parameters: {
            type: 'object', additionalProperties: false,
            required: ['content_summary','overall_summary','strengths','areas_for_improvement','practice_tips','motivation'],
            properties: {
              content_summary: { type: 'string' },
              overall_summary: { type: 'string' },
              strengths: { type: 'array', items: { type: 'string' } },
              areas_for_improvement: { type: 'array', items: { type: 'string' } },
              practice_tips: { type: 'array', items: { type: 'string' } },
              motivation: { type: 'string' }
            }
          }
        }];

    const msg = { type: 'response.create', response: {
      modalities: ['text'],
      tools,
      tool_choice: { type: 'function', name: toolName },
      instructions: `Analyze only the most recent spoken take (ignore previous turns). Take #${take}. Return only the function call. Always respond in English (US).`
    } };
    lastRequestInstructions = msg.response.instructions;
    dc.send(JSON.stringify(msg));
    log("Processing your recording…");
    if (!sawSpeechThisTake) log("Warning: server VAD did not detect speech in this take.");
  }
}

function stopRecording() {
  try {
    if (micSender) { micSender.replaceTrack(null).catch(() => {}); }
    try { if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop(); } catch {}
    stopMeter();
    if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }

    state = 'waiting_commit'; take += 1;
    if (dc && dc.readyState === 'open') dc.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    if (commitWaitTimer) clearTimeout(commitWaitTimer);
    commitWaitTimer = setTimeout(() => { if (state === 'waiting_commit') { log('Finalizing audio… requesting feedback.'); maybeRequestFeedback(); uploadRecordedForAnalysis(); } }, 900);
    stopBtn.disabled = true; recordBtn.disabled = false;
  } catch (e) { log(`Stop error: ${e}`); }
}

async function hangup() {
  try { if (abortController) abortController.abort(); } catch {}
  if (pc) { pc.getSenders().forEach(s => s.track && s.track.stop()); pc.close(); pc = null; }
  dc = null; toolArgsBuffer = ""; textBuffer = ""; micStream = null; micSender = null;
  try { if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); } catch {}
  mediaRecorder = null; recordedChunks = [];
  stopMeter();
  connectBtn.disabled = false; recordBtn.disabled = true; stopBtn.disabled = true; hangupBtn.disabled = true;
  log("Disconnected.");
}

connectBtn.addEventListener("click", connect);
recordBtn.addEventListener("click", startRecording);
stopBtn.addEventListener("click", stopRecording);
if (replayBtn) replayBtn.addEventListener("click", () => { try { userPlayback.currentTime = 0; userPlayback.play(); } catch {} });
hangupBtn.addEventListener("click", hangup);

function startMeter(stream) {
  try {
    if (audioCtx) stopMeter();
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser(); analyser.fftSize = 512; source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let max = 0; for (let i = 0; i < data.length; i++) { const v = Math.abs(data[i] - 128) / 128; if (v > max) max = v; }
      const pct = Math.min(100, Math.max(0, Math.round(max * 140)));
      if (vuBar) vuBar.style.width = pct + '%';
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  } catch {}
}

function stopMeter() { if (rafId) cancelAnimationFrame(rafId); rafId = null; if (audioCtx) { try { audioCtx.close(); } catch {} } audioCtx = null; analyser = null; if (vuBar) vuBar.style.width = '0%'; }

async function uploadRecordedForAnalysis() {
  try {
    if (!recordedChunks || recordedChunks.length === 0) return;
    // Transcode to WAV in-browser (model accepts wav/mp3 only)
    const webmBlob = new Blob(recordedChunks, { type: 'audio/webm' });
    const wavBlob = await toWavBlob(webmBlob);
    const fd = new FormData();
    fd.append('audio', wavBlob, 'take.wav');
    // Read latest selections in case user changed mode/target after Connect
    const latestMode = modeSelect.value;
    const latestTarget = (targetScriptEl?.value || "").trim();
    currentMode = latestMode;
    lastTargetScript = latestTarget;
    fd.append('mode', latestMode);
    if (latestTarget) fd.append('target_script', latestTarget);
    if (instructionsEl.value.trim()) fd.append('instructions', instructionsEl.value.trim());
    const r = await fetch(`${API_BASE}/analyze/audio`, { method: 'POST', body: fd });
    const data = await r.json();
    let replyUrl = '';
    let assistantTranscript = '';
    if (data?.audio_b64) {
      try {
        const b = atob(data.audio_b64);
        const arr = new Uint8Array(b.length);
        for (let i=0;i<b.length;i++) arr[i] = b.charCodeAt(i);
        const aBlob = new Blob([arr], { type: `audio/${data.audio_format || 'mp3'}` });
        const url = URL.createObjectURL(aBlob);
        replyUrl = url;
        if (assistantAudio) {
          assistantAudio.src = url;
          try { assistantAudio.play().catch(() => {}); } catch {}
        }
      } catch {}
    }
    if (data && typeof data.reply_transcript === 'string' && data.reply_transcript.trim().length) {
      assistantTranscript = data.reply_transcript;
    }
    const textOut = (data && typeof data.text === 'string' && data.text.trim().length)
      ? String(data.text)
      : '';
    const transcript = (data && typeof data.transcript === 'string' && data.transcript.trim().length)
      ? data.transcript
      : '(uploaded recording)';
    setFeedback(textOut, { mode: currentMode, take, request_instructions: '(REST analyze)', target_script: lastTargetScript, intake_text: transcript, audio_url: replyUrl, assistant_transcript: assistantTranscript });
    log('Received REST analysis feedback.');
  } catch (e) {
    log(`REST analyze error: ${e}`);
  }
}

// Decode a WebM blob and re-encode to PCM16 WAV
async function toWavBlob(webmBlob) {
  try {
    const arrayBuf = await webmBlob.arrayBuffer();
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuf = await ac.decodeAudioData(arrayBuf);
    const ch = 0; // mono
    const sampleRate = 24000; // downsample target
    // Resample via OfflineAudioContext for better quality
    const offline = new OfflineAudioContext(1, Math.ceil(audioBuf.duration * sampleRate), sampleRate);
    const src = offline.createBufferSource();
    // downmix to mono
    const monoBuf = offline.createBuffer(1, audioBuf.length, audioBuf.sampleRate);
    const tmp = new Float32Array(audioBuf.length);
    const ch0 = audioBuf.getChannelData(0);
    tmp.set(ch0);
    if (audioBuf.numberOfChannels > 1) {
      const ch1 = audioBuf.getChannelData(1);
      for (let i=0;i<tmp.length;i++) tmp[i] = (ch0[i] + ch1[i]) * 0.5;
    }
    monoBuf.copyToChannel(tmp, 0);
    src.buffer = monoBuf;
    src.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    const pcm = rendered.getChannelData(ch);
    const wavBuf = encodeWavPcm16(pcm, rendered.sampleRate);
    return new Blob([wavBuf], { type: 'audio/wav' });
  } catch (e) {
    log(`Transcode to WAV failed, sending WebM: ${e}`);
    return webmBlob;
  }
}

function encodeWavPcm16(samples, sampleRate) {
  // Convert float32 [-1,1] to PCM16 and write WAV header
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample * 1;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  function writeString(offset, s) { for (let i=0;i<s.length;i++) view.setUint8(offset+i, s.charCodeAt(i)); }
  function floatTo16BitPCM(offset, input) {
    let pos = offset;
    for (let i=0;i<input.length;i++, pos+=2) {
      let s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return pos;
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);
  floatTo16BitPCM(44, samples);
  return buffer;
}
