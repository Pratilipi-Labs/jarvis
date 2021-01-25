const _ = require('lodash');

const ConfigAccessor = require('./../../configs/ConfigAccessor');

module.exports = {
    buildDeploymentsFromSqs(sqsDeploymentRecord) {
        let pipelineRepository = `${sqsDeploymentRecord.resources[0]}:${sqsDeploymentRecord.detail.referenceName}`;
        let pipelineNames = _.map(_.filter(ConfigAccessor.getPipelineConfig(), {'source': pipelineRepository}), 'name');


        return pipelineNames.map(pipelineName => {
            return {
                pipeline: pipelineName,
                action: 'build',
                trigger: 'CodeCommit',
                owner: sqsDeploymentRecord.detail.callerUserArn.split(':').slice(-1)[0].trim(),
                commit_id: sqsDeploymentRecord.detail.commitId,
                state: 'WAITING'
            }
        });
    },
    buildDeploymentsFromGithub(githubDeploymentRecord) {
        let pipelineRepository = `${githubDeploymentRecord.repository.url}:${githubDeploymentRecord.ref.split('/').slice(-1)[0].trim()}`;

        //whichever pipelines have the same repository, a build record will be created for each of them
        let pipelineNames = _.map(_.filter(ConfigAccessor.getPipelineConfig(), {'source': pipelineRepository}), 'name');

        return pipelineNames.map(pipelineName => {
            return {
                pipeline: pipelineName,
                action: 'build',
                trigger: 'GitHub',
                owner: githubDeploymentRecord.pusher.email,
                commit_id: githubDeploymentRecord.head_commit.id,
                state: 'WAITING'
            }
        });
    },
    buildDeploymentsFromPreviousDeployment(previousDeployment) {
        let pipeline = previousDeployment.pipeline;

        //the pipeline and steps should necessarily exist here
        let currentPipelineConfigSteps = _.filter(ConfigAccessor.getPipelineConfig(), {'name': pipeline})[0].pipes;
        let nextPipeConfig = null;

        if (previousDeployment.pipe) {
            let oldPipeIndex = _.findIndex(currentPipelineConfigSteps, {name: previousDeployment.pipe});
            if (oldPipeIndex > -1) {
                nextPipeConfig = currentPipelineConfigSteps[oldPipeIndex + 1];
            }
        } else {
            nextPipeConfig = currentPipelineConfigSteps[0];
        }

        const newDeploymentObjects = [];
        if (nextPipeConfig && nextPipeConfig.approval && nextPipeConfig.approval === 'automatic') {
            newDeploymentObjects.push({
                pipeline: previousDeployment.pipeline,
                pipe: nextPipeConfig.name,
                action: 'deploy',
                trigger: 'Automatic',
                owner: previousDeployment.owner,
                commit_id: previousDeployment.commit_id,
                reviewer: previousDeployment.reviewer,
                ecr_image: previousDeployment.ecr_image,
                state: 'WAITING'
            });
        }

        return newDeploymentObjects;
    }
};
