const fs = require('fs');

const testContracts = fs.readdirSync("./contracts/test")
const skipFiles = testContracts.map((x) => "test/" + x)
skipFiles.push("lens/QuoterV2.sol"); // stack too deep when instrumented, see hardhat.config.ts


module.exports = {
    skipFiles: skipFiles,
    testfiles: "test/*.ts",
    configureYulOptimizer: true,
    mocha: {
      grep: "@skip-on-coverage", // Find everything with this tag
      invert: true               // Run the grep's inverse set.
    }
  };