const { constants } = require('buffer');
const fs = require('fs');
const path = require('path');

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
      fs.writeFileSync(path.resolve(currentDirectory, file.name), content);
    }
  }
}

cleanDirectoryRecursively(__dirname, 'Contracts');
