"use strict";

//modules
const aws = require('./aws');
const utility = require('./misc');
const palo = require('./palo');

//third party
const async = require('async');

exports.notifyProcessError = function(zenRequester, snsTopic, clientName, detail){
    if(!clientName) clientName = 'Oxygen';
    utility.sendNotfications(true, true, false, clientName + ' Palo Config Export Error', detail, zenRequester, snsTopic, function(err, result){
        callback(err, result);
    });
};

exports.saveConfigToS3 = function (configFile, s3Bucket, palo1PrivateIp, callback){
    let paloId = 2;

    configFile = configFile.replace('<response status="success"><result>', '');
    configFile = configFile.replace('</result></response>', '');

    if(configFile.includes(palo1PrivateIp)) paloId = 1;

    aws.putObjectS3(s3Bucket, 'Palo' + paloId + '-config.xml', configFile, function(err, response){
        if (err) {
            callback(new Error(err));
        }
        else {
            callback(null, response);
        }
    });
};

exports.parseConfigFile = function(configFile, manifest, callback) {
    let parsedConfig = configFile.replace('<response status="success"><result>', '');
    parsedConfig = parsedConfig.replace('</result></response>', '');

    async.each(manifest.Translations, function(translation, callback){
            parsedConfig = parsedConfig.replace(new RegExp(translation.original, 'g'), translation.translated);
            callback();
        }, function(err){
            if(err){
                console.log(err, err.stack);
                callback(err, err.stack);
            }else{
                callback(null, parsedConfig);
            }
        }
    );
};

exports.loadPassiveConfig = function(passiveConfig, passiveIp, password, callback){
    let fileName = 'palo-export.xml';

    palo.uploadPaloConfig(passiveIp, password, fileName, passiveConfig, function(err, uploadResponse){
        if(err || !uploadResponse.toString().includes('success')) callback(err + uploadResponse.toString());
        else{
            console.log(uploadResponse.toString());
            palo.loadPaloConfig(passiveIp, password, fileName, function(err, loadResponse){
                if(err || !loadResponse.toString().includes('success')) callback(err + loadResponse.toString());
                else{
                    console.log(loadResponse.toString());
                    palo.commitPaloConfig(passiveIp, password, function(err, commitResponse){
                        if(err || !commitResponse.toString().includes('success')) callback(err + commitResponse.toString());
                        else callback(null, commitResponse);
                    })
                }
            });
        }
    });
};