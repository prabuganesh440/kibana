define(function (require) {

  var module = require('ui/modules').get('kibana/uvmap_vis', ['kibana']);
  module.controller('UVMapVisParamsController', function ($scope, $rootScope) {
    $scope.vis.params.expression = $scope.vis.params.expression || '.es(*)';
    $scope.vis.params.connection = $scope.vis.params.connection || '';
    $scope.search = function () {
      $rootScope.$broadcast('courier:searchRefresh');
    };
  });
});
