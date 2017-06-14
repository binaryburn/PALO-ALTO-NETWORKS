"use strict";

//modules
const aws = require('./../utility/aws');
const failover = require('./../utility/failover');

//third-party
const async = require('async');

exports.handler = function (event, context, callback) {
    const paloBucket = 'odh-palo';
    const snsTopic = 'arn:aws:sns:us-east-1:465848643504:palo-alert';
    const alertEmail = 'rob@cloudticity.com';
    const palo1Id = 'i-3098db3e';
    const clientName = 'ODH';


    let fileName = 'palo2-manifest.json';
    async.waterfall([
        function updateTags(callback) {
            failover.updateTags(function (err, instanceIds) {
                if (err) {
                    console.log(err, err.stack);
                    callback('Palo failover failure - Update Tags', 'Palo failover update status tags has failed. Check the cloudwatch logs for error details');
                } else {
                    callback(null, instanceIds);
                }
            });
        },
        function getFileName(instanceIds, callback) {
            if (instanceIds.active !== palo1Id) {
                fileName = 'palo1-manifest.json';
            }
            callback(null, fileName);
        },
        function getManifest(fileName, callback) {
            aws.getObjectS3(paloBucket, fileName, function (err, response) {
                if (err) {
                    console.log(err, err.stack);
                    callback('Palo failover failure - Get Manifest', 'Palo failover failed to retrieve the current manifest. Check the cloudwatch logs for error details');
                } else {
                    callback(null, response);
                }
            });
        },
        function transferEIPs(manifest, callback) {
            failover.transferEIPs(manifest, function (err, response) {
                if (err) {
                    console.log(err, err.stack);
                    callback('Palo failover failure - Transfer EIPs', 'The Palo failover EIP transfer has failed. Check the cloudwatch logs for error details');
                } else {
                    callback(null, manifest);
                }
            });
        },
        function transferRouteTables(manifest, callback) {
            failover.transferRouteTables(manifest, function (err, response) {
                if (err) {
                    console.log(err, err.stack);
                    callback('Palo failover failure - Transfer Route Tables', 'The Palo failover Route Table transfer has failed. Check the cloudwatch logs for error details');
                } else {
                    callback(null, response);
                }
            });
        }
    ], function (err, results) {
        if (err) {
            console.log(err, results);
            failover.notifyProcessError(alertEmail, snsTopic, clientName, results, function (err, result) {
                console.log(err, result);
            });
        } else {
            console.log('Palo Failover Complete');
            failover.notifyFailover(alertEmail, snsTopic, clientName, 'A Palo Alto failover has been executed for ' + clientName, function (err, result) {
                console.log(err, result);
            });
        }
    });
};