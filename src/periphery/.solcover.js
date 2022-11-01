const fs = require('fs');

const testContracts = fs.readdirSync("./contracts/test")
const skipFiles = testContracts.map((x) => "test/" + x)
skipFiles.push("libraries/NFTSVG.sol"); // TODO remove after fix of https://github.com/sc-forks/solidity-coverage/issues/751


module.exports = {
    skipFiles: skipFiles,
    testfiles: "test/*.ts",
    mocha: {
      grep: "@skip-on-coverage", // Find everything with this tag
      invert: true               // Run the grep's inverse set.
    }
  };