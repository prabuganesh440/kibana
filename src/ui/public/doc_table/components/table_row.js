define(function (require) {
  var _ = require('lodash');
  var $ = require('jquery');
  var addWordBreaks = require('ui/utils/add_word_breaks');
  var module = require('ui/modules').get('app/discover');

  require('ui/highlight');
  require('ui/highlight/highlight_tags');
  require('ui/doc_viewer');
  require('ui/private');
  require('ui/filters/trust_as_html');
  require('ui/filters/short_dots');
  require('ui/directives/confirm_click');


  // guesstimate at the minimum number of chars wide cells in the table should be
  var MIN_LINE_LENGTH = 20;

  /**
   * kbnTableRow directive
   *
   * Display a row in the table
   * ```
   * <tr ng-repeat="row in rows" kbn-table-row="row"></tr>
   * ```
   */
  module.directive('kbnTableRow', function (Private, $compile) {
    var noWhiteSpace = require('ui/utils/no_white_space');
    var openRowHtml = require('ui/doc_table/components/table_row/open.html');
    var detailsHtml = require('ui/doc_table/components/table_row/details.html');
    var DocSource = Private(require('ui/courier/data_source/doc_source'));
    var cellTemplate = _.template(noWhiteSpace(require('ui/doc_table/components/table_row/cell.html')));
    var truncateByHeightTemplate = _.template(noWhiteSpace(require('ui/partials/truncate_by_height.html')));

    return {
      restrict: 'A',
      scope: {
        columns: '=',
        aliasName: '=',
        filter: '=',
        indexPattern: '=',
        printReport: '=',
        row: '=kbnTableRow'
      },
      link: function ($scope, $el) {
        $el.after('<tr>');
        $el.empty();

        var init = function () {
          createSummaryRow($scope.row, $scope.row._id);
        };

        // when we compile the details, we use this $scope
        var $detailsScope;

        // when we compile the toggle button in the summary, we use this $scope
        var $toggleScope;

        // This function is called when a row (document) needs to be updated
        // with a new field or content of an existing field.
        function _updateRow(row, body) {
            var index = row._index;
            var id = row._id;
            var type = row._type;

            // Let us use docSource
            var doc_source = new DocSource();

            // tell the docSource where to find the doc
            doc_source.index(index)
                      .type(type)
                      .id(id);

            doc_source.doUpdate(body)
                .then(function (id) {
                     console.log("Successfully update the document that user has marked it for deletion");
                })
                .catch(function (err) {
                     console.log("Failed to update the document");
                });
        }

        // This function is called when someone clicks the edit button for a
        // document
        $scope.editRow = function () {
            console.log("Editing row");
            console.log($scope.row);

            var old_comments = '';
            if (_.has($scope.row._source, '_user_comments') ) {
                old_comments = $scope.row._source._user_comments;
            }

            // Get comments from text box..
            comments = prompt("Please provide your comments below:", old_comments);

            // If there is no change in comment, we do not invoke the update..
            if (comments != null && comments != old_comments) {
                console.log("Invoking row update");
                var body =  { "_user_comments" : comments };
                _updateRow($scope.row, body);
                // we update _source as well with _user_comments
                // because in some places, it might be used.
                $scope.row._source['_user_comments'] = comments;
                $scope.row['_user_comments'] = comments;
                // We call createSummaryRow to update this row
                // with _user_comments added.
                createSummaryRow($scope.row, $scope.row._id);
            }
        };

        $scope.deleteRow = function () {
            console.log("Deleting row");
            console.log($scope.row);

            // Just create a source that we need to add a tag 'deleted_by_user'
            var body =  { "_user_action" : "User marked this as deleted" };

            _updateRow($scope.row, body);
        };

        // toggle display of the rows details, a full list of the fields from each row
        $scope.toggleRow = function () {
          var $detailsTr = $el.next();

          $scope.open = !$scope.open;

          ///
          // add/remove $details children
          ///

          $detailsTr.toggle($scope.open);

          if (!$scope.open) {
            // close the child scope if it exists
            $detailsScope.$destroy();
            // no need to go any further
            return;
          } else {
            $detailsScope = $scope.$new();
          }

          // empty the details and rebuild it
          $detailsTr.html(detailsHtml);

          $detailsScope.row = $scope.row;

          $compile($detailsTr)($detailsScope);
        };

        $scope.$watchCollection('columns', function () {
          createSummaryRow($scope.row, $scope.row._id);
        });

        $scope.$watchMulti(['indexPattern.timeFieldName', 'row.highlight'], function () {
          createSummaryRow($scope.row, $scope.row._id);
        });

        // create a tr element that lists the value for each *column*
        function createSummaryRow(row) {
          var indexPattern = $scope.indexPattern;

          // We just create a string here because its faster.
          var newHtmls = [
            openRowHtml
          ];

          if (indexPattern.timeFieldName) {
            newHtmls.push(cellTemplate({
              timefield: true,
              formatted: _displayField(row, indexPattern.timeFieldName)
            }));
          }

          // _user_comments should be added to each document
          // when ES creates a document.
          // Once that happens, we won't need the current
          // hack that has been put in to display _user_comments.
          $scope.columns.forEach(function (column) {
            if (column == '_user_comments')
            {
              newHtmls.push(cellTemplate({
                timefield: false,
                sourcefield: (column === '_source'),
                formatted: row._source._user_comments
              }));
            }
            else {
                newHtmls.push(cellTemplate({
                  timefield: false,
                  sourcefield: (column === '_source'),
                  formatted: _displayField(row, column, true)
              }));
            }
          });

          var $cells = $el.children();
          newHtmls.forEach(function (html, i) {
            var $cell = $cells.eq(i);
            if ($cell.data('discover:html') === html) return;

            var reuse = _.find($cells.slice(i + 1), function (cell) {
              return $.data(cell, 'discover:html') === html;
            });

            var $target = reuse ? $(reuse).detach() : $(html);
            $target.data('discover:html', html);
            var $before = $cells.eq(i - 1);
            if ($before.size()) {
              $before.after($target);
            } else {
              $el.append($target);
            }

            // rebuild cells since we modified the children
            $cells = $el.children();

            if (i === 0 && !reuse) {
              $toggleScope = $scope.$new();
              $compile($target)($toggleScope);
            }
          });

          if ($scope.open) {
            $detailsScope.row = row;
          }

          // trim off cells that were not used rest of the cells
          $cells.filter(':gt(' + (newHtmls.length - 1) + ')').remove();
        }

        /**
         * Fill an element with the value of a field
         */
        function _displayField(row, fieldName, breakWords) {
          var indexPattern = $scope.indexPattern;
          var text = indexPattern.formatField(row, fieldName);

          if (breakWords) {
            text = addWordBreaks(text, MIN_LINE_LENGTH);

            if (text.length > MIN_LINE_LENGTH) {
              return truncateByHeightTemplate({
                body: text
              });
            }
          }

          return text;
        }

        init();
      }
    };
  });
});
