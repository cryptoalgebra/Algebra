const { constants } = require('buffer');
const fs = require('fs');
const path = require('path');

const remappings = [
  ['../@cryptoalgebra/integral-core/contracts', '../Core'],
  ['../@cryptoalgebra/integral-periphery/contracts', '../Periphery'],
  ['../@cryptoalgebra/integral-base-plugin/contracts', '../Plugin'],
];

function cleanDirectoryRecursively(currentPath, directory) {
  const currentDirectory = path.resolve(currentPath, directory);
  const files = fs.readdirSync(currentDirectory, { withFileTypes: true });

  for (let file of files) {
    if (file.isDirectory()) {
      cleanDirectoryRecursively(currentDirectory, file.name);
      continue;
    }
    let content = fs.readFileSync(path.resolve(currentDirectory, file.name)).toString();
    if (!content || !content.match(/[^\s\t\n]/)) {
      fs.unlinkSync(path.resolve(currentDirectory, file.name));
    } else {
      content = content.replaceAll('&#x3D;&gt;', '=>');
      for (const remapping of remappings) {
        content = content.replaceAll(remapping[0], remapping[1]);
      }
      fs.writeFileSync(path.resolve(currentDirectory, file.name), content);
    }
  }
}

cleanDirectoryRecursively(__dirname, 'Contracts');
