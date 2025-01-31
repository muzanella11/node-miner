import * as dotenv from "dotenv";
import * as net from "net";
import * as scrypt from "scrypt-js";

export function startMining() {
  // Load environment variables from .env file
  dotenv.config();

  console.info("dotenv :: ", process.env);

  // Retrieve configuration from environment variables
  const POOL_HOST = process.env.POOL_HOST as string;
  const POOL_PORT = parseInt(process.env.POOL_PORT as string, 10);
  const USERNAME = process.env.USERNAME as string;
  const PASSWORD = process.env.PASSWORD as string;

  const client = new net.Socket();

  // Connect to the mining pool
  client.connect(POOL_PORT, POOL_HOST, () => {
    console.log(`⛏️  Connected to pool ${POOL_HOST}:${POOL_PORT}`);

    // Send subscribe message to pool
    const loginMessage = JSON.stringify({
      id: 1,
      method: "mining.subscribe",
      params: [],
    });
    console.info("here login message :: ", loginMessage);
    client.write(`${loginMessage}\n`);
  });

  // Handle incoming data (jobs or responses from the pool)
  client.on("data", async (data: Buffer) => {
    // Convert the data buffer to a string and split by newline to handle multiple JSON objects
    const dataString = data.toString();
    console.info("data :: ", dataString);

    // Split the data string by newline to handle each JSON object
    const messages = dataString.split("\n");

    // Iterate over each message and try to parse it
    messages.forEach(async (message) => {
      if (message.trim()) {
        // Avoid empty messages
        try {
          const response = JSON.parse(message);
          console.info("response :: ", response);

          // If the pool responds with a subscription confirmation
          if (response.result) {
            console.log("✅ Successfully logged in to the pool.");

            // Send authorization message to the pool
            const authMessage = JSON.stringify({
              id: 2,
              method: "mining.authorize",
              params: [USERNAME, PASSWORD],
            });
            console.info("authMessage :: ", authMessage);
            client.write(`${authMessage}\n`);
          }
          // If the pool sends a new job to mine
          else if (response.method === "mining.notify") {
            console.log("🔄 Receiving work from the pool...");

            // Extract job parameters from the response
            const job = response.params;
            const jobId: string = job[0];
            const prevBlockHash: string = job[1];
            const coinBase1: string = job[2];
            const coinBase2: string = job[3];
            const merkleBranch: string[] = job[4];
            const version: string = job[5];
            const nBits: string = job[6];
            const nTime: string = job[7];

            // Construct the block header for hashing
            const blockHeader: string =
              prevBlockHash + coinBase1 + coinBase2 + merkleBranch.join("") + version + nBits + nTime;
            const blockHeaderBytes: Buffer = Buffer.from(blockHeader, "hex");

            let nonce: number = 0;
            let found: boolean = false;
            let hashResult: Buffer;

            console.log("🔍 Trying nonce...");

            // Try different nonce values until a valid one is found
            while (!found) {
              const nonceBuffer: Buffer = Buffer.alloc(4);
              nonceBuffer.writeUInt32LE(nonce, 0); // Write the nonce to the buffer
              const dataToHash: Buffer = Buffer.concat([blockHeaderBytes, nonceBuffer]); // Concatenate block header and nonce

              // Perform Scrypt hashing
              hashResult = Buffer.from(await scrypt.scrypt(dataToHash, dataToHash, 1024, 1, 1, 32));

              // Check if the hash meets the condition (here, the first 4 bytes must be zero)
              if (hashResult.readUInt32LE(0) === 0) {
                found = true;
              } else {
                nonce++; // Increment nonce if the condition is not met
              }
            }

            console.log(`✅ Nonce found: ${nonce}`);

            // Send the result (found nonce) back to the pool for submission
            const submitMessage =
              JSON.stringify({
                id: 3,
                method: "mining.submit",
                params: [USERNAME, jobId, nonce.toString()],
              }) + "\n";

            client.write(submitMessage); // Submit the solution
          }
        } catch (error) {
          console.error("❌ Error parsing JSON:", error, message);
        }
      }
    });
  });

  // Handle any errors
  client.on("error", (error: Error) => {
    console.error("❌ Error:", error);
  });
}
