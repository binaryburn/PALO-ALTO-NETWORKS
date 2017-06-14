"use strict";

const aws = require('aws-sdk');
const kms = new aws.KMS({region: 'us-east-1'});
const elb = new aws.ELB({region: 'us-east-1'});


exports.decrypt = function(value, callback){
    kms.decrypt({ CiphertextBlob: new Buffer(value, 'base64') }, (err, data) => {
        if (err) {
            console.log('Decrypt error:', err);
            return callback(err);
        }
        const decrypted = data.Plaintext.toString('ascii');
        callback(null, decrypted);
    });
};

//gets list of all ELBs in account
exports.getLoadBalancers = function(callback){
    let params = {};
    let elbList = [];
    let count = 0;

    const onComplete = function () {
        callback(null, elbList);
    };

    elb.describeLoadBalancers(params, function(err, data) {
        if (err) {
            callback(err, err.stack);
        }
        else {
            for (let i = 0, len = data.LoadBalancerDescriptions.length; i < len; i++) {
                let item = {
                    'ELBName': data.LoadBalancerDescriptions[i].LoadBalancerName,
                    'DNSName': data.LoadBalancerDescriptions[i].DNSName
                };
                elbList.push(item);
                count++;
                if(count == data.LoadBalancerDescriptions.length) onComplete();
            }
        }
    });
};

exports.getLoadBalancerTags = function(elbName, elbTag, callback){
    let ELBparams = {
        LoadBalancerNames: [
            elbName
        ]
    };
    elb.describeTags(ELBparams, function(err, elb) {
            if (err) callback(err, err.stack);
            else{
                const tags = elb.TagDescriptions[0].Tags;
                const ruleName = tags.find(o => o.Key === elbTag);
                if(ruleName != undefined){
                    const item = {
                        'ELBName': elbName,
                        'RuleName': ruleName.Value
                    };
                    callback(null, item);
                }else callback(err, undefined);
            }
        }
    )
};