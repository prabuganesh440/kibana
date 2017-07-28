define(function (require) {
  var _ = require('lodash');

  var app = require('ui/modules').get('app/report');

  app.directive('reportDetails', function ($compile, Notifier) {
    return {
      restrict: 'E',
      require: '^reportApp', // must inherit from the reportApp
      link: function ($scope, $el) {
        var notify = new Notifier();

        function init() {

            var section_id = 2;
            _.forEach($scope.sections, function(section) {
                // Create a section div with proper style
                var $sectiondiv = $("<h3 style='text-align: center;color:#01b5d5 !important;padding-top:12px;'>" + section_id + '. ' + section.id + "</h3> <p style='font-size:14px;white-space: pre-wrap;'>" + section.description + "</p> <div class='page-break'></div>");
                $sectiondiv.appendTo($el);
                var vis_id = 1;
                _.forEach(section.visuals, function(vis) {
                    // Create a pagebreak div - We need to create a new one for
                    // each visual..
                    var $pagebreakdiv = $("<div class='page-break'></div>");

                    // Create a new scope and populate it
                    vis.$scope = $scope.$new();
                    vis.$scope.panel = vis;
                    vis.$scope.panel_id = section_id + '.' + vis_id;
                    vis.$scope.parentUiState = $scope.uiState;

                    var $visdiv = $compile("<report-panel>")(vis.$scope);
                    $visdiv.appendTo($el);

                    // Append the pagebreak div
                    $pagebreakdiv.appendTo($el);
                    vis_id = vis_id + 1;
                });
                section_id = section_id + 1;
            });
        }

        init();
      }
    };
  });

});
