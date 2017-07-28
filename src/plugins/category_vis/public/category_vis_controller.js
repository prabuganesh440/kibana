define(function (require) {

  var module = require('ui/modules').get('kibana/category_vis', ['kibana']);
  module.controller('KbnCategoryVisController', function ($scope) {
    $scope.show_dashboards = false;
    $scope.dashboards = [];

    $scope.$watch('vis.params', function (resp) {
        if ( resp.dashboards.length != 0 ) {
            // $scope.dashboards = resp.dashboards.split('\n');
            $scope.dashboards = resp.dashboards;
        }
        $scope.category_image = '/vienna_images/' + resp.image;
    });

    // Add a href statement to the dashboard name to make it a link
    $scope.getDashboardHref = function(name) {
        var dash_id = name.replace(/ /g, '-');
        return '#/dashboard/' + dash_id;
    };

    // This code is at two places.. one for the visualization and one for the
    // dashboard panel. Look for it in
    // src/plugins/kibana/public/dashboard/components/panel/panel.js
    // src/plugins/kibana/public/visualize/editor/editor.js
    $scope.getCategoryStyle = function(theme) {
        if (theme === 'Blue-Ink-Color' ) {
             return {'background-color': '#2C144A'}
        } else if ( theme === 'Green-Blue-Color') {
             return {'background-color': '#0e5c5c'}
        } else if ( theme === 'Voilet-Color') {
             return {'background-color': '#641A83'}
        } else if ( theme === 'Blue-Grey-Color') {
             return {'background-color': '#34495e'}
        } else {
             return {'background-color': '#34495e'}
        }
    };

    // Show dashboards which are behind the category description
    $scope.toggleDisplayDashboards = function(theme) {
        $scope.show_dashboards = !$scope.show_dashboards;
    }

  });
});
