const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

function createSecurePassword(length = 14) {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-!@#$%^&*";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset[Math.floor(Math.random() * charset.length)];
  }
  return result;
}

app.get('/ping', (req, res) => {
  res.status(200).send('Server is awake');
});

// Yahan se 'let savedAccount = {};' ko bilkul hata dein

// Generate Temp Email (Yeh route theek hai, bas variable hataya hai)
app.get("/generate", async (req, res) => {
  try {
    const domainsRes = await axios.get("https://api.mail.tm/domains");
    const allDomains = domainsRes.data["hydra:member"];
    let domain = allDomains.find(d => d.domain.endsWith(".com"))?.domain || allDomains[0].domain;

    const email = `user${Date.now()}@${domain}`;
    const password = createSecurePassword(16);

    await axios.post("https://api.mail.tm/accounts", { address: email, password: password });
    const tokenRes = await axios.post("https://api.mail.tm/token", { address: email, password: password });

    // Seedha response bhej dein, server par save na karein
    res.json({
      email,
      token: tokenRes.data.token,
      password
    });
  } catch (err) {
    res.status(500).json({ error: "Email generation failed" });
  }
});

// Helper function: Frontend se token nikalne ke liye
function getToken(req) {
  const authHeader = req.headers.authorization;
  return authHeader ? authHeader.split(" ")[1] : null;
}

// Get Inbox Messages
app.get("/messages", async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const inbox = await axios.get("https://api.mail.tm/messages", {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(inbox.data["hydra:member"]);
  } catch (err) {
    res.status(500).json({ error: "Inbox fetch failed" });
  }
});

// Read Single Message
app.get("/message/:id", async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const message = await axios.get(`https://api.mail.tm/messages/${req.params.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(message.data);
  } catch (err) {
    res.status(500).json({ error: "Message load failed" });
  }
});

// Delete Single Message
app.delete("/message/:id", async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    await axios.delete(`https://api.mail.tm/messages/${req.params.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Delete message failed" });
  }
});

app.listen(3000, () => {
  console.log("✅ Backend running on http://localhost:3000");
});
