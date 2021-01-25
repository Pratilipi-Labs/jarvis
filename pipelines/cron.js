const sqsUtil = require('./utils/sqsUtil');
const sqsConfig = require('./configs/sqs');
const deploymentService = require('./services/DeploymentService');
const actionStatesMap = require('./configs/ActionStates');
const actionStateMethodsMap = require('./configs/ActionStateMethod');
const DeploymentScripts = require('./DbActionScript.js');

module.exports = {
    initPollCodecommitSqs(seconds) {
        if (seconds) {
            const sqsUtilInstance = new sqsUtil(sqsConfig.QUEUE, sqsConfig.MAX_MESSAGES_POLLED);
            setInterval(sqsUtilInstance.pollMessages.bind(sqsUtilInstance), seconds * 1000);
        }
    },
    initExecuteNextDeploymentAction(seconds) {
        if (seconds) {
            module.exports.executeNextDeploymentAction(seconds);
            module.exports.executeNextDeploymentActionSlow(seconds);
        }
    },
    executeNextDeploymentAction: async function (seconds) {
        console.log(`Came in executeNextDeploymentAction ${seconds} seconds received`);
        const nextActionDeployment = await deploymentService.getNextDeployment();

        if (nextActionDeployment) {

            //this will always exist
            //TODO: check if this is okay for create without pre_done
            /*if state method for that action and state exists, find all states of that action
              if state is first state after waiting ie at index 1, set started_at for it
              execute current action state method for it, if that fails, set state to state_error and set timeout and exit
              if its third last state, set finished_at, and if second last, set completed_at
              after this set to next state of that action
            */
            if (actionStateMethodsMap[nextActionDeployment.action][nextActionDeployment.state]) {
                let currentActionStates = actionStatesMap[nextActionDeployment.action];


                if (currentActionStates.indexOf(nextActionDeployment.state) === 1) {
                    await deploymentService.setDeploymentCurrentTimestamp(nextActionDeployment.id, 'started_at');
                }
                try {
                    await DeploymentScripts[actionStateMethodsMap[nextActionDeployment.action][nextActionDeployment.state]](nextActionDeployment);
                } catch (error) {
                    console.log('[ERROR OCCURRED]', error);
                    await deploymentService.update(nextActionDeployment.id, {
                        state: (nextActionDeployment.state + '_ERROR'),
                        completed_at: Date.now()
                    });
                    setTimeout(() => {
                        console.log(`Scheduling next deployment after ${seconds} seconds`);
                        module.exports.executeNextDeploymentAction(seconds);
                    }, seconds * 1000);
                    return;
                }

                if (currentActionStates.indexOf(nextActionDeployment.state) === (currentActionStates.length - 3)) {
                    await deploymentService.setDeploymentCurrentTimestamp(nextActionDeployment.id, 'finished_at');
                }
                if (currentActionStates.indexOf(nextActionDeployment.state) === (currentActionStates.length - 2)) {
                    await deploymentService.setDeploymentCurrentTimestamp(nextActionDeployment.id, 'completed_at');
                }

                let nextState = currentActionStates[currentActionStates.indexOf(nextActionDeployment.state) + 1];
                await deploymentService.setDeploymentActionState(nextActionDeployment.id, nextState);

            }
        }
        console.log('**********************************************************************');
        setTimeout(() => {
            console.log(`Scheduling next deployment after ${seconds} seconds`);
            module.exports.executeNextDeploymentAction(seconds);
        }, seconds * 1000);
    },
    executeNextDeploymentActionSlow: async function (seconds) {
        console.log(`Came in executeNextDeploymentActionSlow ${seconds} seconds received`);
        const nextActionDeployment = await deploymentService.getNextDeploymentSlow();

        if (nextActionDeployment) {

            //this will always exist
            //TODO: check if this is okay for create without pre_done
            /*if state method for that action and state exists, find all states of that action
              if state is first state after waiting ie at index 1, set started_at for it
              execute current action state method for it, if that fails, set state to state_error and set timeout and exit
              if its third last state, set finished_at, and if second last, set completed_at
              after this set to next state of that action
            */
            if (actionStateMethodsMap[nextActionDeployment.action][nextActionDeployment.state]) {
                let currentActionStates = actionStatesMap[nextActionDeployment.action];


                if (currentActionStates.indexOf(nextActionDeployment.state) === 1) {
                    await deploymentService.setDeploymentCurrentTimestamp(nextActionDeployment.id, 'started_at');
                }
                try {
                    await DeploymentScripts[actionStateMethodsMap[nextActionDeployment.action][nextActionDeployment.state]](nextActionDeployment);
                } catch (error) {
                    console.log('[ERROR OCCURRED]', error);
                    await deploymentService.update(nextActionDeployment.id, {
                        state: (nextActionDeployment.state + '_ERROR'),
                        completed_at: Date.now()
                    });
                    setTimeout(() => {
                        console.log(`Scheduling next deployment after ${seconds} seconds`);
                        module.exports.executeNextDeploymentActionSlow(seconds);
                    }, seconds * 1000);
                    return;
                }

                if (currentActionStates.indexOf(nextActionDeployment.state) === (currentActionStates.length - 3)) {
                    await deploymentService.setDeploymentCurrentTimestamp(nextActionDeployment.id, 'finished_at');
                }
                if (currentActionStates.indexOf(nextActionDeployment.state) === (currentActionStates.length - 2)) {
                    await deploymentService.setDeploymentCurrentTimestamp(nextActionDeployment.id, 'completed_at');
                }

                let nextState = currentActionStates[currentActionStates.indexOf(nextActionDeployment.state) + 1];
                await deploymentService.setDeploymentActionState(nextActionDeployment.id, nextState);

            }
        }
        console.log('**********************************************************************');
        setTimeout(() => {
            console.log(`Scheduling next deployment after ${seconds} seconds`);
            module.exports.executeNextDeploymentActionSlow(seconds);
        }, seconds * 1000);
    }
};
