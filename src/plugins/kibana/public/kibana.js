require('plugins/kibana/discover/index');
require('plugins/kibana/visualize/index');
require('plugins/kibana/dashboard/index');
require('plugins/kibana/settings/index');
require('plugins/kibana/doc/index');
require('plugins/kibana/alert/index');
require('plugins/kibana/report/index');
require('ui/timepicker');

const moment = require('moment-timezone');

const chrome = require('ui/chrome');
const routes = require('ui/routes');
const modules = require('ui/modules');

const kibanaLogoUrl = require('ui/images/kibana.svg');

routes.enable();

routes
.otherwise({
    redirectTo: `${chrome.getUserHomeDashboard()}`
});

chrome
// Hiding the kibana logo in the top navigation bar
// .setBrand({
//   'logo': 'url(' + kibanaLogoUrl + ') left no-repeat',
//   'smallLogo': 'url(' + kibanaLogoUrl + ') left no-repeat'
// })
.setNavBackground('#E7EBEE')
.setTabDefaults({
  resetWhenActive: true,
  lastUrlStore: window.sessionStore,
  activeIndicatorColor: '#E7EBEE'
})
 .setTabs([
   {
      id: 'dashboard',
     title: 'Insights'
   },
   {
     id: 'report/Home',
     title: 'Report'
   },
   {
      id: 'discover/Home',
      title: 'Search'
   },
   {
    id: 'visualize/Home',
    title: 'Visualizations',
    activeIndicatorColor: function () {
      return (String(this.lastUrl).indexOf('/visualize/step/') === 0) ? 'white' : '#E7EBEE';
    }
   },
   {
     id: 'alert/Home',
     title: 'Manage alerts'
   },
   {
     id: 'settings',
    title: 'Advanced'
   }
])
.setRootController('kibana', function ($scope, $rootScope, courier, config) {
  function setDefaultTimezone() {
    moment.tz.setDefault(config.get('dateFormat:tz'));
  }

  // wait for the application to finish loading
  $scope.$on('application.load', function () {
    courier.start();
  });

  $scope.$on('init:config', setDefaultTimezone);
  $scope.$on('change:config.dateFormat:tz', setDefaultTimezone);
});
