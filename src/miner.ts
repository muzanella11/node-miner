import * as fs from "fs";
import * as path from "path";

// Function to choose the correct miner script based on the cryptocurrency
async function startMining(crypto: string) {
  const minerFile = path.join(__dirname, `./miner/${crypto}-miner.ts`);

  const startTime = new Date(); // Capture start time
  console.log(`⏳ Script started at: ${startTime.toLocaleString()}`);
  console.log(`🚀 Starting mining for ${crypto.toUpperCase()}...`);

  try {
    if (!fs.existsSync(minerFile)) {
      throw new Error(`Miner script for ${crypto} not found!`);
    }

    // Dynamically import the selected miner script
    const minerModule = await import(minerFile);
    await minerModule.startMining();
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
  } finally {
    const endTime = new Date(); // Capture end time
    const duration = (endTime.getTime() - startTime.getTime()) / 1000; // Calculate duration in seconds
    console.log(`✅ Script ended at: ${endTime.toLocaleString()}`);
    console.log(`⏱️ Duration: ${duration} seconds`);
  }
}

// Get the cryptocurrency to mine from environment variables or arguments
const cryptoToMine = process.argv[2] || "btc"; // Default to 'btc' if no argument is provided

startMining(cryptoToMine);
