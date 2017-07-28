var _ = require('lodash');
var moment = require('moment');

define(function (require) {
  // get the kibana/matrix_vis module, and make sure that it requires the "kibana" module if it
  // didn't already
  const module = require('ui/modules').get('kibana/matrix_vis', ['kibana']);

  // add a controller to the module, which will transform the esResponse into a
  // tabular format that we can pass to the table directive
  module.controller('KbnMatrixVisController', function ($scope, Private, timefilter) {
    const matrixifyAggResponse = Private(require('ui/agg_response/matrixify/matrixify'));

    $scope.$watch('esResponse', function (resp, oldResp) {
      let tableGroups = $scope.tableGroups = null;
      let hasSomeRows = $scope.hasSomeRows = null;
      var input = timefilter.getActiveBounds();
      $scope.startDate = moment(input.min._d).format('ddd MMM DD YYYY HH:mm:ss');
      $scope.noOfDays = moment(input.max._d).diff(moment(input.min._d), 'days', true);
      $scope.outputTimeFormat = $scope.vis.params.outputTimeFormat;
      $scope.exceededNoOfDaysErrorMessage = "No of Days cannot exceed 30! Please use the \
                                            global time picker at the top right corner of \
                                            the screen to update the time"

      if (resp) {
        const vis = $scope.vis;
        const params = vis.params;

        // We will use the metricsInPercentage flag as True only if all the
        // metrics are count, sum or unique count. Also, the table is using
        // split line instead of split table. Metrics in percentage is
        // not support for Split table
        var metricsInPercentage = params.metricsInPercentage;
        _.each(vis.aggs, function(agg) {
            if ( agg.type.type == 'metrics' && agg.type.title != 'Count' && agg.type.title != 'Sum' && agg.type.title != 'Unique Count') {
                        metricsInPercentage = false;
            }
        });

        tableGroups = matrixifyAggResponse(vis, resp, {
          partialRows: params.showPartialRows,
          metricsInPercentage: metricsInPercentage,
          minimalColumns: vis.isHierarchical() && !params.showMeticsAtAllLevels,
          asAggConfigResults: true
        });

        hasSomeRows = tableGroups.tables.some(function haveRows(table) {
          if (table.tables) return table.tables.some(haveRows);
          return table.rows.length > 0;
        });
      }

      $scope.hasSomeRows = hasSomeRows;
      // hide the visualization and show only the error message
      if($scope.noOfDays > 30 && $scope.vis.params.collapseTimeHeaders === true)
      {
        hasSomeRows = false;
      }

      if (hasSomeRows) {
        $scope.tableGroups = tableGroups;
      }

      // Update perPage in vis using number-of-rows
      if ($scope.printReport) {
          $scope.vis.params.perPage = $scope.tableGroups.tables[0].rows.length;
      }
    });

  });

});
