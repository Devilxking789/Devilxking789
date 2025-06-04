app.use(express.json());

app.post("/pair-code", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).send("❌ Pair code is missing");

  try {
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/pair_${Date.now()}`);
    const sock = makeWASocket({
      auth: state,
      browser: ["PairCode", "Chrome", "120.0"],
      connectTimeoutMs: 60_000,
      printQRInTerminal: false,
    });

    // Use pair code
    await sock.ws.send(JSON.stringify(["pair-code", code]));

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "open") {
        const number = sock.user.id.split(":")[0];
        await sock.sendMessage(sock.user.id, {
          text: `✅ Pair code se session activate ho gaya!

📲 Number: ${number}`,
        });
        await saveCreds();
      }

      if (connection === "close" && lastDisconnect?.error instanceof Boom && lastDisconnect.error.output.statusCode !== 401) {
        sock = makeWASocket({ auth: state });
      }
    });

    res.send("✅ Pair code submitted. Session initializing...");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Pair code se connection failed.");
  }
});
