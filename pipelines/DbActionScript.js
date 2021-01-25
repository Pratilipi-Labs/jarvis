const exec = require('child_process').exec;
const _ = require('lodash');
const deploymentService = require('./services/DeploymentService');
const deploymentBuilder = require('./utils/BuildDeploymentBuilder');
const ConfigAccessor = require('./../configs/ConfigAccessor');

const AWS = require('aws-sdk');
AWS.config.update({'region': ''}); // TODO: default region
AWS.config.setPromisesDependency(require('bluebird'));
const sts = new AWS.STS({apiVersion: '2011-06-15'});

let ecsConfig = ConfigAccessor.getEcsConfig();
(function run() {
    ecsConfig = ConfigAccessor.getEcsConfig();
    Object.keys(ecsConfig).forEach(function (realm) {
        Object.keys(ecsConfig[realm]).forEach(function (cluster) {
            const config = ecsConfig[realm][cluster];
            if (config.assumeRole == null) {
                config.options = {
                    region: config.region
                };
                return;
            }
            const params = {
                DurationSeconds: 3600,
                RoleArn: config.assumeRole,
                RoleSessionName: realm + '-' + cluster
            };
            sts.assumeRole(params, function (err, data) {
                if (err)
                    console.log(err);
                else
                    config.options = {
                        region: config.region,
                        accessKeyId: data.Credentials.AccessKeyId,
                        secretAccessKey: data.Credentials.SecretAccessKey,
                        sessionToken: data.Credentials.SessionToken
                    };
            });
        });
    });
    return setTimeout(run, 60 * 60 * 1000);
})();


module.exports = {


    dummy() {
        return Promise.resolve();
    },


    gitPull(deploymentRecord) {
        const pipeline = deploymentRecord.pipeline;
        const configOfPipeline = _.find(ConfigAccessor.getPipelineConfig(), {name: pipeline});
        const source = configOfPipeline.source;
        const repoCredentials = configOfPipeline.credentials;
        const gitRepo = deploymentRecord.trigger.startsWith('GitHub')
            ? `${source.indexOf("https://") > -1 ? "https://" : "http://"}${repoCredentials.username}:${repoCredentials.password}@${source.substring((source.indexOf("https://") > -1 ? 8 : 7), source.lastIndexOf(':'))}.git`
            : `https://${repoCredentials.username}:${repoCredentials.password}@git-codecommit.${configOfPipeline.region}.amazonaws.com/v1/repos/${source.split(':').slice(-2, -1)[0]}`;
        const gitCommit = deploymentRecord.commit_id;
        const gitBranch = deploymentRecord.trigger.startsWith('GitHub')
            ? `${source.substring(source.lastIndexOf(':') + 1)}`
            : `${source.split(':').slice(-1)[0]}`;
        return new Promise((resolve, reject) => {
            const cmdProcess = exec(`bash pipelines/scripts/gitPull.sh ${pipeline} ${gitRepo} ${gitBranch} ${gitCommit}`, (error) => {
                if (error) {
                    reject({});
                } else {
                    resolve({});
                }
            });
            cmdProcess.stdout.pipe(process.stdout);
            cmdProcess.stderr.pipe(process.stdout);
        });
    },


    dockerBuild(deploymentRecord) {
        const pipeline = deploymentRecord.pipeline;
        const pipelineSpecificConfig = _.find(ConfigAccessor.getPipelineConfig(), {name: pipeline});
        const family = pipelineSpecificConfig.family;
        const ecrImage = family + ':' + (pipelineSpecificConfig.version ? pipelineSpecificConfig.version : new Date().getTime());

        return new Promise((resolve, reject) => {
            const cmdProcess = exec(`bash pipelines/scripts/dockerBuild.sh ${pipeline} ${ecrImage}`, {maxBuffer: 2 * 1024 * 1024}, (error) => {
                if (error) {
                    reject({});
                } else {
                    deploymentService.update(deploymentRecord.id, {ecr_image: ecrImage})
                        .then(resolve)
                        .catch(reject)
                    ;
                }
            });
            cmdProcess.stdout.pipe(process.stdout);
            cmdProcess.stderr.pipe(process.stdout);
        });
    },


    ecrPush(deploymentRecord) {
        const pipeline = deploymentRecord.pipeline;
        const ecrImage = deploymentRecord.ecr_image;
        return new Promise((resolve, reject) => {
            const cmdProcess = exec(`bash pipelines/scripts/ecrPush.sh ${pipeline} ${ecrImage}`, (error, stdout, stderr) => {
                if (error) {
                    reject(stderr);
                } else {
                    resolve(stdout);
                }
            });
            cmdProcess.stdout.pipe(process.stdout);
            cmdProcess.stderr.pipe(process.stdout);
        });
    },


    async createEcr(deploymentRecord) { // TODO: Attach LifeCycle - expire all but latest 10 images
        const pipeline = deploymentRecord.pipeline;
        const currPipelineConfig = _.find(ConfigAccessor.getPipelineConfig(), {name: pipeline});

        const ecr = new AWS.ECR();

        try {
            let params = {repositoryName: currPipelineConfig.family};
            let data = await ecr.createRepository(params).promise();
            console.log(data);
        } catch (err) {
            if (err.code !== 'RepositoryAlreadyExistsException') {
                console.log(err);
                return Promise.reject({});
            }
        }

        try {
            let params = {
                repositoryName: currPipelineConfig.family
            };
            let data = await ecr.setRepositoryPolicy(params).promise();
            console.log(data);
        } catch (err) {
            console.log(err);
            return Promise.reject({});
        }

        return {};
    },


    async createLogGroup(deploymentRecord) {
        const pipeline = deploymentRecord.pipeline;
        const pipelineSpecificConfig = _.find(ConfigAccessor.getPipelineConfig(), {name: pipeline});
        const pipeSpecificConfig = _.find(pipelineSpecificConfig.pipes, {name: deploymentRecord.pipe});

        const cloudWatchLogs = new AWS.CloudWatchLogs(ecsConfig[pipelineSpecificConfig.realm][pipeSpecificConfig.cluster].options);
        const logGroupName = pipeSpecificConfig.cluster + '-' + pipeSpecificConfig.appName;
        console.log("Trying to create log group ", logGroupName);
        try {
            let params = {logGroupName: logGroupName};
            let data = await cloudWatchLogs.createLogGroup(params).promise();
            console.log(data);
        } catch (err) {
            if (err.code !== 'ResourceAlreadyExistsException') {
                console.error(err);
                return Promise.reject({});
            }
        }

        try {
            let params = {logGroupName: logGroupName, retentionInDays: 7};
            let data = await cloudWatchLogs.putRetentionPolicy(params).promise();
            console.log(data);
        } catch (err) {
            console.error(err);
            return Promise.reject({});
        }

        return {};
    },


    async createTargetGroup(deploymentRecord) {
        const pipeline = deploymentRecord.pipeline;
        const pipelineSpecificConfig = _.find(ConfigAccessor.getPipelineConfig(), {name: pipeline});
        const pipeSpecificConfig = _.find(pipelineSpecificConfig.pipes, {name: deploymentRecord.pipe});

        if (!pipeSpecificConfig.apiEndpoint) {
            return;
        }

        const elb = new AWS.ELBv2(ecsConfig[pipelineSpecificConfig.realm][pipeSpecificConfig.cluster].options);

        try {

            let createTGParams = {
                Name: 'ecs-' + pipeSpecificConfig.cluster + '-' + pipeSpecificConfig.appName,
                Port: 80,
                Protocol: 'HTTP',
                VpcId: ecsConfig[pipelineSpecificConfig.realm][pipeSpecificConfig.cluster].vpc,
                HealthCheckIntervalSeconds: 11,
                HealthCheckPath: '/health',
                HealthCheckProtocol: 'HTTP',
                HealthCheckTimeoutSeconds: 10,
                HealthyThresholdCount: 2,
                Matcher: {
                    HttpCode: '200'
                },
                UnhealthyThresholdCount: 2
            };

            let createTGData = await elb.createTargetGroup(createTGParams).promise();
            console.log(createTGData);

            let modifyTGDataParams = {
                Attributes: [{
                    Key: "deregistration_delay.timeout_seconds",
                    Value: "60"
                }],
                TargetGroupArn: createTGData.TargetGroups[0].TargetGroupArn
            };

            let modifyTGData = await elb.modifyTargetGroupAttributes(modifyTGDataParams).promise();
            console.log(modifyTGData);

            let createRuleParams = {
                Actions: [{
                    TargetGroupArn: createTGData.TargetGroups[0].TargetGroupArn,
                    Type: "forward"
                }],
                Conditions: [{
                    Field: "path-pattern",
                    Values: [pipeSpecificConfig.apiEndpoint]
                }],
                ListenerArn: ecsConfig[pipelineSpecificConfig.realm][pipeSpecificConfig.cluster].elb,
                Priority: Math.ceil(1000 * Math.random())
            };

            let createRuleData = await elb.createRule(createRuleParams).promise();
            console.log(createRuleData);

        } catch (err) {
            console.error(err);
            return Promise.reject({});
        }

        return {};

    },


    createIamRole(deploymentRecord) {
        const pipeline = deploymentRecord.pipeline;
        const pipelineSpecificConfig = _.find(ConfigAccessor.getPipelineConfig(), {name: pipeline});
        const pipeSpecificConfig = _.find(pipelineSpecificConfig.pipes, {name: deploymentRecord.pipe});
        const currEcsConfig = ecsConfig[pipelineSpecificConfig.realm][pipeSpecificConfig.cluster];
        const params = {
            AssumeRolePolicyDocument: JSON.stringify({
                "Version": "2012-10-17",
                "Statement": [{
                    "Sid": "",
                    "Effect": "Allow",
                    "Principal": {"Service": "ecs-tasks.amazonaws.com"},
                    "Action": "sts:AssumeRole"
                }]
            }),
            Path: "/",
            RoleName: "ecs-task-role-" + pipelineSpecificConfig.family,
            Description: `Custom Role to allow ${pipelineSpecificConfig.family} family  ECS tasks to call AWS services on your behalf.`
        };
        if (pipelineSpecificConfig.realm === 'growth')
            params.RoleName = params.RoleName + '-' + currEcsConfig.stage;
        return new Promise((resolve, reject) => {
            const iam = new AWS.IAM(ecsConfig[pipelineSpecificConfig.realm][pipeSpecificConfig.cluster].options);
            iam.createRole(params, function (err, data) {
                if (!err || err.code === 'EntityAlreadyExists') {
                    console.log(data);
                    resolve({});
                } else {
                    console.log(err);
                    reject({});
                }
            });
        });
    },


    preDone(deploymentRecord) {
        const newDeployments = deploymentBuilder.buildDeploymentsFromPreviousDeployment(deploymentRecord);
        console.log(`Inserting in db ${newDeployments.length} deployments found from automatic deployment config`);

        return deploymentService.createDeployments(newDeployments);
    },


    createTaskDef(deploymentRecord) {
        //(others based on the pipe == name in config of pipe)
        const pipeline = deploymentRecord.pipeline;
        const pipelineSpecificConfig = _.find(ConfigAccessor.getPipelineConfig(), {name: pipeline});
        const pipeSpecificConfig = _.find(pipelineSpecificConfig.pipes, {name: deploymentRecord.pipe});
        const currEcsConfig = ecsConfig[pipelineSpecificConfig.realm][pipeSpecificConfig.cluster];

        const cluster = pipeSpecificConfig.cluster;

        const family = pipelineSpecificConfig.family;
        const image = `${pipeSpecificConfig.accountId}.dkr.ecr.${pipeSpecificConfig.region}.amazonaws.com/${deploymentRecord.ecr_image}`;
        const resource = pipeSpecificConfig.resource || {cpu: 64, memoryReservation: 128, memory: 256};

        const ecs = new AWS.ECS(currEcsConfig.options);

        // logger
        let logger = "awslogs";
        let loggerOptions = {
            'awslogs-group': `${cluster}-${pipeSpecificConfig.appName}`,
            'awslogs-region': currEcsConfig.region
        };

        if (pipeSpecificConfig.logger) {
            logger = pipeSpecificConfig.logger
            loggerOptions = {}
        }

        const params = {
            family: family,
            networkMode: 'bridge',
            taskRoleArn: `arn:aws:iam::${currEcsConfig.projId}:role/ecs-task-role-${family}`,
            containerDefinitions: [{
                name: family,
                environment: [
                    {name: 'REALM', value: pipelineSpecificConfig.realm},
                    {name: 'STAGE', value: pipeSpecificConfig.stage},
                    {name: 'APP_NAME', value: pipeSpecificConfig.appName}
                ],
                image: image,
                command: pipeSpecificConfig.command,
                cpu: resource.cpu,
                memoryReservation: resource.memoryReservation,
                memory: resource.memory,
                portMappings: [{
                    hostPort: 0,
                    containerPort: 80,
                    protocol: 'tcp'
                }],
                ulimits: [{
                    softLimit: 4096,
                    hardLimit: 4096,
                    name: "nofile"
                }],
                essential: true,
                logConfiguration: {
                    logDriver: logger,
                    options: loggerOptions
                }
            }]
        };

        const envConfigStage = pipeSpecificConfig.stage;
        const envVariables = ConfigAccessor.getEnvironmentVariablesConfig()[pipelineSpecificConfig.realm][currEcsConfig.region][envConfigStage];
        let pipelineEnvVariablesConfig = ConfigAccessor.getPipelineEnvVariablesConfig();

        const pipelineSpecificEnvVariables = (pipelineEnvVariablesConfig[pipeline] && pipelineEnvVariablesConfig[pipeline][currEcsConfig.region] && pipelineEnvVariablesConfig[pipeline][currEcsConfig.region][envConfigStage]) || {};

        Object.keys(envVariables).forEach(key => {
            params.containerDefinitions[0].environment.push({name: key, value: envVariables[key]});
        });

        Object.keys(pipelineSpecificEnvVariables).forEach(key => {
            params.containerDefinitions[0].environment.push({name: key, value: pipelineSpecificEnvVariables[key]});
        });

        return new Promise((resolve, reject) => {
            ecs.registerTaskDefinition(params, function (err, data) {
                if (err) {
                    console.log(err);
                    reject({});
                } else {
                    console.log(data);
                    deploymentService.update(deploymentRecord.id, {task_def: `${family}:${data.taskDefinition.revision}`})
                        .then(resolve)
                        .catch(reject)
                    ;
                }
            });
        });

    },


    async createApp(deploymentRecord) {

        const pipeline = deploymentRecord.pipeline;
        const pipelineSpecificConfig = _.find(ConfigAccessor.getPipelineConfig(), {name: pipeline});
        const pipeSpecificConfig = _.find(pipelineSpecificConfig.pipes, {name: deploymentRecord.pipe});

        const elb = new AWS.ELBv2(ecsConfig[pipelineSpecificConfig.realm][pipeSpecificConfig.cluster].options);
        const ecs = new AWS.ECS(ecsConfig[pipelineSpecificConfig.realm][pipeSpecificConfig.cluster].options);

        try {
            const createServiceParams = {
                cluster: pipeSpecificConfig.cluster,
                serviceName: pipeSpecificConfig.appName,
                taskDefinition: deploymentRecord.task_def,
                desiredCount: pipeSpecificConfig.cluster === 'worker' ? 0 : 1,
                deploymentConfiguration: {
                    minimumHealthyPercent: 100,
                    maximumPercent: 200
                },
                healthCheckGracePeriodSeconds: pipeSpecificConfig.apiEndpoint ? 120 : undefined,
                placementStrategy: [
                    {
                        type: "spread",
                        field: "instanceId"
                    },
                    {
                        type: "spread",
                        field: "attribute:ecs.instance-type"
                    }
                ]
            };

            if (pipeSpecificConfig.apiEndpoint) {
                let describeTargetGroupsParams = {
                    Names: ['ecs-' + pipeSpecificConfig.cluster + '-' + pipeSpecificConfig.appName]
                };
                let describeTargetGroupsData = await elb.describeTargetGroups(describeTargetGroupsParams).promise();
                console.log(describeTargetGroupsData);
                createServiceParams.loadBalancers = [{
                    containerName: pipelineSpecificConfig.family,
                    containerPort: 80,
                    targetGroupArn: describeTargetGroupsData.TargetGroups[0].TargetGroupArn
                }]
            }

            const data = await ecs.createService(createServiceParams).promise();
            console.log(data);

        } catch (err) {
            console.error(err);
            return Promise.reject({});
        }

        return {};

    },


    updateApp(deploymentRecord) {
        const pipeline = deploymentRecord.pipeline;
        const pipelineSpecificConfig = _.find(ConfigAccessor.getPipelineConfig(), {name: pipeline});
        const pipeSpecificConfig = _.find(pipelineSpecificConfig.pipes, {name: deploymentRecord.pipe});
        const ecs = new AWS.ECS(ecsConfig[pipelineSpecificConfig.realm][pipeSpecificConfig.cluster].options);
        const params = {
            cluster: pipeSpecificConfig.cluster,
            service: pipeSpecificConfig.appName,
            taskDefinition: deploymentRecord.task_def
        };
        return new Promise((resolve, reject) => {
            ecs.updateService(params, function (err, data) {
                if (err) {
                    console.log(err);
                    reject({});
                } else {
                    console.log(data);
                    resolve({});
                }
            });
        });
    }
}
