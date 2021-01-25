const express = require('express');
const router = express.Router();
const deploymentService = require('./services/DeploymentService');
const buildDeploymentBuilder = require('./utils/BuildDeploymentBuilder');
const JarvisCliHelper = require('./utils/JarvisCliHelper');
const CommitCommentUtil = require('./utils/CommitCommentUtil');

// github webhook are received here, if config of pipelines contains these repos, it will create and deploy respectively
router.post('/', function (req, res) {
    console.log(JSON.stringify(req.body));
    const deploymentObjects = buildDeploymentBuilder.buildDeploymentsFromGithub(req.body);
    console.log(`Inserting in db ${deploymentObjects.length} deployments found from GITHUB webhook`);
    deploymentService.createDeployments(deploymentObjects)
        .then(successObjects => {
            if (successObjects && successObjects.length) {
                console.log(`Successfully created ${successObjects.length} deployment objects from github webhook`);
                res.send(`Successfully created ${successObjects.length} deployment objects from github webhook`);
            } else {
                console.log('No deployment occurred due to this push');
                res.status(400).send('No deployment occurred due to this push');
            }
        })
        .catch(err => {
            console.log(`${err} Error occurred in creating new deployment objects`);
        });
});

// github webhook for commit comment event
router.post('/commitcomment', function (req, res) {
    console.log(JSON.stringify(req.body));
    console.log(`Updating review status of ${req.body.comment.commit_id} commit found from GITHUB webhook`);
    CommitCommentUtil.updateReviewStatusFromGithub(req.body)
        .then(rowsUpdated => {
            if (rowsUpdated) {
                console.log(`Successfully changed review status of ${rowsUpdated} deployment objects from github webhook`);
                res.send(`Successfully changed review status of ${rowsUpdated} deployment objects from github webhook`);
            } else {
                console.log('No update occurred due to this commit comment event');
                res.status(400).send('No update occurred due to this commit comment event');
            }
        })
        .catch(err => {
            console.log(`${err} Error occurred in updating deployment objects`);
            console.log(err.stack);
        });
});


router.patch('/promote', function (req, res) {
    console.log(JSON.stringify(req.body));

    let pipeline = req.body.pipeline;
    let fromPipe = req.body.fromPipe;
    JarvisCliHelper.promoteDeployment(pipeline, fromPipe)
        .then(success => {
            console.log(`Successfully promoted ${success.successObjects.length} deployment object for ${req.body.pipeline} from ${req.body.pipe} to ${success.successObjects[0].pipe}`);
            if (success.warning) console.log(`Warning: ${success.warning}`);
            res.send(success);
        })
        .catch(err => {
            console.log(`${err} Error occurred in promoting ${pipeline} ${fromPipe}`);
            res.status(500).send({err: err});
        });
});

module.exports = router;
