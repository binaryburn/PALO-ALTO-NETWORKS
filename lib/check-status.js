"use strict";

//modules
const aws = require('./../utility/aws');
const utility = require('./../utility/misc');

//third-party
const async = require('async');

//environment variables
const snsErrorTopic = process.env.snsErrorTopic;
const snsFailoverTopic = process.env.snsFailoverTopic;
const failoverFunction = process.env.failoverFunction;
let clientName = process.env.clientName;


const notifyFailover = function(){
    if(!clientName) {
        clientName = 'Undefined';
    }
    utility.sendNotfications(clientName + ' Palo Failover',
        'A Palo Alto failover has been initiated for ' + clientName,
        zenRequester,
        snsFailoverTopic);
};

const notifyProcessError = function(detail){
    if(!clientName) {
        clientName = 'Undefined';
    }
    utility.sendNotfications(clientName + ' Palo Status Check Process Failure - ' + detail,
        'The palo status check process for ' + clientName + ' has failed. Check log group /aws/lambda/palo-status-check for details',
        zenRequester,
        snsErrorTopic);
};

const checkEnvironmentVariables = function(callback){
    async.series([
            function(callback){
                if(!snsTopic){
                    callback(null, 'snsTopic');
                } else {
                    callback();
                }
            },
            function(callback){
                if(!clientName){
                    callback(null, 'clientName');
                }else {
                    callback();
                }
            },
            function(callback){
                if(!zenRequester){
                    callback(null, 'zenRequester');
                }else {
                    callback();
                }
            },
            function(callback){
                if(!failoverFunction){
                    callback(null, 'failoverFunction');
                }else {
                    callback();
                }
            }],
        function(err, results){
            let result = '';
            for (let i = 0, len = results.length; i < len; i++) {
                if(results[i]) result = result + ' ' + results[i];
            }

            if(result.length > 0) callback('Error.', 'Missing Environment Variables: ' + result);
            else callback(null, 'Success');
        }
    );
};

exports.handler = function(event, context, callback) {

    checkEnvironmentVariables(function(err, response){
        if(err){
            console.log(err, response);
            notifyProcessError(response);
        }
        else{
            aws.getInstanceByTag('PaloState', 'active', function(err, instanceId){
                if(err) {
                    //notifyProcessError('Get Instance By Tag');
                    console.log(err, instanceId);
                }
                else{
                    let instanceIds = [ instanceId ];
                    aws.getInstanceStatus(instanceIds, function(err, status){
                        if(err) {
                            notifyProcessError('Get Instance Status');
                            console.log(err, err.stack);
                        }else{
                            if(status.InstanceStatuses.length > 0){
                                if(status.InstanceStatuses[0].InstanceStatus.Details[0].Status != 'passed'){
                                    console.log(status.InstanceStatuses[0].InstanceStatus.Details[0]);
                                    console.log('Response other than "passed" -> do second check');
                                    //check again
                                    setTimeout(function() {
                                        aws.getInstanceStatus(instanceIds, function(err, status) {
                                            if (status.InstanceStatuses.length > 0) {
                                                console.log(status.InstanceStatuses[0].InstanceStatus.Details[0]);
                                                if (status.InstanceStatuses[0].InstanceStatus.Details[0].Status != 'passed') {
                                                    console.log('Second Check Failover!');
                                                    notifyFailover();
                                                    aws.invokeLambda(failoverFunction, '{}', function(err, lambdaResponse){
                                                        if(err){
                                                            console.log(err, lambdaResponse);
                                                            notifyProcessError('Failed to invoke failover lambda function');
                                                        }
                                                    });
                                                } else {
                                                    console.log("Second Check All Good!");
                                                }
                                            } else{
                                                console.log('Second check no response -> do Failover!');
                                                notifyFailover();
                                                aws.invokeLambda(failoverFunction, '{}', function(err, lambdaResponse){
                                                    if(err){
                                                        console.log(err, lambdaResponse);
                                                        notifyProcessError('Failed to invoke failover lambda function');
                                                    }
                                                });
                                            }
                                        });
                                    }, 90000);
                                }else{
                                    console.log("All Good!");
                                }
                            } else{
                                console.log("No response -> do second check");
                                setTimeout(function() {
                                    aws.getInstanceStatus(instanceIds, function(err, status) {
                                        if (status.InstanceStatuses.length > 0) {
                                            console.log(status.InstanceStatuses[0].InstanceStatus.Details[0]);
                                            if (status.InstanceStatuses[0].InstanceStatus.Details[0].Status != 'passed') {
                                                console.log('Second Check Failover!');
                                                notifyFailover();
                                                aws.invokeLambda(failoverFunction, '{}', function(err, lambdaResponse){
                                                    if(err){
                                                        console.log(err, lambdaResponse);
                                                        notifyProcessError('Failed to invoke failover lambda function');
                                                    }
                                                });
                                            } else {
                                                console.log("Second Check All Good!");
                                            }
                                        } else{
                                            console.log('Second check no response -> do Failover!');
                                            notifyFailover();
                                            aws.invokeLambda(failoverFunction, '{}', function(err, lambdaResponse){
                                                if(err){
                                                    console.log(err, lambdaResponse);
                                                    notifyProcessError('Failed to invoke failover lambda function');
                                                }
                                            });
                                        }
                                    });
                                }, 45000);
                            }
                        }
                    });
                }
            })
        }
    });
};