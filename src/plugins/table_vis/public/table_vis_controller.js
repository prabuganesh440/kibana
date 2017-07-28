define(function (require) {
  // get the kibana/table_vis module, and make sure that it requires the "kibana" module if it
  // didn't already
  const module = require('ui/modules').get('kibana/table_vis', ['kibana']);

  // add a controller to tha module, which will transform the esResponse into a
  // tabular format that we can pass to the table directive
  module.controller('KbnTableVisController', function ($scope, Private) {
    const tabifyAggResponse = Private(require('ui/agg_response/tabify/tabify'));

    $scope.$watch('esResponse', function (resp, oldResp) {
      let tableGroups = $scope.tableGroups = null;
      let hasSomeRows = $scope.hasSomeRows = null;

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

            if ( agg.schema.title == 'Split Table' ) {
                metricsInPercentage = false;
            }

        });

        tableGroups = tabifyAggResponse(vis, resp, {
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
      if (hasSomeRows) {
        $scope.tableGroups = tableGroups;
      }

      // Update perPage in vis using number-of-rows
      // Updating the perPage value for tables. 
      // We assume that the tableGroups always has one table. 
      // And set the perpage to the no of rows in this table. 
      // If there are multiple tables, then we will have to handle this case
      if ($scope.printReport) {
          if ($scope.tableGroups) {
              $scope.vis.params.perPage = $scope.tableGroups.tables[0].rows.length;
          }
      }

    });
  });

});
