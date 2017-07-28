'use strict';

var page = require('webpage').create(),
    system = require('system'),
    address,
    duration,
    output,
    size;
//How to to wait for kibana to load and the data from elasticseatch in milliseconds.
var waitTime = 25 * 1000;

if (system.args.length < 8 || system.args.length > 10) {
    console.log("Usage: report.js URL filename username userrole userpermissions duration shipper_url");
    phantom.exit(1);
} else {
    address = system.args[1];
    output = system.args[2];
    duration = system.args[6];
    var company_name = "Wipro CCLG";
    page.viewportSize = { width: 1260, height: 835 };
    page.paperSize = { width: 1250,
                       height: 825,
                       orientation: 'landscape',
                       margin: '1cm',
                       header: {
                           height: "1cm",
                           contents: phantom.callback(function(pageNum, numPages) {
                                return "<div style='border-bottom:1px solid; height:1px;color:#01b5d5;font-size:14px;width:1100px;font-weight:bold'></div>";
                           })
                       },
                       footer: {
                          height: "0.97cm",
                          contents: phantom.callback(function(pageNum, numPages) {
                              return "<div style='border-bottom:1px solid; height:1px;color:#01b5d5;font-size:14px;width:1100px;font-weight:bold'><div style='padding-top:5px;'><span style='display:inline-block;margin-left:5px'> vuSmartMaps</span><span style='margin-left:910px'>" + pageNum + " / " + numPages + "</span></div></div>";
                          })
                       }
                    };

    // Let us write a simple logic of calculating waitTime based on duration
    // For within a day, use waitTime as 15 seconds
    if (duration <= 24) {
        waitTime = 25*1000;
    } else if (duration <= 120) {
        // For within 5 days, use waitTime as 20 seconds
        waitTime = 20*1000;
    } else if (duration <= 360) {
        // For within 15 days, use waitTime as 30 seconds
        waitTime = 30*1000;
    } else if (duration <= 720) {
        // For within 15 days, use waitTime as 45 seconds
        waitTime = 45*1000;
    } else {
        // For anything beyond this, let us use 60 seconds
        waitTime = 60*1000;
    }

    // Add custome header with username

    page.customHeaders = {
        "username": system.args[3],
        "user_group": system.args[4],
        "permissions": system.args[5],
        "shipper_url": system.args[7],
    };


    page.open(address, function (status) {
        if (status !== 'success') {
            console.log('Unable to load the address!');
            phantom.exit();
        } else {
            window.setTimeout(function () {
                page.render(output);
                phantom.exit();
            }, waitTime);
        }
    });
}
