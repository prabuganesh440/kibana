define(function (require) {
  var $ = require('jquery');
  var _ = require('lodash');
  var module = require('ui/modules').get('kibana');
  var AggConfigResult = require('ui/Vis/AggConfigResult');

  module.directive('kbnRows', function ($compile, $rootScope, getAppState, Private) {
    var filterBarClickHandler = Private(require('ui/filter_bar/filter_bar_click_handler'));
    return {
      restrict: 'A',
      link: function ($scope, $el, attr) {

        function convertToSeconds(interval, customInterval) {
          switch (interval) {
            case 's':
              return 1;
            case 'm':
              return 60;
            case 'h':
              return 3600;
            case 'd':
              return 86400;
            case 'w':
              return 86400 * 7;
            case 'M':
              return 86400 * 30;
            case 'y':
              return 86400 * 365;
            case 'auto':
              return 3600;
            case 'custom':
              let customSize = customInterval.slice(0, -1);
              customSize = parseInt(customSize);
              const newInterval = customInterval[customInterval.length - 1];
              return customSize * convertToSeconds(newInterval);
            default:
              return 3600;
          }
        }

        // This function takes the background color of a cell in
        // hexadecimal format and then calculates a value bgDelta
        // using the RGB components in the background color and
        // decides whether the text color needs to be black or white
        // based on intensity of background color
        function idealTextColor(bgColor) {
            var nThreshold = 105;
            var components = getRGBComponents(bgColor);
            var bgDelta = (components.R * 0.299) + (components.G * 0.587) + (components.B * 0.114);
            return ((255 - bgDelta) < nThreshold) ? "#000000" : "#ffffff";
        }

        // This function receives color in hexadecimal format
        // converts and returns color in RGB format
        function getRGBComponents(color) {
            var r = color.substring(1, 3);
            var g = color.substring(3, 5);
            var b = color.substring(5, 7);
            return {
               R: parseInt(r, 16),
               G: parseInt(g, 16),
               B: parseInt(b, 16)
            };
        }

        function addCell($tr, contents, multiplier) {
          var $cell = $(document.createElement('td'));
          var $headerElement = $(document.createElement('h6'));

          // TODO: It would be better to actually check the type of the field, but we don't have
          // access to it here. This may become a problem with the switch to BigNumber
          if (_.isNumeric(contents)) $cell.addClass('numeric-value');

          var createAggConfigResultCell = function (aggConfigResult) {
            var $cell = $(document.createElement('td'));
            var $headerElement = $(document.createElement('h6'));

            var $state = getAppState();
            var clickHandler = filterBarClickHandler($state);
            $headerElement.scope = $scope.$new();
            $headerElement.addClass('cell-hover');
            $headerElement.attr('ng-click', 'clickHandler($event)');
            $headerElement.scope.clickHandler = function (event) {
              if ($(event.target).is('a')) return; // Don't add filter if a link was clicked
              clickHandler({ point: { aggConfigResult: aggConfigResult } });
            };
            return $compile($headerElement)($headerElement.scope);
          };

          let val;
          if (contents instanceof AggConfigResult) {
            if (contents.type === 'bucket' && contents.aggConfig.field() && contents.aggConfig.field().filterable) {
              $headerElement = createAggConfigResultCell(contents);
            }
            val = contents.value;
            val = val * multiplier;
            if (contents.sum != -1){
                if (contents.sum == 0) {
                   contents = contents.toString('html') + '  (0%)';
                } else {
                   var percetange_val = Math.abs(val*100/contents.sum)
                   contents = contents.toString('html') + '  (' + percetange_val.toFixed(2) + '%)';
                }
            } else {
                contents = contents.toString('html');
            }
          }

          if (_.isObject(contents)) {
            if (contents.attr) {
              $headerElement.attr(contents.attr);
            }

            if (contents.class) {
              $headerElement.addClass(contents.class);
            }

            if (contents.scope) {
              $headerElement = $compile($headerElement.html(contents.markup))(contents.scope);
            } else {
              $headerElement.html(contents.markup);
            }
          } else {
            if (contents === '') {
              $headerElement.html('&nbsp;');
            } else {
              const colorSchema = $scope.colorSchema || [];
              colorSchema.forEach(colorRange => {
                if ((val >= colorRange.min) && (val <= colorRange.max)) {
                  $headerElement.each(function () {
                      this.style.setProperty( 'background-color', colorRange.color, 'important' );
                  });
                  const textColor = idealTextColor(colorRange.color);
                  $headerElement.css('color', textColor);
                }
              });
              $headerElement.html(contents);
            }
          }

          $headerElement.addClass('zero-margin');
          $headerElement.appendTo($cell);
          $tr.append($cell);
        }

        function maxRowSize(max, row) {
          return Math.max(max, row.length);
        }

        $scope.$watchMulti([
          attr.kbnRows,
          attr.kbnRowsMin
        ], function (vals) {
          var rows = vals[0];
          var min = vals[1];

          $el.empty();

          if (!_.isArray(rows)) rows = [];
          var width = rows.reduce(maxRowSize, 0);

          if (isFinite(min) && rows.length < min) {
            // clone the rows so that we can add elements to it without upsetting the original
            rows = _.clone(rows);
            // crate the empty row which will be pushed into the row list over and over
            var emptyRow = new Array(width);
            // fill the empty row with values
            _.times(width, function (i) { emptyRow[i] = ''; });
            // push as many empty rows into the row array as needed
            _.times(min - rows.length, function () { rows.push(emptyRow); });
          }

          rows.forEach(function (row) {
            var $tr = $(document.createElement('tr'));
            $tr.appendTo($el);

            // Add style to this element for phantomjs for reports
            $tr[0].style['page-break-inside'] = 'avoid';
            $tr[0].style['page-break-after'] = 'auto';

            row.forEach(function (cell) {
              // background color changes
              let multiplier = 1;
              if (cell instanceof AggConfigResult)
              {
                  // check if it is a matrix table
                  if(cell.aggConfig.vis.type.name=='matrix') {
                      const configs = cell.aggConfig.vis.aggs;
                      const valueConfig = configs[0];
                      const bucketConfig = configs[1];
                      if (valueConfig.type.title !== 'Average') {
                          // use the interval to fix the value;
                          // check if Time buckets are available.
                          // ( Check if Date histogram is selected at the top level)
                          if(_.has(bucketConfig,'buckets'))
                          {
                              const valueInterval = bucketConfig.buckets.getInterval()._milliseconds / 1000;
                              const customInterval = $scope.customInterval + $scope.customIntervalType;
                              const targetInterval = convertToSeconds($scope.interval, customInterval);
                              multiplier = targetInterval / valueInterval;
                          }
                      }
                  }
              }
              addCell($tr, cell, multiplier);
            });

          });
        });
      }
    };
  });
});
