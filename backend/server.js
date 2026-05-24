const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let savedAccount = {};

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

// Generate Temp Email
app.get("/generate", async (req, res) => {
  try {
    const domainsRes = await axios.get("https://api.mail.tm/domains");
    // Filter for .com domains, fallback to first available if none found
    const allDomains = domainsRes.data["hydra:member"];
    let domain = allDomains.find(d => d.domain.endsWith(".com"))?.domain;
    if (!domain) {
      domain = allDomains[0].domain;
    }

    const email = `user${Date.now()}@${domain}`;
    const password = createSecurePassword(16);

    await axios.post("https://api.mail.tm/accounts", {
      address: email,
      password: password
    });

    const tokenRes = await axios.post("https://api.mail.tm/token", {
      address: email,
      password: password
    });

    savedAccount = {
      email,
      token: tokenRes.data.token,
      password
    };

    res.json(savedAccount);
  } catch (err) {
    res.status(500).json({ error: "Email generation failed" });
  }
});

// Get Inbox Messages
app.get("/messages", async (req, res) => {
  try {
    const inbox = await axios.get("https://api.mail.tm/messages", {
      headers: {
        Authorization: `Bearer ${savedAccount.token}`
      }
    });
    res.json(inbox.data["hydra:member"]);
  } catch (err) {
    res.status(500).json({ error: "Inbox fetch failed" });
  }
});

// Read Single Message
app.get("/message/:id", async (req, res) => {
  try {
    const message = await axios.get(
      `https://api.mail.tm/messages/${req.params.id}`,
      {
        headers: {
          Authorization: `Bearer ${savedAccount.token}`
        }
      }
    );
    res.json(message.data);
  } catch (err) {
    res.status(500).json({ error: "Message load failed" });
  }
});

// Delete Single Message
app.delete("/message/:id", async (req, res) => {
  try {
    await axios.delete(`https://api.mail.tm/messages/${req.params.id}`, {
      headers: {
        Authorization: `Bearer ${savedAccount.token}`
      }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Delete message failed" });
  }
});

app.listen(3000, () => {
  console.log("✅ Backend running on http://localhost:3000");
});
