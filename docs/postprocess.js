const fs = require('fs');
const path = require('path');

const remappings = [
  ['&#x3D;&gt;', '=>'],
  ['../@cryptoalgebra/integral-core/contracts', '../Core'],
  ['../@cryptoalgebra/integral-periphery/contracts', '../Periphery'],
  ['../@cryptoalgebra/integral-base-plugin/contracts', '../Plugin'],
  [/\([^\(]+@openzeppelin\/contracts[^\(]+\)/g, '(https://docs.openzeppelin.com/contracts/4.x/)'],
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
      for (const remapping of remappings) {
        content = content.replaceAll(remapping[0], remapping[1]);
      }
      fs.writeFileSync(path.resolve(currentDirectory, file.name), content);
    }
  }
}

const contractsDatas = [];

function loadContracts(currentPath, directory) {
  const currentDirectory = path.resolve(currentPath, directory);
  const files = fs.readdirSync(currentDirectory, { withFileTypes: true });

  for (let file of files) {
    if (file.isDirectory()) {
      loadContracts(currentDirectory, file.name);
      continue;
    }
    contractsDatas[file.name.replace('.md', '')] = path.resolve(currentDirectory, file.name);
  }
}

function updateLinks(currentPath, directory) {
  const currentDirectory = path.resolve(currentPath, directory);
  const files = fs.readdirSync(currentDirectory, { withFileTypes: true });

  for (let file of files) {
    if (file.isDirectory()) {
      updateLinks(currentDirectory, file.name);
      continue;
    }

    let content = fs.readFileSync(path.resolve(currentDirectory, file.name)).toString();

    if (content.match(/\#[A-Z][\w\d]+/)) {
      const results = content.match(/\#[A-Z][\w\d]+/g).map((x) => x);
      for (const result of results) {
        const contractName = result.replace('#', '');
        if (contractsDatas[contractName]) {
          const pathTo = path.relative(currentDirectory, contractsDatas[contractName]).replaceAll('\\', '/');
          content = content.replaceAll(result, `[${contractName}](${pathTo})`);
        }
      }
      fs.writeFileSync(path.resolve(currentDirectory, file.name), content);
    }

    if (content.match(/ [A-Z][\w\d]+\#[\w\d]+/)) {
      const results = content.match(/ [A-Z][\w\d]+\#[\w\d]+/g).map((x) => x);
      for (const result of results) {
        const [contractName, contractMethod] = result.trim().split('#');
        if (contractsDatas[contractName]) {
          const pathTo = path.relative(currentDirectory, contractsDatas[contractName]).replaceAll('\\', '/');
          content = content.replaceAll(result, ` [${contractName}#${contractMethod}](${pathTo}#${contractMethod})`);
        }
      }
      fs.writeFileSync(path.resolve(currentDirectory, file.name), content);
    }

    if (content.match(/[\,\s\.\'\"\`\*\r\n]\#[a-z][\w\d]+[\,\s\.\'\"\`\*\r\n]/)) {
      const results = content.match(/[\,\s\.\'\"\`\*\r\n]\#[a-z][\w\d]+[\,\s\.\'\"\`\*\r\n]/g).map((x) => x);
      for (const result of results) {
        const functionName = result.substring(1, result.length - 1).replace('#', '');
        if (content.includes(`### ${functionName}`)) {
          content = content.replaceAll(result, result[0] + `[#${functionName}](#${functionName})` + result[result.length - 1]);
        }
      }
      fs.writeFileSync(path.resolve(currentDirectory, file.name), content);
    }
  }
}

function removeDeadLinks(currentPath, directory) {
  const currentDirectory = path.resolve(currentPath, directory);
  const files = fs.readdirSync(currentDirectory, { withFileTypes: true });

  for (let file of files) {
    if (file.isDirectory()) {
      removeDeadLinks(currentDirectory, file.name);
      continue;
    }

    let content = fs.readFileSync(path.resolve(currentDirectory, file.name)).toString();

    if (content.match(/\[[\w\d]+\]\([^\()]+\)/)) {
      const results = content.match(/\[[\w\d]+\]\([^\()]+\)/g).map((x) => x);
      for (const result of results) {
        const name = result.split('](')[0].replace('[', '').split('#')[0];
        const link = result.split('](')[1].replace(')', '');
        if (!contractsDatas[name] && !link.startsWith('http')) {
          content = content.replaceAll(result, name);
        }
      }
      fs.writeFileSync(path.resolve(currentDirectory, file.name), content);
    }
  }
}

cleanDirectoryRecursively(__dirname, 'Contracts');

loadContracts(__dirname, 'Contracts');

updateLinks(__dirname, 'Contracts');

removeDeadLinks(__dirname, 'Contracts');
