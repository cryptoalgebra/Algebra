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
        const content = (fs.readFileSync(path.resolve(currentDirectory, file.name))).toString();
        if (!content || !content.match(/[^\s\t\n]/)) {
            fs.unlinkSync(path.resolve(currentDirectory, file.name));
        }
    }
}

cleanDirectoryRecursively(__dirname, 'Contracts');