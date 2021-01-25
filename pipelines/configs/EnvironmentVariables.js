module.exports = {};

// folder names which are basically realm names
const folders = [];

folders.forEach(folder => {
  module.exports[folder] = require(`./${folder}/common-env-variables/EnvVariables`);
});
