const express = require("express");
const fs = require("fs");
const { Boom } = require("@hapi/boom");
const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

let qrCodeData = null;

app.get("/generate-qr", async (req, res) => {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/temp_${Date.now()}`);
    const sock = makeWASocket({ auth: state });

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCodeData = await qrcode.toDataURL(qr);
      }

      if (connection === "open") {
        const number = sock.user.id.split(":")[0];
        await sock.sendMessage(sock.user.id, {
          text: `✅ Aapka WhatsApp bot session activate ho gaya hai.

🔐 Number: ${number}`,
        });
        await saveCreds();
      }

      if (connection === "close" && lastDisconnect?.error instanceof Boom && lastDisconnect.error.output.statusCode !== 401) {
        sock = makeWASocket({ auth: state });
      }
    });

    setTimeout(() => {
      res.send(qrCodeData || "QR not ready, refresh again.");
    }, 2000);
  } catch (e) {
    console.error(e);
    res.status(500).send("Error generating QR");
  }
});

app.listen(PORT, () => {
  console.log(`✅ Public WhatsApp Pair Bot running on http://localhost:${PORT}`);
});