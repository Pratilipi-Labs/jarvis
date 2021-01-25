const chokidar = require('chokidar');
const path = require('path');
let pipelineConfig = require('./../pipeline-Jarvis/configs/pipelines/pipelines');
let ecsConfig = require('./../pipeline-Jarvis/configs/ecs');
let environmentVariablesConfig = require('./../pipeline-Jarvis/pipelines/configs/EnvironmentVariables');
let pipelineEnvVariablesConfig = require('./../pipeline-Jarvis/pipelines/configs/PipelineEnvVariables');


console.log(`Watching ${path.join(__dirname + "/../pipeline-Jarvis/configs")} and ${path.join(__dirname + '/../pipeline-Jarvis/pipelines/configs')}`);
chokidar.watch(path.join(__dirname + "/../pipeline-Jarvis/configs")).on('all', (eventType, filename) => {

    if (filename.indexOf('pipelines/') === 0) {
        delete require.cache[path.join(__dirname + "/../pipeline-Jarvis/configs", "pipelines", "pipelines.js")];
    }

    delete require.cache[filename];

    pipelineConfig = require('./../pipeline-Jarvis/configs/pipelines/pipelines');
    ecsConfig = require('./../pipeline-Jarvis/configs/ecs');

});

chokidar.watch(path.join(__dirname + '/../pipeline-Jarvis/pipelines/configs')).on('all', (eventType, filename) => {
    debugger
    delete require.cache[path.join(__dirname + '/../pipeline-Jarvis/pipelines/configs/EnvironmentVariables.js')];
    delete require.cache[path.join(__dirname + '/../pipeline-Jarvis/pipelines/configs/PipelineEnvVariables.js')];
    delete require.cache[filename];
    debugger
    environmentVariablesConfig = require('./../pipeline-Jarvis/pipelines/configs/EnvironmentVariables');
    pipelineEnvVariablesConfig = require('./../pipeline-Jarvis/pipelines/configs/PipelineEnvVariables');

});


module.exports = {
    getEnvironmentVariablesConfig() {
        return environmentVariablesConfig;
    },
    getPipelineEnvVariablesConfig() {
        return pipelineEnvVariablesConfig;
    },
    getPipelineConfig() {
        return pipelineConfig;
    },
    getEcsConfig() {
        return ecsConfig
    }
}
