const _ = require('lodash');
const db = require('./../../models');
const slowBuildConfig = require('./../configs/slowBuild');

module.exports = {
    createDeployments(deploymentRecords) {

        // let pipelines = _.

        // let deploymentObject = {
        //   pipeline: deploymentRecord.eventSourceARN.split(':').slice(-1)[0].trim(),
        //   action: 'build',
        //   trigger: deploymentRecord.eventTriggerName,
        //   owner: deploymentRecord.userIdentityARN.split(':').slice(-1)[0].trim(),
        //   commit_id: deploymentRecord.codecommit.references.slice(-1)[0].commit,
        //   state: 'WAITING',
        //   added_at: new Date()
        // };
        const newDeploymentRecords = _.map(deploymentRecords, function (deploymentRecord) {
            return _.extend({}, deploymentRecord, {added_at: new Date()});
        });

        if (newDeploymentRecords.length) {
            return db.Deployment.bulkCreate(newDeploymentRecords, {
                validate: true
            });
        } else {
            return Promise.resolve(null);
        }
    },

    async updateDeploymentReviewStatus(commitId, reviewer) {
        return db.Deployment.update({reviewer: reviewer}, {
            where: {
                commit_id: commitId    // there is a very thin chance that commit_id may match for two separate pipelines
            }
        });
    },

    async getLatestPipelinePipeDeployment(pipeline, pipe, latestFlag = false) {
        let conditions = {
            action: 'deploy',
            pipeline: pipeline,
            pipe: pipe,
            state: 'DONE'
        }
        // if ( coreServiceConfig.indexOf(pipeline) !== -1 && !latestFlag ) {
        if (!latestFlag) {
            conditions.reviewer = {
                $not: null
            };
        }
        let latestDeployment = await db.Deployment.findAll({
            where: conditions,
            order: [
                ['added_at', 'DESC']
            ],
            limit: 1,
            raw: true
        });

        if (latestDeployment.length) {
            return latestDeployment[0];
        } else {
            return null;
        }

    },
    async getNextDeployment() {
        /*
        find the record which is in intermediate state ie not waiting or completed or cancelled or error state
        if found, return that
        else, find the latest record with waiting state in build action and mark all others in same pipeline as cancelled
        what if many in build state in different pipeline( i think should give priority to oldest build in waiting state)
        if not found, find the record with waiting state in deploy, then scale, then delete
        */

        const actionsPriority = ['create', 'deploy', 'build', 'scale', 'delete'];
        let currentPriorityIndex = 0;

        const intermediateStateDeployment = await db.Deployment.findAll({
            where: {
                state: {
                    $notIn: ['DONE', 'WAITING', 'CANCELLED'],
                    $notRegexp: '_ERROR$'
                },
                pipeline: {
                    $notIn: slowBuildConfig
                }
            },
            raw: true
        });

        //it is assumed at max 1 deployment will be in intermediate state at any time
        if (intermediateStateDeployment.length) {
            debugger
            return intermediateStateDeployment[0];
        }

        //find oldest pipeline and pipe, take all records which match these, mark all as cancelled except the latest one
        for (let i = 0; i < actionsPriority.length; i++) {
            const waitingDeployments = await db.Deployment.findAll({
                where: {
                    action: actionsPriority[currentPriorityIndex],
                    state: 'WAITING',
                    pipeline: {
                        $notIn: slowBuildConfig
                    }
                },
                order: ['added_at'],
                raw: true
            });
            if (waitingDeployments.length) {
                const oldestDeployment = waitingDeployments[0];
                const oldestPipeline = oldestDeployment.pipeline;
                const oldestPipe = oldestDeployment.pipe;
                //in case of build pipe will also be null, so always same pipeline deployments will be fetched
                const oldestPipelineDeployments = waitingDeployments.filter(deployment => deployment.pipeline === oldestPipeline && deployment.pipe === oldestPipe);
                const cancellationIds = oldestPipelineDeployments.slice(0, oldestPipelineDeployments.length - 1).map(deployment => deployment.id);
                debugger
                if (cancellationIds.length) {
                    module.exports.markForCancellation(cancellationIds);
                    return null;
                }
                return oldestPipelineDeployments.slice(-1)[0];
            }
            currentPriorityIndex++;

        }

        return null;
    },

    async getNextDeploymentSlow() {
        /*
        find the record which is in intermediate state ie not waiting or completed or cancelled or error state
        if found, return that
        else, find the latest record with waiting state in build action and mark all others in same pipeline as cancelled
        what if many in build state in different pipeline( i think should give priority to oldest build in waiting state)
        if not found, find the record with waiting state in deploy, then scale, then delete
        */

        const actionsPriority = ['create', 'deploy', 'build', 'scale', 'delete'];
        let currentPriorityIndex = 0;

        const intermediateStateDeployment = await db.Deployment.findAll({
            where: {
                state: {
                    $notIn: ['DONE', 'WAITING', 'CANCELLED'],
                    $notRegexp: '_ERROR$'
                },
                pipeline: {
                    $in: slowBuildConfig
                }
            },
            raw: true
        });

        //it is assumed at max 1 deployment will be in intermediate state at any time
        if (intermediateStateDeployment.length) {
            debugger
            return intermediateStateDeployment[0];
        }

        //find oldest pipeline and pipe, take all records which match these, mark all as cancelled except the latest one
        for (let i = 0; i < actionsPriority.length; i++) {
            const waitingDeployments = await db.Deployment.findAll({
                where: {
                    action: actionsPriority[currentPriorityIndex],
                    state: 'WAITING',
                    pipeline: {
                        $in: slowBuildConfig
                    }
                },
                order: ['added_at'],
                raw: true
            });
            if (waitingDeployments.length) {
                const oldestDeployment = waitingDeployments[0];
                const oldestPipeline = oldestDeployment.pipeline;
                const oldestPipe = oldestDeployment.pipe;
                //in case of build pipe will also be null, so always same pipeline deployments will be fetched
                const oldestPipelineDeployments = waitingDeployments.filter(deployment => deployment.pipeline === oldestPipeline && deployment.pipe === oldestPipe);
                const cancellationIds = oldestPipelineDeployments.slice(0, oldestPipelineDeployments.length - 1).map(deployment => deployment.id);
                debugger
                if (cancellationIds.length) {
                    module.exports.markForCancellation(cancellationIds);
                    return null;
                }
                return oldestPipelineDeployments.slice(-1)[0];
            }
            currentPriorityIndex++;

        }

        return null;
    },

    markForCancellation(ids) {
        /*check for date timezone*/
        return db.Deployment.update({state: 'CANCELLED', completed_at: Date.now()}, {
            where: {
                id: {
                    $in: ids
                }
            }
        });
    },

    setDeploymentActionState(id, state) {
        return db.Deployment.update({state: state}, {
            where: {
                id: id
            }
        });
    },

    update(id, updatedProperties) {
        return db.Deployment.update(updatedProperties, {
            where: {
                id: id
            }
        });
    },

    setDeploymentCurrentTimestamp(id, field) {
        return db.Deployment.update({[field]: Date.now()}, {
            where: {
                id: id
            }
        });
    }


}
