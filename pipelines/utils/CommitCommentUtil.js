const defaultGitCredentials = {
    "auth": {
        "username": `${process.env.GIT_USERNAME}`,
        "password": `${process.env.GIT_PASSWORD}`
    }
};
const octokit = require('@octokit/rest')(defaultGitCredentials);
const DeploymentService = require('./../services/DeploymentService');
const ConfigAccessor = require('./../../configs/ConfigAccessor');
const ownerUsernameMap = require('./../configs/ownerUsername');
const defaultOwners = require('./../configs/defaultOwners');
const _ = require('lodash');

const default_branch = "master";

const AWS = require('aws-sdk');
AWS.config.update({'region': ''}); // TODO: default region
const codecommit = new AWS.CodeCommit();

module.exports = {
    async updateReviewStatusFromGithub(commentData) {
        if (commentData.comment.body.indexOf(':+1:') !== -1 || commentData.comment.body.indexOf('👍') !== -1) {
            let params = {
                owner: commentData.repository.owner.login,
                repo: commentData.repository.name,
                commit_sha: commentData.comment.commit_id
            }
            let commitData = await octokit.repos.getCommit(params);
            let pipeline = await _.find(ConfigAccessor.getPipelineConfig(), {source: `${commentData.repository.html_url}:${default_branch}`});
            let owners = pipeline.owners === undefined || pipeline.owners.length === 0 ? [] : pipeline.owners;
            owners.push(...defaultOwners)
            owners = _.flattenDeep(owners.map(function (owner) {
                return ownerUsernameMap[owner] || [];
            }));
            if (commitData && commitData.data && commitData.data.sha) {
                console.log(commitData.data.committer)
                console.log(commentData.comment.user)
                if (commitData.data.committer.login === commentData.comment.user.login) {
                    return Promise.reject(`User approved is same as user committed.`);
                } else if (owners.length === 0) {
                    try {
                        let rowsUpdated;
                        rowsUpdated = await DeploymentService.updateDeploymentReviewStatus(
                            commentData.comment.commit_id,
                            commentData.comment.user.login
                        );
                        return rowsUpdated;
                    } catch (err) {
                        return Promise.reject(err);
                    }
                }
                // owners of repo are to review
                else if (owners.indexOf(commentData.comment.user.login) > -1) {
                    try {
                        let rowsUpdated;
                        rowsUpdated = await DeploymentService.updateDeploymentReviewStatus(
                            commentData.comment.commit_id,
                            commentData.comment.user.login
                        );
                        return rowsUpdated;
                    } catch (err) {
                        return Promise.reject(err);
                    }
                } else {
                    return Promise.reject(`Not the owner of this repo.`);
                }
            } else {
                return Promise.reject(`Couldn't fetch commit data.`);
            }
        } else {
            return Promise.reject(`Comment doesnt have approval.`);
        }
    },

    async updateReviewStatusFromSqs(commentEventData) {
        let commitData = await codecommit.getCommit({
            commitId: commentEventData.detail.afterCommitId,
            repositoryName: commentEventData.detail.repositoryName
        }).promise();
        let commentData = await codecommit.getComment({commentId: commentEventData.detail.commentId}).promise();
        if (commitData && commitData.commit && commentData && commentData.comment) {
            if (commentData.comment.content.indexOf(':+1:') !== -1) {
                let pipeline = await _.find(ConfigAccessor.getPipelineConfig(), {source: `${commentEventData.resources[0]}:${default_branch}`});
                let owners = pipeline.owners === undefined || pipeline.owners.length === 0 ? [] : pipeline.owners;
                owners.push(...defaultOwners)
                owners = _.flattenDeep(owners.map(function (owner) {
                    return ownerUsernameMap[owner] || [];
                }));
                let commenter = commentData.comment.authorArn.split('/').pop();
                if (commenter === commitData.commit.committer.name) {
                    return Promise.reject(`User approved is same as user committed.`);
                } else if (owners.length === 0) {
                    try {
                        let rowsUpdated;
                        rowsUpdated = await DeploymentService.updateDeploymentReviewStatus(commitData.commit.commitId, commenter);
                        return rowsUpdated;
                    } catch (err) {
                        return Promise.reject(err);
                    }
                }
                // owners of repo are to review
                else if (owners.indexOf(commenter) > -1) {
                    try {
                        let rowsUpdated;
                        rowsUpdated = await DeploymentService.updateDeploymentReviewStatus(commitData.commit.commitId, commenter);
                        return rowsUpdated;
                    } catch (err) {
                        return Promise.reject(err);
                    }
                } else {
                    return Promise.reject(`Not the owner of this repo.`);
                }
            } else {
                return Promise.reject(`Comment doesnt have approval.`);
            }
        } else {
            return Promise.reject(`Couldn't fetch commit or comment data.`);
        }
    }
}
