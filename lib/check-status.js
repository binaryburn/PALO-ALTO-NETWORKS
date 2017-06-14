"use strict";

//modules
const aws = require('./../utility/aws');
const utility = require('./../utility/misc');

//environment variables
const snsErrorTopic = process.env.snsErrorTopic;
const snsFailoverTopic = process.env.snsFailoverTopic;
const failoverFunction = process.env.failoverFunction;
const clientName = process.env.clientName;


exports.handler = function(event, context, callback) {
    aws.getInstanceByTag('PaloState', 'active', function (err, instanceId) {
        if (err) {
            //notifyProcessError('Get Instance By Tag');
            console.log(err, instanceId);
        } else {
            let instanceIds = [instanceId];
            aws.getInstanceStatus(instanceIds, function (err, status) {
                if (err) {
                    utility.sendNotfications(clientName + ' Palo Status Check Process Failure', 'Get Instance Status has failed', snsErrorTopic);
                    console.log(err, err.stack);
                } else {
                    if (status.InstanceStatuses.length > 0) {
                        if (status.InstanceStatuses[0].InstanceStatus.Details[0].Status !== 'passed') {
                            console.log(status.InstanceStatuses[0].InstanceStatus.Details[0]);
                            console.log('Response other than "passed" -> do second check');
                            //check again
                            setTimeout(function () {
                                aws.getInstanceStatus(instanceIds, function (err, status) {
                                    if (err) {
                                        console.log(err, err.message);
                                        utility.sendNotfications(clientName + ' Palo Status Check Process Failure', 'The palo status check process for ' + clientName + ' has failed. Check log group /aws/lambda/palo-status-check for details', snsErrorTopic);
                                    } else {
                                        if (status.InstanceStatuses.length > 0) {
                                            console.log(status.InstanceStatuses[0].InstanceStatus.Details[0]);
                                            if (status.InstanceStatuses[0].InstanceStatus.Details[0].Status !== 'passed') {
                                                console.log('Second Check Failover!');
                                                utility.sendNotfications(clientName + ' Palo Failover', 'A Palo Alto failover has been initiated for ' + clientName, snsFailoverTopic);
                                                aws.invokeLambda(failoverFunction, '{}', function (err, lambdaResponse) {
                                                    if (err) {
                                                        console.log(err, lambdaResponse);
                                                        utility.sendNotfications(clientName + ' Palo Status Check Process Failure', 'The palo status check process for ' + clientName + ' has failed. Check log group /aws/lambda/palo-status-check for details', snsErrorTopic);
                                                    }
                                                });
                                            } else {
                                                console.log("Second Check All Good!");
                                            }
                                        } else {
                                            console.log('Second check no response -> do Failover!');
                                            utility.sendNotfications(clientName + ' Palo Failover', 'A Palo Alto failover has been initiated for ' + clientName, snsFailoverTopic);
                                            aws.invokeLambda(failoverFunction, '{}', function (err, lambdaResponse) {
                                                if (err) {
                                                    console.log(err, lambdaResponse);
                                                    utility.sendNotfications(clientName + ' Palo Status Check Process Failure', 'The palo status check process for ' + clientName + ' has failed. Check log group /aws/lambda/palo-status-check for details', snsErrorTopic);
                                                }
                                            });
                                        }
                                    }
                                });
                            }, 90000);
                        } else {
                            console.log("All Good!");
                        }
                    } else {
                        console.log("No response -> do second check");
                        setTimeout(function () {
                            aws.getInstanceStatus(instanceIds, function (err, status) {
                                if (err) {
                                    console.log(err, err.message);
                                    utility.sendNotfications(clientName + ' Palo Status Check Process Failure', 'The palo status check process for ' + clientName + ' has failed. Check log group /aws/lambda/palo-status-check for details', snsErrorTopic);
                                } else {
                                    if (status.InstanceStatuses.length > 0) {
                                        console.log(status.InstanceStatuses[0].InstanceStatus.Details[0]);
                                        if (status.InstanceStatuses[0].InstanceStatus.Details[0].Status !== 'passed') {
                                            console.log('Second Check Failover!');
                                            utility.sendNotfications(clientName + ' Palo Failover', 'A Palo Alto failover has been initiated for ' + clientName, snsFailoverTopic);
                                            aws.invokeLambda(failoverFunction, '{}', function (err, lambdaResponse) {
                                                if (err) {
                                                    console.log(err, lambdaResponse);
                                                    utility.sendNotfications(clientName + ' Palo Status Check Process Failure', 'The palo status check process for ' + clientName + ' has failed. Check log group /aws/lambda/palo-status-check for details', snsErrorTopic);
                                                }
                                            });
                                        } else {
                                            console.log("Second Check All Good!");
                                        }
                                    } else {
                                        console.log('Second check no response -> do Failover!');
                                        utility.sendNotfications(clientName + ' Palo Failover', 'A Palo Alto failover has been initiated for ' + clientName, snsFailoverTopic);
                                        aws.invokeLambda(failoverFunction, '{}', function (err, lambdaResponse) {
                                            if (err) {
                                                console.log(err, lambdaResponse);
                                                utility.sendNotfications(clientName + ' Palo Status Check Process Failure', 'The palo status check process for ' + clientName + ' has failed. Check log group /aws/lambda/palo-status-check for details', snsErrorTopic);
                                            }
                                        });
                                    }
                                }
                            });
                        }, 45000);
                    }
                }
            });
        }
    });
};