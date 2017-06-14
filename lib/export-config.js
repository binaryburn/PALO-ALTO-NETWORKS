"use strict";

//modules
const aws = require('./../utility/aws');
const utility = require('./../utility/misc');
const palo = require('./../utility/palo');
const config = require('../utility/config');

//third party
const async = require('async');

//environment variables
const encrypted = process.env.pw;
const activeIp = process.env.activeIp;
const passiveIp = process.env.passiveIp;
const snsErrorTopic = process.env.snsErrorTopic;
const paloBucket = process.env.paloBucket;
const palo1PrivateIp = process.env.palo1PrivateIp;
const clientName = process.env.clientName;


exports.handler = function(event, context, callback) {

    //Save active config
    async.waterfall([
        function decryptPassword(callback) {
            aws.decrypt(encrypted, function (err, password) {
                if (err) {
                    console.log(err, err.stack);
                    callback('Palo active config export failure - Decryption', 'Palo config export password decryption has failed. Check the cloudwatch logs for error details');
                } else {
                    callback(null, password);
                }
            });
        },
        function getPaloConfig(password, callback) {
            palo.getPaloConfig(activeIp, password, function (err, paloConfig) {
                if (err) {
                    console.log(err, err.stack);
                    callback('Palo active config export failure - Retrieve configuration', 'Palo config export failed to retrieve the current Palo configuration. Check the cloudwatch logs for error details');
                } else {
                    callback(null, paloConfig, password);
                }
            });
        },
        function saveConfigToS3(paloConfig, password, callback) {
            config.saveConfigToS3(paloConfig, paloBucket, palo1PrivateIp, function (err, saveActiveResponse) {
                if (err) {
                    console.log(err, err.stack);
                    callback('Palo active config export failure - Save active configuration', 'Palo config export failed to save the active configuration. Check the cloudwatch logs for error details');
                } else {
                    callback(null, paloConfig, password);
                }
            });
        }
    ], function (err, results) {
        if (err) {
            console.log(err, err.stack);
        } else {
            console.log('Active Configuration Saved.');
        }
    });

    //Convert, Load, and Save Passive config
    async.waterfall([
        function decryptPassword(callback) {
            aws.decrypt(encrypted, function (err, password) {
                if (err) {
                    console.log(err, err.stack);
                    callback('Palo passive config export failure - Decryption', 'Palo config export password decryption has failed. Check the cloudwatch logs for error details');
                } else {
                    callback(null, password);
                }
            });
        },
        function getPaloConfig(password, callback) {
            palo.getPaloConfig(activeIp, password, function (err, paloConfig) {
                if (err) {
                    console.log(err, err.stack);
                    callback('Palo passive config export failure - Retrieve configuration', 'Palo config export failed to retrieve the current Palo configuration. Check the cloudwatch logs for error details');
                } else {
                    callback(null, paloConfig, password);
                }
            });
        },
        function setPassivePaloId(paloConfig, password, callback) {
            let paloId = 1;
            if (paloConfig.includes(palo1PrivateIp)) {
                paloId = 2;
            }
            callback(null, paloConfig, password, paloId);
        },
        function setFileName(paloConfig, password, paloId, callback) {
            let fileName = 'palo' + paloId + '-manifest.json';
            callback(null, paloConfig, password, fileName);
        },
        function getManifest(paloConfig, password, fileName, callback) {
            aws.getObjectS3(paloBucket, fileName, function (err, response) {
                if (err) {
                    console.log(err, err.stack);
                    callback('Palo passive config export failure - Retrieve manifest', 'Palo config export failed to retrieve the current manifest. Check the cloudwatch logs for error details');
                } else {
                    callback(null, paloConfig, password, response);
                }
            });
        },
        function parseConfigFile(paloConfig, password, manifest, callback) {
            let parsedManifest = JSON.parse(manifest);
            config.parseConfigFile(paloConfig, parsedManifest, function (err, result) {
                if (err) {
                    console.log(err, err.stack);
                    callback('Palo passive config export failure - Parse passive configuration', 'Palo config export failed to parse the passive Palo configuration. Check the cloudwatch logs for error details');
                } else {
                    callback(null, result, password);
                }
            });
        },
        function saveConfigToS3(paloConfig, password, callback) {
            config.saveConfigToS3(paloConfig, paloBucket, palo1PrivateIp, function (err, saveActiveResponse) {
                if (err) {
                    console.log(err, err.stack);
                    callback('Palo passive config export failure - Save passive configuration', 'Palo config export failed to save the passive configuration. Check the cloudwatch logs for error details');
                } else {
                    callback(null, paloConfig, password);
                }
            });
        },
        function loadPassiveConfig(paloConfig, password, callback) {
            config.loadPassiveConfig(paloConfig, passiveIp, password, function (err, result) {
                if (err) {
                    console.log(err, err.stack);
                    callback('Palo passive config export failure - Load passive configuration', 'Palo config export failed to load the passive configuration. Check the cloudwatch logs for error details');
                } else {
                    callback(null, result);
                }
            });
        }
    ], function (err, results) {
        if (err) {
            utility.notifyProcessError(clientName + ' Config Export Error', err + '\n' + results, snsErrorTopic);
            console.log(err, results);
        } else {
            console.log('Passive Configuration Saved');
        }
    });
};