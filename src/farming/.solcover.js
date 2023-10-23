const fs = require('fs');

const testContracts = fs.readdirSync("./contracts/test")
const skipFiles = testContracts.map((x) => "test/" + x)

module.exports = {
  skipFiles: skipFiles,
  mocha: {
    grep: '@skip-on-coverage', // Find everything with this tag
    invert: true, // Run the grep's inverse set.
  },
}
