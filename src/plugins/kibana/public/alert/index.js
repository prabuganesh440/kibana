define(function (require) {
  var _ = require('lodash');
  var $ = require('jquery');
  var ConfigTemplate = require('ui/ConfigTemplate');
  var chrome = require('ui/chrome');
  const lup = require('plugins/kibana/log_user_operation');

  require('ui/directives/config');
  require('ui/courier');
  require('ui/config');
  require('ui/notify');
  require('ui/typeahead');

  require('plugins/kibana/alert/directives/details');
  require('plugins/kibana/alert/services/saved_alerts');
  require('plugins/kibana/alert/styles/main.less');
  require('ui/directives/rbac_user_role');

  require('ui/saved_objects/saved_object_registry').register(require('plugins/kibana/alert/services/saved_alert_register'));

  var app = require('ui/modules').get('app/alert', [
    'elasticsearch',
    'ngRoute',
    'kibana/courier',
    'kibana/config',
    'kibana/notify',
    'kibana/typeahead'
  ]);

  require('ui/routes')
  .when('/alert', {
    template: require('plugins/kibana/alert/index.html'),
    resolve: {
      indexPatternIds: function (courier) {
          return courier.indexPatterns.getIds();
      },
      list_alert: function(){return false},
      alertcfg: function (savedAlerts, config) {
         return savedAlerts.get();
      },
      // This flag indicates if new alert is being
      // created.
      is_new_alert: function () {
        return true;
      }
    }
  })
  .when('/alert/Home', {
    template: require('plugins/kibana/alert/index.html'),
    resolve: {
      list_alert: function(){return true},
      alertcfg: function (savedAlerts, config) {
         return savedAlerts.get();
      },
      is_new_alert: function () {
        return false;
      }
    }
  })
  .when('/alert/:id', {
    template: require('plugins/kibana/alert/index.html'),
    resolve: {
      list_alert: function(){return false},
      indexPatternIds: function (courier) {
          return courier.indexPatterns.getIds();
      },
      alertcfg: function (savedAlerts, Notifier, $route, $location, courier, $http) {
        lup.logUserOperation($http, 'GET','alert', $route.current.params.id);
        return savedAlerts.get($route.current.params.id)
        .catch(courier.redirectWhenMissing({
          'alert' : '/alert/Home'
        }))
        .catch(courier.redirectWhenNotAllowed({
          'alert' : '/alert/Home'
        }));
      },
      is_new_alert: function () {
        return false;
      },
      loaded_alert_id: function($route) {
        return $route.current.params.id;
      }
    }
  });

  app.directive('alertApp', function (Notifier, courier, AppState, timefilter, kbnUrl) {
    return {
      controller: function ($scope, $rootScope, $route, $routeParams, $location, Private, getAppState, savedAlerts, $filter, $http) {
        var queryFilter = Private(require('ui/filter_bar/query_filter'));
        var notify = new Notifier({
          location: 'Alert'
        });
        var alertcfg = $scope.alertcfg = $route.current.locals.alertcfg;
        var is_new_alert = $route.current.locals.is_new_alert;
        var loaded_alert_id = $route.current.locals.loaded_alert_id;
        var indexPatternIds = $scope.indexPatternIds = $route.current.locals.indexPatternIds;
        var list_alert = $scope.list_alert = $route.current.locals.list_alert;
        // Populate allowedRoles from alertcfg 
        var allowedRoles = alertcfg.allowedRolesJSON ? JSON.parse(alertcfg.allowedRolesJSON) : [];

        // Get the RBAC stuff here...
        // Set whether the current logged in user be allowed to create a new
        // object or not
        $scope.creation_allowed = false;
        if ( chrome.canCurrentUserCreateObject() ) {
            $scope.creation_allowed = true;
        }

        // For an admin used, we always show modify permissions during save..
        var user_role_can_modify = false;
        if ( chrome.isCurrentUserAdmin() ) {
            user_role_can_modify = true;
        } else {
            // Set a flag whether the current user's role can modify this object
            user_role_can_modify = chrome.canCurrentUserModifyPermissions(allowedRoles);
        }

        if(alertcfg.ruleList.length)
        {
            // prepare $scope.ruleList and $scope.operRuleList iterating over the object
            // created from backend and populate these fields in the front end.
            $scope.ruleList = [];
            $scope.operRuleList = [];
            var default_rule_obj = {
                              'selectedIndex':'',
                              'rule_type':'',
                              'selectedField':'',
                              'compare_type':'',
                              'compare_value':0,
                              'rule_type_duration':1,
                              'rule_type_duration_type':'',
                              'groupByField':[],
                              'alert_filter':'',
                              'enableComparisionFields':false,
                          }

            var default_oper_rule_obj = {
                                    'indexFields': [],
                                    'metricIsSelected': false,
                                    'sumOrAverageIsSelected': false,
                                    'countIsSelected': false,
                                    'targetFieldInvisibility': false,
                                    'stateChangeIsSelected': false,
                                    'selectedField':undefined,
                                    'groupByField':[],
                          }

            _.each(alertcfg.ruleList, function(alertcfg_rule, index) {
                // we are using _.clonedeep so that the groupbyField under
                // new_oper_rule_obj is not updated in each iteration.
                var new_rule_obj = _.cloneDeep(default_rule_obj);
                var new_oper_rule_obj = _.cloneDeep(default_oper_rule_obj);

                // These conditions are added here so as to handle load operations of
                // alert. Any changes added here needs to be added under details.js too
                if(alertcfg_rule.rule_type == 'count')
                {
                    new_oper_rule_obj.metricIsSelected = true;
                    new_oper_rule_obj.targetFieldInvisibility = true;
                    new_oper_rule_obj.countIsSelected = true;
                    alertcfg_rule.selectedField = '';
                }
                else if (alertcfg_rule.rule_type == 'sum'|| alertcfg_rule.rule_type == 'average' )
                {
                    new_oper_rule_obj.metricIsSelected = true;
                    new_oper_rule_obj.sumOrAverageIsSelected = true;
                }
                else if(alertcfg_rule.rule_type == 'unique_values')
                {
                    new_oper_rule_obj.metricIsSelected = true;
                }
                else if(alertcfg_rule.rule_type == 'state_change')
                {
                    new_oper_rule_obj.stateChangeIsSelected = true;
                    new_oper_rule_obj.metricIsSelected = false;
                    alertcfg_rule.compare_value = 0;
                    alertcfg_rule.rule_type_duration = 1;
                }
                new_rule_obj.rule_type = alertcfg_rule.rule_type;
                new_rule_obj.selectedIndex = alertcfg_rule.selectedIndex;
                new_rule_obj.enableComparisionFields = alertcfg_rule.enableComparisionFields;
                new_rule_obj.compare_type = alertcfg_rule.compare_type;
                new_rule_obj.compare_value = alertcfg_rule.compare_value;
                new_rule_obj.rule_type_duration = alertcfg_rule.rule_type_duration;
                new_rule_obj.rule_type_duration_type = alertcfg_rule.rule_type_duration_type;
                new_rule_obj.alert_filter = alertcfg_rule.alert_filter;
                //The following code takes care of populating the 'groupByField'
                // and 'selectedField' form when any alert is loaded
                if ( new_rule_obj.selectedIndex != '' ) {
                    courier.indexPatterns.get(new_rule_obj.selectedIndex).then(function(current_index) {
                        var fields = current_index.fields.raw
                        fields = $filter('filter')(fields, { bucketable: true });
                        new_oper_rule_obj.indexFields = fields.slice(0);
                        _.each(new_oper_rule_obj.indexFields, function(field) {
                            if(alertcfg_rule.selectedField) {
                                if (alertcfg_rule.selectedField === field.name) {
                                    new_oper_rule_obj.selectedField = field;
                                }
                            }
                        });

                        // The indexfields is moved as a inner loop to maintain
                        // the order of the fields under groupByField list.
                        if(alertcfg_rule.groupByField.length)
                        {
                            _.each(alertcfg_rule.groupByField, function(grp_by_field) {
                                _.each(new_oper_rule_obj.indexFields, function(field) {
                                    if(grp_by_field === field.name)
                                    {
                                        var dataObj = {data:field};
                                        new_oper_rule_obj.groupByField.push(dataObj);
                                    }
                                });
                            });
                        }
                        // Adding the default object data to groupByField under
                        // new_oper_rule_obj to display an empty selectbox in the
                        // front end when no groupby field is selected for this rule.
                        else
                        {
                            new_oper_rule_obj.groupByField.push({data:''});
                        }
                        // Using return will not help here ,
                        // As _each will continue to execute without breaking at any point

                    $scope.ruleList.push(new_rule_obj);
                    $scope.operRuleList.push(new_oper_rule_obj);
                    })
                }
            });
            $scope.severity = alertcfg.severity;
            $scope.summary = alertcfg.summary;
            $scope.description = alertcfg.description;
            $scope.enable_throttle = alertcfg.enable_throttle;
            $scope.throttle_duration_type = alertcfg.throttle_duration_type;
            $scope.throttle_duration = alertcfg.throttle_duration;
            $scope.alertByUI = alertcfg.alertByUI;
            $scope.alertByEmail = alertcfg.alertByEmail;
            $scope.alertEmailId = alertcfg.alertEmailId;
            $scope.active_start_time = alertcfg.active_start_time;
            $scope.active_end_time = alertcfg.active_end_time;
            $scope.enable_alert = alertcfg.enable_alert;
            $scope.active_alert_check = alertcfg.active_alert_check
            $scope.weekdays = alertcfg.weekdays;
            $scope.ruleLevelThreshold = alertcfg.ruleLevelThreshold;
            $scope.eval_criteria = JSON.parse(alertcfg.eval_criteria);

            $scope.$on('$destroy', alertcfg.destroy);
        }
        else
        {
            $scope.ruleList = [ { 'selectedIndex':'',
                          'rule_type':'',
                          'selectedField':'',
                          'compare_type':'',
                          'compare_value':'',
                          'rule_type_duration':1,
                          'rule_type_duration_type':'',
                          'groupByField':[],
                          'alert_filter':'',
                          'enableComparisionFields':false,
                      }];

            $scope.operRuleList = [ { 'indexFields': [],
                                    'metricIsSelected': true,
                                    'sumOrAverageIsSelected': false,
                                    'countIsSelected': false,
                                    'targetFieldInvisibility': false,
                                    'stateChangeIsSelected': false,
                                    'selectedField': undefined,
                                    'groupByField':[{data:''}],
                      }];

            //hide the operational buttons for alert on loading the alert page.
            $scope.show_toolbar = false;

            // set the enable alert checkbox to true by default
            $scope.enable_alert = true;

            // Setting the default time for alert active time
            $scope.active_start_time = "00:00:00";
            $scope.active_end_time = "23:59:59";

            $scope.weekdays = [
                  { name: 'Monday', selected: true },
                  { name: 'Tuesday', selected: true },
                  { name: 'Wednesday', selected: true },
                  { name: 'Thursday', selected: true },
                  { name: 'Friday', selected: true },
                  { name: 'Saturday', selected: true },
                  { name: 'Sunday', selected: true },
                ];
        }

        // Show the alert operational butttons on clicking the show toolbar button
        $scope.toggleToolbar = function(value) {
            $scope.show_toolbar = !$scope.show_toolbar;
        }

        var stateDefaults = {
          title: alertcfg.title,
        };

        var $state = $scope.state = new AppState(stateDefaults);

        //calling the save function to save the alert details filled in the alert cfg form
        $scope.save = function () {
            $state.title = alertcfg.id = alertcfg.title;
            if (alertcfg.title == 'Home') {
                // We can't allow anyone to save a Home alert so inform the user
                // about it
                //
                // There is some problem here... when we return first time,
                // things work fine but if a user press save with 'Home' again,
                // we end up throwing an error.. Can't find where the error is
                // coming from... need to look at this later..
                alert("You cannot create an alert with name 'Home'. Please use a different name");
                return;
            }
            $state.save();
            alertcfg.allowedRolesJSON = angular.toJson($scope.opts.allowedRoles);

            Number.prototype.padLeft = function(base,chr) {
               var  len = (String(base || 10).length - String(this).length)+1;
               return len > 0? new Array(len).join(chr || '0')+this : this;
            }
   
            dateObj = new Date();
            var month = (dateObj.getMonth() + 1).padLeft(); //months from 1-12
            var day = dateObj.getDate().padLeft();
            var year = dateObj.getFullYear().padLeft();
            var hour = dateObj.getHours().padLeft();
            var minute = dateObj.getMinutes().padLeft();
            var second = dateObj.getSeconds().padLeft();
            alert_timestamp = year + "/" + month + "/" + day + " " + hour + ":" + minute + ":" + second;
            alertcfg.last_modified_time = alert_timestamp;
            alertcfg.severity = $scope.severity;
            alertcfg.summary = $scope.summary;
            alertcfg.description = $scope.description;
            alertcfg.enable_throttle = $scope.enable_throttle;
            alertcfg.throttle_duration_type = $scope.throttle_duration_type;
            alertcfg.throttle_duration = $scope.throttle_duration;
            alertcfg.alertByUI = $scope.alertByUI;
            alertcfg.alertByEmail = $scope.alertByEmail;
            alertcfg.alertEmailId = $scope.alertEmailId;
            alertcfg.ruleLevelThreshold = $scope.ruleLevelThreshold;
            alertcfg.eval_criteria = angular.toJson($scope.eval_criteria);
            _.each($scope.operRuleList, function(oper_rule, index) {
                if(oper_rule.selectedField)
                {
                  $scope.ruleList[index].selectedField = oper_rule.selectedField.displayName;
                }
                else
                {
                  $scope.ruleList[index].selectedField = '';
                }
                // setting the groupByField of this rule to empty
                // and fetching the group by fields set in the operRuleList
                $scope.ruleList[index].groupByField = [];
                _.each(oper_rule.groupByField, function(field) {
                    if(oper_rule.groupByField.length == 1 && field.data == null)
                    {
                      oper_rule.groupByField = [{data:''}];
                    }
                    else if(field.data != '')
                    {
                      $scope.ruleList[index].groupByField.push(field.data.displayName);
                    }
                });
            });
            alertcfg.ruleList = $scope.ruleList;
            alertcfg.active_start_time = $scope.active_start_time;
            alertcfg.active_end_time = $scope.active_end_time;
            alertcfg.enable_alert = $scope.enable_alert;
            alertcfg.active_alert_check = $scope.active_alert_check;
            alertcfg.weekdays = $scope.weekdays;
            // if an alert is loaded and saved as another
            // alert, It is a new alert. Hence set the flag to true.
            if( loaded_alert_id !== alertcfg.id )
            {
              is_new_alert = true;
            }
            alertcfg.save(is_new_alert).then(function (id) {
                $scope.configTemplate.close('save');
                if (id) {
                        // making a post call to vusmartmaps with 'alert_id' and 
                        // 'action' (save/modify alert). This information will be 
                        // used to generate alerts.
                        var modify_alert = $http({
                            method: 'POST',
                            url: '/vuSmartMaps/api/alert_status/',
                            data: {'alert_id': id, 'alert_title': alertcfg.title,  'action':'modify' },
                            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                        }).success(function (data, status, headers, config) {
                        }).error(function (data, status, headers, config) {
                            notify.error('Failed to notify for the alert change')
                        });
                    if (alertcfg.id !== $routeParams.id) {
                        kbnUrl.change('/alert/{{id}}', {id: alertcfg.id});
                    }
                lup.logUserOperation($http, 'POST','alert', id);
                }
            })
            .catch(notify.fatal);
        }

        $scope.configTemplate = new ConfigTemplate({
          save: require('plugins/kibana/alert/partials/save_alert.html'),
          load: require('plugins/kibana/alert/partials/load_alert.html'),
        });

        function init() {
          var docTitle = Private(require('ui/doc_title'));
          if (alertcfg.id) {
            docTitle.change(alertcfg.title);
          }
          $scope.$emit('application.load');
        }

        function setDarkTheme(enabled) {
          var theme = Boolean(enabled) ? 'theme-dark' : 'theme-light';
          chrome.removeApplicationClass(['theme-dark', 'theme-light']);
          chrome.addApplicationClass(theme);
        }

        $scope.newAlert = function () {
          kbnUrl.change('/alert', {});
        };

        // Setup configurable values for config directive, after objects are initialized
        $scope.opts = {
          alertcfg: alertcfg,
          allowedRoles: allowedRoles,
          save: $scope.save,
          user_role_can_modify: user_role_can_modify,
        };
        init();
      }
    };
  });
});
