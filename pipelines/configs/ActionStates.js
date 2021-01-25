const config = {
    create: ['WAITING', 'ECR', 'LOG_GROUP', 'TARGET_GROUP', 'IAM', 'TASK_DEF', 'CREATE', 'PRE_DONE', 'DONE'],
    build: ['WAITING', 'GIT_PULL', 'BUILD', 'PUSH', 'PRE_DONE', 'DONE'],
    deploy: ['WAITING', 'TASK_DEF', 'UPDATE', 'PRE_DONE', 'DONE'],
    scale: ['WAITING', 'ALARMS', 'APP_SCALING', 'PRE_DONE', 'DONE'],
    delete: ['WAITING', 'DELETE', 'ELB', 'TARGET_GROUP', 'APP_SCALING', 'PRE_DONE', 'DONE']
};


module.exports = config;
