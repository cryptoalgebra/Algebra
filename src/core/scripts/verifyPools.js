const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const deployDataPath = path.resolve(__dirname, './pools.json');
  let poolsData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'));
  let pools = poolsData["data"]["pools"]
  
  // Array to store unverified pools
  const unverifiedPools = [];

  for (let i = 0; i < pools.length; i++){
    try{
        // First check if the address exists in the explorer
        const explorerResponse = await fetch(`https://shannon-explorer.somnia.network/api/v2/addresses/${pools[i]["id"]}`);
        
        if (explorerResponse.ok) {
            const explorerData = await explorerResponse.json();
            console.log(`Address ${pools[i]["id"]} found in explorer:`, explorerData.is_contract ? 'Contract' : 'EOA');
            
            // If it's not detected as a contract, try to trigger indexing by calling the contract
            if (!explorerData.is_contract) {
                console.log(`Attempting to trigger contract detection for ${pools[i]["id"]}`);
                
                // Make a simple contract call to trigger indexing
                const provider = hre.ethers.provider;
                const code = await provider.getCode(pools[i]["id"]);
                
                if (code !== '0x') {
                    console.log(`Contract bytecode exists for ${pools[i]["id"]}, explorer should detect it soon`);
                    
                    // Wait a bit for the explorer to index
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }

        // Proceed with verification
        await hre.run('verify:verify', {
            address: pools[i]["id"],
        });
        
        console.log(`Successfully verified: ${pools[i]["id"]}`);
        
    } catch (error) {
        console.log(pools[i]["id"], "verification failed:", error.message);
        // Add to unverified pools array
        unverifiedPools.push({
            ...pools[i],
            error: error.message
        });
    }
  }

  // Save unverified pools to unverified.json
  if (unverifiedPools.length > 0) {
    const unverifiedPath = path.resolve(__dirname, './unverified.json');
    fs.writeFileSync(unverifiedPath, JSON.stringify({
      data: {
        pools: unverifiedPools
      }
    }, null, 2));
    console.log(`\nSaved ${unverifiedPools.length} unverified pools to unverified.json`);
  } else {
    console.log('\nAll pools verified successfully!');
  }
}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
