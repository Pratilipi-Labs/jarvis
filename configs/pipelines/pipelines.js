module.exports = [];
// folder names which are basically realm names
const folders = [];

folders.forEach(folder => {
    const normalizedPath = require("path").join(__dirname, folder);
    require("fs").readdirSync(normalizedPath).forEach(function (file) {
        module.exports.push(require(`./${folder}/` + file));
    });
});
