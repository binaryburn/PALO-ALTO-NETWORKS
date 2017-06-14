"use strict";

const palo = require('./../utility/palo');
const aws = require('./../utility/aws');
const utility = require('./../utility/misc');

//environment variables
const encrypted = process.env.pw;
const ip = process.env.ip;
const elbTag = process.env.elbTag;
const paloAdmin = process.env.paloAdmin;


exports.handler = function(event, context, callback){
    let count = 0;
    let commitCount = 0;

    aws.decrypt(encrypted, function(err, password){
        const onComplete = function () {
            if(commitCount > 0){
                palo.commitConfig(ip, paloAdmin, password, function(err, commitResult){
                    console.log(commitResult);
                    callback(null, commitResult);
                });
            } else {
                callback(null ,'no commit');
            }
        };

        utility.buildELBList(elbTag, function(err, elbList){
            for (let i = 0, len = elbList.length; i < len; i++) {
                utility.checkAndUpdate(ip, paloAdmin, password, elbList[i], function (err, result) {
                    console.log(result);
                    const string = result.toString();
                    if(!string.includes('no change')){
                        commitCount++;
                    }
                    count++;
                    if(count == elbList.length) onComplete();
                })
            }
        })
    });
};