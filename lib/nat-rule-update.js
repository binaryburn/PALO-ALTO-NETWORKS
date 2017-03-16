"use strict";

const palo = require('./palo');
const aws = require('./aws');
const utility = require('./utility');

//environment variables
const encrypted = process.env['pw'];
const ip = process.env['ip'];
const elbTag = process.env['elbTag'];


exports.handler = function(event, context, callback){
    let count = 0;
    let commitCount = 0;

    aws.decrypt(encrypted, function(err, password){
        const onComplete = function () {
            if(commitCount > 0){
                palo.commitConfig(ip, password, function(err, commitResult){
                    console.log(commitResult);
                    callback(null, commitResult);
                });
            } else callback(null ,'no commit');
        };

        utility.buildELBList(elbTag, function(err, elbList){
            for (let i = 0, len = elbList.length; i < len; i++) {
                utility.checkAndUpdate(ip, password, elbList[i], function (err, result) {
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