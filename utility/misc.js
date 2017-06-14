"use strict";

const aws = require('./aws');
const utility = require('./misc');
const palo = require('./palo');
const async = require('async');
const dns = require('dns');
const parseString = require('xml2js').parseString;
const find = require('array.prototype.find');
const fs = require('fs');

//extracts translated address from xml
exports.parseXml = function(xml, callback){
    parseString(xml, function (err, result) {
        let xmlString = JSON.stringify(result);
        let xmlJson = JSON.parse(xmlString);
        let transAddr = xmlJson.response.result[0]['translated-address'][0];
        callback(null, transAddr);
    });
};

//performs nslookup for specified fqdn
exports.nsLookup = function(fqdn, callback){
    dns.resolve4(fqdn, function (err, addresses) {
        if (err){
            callback(err, err.stack);
        } else{
            addresses.sort();
            callback(null, addresses[0]);
        }
    });
};

//builds list of ELBs with palo-nat-rule tags
exports.buildELBList = function(callback){
    let tagArray = [];
    let elbList = [];

    async.waterfall([
        function buildELBList(callback){
            aws.getLoadBalancers(function(err, result){
                elbList = result;
                callback(null, elbList);
            });
        },
        function buildTagArray(elbList, callback){
            let count = 0;

            const onComplete = function () {
                callback(null, tagArray);
            };

            for (let i = 0, len = elbList.length; i < len; i++) {
                let elbName = elbList[i].ELBName;
                aws.getLoadBalancerTags(elbList[i].ELBName, function(err, paloTag){
                    if(paloTag != undefined) tagArray.push(paloTag);
                    count++;
                    if(count == elbList.length) onComplete();
                });
            }
        }
    ], function(err, results){
        if(err){
            callback(err, err.stack)
        } else {
            for (let i = 0, len = tagArray.length; i < len; i++) {
                let item = find(elbList, function (o) { return o.ELBName === tagArray[i].ELBName; });
                //let item = elbList.find(o => o.ELBName === tagArray[i].ELBName);
                tagArray[i].DNSName = item.DNSName;
            }
        }
        callback(null, tagArray);
    });
};

exports.checkAndUpdate = function(paloIp, paloPw, elbItem, callback){
    let currentELBIp = '';
    let currentNatRuleIp = '';

    async.waterfall([
        function getELBCurrentIP(callback){
            utility.nsLookup(elbItem.DNSName, function(err, result){
                currentELBIp = result;
                callback(null, result);
            });
        },
        function getNATRuleCurrentIP(val, callback){
            palo.getCurrentDestination(elbItem.RuleName, paloIp, paloPw, function(err, result){
                currentNatRuleIp = result;
                callback(null, result);
            });
        }
    ], function(err, results){
        if(currentNatRuleIp != 'rule not found' && currentNatRuleIp == currentELBIp){
            callback(null, elbItem.RuleName + ': no change');
        } else if(currentNatRuleIp == 'rule not found'){
            callback(null, elbItem.RuleName + ': rule not found');
        } else{
            palo.updateNATRule(elbItem.RuleName, paloIp, paloPw, currentELBIp, function(err, updateResult){
                callback(null, elbItem.RuleName + ': ' + updateResult);
            })
        }
    });
};

exports.checkAndUpdateUsingState = function(paloIp, paloPw, state, elbItem, callback){
    async.waterfall([
        function getELBCurrentIP(callback){
            utility.nsLookup(elbItem.DNSName, function(err, ip){
                if(err) callback(err, err.stack);
                else callback(null, ip);
            });
        },
        function matchRecord(ip, callback){
            let item = find(state, function (o) { return o.ELBName === elbItem.ELBName; });
            callback(null, ip, item);
        },
        function updateIfMatch(ip, item, callback){
            if(item){
                if(ip != item.IpAddress){
                    console.log('update this thang: ' + elbItem.RuleName + ' with ' + ip );
                    // palo.updateNATRule(elbItem.RuleName, paloIp, paloPw, ip, function(err, updateResult){
                    //     console.log(elbItem.RuleName + ': ' + updateResult);
                    // })

                }
            }
            callback(null, ip, item);
        },
        function updateIfNoMatch(ip, item, callback){
            if(!item) {
                console.log('no match so update this thang: ' + elbItem.RuleName + ' with ' + ip );
                // palo.updateNATRule(elbItem.RuleName, paloIp, paloPw, ip, function(err, updateResult){
                //     console.log(elbItem.RuleName + ': ' + updateResult);
                // })
            }
            callback(null, ip, item);
        },
        function addCurrentValueToState(ip, item, callback){
            let currentItem = {
                ELBName: elbItem.ELBName,
                RuleName: elbItem.RuleName,
                IpAddress: ip
            };
            callback(null, currentItem)
        }

    ], function (err, result) {
        callback(null, result);
    });
};

exports.getStateFile = function(fileName, callback){
    fs.stat(fileName, function(err, result){
        if (err) {
            //check if file doesn't exist
            if (err.code === 'ENOENT' ) {
                //create file and return
                let newArray = [];
                let newItem = {
                    entries: newArray
                };
                let json = JSON.stringify(newItem);
                fs.writeFile(fileName, json, 'utf8', function (err, response) {
                    if (err) callback('WriteFile Error:' + err, err.stack);
                    else callback(null, JSON.stringify(newItem));
                });
            }
        } else{
            fs.readFile(fileName, 'utf8', function(err, data){
                if (err){
                    callback('ReadFile Error:' + err, err.stack);
                } else {
                    callback(null, JSON.parse(data));
                }});
        }
    })
};

exports.writeStateFile = function(filePath, file, callback){
    let json = JSON.stringify(file);
    fs.writeFile(filePath, json, 'utf8', function (err, response) {
        if (err) callback('WriteFile Error:' + err, err.stack);
        else callback(null, response);
    });
};

exports.sendNotfications = function(subject, message, requester, arn, callback){
    aws.publishToSNS(subject, message, arn, function(err, snsResponse){
        if(err) console.log(err. snsResponse);
        else console.log(snsResponse);
    });
};