const AWS = require('aws-sdk');

const deploymentService = require('./../services/DeploymentService');
const buildDeploymentBuilder = require('./../utils/BuildDeploymentBuilder');
const CommitCommentUtil = require('./../utils/CommitCommentUtil');

AWS.config.update({'region': ''}); // TODO add default region
AWS.config.setPromisesDependency(require('bluebird'));
const sqs = new AWS.SQS();


const SQS = function (queueUrl, messagesNo) {
    this.receiveMessageParams = {
        QueueUrl: queueUrl,
        MaxNumberOfMessages: messagesNo
    };
};

SQS.prototype.pollMessages = function () {
    sqs.receiveMessage(this.receiveMessageParams).promise()
        .then(this.processMessages.bind(this))
    // .catch(processMessagesError)
    ;
};

SQS.prototype.processMessages = function (data) {
    if (data && data.Messages && data.Messages.length > 0) {
        for (let i = 0; i < data.Messages.length; i++) {

            let message = JSON.parse(JSON.parse(data.Messages[i].Body).Message);

            let deleteMessageParams = {
                QueueUrl: this.receiveMessageParams.QueueUrl,
                ReceiptHandle: data.Messages[i].ReceiptHandle
            };

            if (message['detail-type'] === 'CodeCommit Repository State Change') {
                console.log('Pipeline.build:', JSON.stringify(message));
                deploymentService.createDeployments(buildDeploymentBuilder.buildDeploymentsFromSqs(message))
                    .then(() => {
                        sqs.deleteMessage(deleteMessageParams).promise()
                            .then(() => {
                                // console.log('Successfully deleted message.');
                            })
                            .catch(() => {
                                // console.error('Error in deleting message.');
                            })
                        ;
                    })
                ;
            } else if (message['detail-type'] === 'CodeCommit Comment on Commit') {
                console.log('Pipeline.build:', JSON.stringify(message));
                CommitCommentUtil.updateReviewStatusFromSqs(message)
                    .then(() => {
                        sqs.deleteMessage(deleteMessageParams).promise()
                            .then(() => {
                                // console.log('Successfully deleted message.');
                            })
                            .catch(() => {
                                // console.error('Error in deleting message.');
                            })
                        ;
                    })
                    .catch(() => {
                        sqs.deleteMessage(deleteMessageParams).promise()
                            .then(() => {
                                // console.log('Successfully deleted message.');
                            })
                            .catch(() => {
                                // console.error('Error in deleting message.');
                            })
                        ;
                    })
                ;
            } else {
                console.log('Unhandled:', JSON.stringify(message));
                sqs.deleteMessage(deleteMessageParams).promise()
                    .then(() => {
                        // console.log('Successfully deleted message.');
                    })
                    .catch(() => {
                        // console.error('Error in deleting message.');
                    });
            }

        }
    }
};

SQS.prototype.init = function () {
    setInterval(this.pollMessages.bind(this), 5000);
};

module.exports = SQS;
