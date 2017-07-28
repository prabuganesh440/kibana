define(function (require) {
  const _ = require('lodash');

  require('ui/modules').get('kibana/matrix_vis')
  .directive('matrixVisParams', function () {
    return {
      restrict: 'E',
      template: require('plugins/matrix_vis/matrix_vis_params.html'),
      link: function ($scope) {

        $scope.$watch('vis.aggs[0].type.title', function() {
            $scope.metricTypeSelected = $scope.vis.aggs[0].type.title;
        });

        function validate(colorSchema) {
          const { min, max, color } = $scope;
          $scope.minError = min || (min === 0) ? '' :  'Min is required.';
          $scope.maxError = max || (max === 0) ? '' : 'Max is required.';
          $scope.colorError = color ? '' : 'Color is required.';
          if (color) {
            if (!/(^#[0-9a-fA-F]{6}$)|(^#[0-9a-fA-F]{3}$)/i.test(color)) {
              $scope.colorError = 'Color should be valid hexadecimal color representation.';
            }
          }

          if (!$scope.minError && !$scope.maxError) {
            if (max < min) {
              $scope.maxError = 'Max should be greater than min.';
            }
            const noOverlap = colorSchema.every(colorRange => {
              const lmin = colorRange.min;
              const lmax = colorRange.max;
              if ((min >= lmin) && (min <= lmax)) {
                return false;
              }
              if ((max >= lmin) && (max <= lmax)) {
                return false;
              }
              if ((min < lmin) && (max > lmax)) {
                return false;
              }
              return true;
            });
            if (!noOverlap) {
              $scope.maxError = 'The range specified overlaps with another range.';
            }
          }
        }

        $scope.addRange = function () {
          const params = $scope.vis.params;
          validate(params.colorSchema);
          if (!$scope.minError && !$scope.maxError && !$scope.colorError) {
            const { min, max, color } = $scope;
            params.colorSchema.push({
              min,
              max,
              color
            });
          }
        };

        $scope.editRange = function (color) {
          const params = $scope.vis.params;
          const index = params.colorSchema.findIndex(cs => cs.color === color);
          if (index !== -1) {
            const colorRange = params.colorSchema[index];
            $scope.editIndex = index;
            $scope.min = colorRange.min;
            $scope.max = colorRange.max;
            $scope.color = colorRange.color;
            $scope.minError = '';
            $scope.maxError = '';
            $scope.colorError = '';
          }
        };

        $scope.updateRange = function () {
          const { min, max, color, editIndex } = $scope;
          const params = $scope.vis.params;
          const colorSchema = params.colorSchema.slice();
          colorSchema.splice(editIndex, 1);
          validate(colorSchema);
          if (!$scope.minError && !$scope.maxError && !$scope.colorError) {
            params.colorSchema[editIndex] = {
              min,
              max,
              color
            };
            $scope.editIndex = -1;
          }
        };

        $scope.cancelEdit = function (color) {
          $scope.editIndex = -1;
          $scope.min = '';
          $scope.max = '';
          $scope.color = '';
          $scope.minError = '';
          $scope.maxError = '';
          $scope.colorError = '';
        };

        $scope.deleteRange = function (color) {
          const option = confirm('Are you sure you want to delete?');
          if (option) {
            const params = $scope.vis.params;
            const index = params.colorSchema.findIndex(cs => cs.color === color);
            if (index !== -1) {
              params.colorSchema.splice(index, 1);
            }
          }
        };
      }
    };
  });
});
