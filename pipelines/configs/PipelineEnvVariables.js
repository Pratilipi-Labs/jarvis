const _ = require('lodash');
// folder names which are basically realm names
const folders = [];
const modules = folders.map(folder => {
    return require(`./${folder}/pipeline-env-variables/EnvVariables`);
});

folders.forEach(() => {
    module.exports = _.assign({}, ...modules);
});
