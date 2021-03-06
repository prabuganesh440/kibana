define(function (require) {
  var _ = require('lodash');

  var html = require('ui/doc_table/doc_table.html');
  var getSort = require('ui/doc_table/lib/get_sort');

  require('ui/doc_table/doc_table.less');
  require('ui/directives/truncated');
  require('ui/directives/infinite_scroll');
  require('ui/doc_table/components/table_header');
  require('ui/doc_table/components/table_row');

  require('ui/modules').get('kibana')
  .directive('docTable', function (config, Notifier, getAppState) {
    return {
      restrict: 'E',
      template: html,
      scope: {
        gridster: '=',
        element: '=',
        sorting: '=',
        columns: '=',
        aliasName: '=',
        hits: '=?', // You really want either hits & indexPattern, OR searchSource
        indexPattern: '=?',
        printReport: '=?',
        searchSource: '=?',
        infiniteScroll: '=?',
        filter: '=?',
      },
      link: function ($scope) {
        // alert($scope.columns);
        // alert($scope.aliasName);
        var notify = new Notifier();
        $scope.limit = config.get('discover:sampleSize');
        $scope.persist = {
          sorting: $scope.sorting,
          columns: $scope.columns,
          aliasName:$scope.aliasName
        };

        var prereq = (function () {
          var fns = [];

          return function register(fn) {
            fns.push(fn);

            return function () {
              fn.apply(this, arguments);

              if (fns.length) {
                _.pull(fns, fn);
                if (!fns.length) {
                  $scope.$root.$broadcast('ready:vis');
                }
              }
            };
          };
        }());

        $scope.addRows = function () {
          $scope.limit += config.get('discover:sampleSize');
        };

        // This exists to fix the problem of an empty initial column list not playing nice with watchCollection.
        $scope.$watch('columns', function (columns) {
          if (columns.length !== 0) return;

          var $state = getAppState();
          $scope.columns.push('_source');
          // $scope.aliasName.push('_source');
          if ($state) $state.replace();
        });

        $scope.$watchCollection('columns', function (columns, oldColumns) {
          if (oldColumns.length === 1 && oldColumns[0] === '_source' && $scope.columns.length > 1) {
            _.pull($scope.columns, '_source');
          }

          if ($scope.columns.length === 0) $scope.columns.push('_source');
        });


        $scope.$watch('searchSource', prereq(function (searchSource) {
          if (!$scope.searchSource) return;

          $scope.indexPattern = $scope.searchSource.get('index');

          $scope.searchSource.size(config.get('discover:sampleSize'));
          $scope.searchSource.sort(getSort($scope.sorting, $scope.indexPattern));

          // Set the watcher after initialization
          $scope.$watchCollection('sorting', function (newSort, oldSort) {
            // Don't react if sort values didn't really change
            if (newSort === oldSort) return;
            $scope.searchSource.sort(getSort(newSort, $scope.indexPattern));
            $scope.searchSource.fetchQueued();
          });

          $scope.$on('$destroy', function () {
            if ($scope.searchSource) $scope.searchSource.destroy();
          });

          // TODO: we need to have some way to clean up result requests
          $scope.searchSource.onResults().then(function onResults(resp) {
            // Reset infinite scroll limit
            $scope.limit = config.get('discover:sampleSize');

            // Abort if something changed
            if ($scope.searchSource !== $scope.searchSource) return;

            $scope.hits = resp.hits.hits;
            return $scope.searchSource.onResults().then(onResults);
          }).catch(notify.fatal);

          $scope.searchSource.onError(notify.error).catch(notify.fatal);
        }));

        // This is for exporting the search output as csv
        $scope._saveAs = require('@spalger/filesaver').saveAs;
        $scope.csv = {
          separator: config.get('csv:separator'),
          quoteValues: config.get('csv:quoteValues')
        };

        $scope.exportAsCsv = function (formatted) {
          var csv = new Blob([$scope.toCsv(formatted)], { type: 'text/plain' });
          $scope._saveAs(csv, $scope.csv.filename);
        };

        $scope.toCsv = function (formatted) {
          var rows = $scope.hits;
          var columns = $scope.columns;
          var aliasName = $scope.aliasName;
          var nonAlphaNumRE = /[^a-zA-Z0-9]/;
          var allDoubleQuoteRE = /"/g;
          var indexPattern = $scope.indexPattern;

          if (columns.length === 1 && columns[0] === '_source') {
              return [];
          }

          function escape(row, column) {
            var val = indexPattern.formatField(row, column);
            val = String(val);
            if ($scope.csv.quoteValues && nonAlphaNumRE.test(val)) {
                val = '"' + val.replace(allDoubleQuoteRE, '""') + '"';
            }
            return val;
          }

          // escape each cell in each row
          var csvRows = rows.map(function (row) {
            return columns.map(function(column) {
                return escape(row, column);
            });
          });

          // add the columns to the rows
          csvRows.unshift(columns.map(function (col) {
            return col;
          }));

          return csvRows.map(function (row) {
            return row.join($scope.csv.separator) + '\r\n';
          }).join('');
        };

      }
    };
  });
});
