const _ = require('lodash');

const ConfigAccessor = require('./../../configs/ConfigAccessor');
const DeploymentService = require('./../services/DeploymentService');

module.exports = {
    async promoteDeployment(pipeline, fromPipe) {
        // the pipeline and steps should necessarily exist here
        let currentPipelineConfigSteps = _.filter(ConfigAccessor.getPipelineConfig(), {'name': pipeline})[0].pipes;
        let nextPipeConfig = null;

        let oldPipeIndex = _.findIndex(currentPipelineConfigSteps, {name: fromPipe});
        if (oldPipeIndex > -1) {
            nextPipeConfig = currentPipelineConfigSteps[oldPipeIndex + 1];
        } else {
            return Promise.reject(`Pipe ${fromPipe} Doesnt Exist`);
        }


        if (!nextPipeConfig) {
            return Promise.reject(`Next Pipe to ${fromPipe} Doesnt Exist`);
        }

        let nextPipeName = nextPipeConfig.name;

        // get latest reviewed deployment object
        let noReviewFlag = pipeline.toLowerCase().startsWith('audio') || pipeline.toLowerCase().startsWith('comic');
        let fromDeploymentObject = await DeploymentService.getLatestPipelinePipeDeployment(pipeline, fromPipe);

        // get the latest deployment object irrespective of whether it has been reviewed or not
        let latestDeploymentObject = await DeploymentService.getLatestPipelinePipeDeployment(pipeline, fromPipe, true);
        let warning = null;

        if (noReviewFlag) fromDeploymentObject = latestDeploymentObject;
        if (latestDeploymentObject && fromDeploymentObject && fromDeploymentObject.commit_id !== latestDeploymentObject.commit_id) {
            let pipelineRepository = _.map(_.filter(ConfigAccessor.getPipelineConfig(), {'name': pipeline}), 'source')[0];
            let lastIndex = pipelineRepository.lastIndexOf(':');
            let compareUrl = pipelineRepository.slice(0, lastIndex) + '/compare/' + fromDeploymentObject.commit_id + '...' + latestDeploymentObject.commit_id;
            warning = `Could not promote to the latest deployment as review is needed. Compare changes at ${compareUrl}.`;
        }

        if (latestDeploymentObject && !fromDeploymentObject) {
            return Promise.reject(`Review is must now. Get the commit reviewed.`)
        }

        let newDeploymentObjects = [];
        if (fromDeploymentObject) {
            newDeploymentObjects.push({
                pipeline: pipeline,
                pipe: nextPipeName,
                action: 'deploy',
                trigger: 'CLI',
                owner: fromDeploymentObject.owner,
                commit_id: fromDeploymentObject.commit_id,
                ecr_image: fromDeploymentObject.ecr_image,
                state: 'WAITING',
                reviewer: fromDeploymentObject.reviewer
            });
        } else {
            return Promise.reject(`Deployment for Pipe ${fromPipe} Doesnt Exist in records`)
        }

        try {
            const successObjects = await DeploymentService.createDeployments(newDeploymentObjects);
            return {
                successObjects: successObjects,
                warning: warning
            };
        } catch (err) {
            return Promise.reject(err);
        }
    }
};
