define(function (require) {

  var _ = require('lodash');
  var vis = require('vis');
  var moment = require('moment');
  var module = require('ui/modules').get('kibana/uvmap_vis', ['kibana']);
  module.controller('UVMapVisController', function ($scope, Private, Notifier, $http, $rootScope, timefilter, kbnUrl) {

    const queryFilter = Private(require('ui/filter_bar/query_filter'));
    var dashboardContext = Private(require('plugins/timelion/services/dashboard_context'));
    var notify = new Notifier({
      location: 'UVMapVis'
    });

    $scope.search = function run() {
      var expression = $scope.vis.params.expression;
      var connection = $scope.vis.params.connection;

      // If both expression and connection doesn't have anything, we don't have
      // anything to do..
      if (!expression && !connection) return;

      // As we want to display one single metric, we choose the interval as
      // current time selection + 1 second. This will make sure that ES always
      // returns one single metric.
      time_duration = timefilter.getBounds();
      var duration = moment.duration(time_duration.max.diff(time_duration.min));
      var time_duration_seconds = Math.round(duration.asSeconds()) + 1;
      var time_interval = time_duration_seconds + 's';

      // Invoke the backend URL with all the details..
      $http.post('/api/uvmap_vis/run/', {
        sheet: [expression],
        connection: [connection],
        extended: {
          es: {
            filter: dashboardContext()
          }
        },
        time: _.extend(timefilter.time, {
              interval: time_interval
        }),
      })
      // data, status, headers, config
      .success(function (resp) {
          $scope.data = resp.data;
          $scope.mapData = resp.data;
      })
      .error(function (resp) {
        $scope.data = [];
        var err = new Error(resp.message);
        err.stack = resp.stack;
        notify.error(err);
      });
    };

    // Function to be called when a node is selected
    $scope.onNodeSelect = function(params) {
        if (params.nodes[0] in $scope.data.node_dashboard_dict) {
            var dashboard = '/dashboard/' + $scope.data.node_dashboard_dict[params.nodes[0]];
            kbnUrl.redirect(dashboard);
        }
    };

    // This is bad, there should be a single event that triggers a refresh of data.

    // When the expression updates
    $scope.$watchMulti(['vis.params.expression', 'vis.params.connection', 'vis.params.interval'], $scope.search);

    // When the time filter changes
    $scope.$listen(timefilter, 'fetch', $scope.search);

    // When a filter is added to the filter bar?
    $scope.$listen(queryFilter, 'fetch', $scope.search);

    // When auto refresh happens
    $scope.$on('courier:searchRefresh', $scope.search);

    $scope.$on('fetch', $scope.search);

  });
});
