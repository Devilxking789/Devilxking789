const express = require("express");
const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode");
const { Boom } = require("@hapi/boom");
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const P = require("pino");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json());

let latestSock = null;

app.get("/qr", async (req, res) => {
  const { state, saveCreds } = await useMultiFileAuthState(`./sessions/session_${Date.now()}`);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
    logger: P({ level: "silent" }),
  });

  latestSock = sock;

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      const qrImage = await qrcode.toDataURL(qr);
      res.send(`<img src="${qrImage}" style="width:300px;"/>`);
    }

    if (connection === "open") {
      await sock.sendMessage(sock.user.id, {
        text: `✅ Your WhatsApp session is active.\n\n🔐 Number: ${sock.user.id.split(":")[0]}`,
      });
      await saveCreds();
    }

    if (connection === "close") {
      if (
        lastDisconnect &&
        lastDisconnect.error &&
        lastDisconnect.error.output &&
        lastDisconnect.error.output.statusCode !== 401
      ) {
        makeWASocket({ auth: state });
      }
    }
  });
});

app.post("/pair-code", async (req, res) => {
  try {
    const code = req.body.code;
    if (!code) return res.status(400).send("No code sent");

    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/pair_${Date.now()}`);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      printQRInTerminal: false,
      auth: state,
      logger: P({ level: "silent" }),
    });

    await sock.ws.send(JSON.stringify(["pair-code", code]));

    sock.ev.on("connection.update", async ({ connection }) => {
      if (connection === "open") {
        await sock.sendMessage(sock.user.id, {
          text: `✅ Pair Code se session active ho gaya.\n\n🔐 Number: ${sock.user.id.split(":")[0]}`,
        });
        await saveCreds();
      }
    });

    res.send("✅ Pair code sent for connection...");
  } catch (e) {
    console.error(e);
    res.status(500).send("❌ Pair code se connection failed.");
  }
});

app.listen(PORT, () => {
  console.log(`✅ Running on http://localhost:${PORT}`);
});
