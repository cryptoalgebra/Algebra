const fs = require('fs');

const testContracts = fs.readdirSync("./contracts/test")


module.exports = {
    skipFiles: testContracts.map((x) => "test/" + x),
    testfiles: "test/*.ts",
    mocha: {
      grep: "@skip-on-coverage", // Find everything with this tag
      invert: true               // Run the grep's inverse set.
    }
  };