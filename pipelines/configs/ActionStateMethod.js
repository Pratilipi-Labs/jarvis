const config = {
    create: {
        WAITING: "dummy",
        ECR: "createEcr",
        LOG_GROUP: "createLogGroup",
        TARGET_GROUP: "createTargetGroup",
        IAM: "createIamRole",
        TASK_DEF: "createTaskDef",
        CREATE: "createApp",
        PRE_DONE: "dummy"
    },
    build: {
        WAITING: "dummy",
        GIT_PULL: "gitPull",
        BUILD: "dockerBuild",
        PUSH: "ecrPush",
        PRE_DONE: "preDone"
    },
    deploy: {
        WAITING: "dummy",
        TASK_DEF: "createTaskDef",
        UPDATE: "updateApp",
        PRE_DONE: 'preDone'
    }
};

module.exports = config;
