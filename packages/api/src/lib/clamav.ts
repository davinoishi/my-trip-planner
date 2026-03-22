import net from "net";

/**
 * Scan a buffer with ClamAV via the clamd TCP socket.
 * Returns { clean: true } if no threat found, { clean: false, threat } if infected.
 * Returns { clean: true, skipped: true } if ClamAV is unreachable (dev tolerance).
 */
export async function scanBuffer(
  buffer: Buffer
): Promise<{ clean: boolean; threat?: string; skipped?: boolean }> {
  const host = process.env.CLAMAV_HOST ?? "localhost";
  const port = parseInt(process.env.CLAMAV_PORT ?? "3310", 10);

  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 5000;

    socket.setTimeout(timeout);

    socket.on("timeout", () => {
      socket.destroy();
      console.warn("[ClamAV] Connection timed out — skipping scan");
      resolve({ clean: true, skipped: true });
    });

    socket.on("error", (err) => {
      console.warn(`[ClamAV] Unavailable (${err.message}) — skipping scan`);
      resolve({ clean: true, skipped: true });
    });

    socket.connect(port, host, () => {
      let response = "";

      // clamd INSTREAM protocol: send "zINSTREAM\0" then chunks prefixed with 4-byte big-endian length
      socket.write("zINSTREAM\0");

      const chunkSize = 4096;
      for (let i = 0; i < buffer.length; i += chunkSize) {
        const chunk = buffer.subarray(i, i + chunkSize);
        const sizeBuffer = Buffer.alloc(4);
        sizeBuffer.writeUInt32BE(chunk.length, 0);
        socket.write(sizeBuffer);
        socket.write(chunk);
      }

      // End of stream: 4 zero bytes
      socket.write(Buffer.alloc(4));

      socket.on("data", (data) => {
        response += data.toString();
      });

      socket.on("end", () => {
        // Response: "stream: OK\n" or "stream: <threat> FOUND\n"
        if (response.includes("OK")) {
          resolve({ clean: true });
        } else {
          const match = response.match(/stream: (.+) FOUND/);
          resolve({ clean: false, threat: match?.[1] ?? "Unknown threat" });
        }
      });
    });
  });
}
