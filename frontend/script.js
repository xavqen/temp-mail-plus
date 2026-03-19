const backend = "http://localhost:3000";
let currentAccount = null;
let currentMessages = [];
let selectedMessageId = null;
let refreshIntervalId = null;
const AUTO_REFRESH_MS = 3000;

function setStatus(message, type = "success") {
  const statusEl = document.getElementById("status");
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
  statusEl.classList.remove("hidden");
  if (type === "success") {
    setTimeout(() => statusEl.classList.add("hidden"), 2700);
  }
}

function animateRefreshBar() {
  const barFill = document.getElementById("refreshBarFill");
  if (!barFill) return;
  barFill.style.transition = "none";
  barFill.style.width = "0%";
  requestAnimationFrame(() => {
    barFill.style.transition = `width ${AUTO_REFRESH_MS}ms linear`;
    barFill.style.width = "100%";
  });
}

function startAutoRefresh() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
  }

  animateRefreshBar();
  refreshIntervalId = setInterval(async () => {
    if (!currentAccount) {
      return;
    }
    animateRefreshBar();
    await loadInbox();
  }, AUTO_REFRESH_MS);
}

function highlightSelectedMessage() {
  document.querySelectorAll(".inbox-item").forEach((item) => {
    item.classList.toggle("selected", item.dataset.messageId === selectedMessageId);
  });
}

async function deleteMessage(event, id) {
  event.stopPropagation();
  if (!currentAccount) {
    setStatus("No account active.", "error");
    return;
  }

  let deleteFailed = false;

  try {
    const res = await fetch(`${backend}/message/${id}`, { method: "DELETE" });
    const text = await res.text();
    let info = {};
    try {
      info = JSON.parse(text);
    } catch (err) {
      info = { error: text };
    }

    if (!res.ok) {
      deleteFailed = true;
      throw new Error(info.error || `${res.status} ${res.statusText}`);
    }

    setStatus("Message deleted from server.", "success");
  } catch (error) {
    deleteFailed = true;
    setStatus(`Delete request failed: ${error.message || error}. Removing locally entry.`, "error");
  }

  // Always remove from local cache/UI to keep smart interaction.
  currentMessages = currentMessages.filter((m) => m.id !== id);

  if (selectedMessageId === id) {
    selectedMessageId = null;
    document.getElementById("messageDetails").innerHTML = "<p>Select an email from the inbox to view the content.</p>";
  }

  await loadInbox(true);

  if (deleteFailed) {
    setStatus("Delete action applied locally. server delete may have failed.", "error");
  }
}

async function generateEmail() {
  try {
    setStatus("Creating your temporary address...");
    const res = await fetch(`${backend}/generate`);
    const data = await res.json();

    if (!data.email || !data.token) {
      throw new Error(data.error || "Generation failed");
    }

    currentAccount = data;
    document.getElementById("generatedEmail").value = currentAccount.email;
    document.getElementById("generatedPassword").textContent = currentAccount.password || "(not available)";
    document.getElementById("copyEmail").disabled = false;
    document.getElementById("copyPassword").disabled = false;

    setStatus("Email generated successfully! Inbox is ready.", "success");
    await loadInbox(true);
    startAutoRefresh();
  } catch (error) {
    setStatus(`Generate failed: ${error.message || error}`, "error");
  }
}

async function loadInbox(skipRequires = false) {
  if (!currentAccount && !skipRequires) {
    setStatus("Generate an email first before checking inbox.", "error");
    return;
  }

  try {
    setStatus("Loading inbox...", "success");
    const res = await fetch(`${backend}/messages`);
    const messages = await res.json();

    if (!Array.isArray(messages)) {
      throw new Error(messages.error || "Failed to read inbox");
    }

    currentMessages = messages;
    const inbox = document.getElementById("inbox");
    inbox.innerHTML = "";

    if (messages.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "No messages yet. Please refresh later.";
      empty.style.cursor = "default";
      inbox.appendChild(empty);
      setStatus("Inbox is empty.", "success");
      return;
    }

    messages.forEach((msg) => {
      const li = document.createElement("li");
      const activeClass = selectedMessageId === msg.id ? " selected" : "";
      li.className = "inbox-item" + activeClass;
      li.dataset.messageId = msg.id;
      li.innerHTML = `
        <div class="message-row">
          <div class="message-info" onclick="readMessage('${msg.id}')">
            <strong>${msg.subject || "(No Subject)"}</strong><br>
            <small>${msg.from?.address || "unknown"} • ${new Date(msg.createdAt).toLocaleString()}</small>
          </div>
          <button class="delete-btn" onclick="deleteMessage(event, '${msg.id}')" title="Delete this message">🗑️</button>
        </div>
      `;
      inbox.appendChild(li);
    });

    if (selectedMessageId) {
      const selected = messages.find((m) => m.id === selectedMessageId);
      if (!selected) {
        selectedMessageId = null;
        document.getElementById("messageDetails").innerHTML = "<p>Select an email from the inbox to view the content.</p>";
      }
    }

    setStatus(`${messages.length} message(s) loaded.`, "success");
  } catch (error) {
    setStatus(`Inbox load failed: ${error.message || error}`, "error");
  }
}

async function readMessage(id) {
  try {
    const res = await fetch(`${backend}/message/${id}`);
    const msg = await res.json();

    if (msg.error) {
      throw new Error(msg.error);
    }

    selectedMessageId = id;
    highlightSelectedMessage();

    const detail = document.getElementById("messageDetails");
    detail.innerHTML = `
      <h3>${msg.subject || "(No Subject)"}</h3>
      <p><strong>From:</strong> ${msg.from?.address || "-"}</p>
      <p><strong>Date:</strong> ${new Date(msg.createdAt).toLocaleString()}</p>
      <hr />
      <div>${msg.text ? msg.text.replace(/\n/g, "<br>") : "<em>No text content</em>"}</div>
      <div>${msg.html || ""}</div>
    `;

    setStatus("Message displayed.", "success");
  } catch (error) {
    setStatus(`Read message failed: ${error.message || error}`, "error");
  }
}

function copyEmail() {
  const email = document.getElementById("generatedEmail").value;
  if (!email) return;

  navigator.clipboard.writeText(email).then(
    () => setStatus("Email copied to clipboard!", "success"),
    (err) => setStatus(`Copy failed: ${err}`, "error")
  );
}

function copyPassword() {
  const password = document.getElementById("generatedPassword").textContent;
  if (!password || password === "••••••" || password === "(not available)") {
    return setStatus("No passwords available to copy.", "error");
  }

  navigator.clipboard.writeText(password).then(
    () => setStatus("Password copied to clipboard!", "success"),
    (err) => setStatus(`Copy failed: ${err}`, "error")
  );
}



