define(function (require) {
  const _ = require('lodash');

  require('plugins/kibana/visualize/saved_visualizations/saved_visualizations');
  require('ui/directives/saved_object_finder');
  require('plugins/kibana/discover/saved_searches/saved_searches');

  const templateStep = function (num, txt) {
    return '<div ng-controller="VisualizeWizardStep' + num + '" class="container vis-wizard">' + txt + '</div>';
  };

  const module = require('ui/modules').get('app/visualize', ['kibana/courier']);
  const routes = require('ui/routes');

  /********
  /** Wizard Step 1
  /********/
  routes.when('/visualize/step/1', {
    template: templateStep(1, require('plugins/kibana/visualize/wizard/step_1.html'))
  });

  module.controller('VisualizeWizardStep1', function ($scope, $route, $location, timefilter, Private) {
    timefilter.enabled = false;

    $scope.visTypes = Private(require('ui/registry/vis_types'));
    // Preparing a list of lists so as to display the different 
    //visualization types in a grid layout.
    $scope.primary_visTypes = []; // A global list which will contain the sublists.
    var sub_visTypes=[]; // sublist that will be appended to global list.    
    for(i=0;i<$scope.visTypes.length;i++)
    {
       sub_visTypes.push($scope.visTypes[i]);
       if( (i+1) % 5 == 0)
       {
          $scope.primary_visTypes.push(sub_visTypes);
          sub_visTypes = [];
       }
    }

    // This code takes care of visualization types which are left out from the
    // above for loop, as we print maximum 5 visualization type in a row, the
    // code uses 5
    if($scope.visTypes.length % 5 != 0) {
        $scope.primary_visTypes.push(sub_visTypes);
    }

    $scope.visTypeUrl = function (visType) {
      if (!visType.requiresSearch) return '#/visualize/create?type=' + encodeURIComponent(visType.name);
      else return '#/visualize/step/2?type=' + encodeURIComponent(visType.name);
    };
  });

  /********
  /** Wizard Step 2
  /********/
  routes.when('/visualize/step/2', {
    template: templateStep(2, require('plugins/kibana/visualize/wizard/step_2.html')),
    resolve: {
      indexPatternIds: function (courier) {
        return courier.indexPatterns.getIds();
      }
    }
  });

  module.controller('VisualizeWizardStep2', function ($route, $scope, $location, timefilter, kbnUrl) {
    const type = $route.current.params.type;

    $scope.step2WithSearchUrl = function (hit) {
      return kbnUrl.eval('#/visualize/create?&type={{type}}&savedSearchId={{id}}', {type: type, id: hit.id});
    };

    timefilter.enabled = false;

    $scope.indexPattern = {
      selection: null,
      list: $route.current.locals.indexPatternIds
    };

    $scope.$watch('stepTwoMode', function (mode) {
      if (mode === 'new') {
        if ($scope.indexPattern.list && $scope.indexPattern.list.length === 1) {
          $scope.indexPattern.selection = $scope.indexPattern.list[0];
        }
      }
    });

    $scope.$watch('indexPattern.selection', function (pattern) {
      if (!pattern) return;
      kbnUrl.change('/visualize/create?type={{type}}&indexPattern={{pattern}}', {type: type, pattern: pattern});
    });
  });
});
