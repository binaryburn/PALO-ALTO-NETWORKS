"use strict";

//modules
const aws = require('./aws');
const utility = require('./misc');
const failover = require('./failover');

//third-party
const request = require('request');
const async = require('async');

exports.notifyProcessError = function(zenRequester, snsTopic, clientName, detail){
    if(!clientName) {
        clientName = 'Undefined';
    }
    utility.sendNotfications(clientName + ' Palo Failover Alert', detail, zenRequester, snsTopic, function(err, result){
        callback(err, result);
    });
};

exports.notifyFailover = function(zenRequester, snsTopic, clientName, detail){
    if(!clientName) {
        clientName = 'Undefined';
    }
    utility.sendNotfications(clientName + ' Palo Failover Alert', detail, zenRequester, snsTopic, function(err, result){
        callback(err, result);
    });
};

exports.updateTags = function(callback){
    async.waterfall([
        function getPaloIds(callback) {
            failover.getPaloIDs(function (err, response){
                if(err){
                    callback('Error', err + '\n' + err.message);
                } else if (response.active == 'not found'){
                    callback('Error retrieving Palo IDs:', response)
                } else{
                    callback(null, response);
                }
            })
        },
        function updatePassiveTag(instanceIDs, callback) {
            aws.updateEC2Tag(instanceIDs.active, 'PaloState', 'passive', function(err, passiveResult){
                if(err){
                    callback('Error updating passive tag: \n' + err)
                }else{
                    callback(null, instanceIDs)
                }
            })
        },
        function updateActiveTag(instanceIDs, callback) {
            aws.updateEC2Tag(instanceIDs.passive, 'PaloState', 'active', function(err, activeResult){
                if(err){
                    callback('Error updating active tag: \n' + err)
                }else{
                    callback(null, instanceIDs)
                }
            })
        }
    ], function (err, results) {
        if (err) {
            callback(err, err.stack);

        } else {
            callback(null, results);
        }
    });
};

exports.transferEIPs = function(manifest, callback){
    let parsedManifest = JSON.parse(manifest);

    async.each(parsedManifest.EIPs, function(item, callback){
            aws.associateElasticIP(item.eipAllocation, item.eni, item.ip, item.publicIp, function(err, result){
                if(err) {
                    callback(err, err.stack);
                }
                else {
                    callback(null, result);
                }
            });
        }, function(err){
            if(err){
                console.log(err + err.stack);
                callback('Error transferring EIPs', err + err.stack);
            }else{
                callback(null, 'Successfully transferred EIPs');
            }
        }
    );
};

exports.transferRouteTables = function(manifest, callback){
    let parsedManifest = JSON.parse(manifest);

    async.each(parsedManifest.RouteTables, function(item, callback){
            aws.addRouteTableRoute(item.ip, item.routeTable, item.eni, function(err, routeResult){
                if(err) {
                    callback(err, err.stack);
                }
                else {
                    callback(null, routeResult);
                }
            });
        }, function(err){
            if(err){
                console.log(err, err.stack);
                callback(err, err.stack);
            }else{
                callback(null, 'Successfully transferred Route Tables.');
            }
        }
    );
};

exports.executeFailover = function (palo1Id, paloBucket, instanceMap, callback) {
    let result = '';
    let count = 0;

    if(instanceMap.active != palo1Id){
        //get palo 1 manifest
        aws.getObjectS3(paloBucket, 'palo1-manifest.json', function(err, response){
            if(err) {
                callback(err);
            }
            else{
                let manifest = JSON.parse(response);
                console.log('palo 1');

                async.each(manifest.EIPs, function(item, callback){
                        aws.associateElasticIP(item.eipAllocation, item.eni, item.ip, item.publicIp, function(err, result){
                            if(err) callback(err, err.stack);
                            else callback(null, result);
                        });
                    }, function(err){
                        if(err){
                            console.log(err + err.stack);
                            callback('Error transferring EIPs', err + err.stack);
                        }else{
                            callback(null, 'Successfully transferred EIPs');
                        }
                    }
                );

                async.each(manifest.RouteTables, function(item, callback){
                        aws.addRouteTableRoute(manifest.RouteTables[i].ip, manifest.RouteTables[i].routeTable, manifest.RouteTables[i].eni, function(err, routeResult){
                            if(err) callback(err, err.stack);
                            else callback(null, routeResult);
                        });
                    }, function(err){
                        if(err){
                            console.log(err, err.stack);
                            callback(err, err.stack);
                        }else{
                            callback(null, parsedConfig);
                        }
                    }
                );
            }
        });
    }else{
        //get palo 2 manifest
        aws.getObjectS3(paloBucket, 'palo2-manifest.json', function(err, response){
            if(err) callback(err);
            else{
                try{
                    let manifest = JSON.parse(response);
                    console.log('palo 2');

                    for (let i = 0, len = manifest.EIPs.length; i < len; i++) {
                        const onComplete = function () {
                            callback(null, result);
                        };

                        aws.associateElasticIP(manifest.EIPs[i].eipAllocation, manifest.EIPs[i].eni, manifest.EIPs[i].ip, manifest.EIPs[i].publicIp, function(err,result){
                            if(err) console.log(err, err.stack);
                            else console.log(null, result);
                        });
                        count++;
                        if(count == manifest.EIPs.length) onComplete();
                    }

                    // for (let i = 0, len = manifest.RouteTables.length; i < len; i++) {
                    //     aws.addRouteTableRoute(manifest.RouteTables[i].ip, manifest.RouteTables[i].routeTable, manifest.RouteTables[i].eni, function(err, routeResult){
                    //         if(err) console.log(err, err.stack);
                    //         else console.log(null, routeResult);
                    //     });
                    // }
                    //callback(null, result);
                }catch(err){
                    //callback(err, err.message);
                }
            }
        });
    }
};

exports.getPaloIDs = function (callback) {
    let activeInstanceId = '';
    let passiveInstanceId = '';

    aws.getInstanceByTag('PaloState', 'active', function (err, response) {
        if(err) console.log(err);
        else{
            activeInstanceId = response;
            aws.getInstanceByTag('PaloState', 'passive', function(err, response){
                if(err) console.log(err, response);
                else{
                    passiveInstanceId = response;
                    const retVal = {
                        active: activeInstanceId,
                        passive: passiveInstanceId
                    };
                    callback(null, retVal);
                }
            })
        }
    });
};