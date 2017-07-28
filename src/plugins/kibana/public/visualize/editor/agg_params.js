define(function (require) {
  const IndexedArray = require('ui/IndexedArray');

  require('ui/modules')
  .get('app/visualize')
  .directive('visEditorAggParams', function ($compile, $parse, Private, Notifier, $filter) {
    const _ = require('lodash');
    const $ = require('jquery');
    const aggTypes = Private(require('ui/agg_types/index'));
    const aggSelectHtml = require('plugins/kibana/visualize/editor/agg_select.html');
    const advancedToggleHtml = require('plugins/kibana/visualize/editor/advanced_toggle.html');
    const pipelineAggToggleHtml = require('plugins/kibana/visualize/editor/pipeline_agg_toggle.html');
    require('ui/filters/match_any');
    require('plugins/kibana/visualize/editor/agg_param');

    const notify = new Notifier({
      location: 'visAggGroup'
    });

    return {
      restrict: 'E',
      template: require('plugins/kibana/visualize/editor/agg_params.html'),
      scope: true,
      link: function ($scope, $el, attr) {
        $scope.$bind('agg', attr.agg);
        $scope.$bind('groupName', attr.groupName);

        $scope.aggTypeOptions = aggTypes.byType[$scope.groupName];
        $scope.advancedToggled = false;
        $scope.pipelineAggToggled = false;

        // this will contain the controls for the schema (rows or columns?), which are unrelated to
        // controls for the agg, which is why they are first
        const $schemaEditor = $('<div>').addClass('schemaEditors').appendTo($el);

        if ($scope.agg.schema.editor) {
          $schemaEditor.append($scope.agg.schema.editor);
          $compile($schemaEditor)($scope.$new());
        }

        // allow selection of an aggregation
        const $aggSelect = $(aggSelectHtml).appendTo($el);
        $compile($aggSelect)($scope);

        // params for the selected agg, these are rebuilt every time the agg in $aggSelect changes
        let $aggParamEditors; //  container for agg type param editors
        let $aggParamEditorsScope;
        $scope.$watch('agg.type', function updateAggParamEditor(newType, oldType) {
          if ($aggParamEditors) {
            $aggParamEditors.remove();
            $aggParamEditors = null;
          }

          // if there's an old scope, destroy it
          if ($aggParamEditorsScope) {
            $aggParamEditorsScope.$destroy();
            $aggParamEditorsScope = null;
          }

          // create child scope, used in the editors
          $aggParamEditorsScope = $scope.$new();

          const agg = $scope.agg;
          if (!agg) return;

          const type = $scope.agg.type;

          if (newType !== oldType) {
            // don't reset on initial load, the
            // saved params should persist
            agg.resetParams();
          }

          if (!type) return;

          const aggParamHTML = {
            basic: [],
            advanced: [],
            pipeline_agg: []
          };

          // build collection of agg params html
          type.params.forEach(function (param, i) {
            let aggParam;
            // if field param exists, compute allowed fields
            if (param.name === 'field') {
              $aggParamEditorsScope.indexedFields = getIndexedFields(param);
            }

            if ($aggParamEditorsScope.indexedFields) {
              const hasIndexedFields = $aggParamEditorsScope.indexedFields.length > 0;
              const isExtraParam = i > 0;
              if (!hasIndexedFields && isExtraParam) { // don't draw the rest of the options if their are no indexed fields.
                return;
              }
            }

            let type = 'basic';
            if (param.advanced) type = 'advanced';
            if (param.pipeline_agg) type = 'pipeline_agg';

            if (aggParam = getAggParamHTML(param, i)) {
              aggParamHTML[type].push(aggParam);
            }
          });

          // The following code in the box is placed in this file
          // as to access $scope for pipeline agg validations
          //------------------------------------------------------

          // Hiding the set of fields which are not applicable
          // when moving average is not selected
          $scope.isSelectedMovingAverage = false;

          // display the set of fields which are applicable
          // when moving average is selected.This code is needed to 
          // handle the load visualization.
          if(_.has($scope.agg.params,'pipeline_aggs'))
          {
              if($scope.agg.params.pipeline_aggs.type == 'Moving Average')
              {
                  // show the div containing the necessary fields for 
                  // moving avergages
                  $scope.isSelectedMovingAverage = true;
              }
          }

          // This function is called when 'type' is
          // changed under pipeline aggregations.
          $scope.updatePipelineAgg = function() {
              if(_.has($scope.agg.params,'pipeline_aggs'))
              {
                  // removing the pipeline aggregation
                  // from agg.params when the 'type' is empty.
                  if($scope.agg.params.pipeline_aggs.type == '')
                  {
                      delete $scope.agg.params["pipeline_aggs"];
                      $scope.isSelectedMovingAverage = false;
                  }
                  // setting the default values when pipeline aggregation type
                  // 'moving average' is selected
                  else if($scope.agg.params.pipeline_aggs.type == 'Moving Average')
                  {
                    $scope.agg.params.pipeline_aggs.model = 'simple';
                    $scope.agg.params.pipeline_aggs.gap_policy = 'insert zero';
                    $scope.agg.params.pipeline_aggs.window = '5';
                    $scope.agg.params.pipeline_aggs.minimize = 'false'
                    // show the div containing the necessary fields for 
                    // moving avergages
                    $scope.isSelectedMovingAverage = true;
                  }
              }
          }

          //------------------------------------------------------------

          // compile the paramEditors html elements
          let paramEditors = aggParamHTML.basic;
          // check if pipelining is allowed on a particular
          // type of visualization
           if(agg.vis.type.add_pipeline_aggregation)
          {
              // Pipelining is enabled only for the metrics : sum and average
              if(type.name == 'sum' || type.name == 'avg')
              {
                  if (aggParamHTML.pipeline_agg.length) {
                  paramEditors.push($(pipelineAggToggleHtml).get(0));
                  paramEditors = paramEditors.concat(aggParamHTML.pipeline_agg);
                  }
              }
          }
          if (aggParamHTML.advanced.length) {
            paramEditors.push($(advancedToggleHtml).get(0));
            paramEditors = paramEditors.concat(aggParamHTML.advanced);
          }

          $aggParamEditors = $(paramEditors).appendTo($el);
          $compile($aggParamEditors)($aggParamEditorsScope);
        });

        // build HTML editor given an aggParam and index
        function getAggParamHTML(param, idx) {
          // don't show params without an editor
          if (!param.editor) {
            return;
          }

          const attrs = {
            'agg-param': 'agg.type.params[' + idx + ']'
          };

          if (param.advanced) {
            attrs['ng-show'] = 'advancedToggled';
          }

           if (param.pipeline_agg) {
            attrs['ng-show'] = 'pipelineAggToggled';
          }

          return $('<vis-agg-param-editor>')
          .attr(attrs)
          .append(param.editor)
          .get(0);
        }

        function getIndexedFields(param) {
          let fields = $scope.agg.vis.indexPattern.fields.raw;
          const fieldTypes = param.filterFieldTypes;

          if (fieldTypes) {
            fields = $filter('fieldType')(fields, fieldTypes);
            fields = $filter('filter')(fields, { bucketable: true });
            fields = $filter('orderBy')(fields, ['type', 'name']);
          }

          return new IndexedArray({

            /**
             * @type {Array}
             */
            index: ['name'],

            /**
             * [group description]
             * @type {Array}
             */
            initialSet: fields
          });
        }
      }
    };
  });
});