const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const app = express();
const port = 80;
const _ = require('lodash');
const exec = require('child_process').exec;


const models = require('./models');

const pipelineConfig = require('./configs/pipelines/pipelines');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.get('/health', function (req, res) {
    res.json({code: 200, message: "Healthy", service: "jarvis"});
});

models.sequelize.authenticate()
    .then(() => {
        const name = "Jarvis";
        const configOfPipeline = _.find(pipelineConfig, {name: name});
        const source = configOfPipeline.source;
        const repoCredentials = configOfPipeline.credentials;
        const gitRepo = `https://${repoCredentials.username}:${repoCredentials.password}@git-codecommit.ap-south-1.amazonaws.com/v1/repos/${source.split(':').slice(-2, -1)[0]}`;
        const gitBranch = `${source.split(':').slice(-1)[0]}`;
        return new Promise((resolve, reject) => {
            const cmdProcess = exec(`bash pipelines/scripts/cloneJarvis.sh ${name} ${gitRepo} ${gitBranch}`, (error) => {
                if (error) {
                    reject({});
                } else {
                    resolve({});
                }
            });
            cmdProcess.stdout.pipe(process.stdout);
            cmdProcess.stderr.pipe(process.stdout);
        });
    })
    .then(() => {
        router.use('/pipeline', require('./pipelines/router.js'));
        app.use('/', router);
        app.listen(port);
        console.log('Service started on port ' + port);
        return Promise.resolve();
    })
    .then(() => {
        const pipelinesCron = require('./pipelines/cron');

        pipelinesCron.initPollCodecommitSqs(5); // 5 seconds
        pipelinesCron.initExecuteNextDeploymentAction(5);

        return Promise.resolve();
    })
;
