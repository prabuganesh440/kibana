var _ = require('lodash');

module.exports = function (chrome, internals) {

  chrome.setupAngular = function () {
    var modules = require('ui/modules');
    var kibana = modules.get('kibana');

    _.forOwn(chrome.getInjected(), function (val, name) {
      kibana.value(name, val);
    });

    kibana
    .value('kbnVersion', internals.version)
    .value('buildNum', internals.buildNum)
    .value('buildSha', internals.buildSha)
    .value('user_name', internals.user_name)
    .value('user_role', internals.user_role)
    .value('user_permission', internals.user_permission)
    .value('shipper_url', internals.shipper_url)
    .value('user_home_dashboard', internals.user_home_dashboard)
    .value('sessionId', Date.now())
    .value('esUrl', (function () {
      var a = document.createElement('a');
      a.href = chrome.addBasePath('/elasticsearch');
      return a.href;
    }()))
    .config(chrome.$setupXsrfRequestInterceptor);

    require('../directives')(chrome, internals);

    modules.link(kibana);
  };

};
