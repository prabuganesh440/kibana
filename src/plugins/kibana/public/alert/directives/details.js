define(function (require) {
  var _ = require('lodash');
  var $ = require('jquery');

  require('ui/courier');
  require('bootstrap-timepicker');
  require('ui/directives/email_validator.js');

  var app = require('ui/modules').get('app/alert', [
    'kibana/courier'
    ]);

  app.directive('alertDetails', function ($compile, courier, Notifier, $filter) {
    return {
      restrict: 'E',
      require: '^alertApp', // must inherit from the alertApp
      template: require('plugins/kibana/alert/directives/details.html'),
      link: function ($scope) {

        //This will set the indexFields with the fields according to the data source selected.
        //It also takes care of grouping the fields according to their types.
        $scope.setIndexPattern = function(rule,$index) {
            courier.indexPatterns.get(rule.selectedIndex).then(function(current_index) {
            var fields = current_index.fields.raw;
            fields = $filter('filter')(fields, { bucketable: true });
            $scope.operRuleList[$index].indexFields = fields.slice(0)
          })
        }

        // Takes care of showing the rule_type related fields when rule_type is selected.
        // Example hide the target field when count is selected.
        // metricIsSelected : To show / hide the threshold conditions
        // and alert duration

        // sumOrAverageIsSelected : To show the target field names where ever
        // necessary

        // targetFieldInvisibility : To show / hide target field

        // countIsSelected : To display text 'events' wherever necessary.

        // stateChangeIsSelected : Hide the threshold conditions and display
        // relevant text
        $scope.updateRuleType = function(rule, $index) {
            $scope.operRuleList[$index].metricIsSelected = false;
            $scope.operRuleList[$index].stateChangeIsSelected = false;
            $scope.operRuleList[$index].sumOrAverageIsSelected = false;
            $scope.operRuleList[$index].targetFieldInvisibility = false;
            $scope.operRuleList[$index].countIsSelected = false;
            $scope.operRuleList[$index].groupByField = [{data:''}];

            if(rule.rule_type == 'sum' || rule.rule_type == 'average')
            {
                $scope.operRuleList[$index].metricIsSelected = true;
                $scope.operRuleList[$index].sumOrAverageIsSelected = true;
            }
            else if(rule.rule_type == 'count')
            {
                $scope.operRuleList[$index].selectedField = undefined;
                $scope.operRuleList[$index].metricIsSelected = true;
                $scope.operRuleList[$index].targetFieldInvisibility = true;
                $scope.operRuleList[$index].countIsSelected = true;
            }
            else if(rule.rule_type == 'unique_values')
            {
                $scope.operRuleList[$index].metricIsSelected = true;
            }
            else if(rule.rule_type == 'state_change')
            {
                $scope.operRuleList[$index].stateChangeIsSelected = true;
                $scope.operRuleList[$index].metricIsSelected = false;
                rule.compare_value = 0;
                rule.rule_type_duration = 1;
            }
        }

        // to add a group by field
        $scope.addNewGroupByField = function($index) {
            // we need a list of group by fields in this format
            // ['field1', 'field2', field3']
            // To achive this we are initialising dataObj to {data:''}
            // every time this function is called so that we can push the
            // user selected field object into the list.
            // Please note this is run inside a ng-repeat for group by fields
            // in details.html, where the 'data' is populated with the value
            // selected by the user in the front end.
            var dataObj = {data:''};
            $scope.operRuleList[$index].groupByField.push(dataObj);
        };
        
        // To delete a group by field
        $scope.removeGroupByField = function(parent_index, index) {
            $scope.operRuleList[parent_index].groupByField.splice(index,1);
        };
        
        // This function will reset the threshold fields when the 
        // checkbox to enable rule level threshold is changed.
        $scope.resetFieldsOnRuleLevelSelection = function() {
          if($scope.ruleLevelThreshold == false)
          {
            // when the rule level threshold is disabled
            // reset the threshold fields used along with
            // the eval criteria
            if($scope.eval_criteria)
            {
              $scope.eval_criteria.compare_type = "";
              $scope.eval_criteria.compare_value = "";
            }

            // When ruleLevelThreshold is not enabled, The
            // threshold fields for each rule should always 
            // be displayed
            _.each($scope.ruleList, function(rule, index) {
              rule.enableComparisionFields = true;
            });
          }
          else {
            // When ruleLevelThreshold is enabled, The
            // threshold fields for each rule should always 
            // be hidden initially
            _.each($scope.ruleList, function(rule, index) {
              rule.enableComparisionFields = false;
            });
          }
        }

        // reset the comparision fields
        $scope.resetComparisionFields = function(rule) {
              rule.compare_type = '';
              rule.compare_value = '';
        }

        // To add a rule
        $scope.addNewRule = function() {
            var new_rule_obj = {
                              'selectedIndex':'',
                              'rule_type':'',
                              'selectedField':'',
                              'compare_type':'',
                              'compare_value':'',
                              'rule_type_duration':1,
                              'rule_type_duration_type':'',
                              'groupByField':[],
                              'alert_filter':'',
                              'enableComparisionFields':false,
                          }
            $scope.ruleList.push(new_rule_obj);
            $scope.operRuleList.push({  'indexFields': [],
                                        'metricIsSelected': false,
                                        'stateChangeIsSelected':false,
                                        'sumOrAverageIsSelected': false,
                                        'countIsSelected': false,
                                        'targetFieldInvisibility': false,
                                        'selectedField':undefined,
                                        'groupByField':[{data:''}],
                      });
        };

        // To delete a rule
        $scope.removeRule = function($index) {
            $scope.ruleList.splice($index,1);
            $scope.operRuleList.splice($index,1);
        };

        //Time picker start time and end time in Active alert time section
        $('#alert-timepicker1').timepicker({
            minuteStep: 1,
            template: 'modal',
            appendWidgetTo: 'body',
            showSeconds: true,
            showMeridian: false,
            defaultTime: false
        });

        $('#alert-timepicker2').timepicker({
            minuteStep: 1,
            template: 'modal',
            appendWidgetTo: 'body',
            showSeconds: true,
            showMeridian: false,
            defaultTime: false
        });

        //Check for atleast one alert channel is selected.
        //It makes sure either Alert By UI or Alert by email is selected.
        $scope.isAlertActivated = function() {
            return ($scope.alertByUI || $scope.alertByEmail)
        }

        // Check for atleast one day in the week is selected
        $scope.isAlertEnabledForADay = function() {
            return ($scope.alertOnMonday || $scope.alertOnTuesday ||
                    $scope.alertOnWednesday || $scope.alertOnThursday ||
                    $scope.alertOnFriday || $scope.alertOnSaturday ||
                    $scope.alertOnSunday )
        }
      }
    };
  });

});
