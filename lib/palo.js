"use strict";

const request = require('request');
const utility = require('./utility');

exports.getCurrentDestination = function(entryName, paloIp, paloPw, callback){
    this.getPaloKey(paloIp, paloPw, function(err, paloKey){
        const xpath = "/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']/rulebase/nat/rules/entry[@name='" + entryName + "']/destination-translation/translated-address";

        const url = 'https://' + paloIp + '/api/?type=config&action=show&key=' + paloKey + '&xpath=' + xpath;

        const r = request.post(url, function (err, httpResponse, body) {
            if (err) {
                callback(err, err.stack);
            }else{
                const strBody = body.toString();
                if(strBody.includes('No such node')){
                    callback(null, 'rule not found');
                }else{
                    utility.parseXml(body, function(err, xmlResponse){
                        callback(null, xmlResponse);
                    });
                }
            }
        });
    })
};