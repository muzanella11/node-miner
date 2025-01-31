import * as fs from "fs";
import * as path from "path";

// Function to choose the correct miner script based on the cryptocurrency
function startMining(crypto: string) {
  const minerFile = path.join(__dirname, `./miner/${crypto}-miner.ts`);

  if (fs.existsSync(minerFile)) {
    // Dynamically import the selected miner script
    import(minerFile)
      .then((minerModule) => {
        console.log(`🚀 Starting mining for ${crypto.toUpperCase()}...`);
        minerModule.startMining();
      })
      .catch((error) => {
        console.error(`❌ Error loading miner script for ${crypto}:`, error);
      });
  } else {
    console.log(`❌ Miner script for ${crypto} not found!`);
  }
}

// Get the cryptocurrency to mine from environment variables or arguments
const cryptoToMine = process.argv[2] || "btc"; // Default to 'btc' if no argument is provided

startMining(cryptoToMine);
