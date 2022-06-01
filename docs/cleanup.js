const { constants } = require('buffer');
const fs = require('fs');
const path = require('path');

const dirs = fs.readdirSync(path.resolve(__dirname, './Contracts'));

for (let dir of dirs) {
    const files = fs.readdirSync(path.resolve(__dirname, './Contracts', dir));
    for (let file of files) {
        let filename = path.resolve(__dirname, './Contracts', dir, file);
        const content = (fs.readFileSync(path.resolve(__dirname, './Contracts', dir, file))).toString();
        if (!content || !content.match(/[^\s\t\n]/)) {
            fs.unlinkSync(path.resolve(__dirname, './Contracts', dir, file));
        }
    }
}