import * as dotenv from "dotenv";
import * as net from "net";
import * as scrypt from "scrypt-js";

export async function startMining() {
  const startTime = new Date();
  console.log(`⏳ Script started at: ${startTime.toLocaleString()}`);

  try {
    console.log("🔑 Loading environment variables...");
    dotenv.config();
    console.info("dotenv :: ", process.env);

    const POOL_HOST = process.env.POOL_HOST as string;
    const POOL_PORT = parseInt(process.env.POOL_PORT as string, 10);
    const USERNAME = process.env.USERNAME as string;
    const PASSWORD = process.env.PASSWORD as string;

    const client = new net.Socket();

    // Connect to the mining pool
    console.log(`⛓️ Connecting to pool ${POOL_HOST}:${POOL_PORT}...`);
    const connectionStart = new Date();
    client.connect(POOL_PORT, POOL_HOST, () => {
      const connectionEnd = new Date();
      console.log(`✅ Connected to pool ${POOL_HOST}:${POOL_PORT}`);
      console.log(`⏱️ Connection duration: ${(connectionEnd.getTime() - connectionStart.getTime()) / 1000} seconds`);

      // Send subscribe message to pool
      const loginMessage = JSON.stringify({
        id: 1,
        method: "mining.subscribe",
        params: [],
      });
      console.info("loginMessage :: ", loginMessage);
      client.write(`${loginMessage}\n`);
    });

    // Handle incoming data (jobs or responses from the pool)
    client.on("data", async (data: Buffer) => {
      const dataStartTime = new Date();
      const dataString = data.toString();
      console.info("data :: ", dataString);

      const messages = dataString.split("\n");

      messages.forEach(async (message) => {
        if (message.trim()) {
          try {
            const response = JSON.parse(message);
            console.info("response :: ", response);

            if (response.result) {
              console.log("✅ Successfully logged in to the pool.");

              const authStartTime = new Date();
              const authMessage = JSON.stringify({
                id: 2,
                method: "mining.authorize",
                params: [USERNAME, PASSWORD],
              });
              console.info("authMessage :: ", authMessage);
              client.write(`${authMessage}\n`);
              const authEndTime = new Date();
              console.log(
                `⏱️ Authorization duration: ${(authEndTime.getTime() - authStartTime.getTime()) / 1000} seconds`,
              );
            } else if (response.method === "mining.notify") {
              console.log("🔄 Receiving work from the pool...");

              const job = response.params;
              const jobId: string = job[0];
              const prevBlockHash: string = job[1];
              const coinBase1: string = job[2];
              const coinBase2: string = job[3];
              const merkleBranch: string[] = job[4];
              const version: string = job[5];
              const nBits: string = job[6];
              const nTime: string = job[7];

              const blockHeader: string =
                prevBlockHash + coinBase1 + coinBase2 + merkleBranch.join("") + version + nBits + nTime;
              const blockHeaderBytes: Buffer = Buffer.from(blockHeader, "hex");

              let nonce: number = 0;
              let found: boolean = false;
              let hashResult: Buffer;

              console.log("🔍 Trying nonce...");

              const nonceStartTime = new Date();
              let totalHashes = 0; // To count the total number of hashes calculated

              while (!found) {
                const nonceBuffer: Buffer = Buffer.alloc(4);
                nonceBuffer.writeUInt32LE(nonce, 0);
                const dataToHash: Buffer = Buffer.concat([blockHeaderBytes, nonceBuffer]);

                hashResult = Buffer.from(await scrypt.scrypt(dataToHash, dataToHash, 1024, 1, 1, 32));
                totalHashes++; // Increment hash count for every nonce trial

                if (hashResult.readUInt32LE(0) === 0) {
                  found = true;
                } else {
                  nonce++;
                }

                // Display hashrate and total hashes every 1000 hashes
                if (totalHashes % 1000 === 0) {
                  const elapsedTime = (new Date().getTime() - nonceStartTime.getTime()) / 1000; // Elapsed time in seconds
                  const hashrate = totalHashes / elapsedTime; // Hashes per second (hashrate)
                  console.log(`⏱️ Current Hashrate: ${hashrate.toFixed(2)} H/s`);
                  console.log(`🔢 Total Hashes: ${totalHashes}`);
                }
              }

              const nonceEndTime = new Date();
              console.log(`✅ Nonce found: ${nonce}`);
              console.log(
                `⏱️ Nonce finding duration: ${(nonceEndTime.getTime() - nonceStartTime.getTime()) / 1000} seconds`,
              );

              const submitMessage =
                JSON.stringify({
                  id: 3,
                  method: "mining.submit",
                  params: [USERNAME, jobId, nonce.toString()],
                }) + "\n";
              console.info("submitMessage :: ", submitMessage);
              client.write(submitMessage);
            }
          } catch (error) {
            console.error("❌ Error parsing JSON:", error, message);
          }
        }
      });

      const dataEndTime = new Date();
      console.log(`⏱️ Data handling duration: ${(dataEndTime.getTime() - dataStartTime.getTime()) / 1000} seconds`);
    });

    client.on("error", (error: Error) => {
      console.error("❌ Error:", error);
    });
  } catch (error) {
    console.error("❌ Error occurred during mining:", error);
  } finally {
    const endTime = new Date();
    const totalDuration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log(`✅ Script ended at: ${endTime.toLocaleString()}`);
    console.log(`⏱️ Total script duration: ${totalDuration} seconds`);
  }
}
