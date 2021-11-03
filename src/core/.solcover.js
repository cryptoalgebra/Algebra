const fs = require('fs');

const testContracts = fs.readdirSync("./contracts/test")


module.exports = {
    skipFiles: testContracts.map((x) => "test/" + x),
    testfiles: "test/*.ts"
  };