"use strict";

const dns = require('dns');
const async = require('async');
const aws = require('./aws');
const utility = require('./utility');
const palo = require('./palo');
const parseString = require('xml2js').parseString;
const find = require('array.prototype.find');

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
exports.buildELBList = function(elbTag, callback){
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
                aws.getLoadBalancerTags(elbList[i].ELBName, elbTag, function(err, paloTag){
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

//iterates through list of ELBs and updates those that differ from Palo configuration
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