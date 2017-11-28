define(function (require) {
  var _ = require('lodash');
  var $ = require('jquery');
  var angular = require('angular');
  var ConfigTemplate = require('ui/ConfigTemplate');
  var chrome = require('ui/chrome');
  var saveAs = require('@spalger/filesaver').saveAs;
  var moment = require('moment');
  const lup = require('plugins/kibana/log_user_operation');

  require('angular-loading-bar');
  require('angular-loading-bar/build/loading-bar.css');

  require('ui/directives/config');
  require('ui/courier');
  require('ui/timefilter');
  require('ui/config');
var notify = require('ui/notify');
  require('ui/typeahead');

  require('ui/directives/rbac_user_role');
  require('ui/directives/email_validator.js');
  require('plugins/kibana/report/directives/details');
  require('plugins/kibana/report/components/panel/panel');
  require('plugins/kibana/report/services/saved_reports');
  require('plugins/kibana/report/styles/main.less');

  require('ui/saved_objects/saved_object_registry').register(require('plugins/kibana/report/services/saved_report_register'));


  var app = require('ui/modules').get('app/report', [
    'elasticsearch',
    'angular-loading-bar',
    'ngRoute',
    'kibana/courier',
    'kibana/config',
    'kibana/notify',
    'kibana/typeahead'
  ]);

  require('ui/routes')
  .when('/report/', {
    template: require('plugins/kibana/report/index.html'),
    resolve: {
      print_report: function(){return false},
      list_report: function(){return false},
      dash: function (savedReports, config) {
        return savedReports.get();
      },
     company_name: function($http) {
            return $http({
                method: 'GET',
                url: '/vuSmartMaps/api/1/'
            }).success(function (data, status, headers, config) {
            }).error(function (data, status, headers, config) {
                notify.error('Unable to get company name')
            });
      },
      // This flag indicates if new report is being
      // created.
      is_new_report: function () {
        return true;
      }
    }
  })
  .when('/report/Home', {
    template: require('plugins/kibana/report/index.html'),
    resolve: {
      list_report: function(){return true},
      print_report: function(){return false},
      dash: function (savedReports, config) {
        return savedReports.get();
      },
      company_name: function(){return ""},
    },
    is_new_report: function () {
      return false;
    }
  })
  .when('/report/:id', {
    template: require('plugins/kibana/report/index.html'),
    resolve: {
      print_report: function(){return false},
      list_report: function(){return false},
      dash: function (savedReports, Notifier, $route, $location, courier, $http) {
        lup.logUserOperation($http, 'GET','report', $route.current.params.id);
        return savedReports.get($route.current.params.id)
        .catch(courier.redirectWhenMissing({
          'report' : '/report/Home'
        }))
        .catch(courier.redirectWhenNotAllowed({
          'report' : '/report/Home'
        }));
      },
      company_name: function(){return ""},
      is_new_report: function () {
        return false;
      },
      loaded_report_id: function ($route) {
        return $route.current.params.id;
      }
    }
  })
  .when('/report/print/:id', {
    template: require('plugins/kibana/report/index.html'),
    resolve: {
      print_report: function(){chrome.setVisible(false);return true},
      list_report: function(){return false},
      dash: function (savedReports, Notifier, $route, $location, courier) {
        return savedReports.get($route.current.params.id)
        .catch(courier.redirectWhenMissing({
          'report' : '/report/Home'
        }));
        // Please note that we are not catching Not-Allowed here as print
        // button won't be available to those who can't access the report
      },
     company_name: function(){return ""},
    },
    is_new_report: function () {
      return false;
    }
  });

  app.directive('reportApp', function (Notifier, courier, AppState, timefilter, kbnUrl) {
    return {
      controller: function ($scope, $rootScope, $route, $routeParams, $location, Private, getAppState, savedReports, savedVisualizations, savedSearches, $http) {

        var queryFilter = Private(require('ui/filter_bar/query_filter'));
        var notify = new Notifier({
          location: 'Report'
        });

        // Since vienna is in a iframe, we use the window.parent to
        // get the url in the browser.
        $scope.shipper_address = window.parent.location.href;
        $scope.reportDate = new Date();
        var is_new_report = $route.current.locals.is_new_report;
        var list_report = $scope.list_report = $route.current.locals.list_report;
        var loaded_report_id = $route.current.locals.loaded_report_id;
        var dash = $scope.dash = $route.current.locals.dash;
        // when reports tab (/report/) is hit, company_name
        // is fetched from the api '/vuSmartMaps/api/1/'
        // else company name is fetched from the dash
        // object stored.
        if($route.current.locals.company_name != "") {
            $scope.company_name = $route.current.locals.company_name.data.enterprise_name;
        }
        else {
            $scope.company_name = $route.current.locals.dash.company_name || "";
        }
        // Populate allowedRoles from dashboard
        var allowedRoles = dash.allowedRolesJSON ? JSON.parse(dash.allowedRolesJSON) : [];

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

        $scope.print_report = $route.current.locals.print_report;
        $scope.sections = [{ id: "", description: "", visuals: []}];
        $scope.enable_scheduling = false;
        // Populate owner, if its available from the backend, use that,
        // otherwise use current user
        $scope.owner = {};
        if (_.has(dash.owner, 'name')) {
            $scope.owner = JSON.parse(dash.owner);
        } else {
            var current_user = chrome.getCurrentUser();
            $scope.owner.name = current_user[0];
            $scope.owner.role = current_user[1];
            $scope.owner.permission = current_user[2];
        }

        if (dash.timeRestore && dash.timeTo && dash.timeFrom && !getAppState.previouslyStored()) {
            timefilter.time.to = dash.timeTo;
            timefilter.time.from = dash.timeFrom;
        }

        $scope.$on('$destroy', dash.destroy);

        var matchQueryFilter = function (filter) {
          return filter.query && filter.query.query_string && !filter.meta;
        };

        var extractQueryFromFilters = function (filters) {
          var filter = _.find(filters, matchQueryFilter);
          if (filter) return filter.query;
        };

        var stateDefaults = {
          title: dash.title,
          panels: dash.panelsJSON ? JSON.parse(dash.panelsJSON) : [],
          options: dash.optionsJSON ? JSON.parse(dash.optionsJSON) : {},
          uiState: dash.uiStateJSON ? JSON.parse(dash.uiStateJSON) : {},
          query: extractQueryFromFilters(dash.searchSource.getOwn('filter')) || {query_string: {query: '*'}},
          filters: _.reject(dash.searchSource.getOwn('filter'), matchQueryFilter),
        };

        $scope.show_toolbar = false;
        $scope.show_searchbar = false;

        var $state = $scope.state = new AppState(stateDefaults);
        var $uiState = $scope.uiState = $state.makeStateful('uiState');
        $scope.sections = dash.sectionJSON ? JSON.parse(dash.sectionJSON) : [{ id: "", description: "", visuals: []}];
        $scope.schedule = JSON.parse(dash.schedule);
        if($scope.sections.length == 0)
        {
          $scope.sections.push({ id: "", description: "", visuals: []});
        }
        $scope.$watchCollection('state.options', function (newVal, oldVal) {
          if (!angular.equals(newVal, oldVal)) $state.save();
        });
        $scope.$watch('state.options.darkTheme', setDarkTheme);

        if(_.has($scope.schedule,'frequency')) {
            $scope.enable_scheduling = true;
        }

        // This function will be called when we change
        // the report scheduling options using the
        // select box in section 2
        $scope.updateTimeFilter = function() {
            if($scope.schedule.frequency == 'daily')
            {
                timefilter.time.to = 'now'
                timefilter.time.from = 'now-24h';
            }
            else if($scope.schedule.frequency == 'weekly')
            {
                timefilter.time.to = 'now'
                timefilter.time.from = 'now-7d';
            }
            else if($scope.schedule.frequency == 'monthly')
            {
                timefilter.time.to = 'now'
                timefilter.time.from = 'now-30d';
            }
        }

        $scope.configTemplate = new ConfigTemplate({
          save: require('plugins/kibana/report/partials/save_report.html'),
          load: require('plugins/kibana/report/partials/load_report.html'),
          share: require('plugins/kibana/report/partials/share.html'),
          pickVis: require('plugins/kibana/report/partials/pick_visualization.html'),
          options: require('plugins/kibana/report/partials/options.html')
        });

        $scope.refresh = _.bindKey(courier, 'fetch');

        // Disabling the global timer in vienna
        // when report scheduling is enabled.
        timefilter.blur = false;
        if($scope.enable_scheduling)
        {
          timefilter.blur = true;
        }
        timefilter.enabled = true;
        $scope.timefilter = timefilter;
        time_duration = timefilter.getBounds();
        $scope.time_duration_start = time_duration.min.valueOf();
        $scope.time_duration_end = time_duration.max.valueOf();
        $scope.$listen(timefilter, 'fetch', $scope.refresh);
        var duration = moment.duration(time_duration.max.diff(time_duration.min));
        var time_duration_hours = duration.asHours();

        //checking if incoming report is new or existing
        //so as to handle the global edit button requirements.
        var category_obj = angular.fromJson(dash.optionsJSON);

        courier.setRootSearchSource(dash.searchSource);

        function init() {
          updateQueryOnRootSource();

          var docTitle = Private(require('ui/doc_title'));
          if (dash.id) {
            docTitle.change(dash.title);
          }

          initPanelIndices();
          $scope.$emit('application.load');
        }

        function initPanelIndices() {
          // find the largest panelIndex in all the panels
          var maxIndex = getMaxPanelIndex();

          // ensure that all panels have a panelIndex
          $scope.state.panels.forEach(function (panel) {
            if (!panel.panelIndex) {
              panel.panelIndex = maxIndex++;
            }
          });
        }

        function getMaxPanelIndex() {
          var index = $scope.state.panels.reduce(function (idx, panel) {
            // if panel is missing an index, add one and increment the index
            return Math.max(idx, panel.panelIndex || idx);
          }, 0);
          return ++index;
        }

        function updateQueryOnRootSource() {
          var filters = queryFilter.getFilters();
          if ($state.query) {
            dash.searchSource.set('filter', _.union(filters, [{
              query: $state.query
            }]));
          } else {
            dash.searchSource.set('filter', filters);
          }
        }

        function setDarkTheme(enabled) {
          var theme = Boolean(enabled) ? 'theme-dark' : 'theme-light';
          chrome.removeApplicationClass(['theme-dark', 'theme-light']);
          chrome.addApplicationClass(theme);
        }

        // update root source when filters update
        $scope.$listen(queryFilter, 'update', function () {
          updateQueryOnRootSource();
          $state.save();
        });

        // update data when filters fire fetch event
        $scope.$listen(queryFilter, 'fetch', $scope.refresh);

        $scope.newReport = function () {
          kbnUrl.change('/report', {});
        };

        // This function is called when a user is adding a new section. It
        // adds an empty section into list of sections
        $scope.addSection = function () {
            $scope.sections.push({ id: "", description: "", visuals: []});
            $scope.refresh();
        };

        // This function is called when a user removes an existing section.
        // Everything about the section is lost..
        $scope.removeSection = function (section) {
            $scope.sections = _.without($scope.sections, section);
        }

        // This function is called when a user clicks on add visualization.
        // Add visualization throws up a list of visualization available
        // to choose from but this function is called to set the current
        // section under which a visualization is to be added
        $scope.addVisToSection = function(section) {
            $scope.cur_section = section;
        }

        // This function is called when a user deletes a visuzliation from
        // a section.
        $scope.removeVisFromSection = function(section, vis) {
            section.visuals = _.without(section.visuals, vis)
        }

        // This function is called when a user clicks on UP arrow icon to move
        // a visuzliation to the above place.
        $scope.moveVisUpInSection = function(section, vis) {
            var index = section.visuals.indexOf(vis);
            if (index == 0) {
                return;
            }
            var vis_up = section.visuals[index-1];
            section.visuals[index-1] = vis;
            section.visuals[index] = vis_up;
        }

        // This function is called when a user clicks on DOWN arrow icon to move
        // a visuzliation to the below place.
        $scope.moveVisDownInSection = function(section, vis) {
            var index = section.visuals.indexOf(vis);
            if (index == section.visuals.length - 1) {
                return;
            }
            var vis_down = section.visuals[index+1];
            section.visuals[index+1] = vis;
            section.visuals[index] = vis_down;
        }

        // This will be used to populate the shipper url in the report
        if($scope.print_report === true) {
          $scope.shipper_address_url = chrome.getShipperUrl();
        }
        else {
          $scope.shipper_address_url = '';
        }

        // This function is called to print a report. Backend returns the pdf
        // report
        $scope.printReport = function () {
            $scope.reportDate = new Date();
            var url = dash.id;

            // Get current user
            var current_user = chrome.getCurrentUser();

            var posting = $http({
                method: 'POST',
                url: '/vienna_print_report/',
                data: { report_name: url,
                        time_duration: time_duration_hours,
                        username:current_user[0],
                        user_role:current_user[1],
                        permissions:current_user[2],
                        shipper_url: $scope.shipper_address
                      },
                responseType: 'blob'
            }).success(function (data, status, headers, config) {
                var blob = new Blob([data], { type: 'application/pdf' });
                var fileName = headers('content-disposition');
                saveAs(blob, fileName);
            }).error(function (data, status, headers, config) {
                notify.error('Unable to print the report')
            });
        };

        $scope.filterResults = function () {
          updateQueryOnRootSource();
          $state.save();
          $scope.refresh();
        };

        // Disable global timer in vienna when the
        // report scheduling is checked and
        // Initialise the schedule object
        $scope.handleChangeInReportType = function () {
            if($scope.enable_scheduling)
            {
                timefilter.blur = true;
                $scope.schedule = {'frequency':"daily", 'recipients':""};
            }
            else
            {
                timefilter.blur = false;
                $scope.schedule = {};
            }
        }

        function saveReport(dash){
            $state.save();
            dash.sectionJSON = angular.toJson($scope.sections);
            dash.panelsJSON = angular.toJson($state.panels);
            dash.uiStateJSON = angular.toJson($uiState.getChanges());
            dash.allowedRolesJSON = angular.toJson($scope.opts.allowedRoles);
            dash.timeFrom = dash.timeRestore ? timefilter.time.from : undefined;
            dash.timeTo = dash.timeRestore ? timefilter.time.to : undefined;
            dash.optionsJSON = angular.toJson($state.options);
            dash.schedule = angular.toJson($scope.schedule);
            dash.company_name = $scope.company_name;
            // collect the report owner details, his role and permissions.
            // If owners name is not populated. It is a new report.
            // Collect owner details.
            if (!_.has(dash.owner, 'name')) {
                dash.owner = angular.toJson($scope.owner);
            }
            var category_obj = angular.fromJson($state.options);
            // if a report is loaded and saved as another
            // report, It is a new report. Hence set the flag to true.
            if( loaded_report_id !== dash.id )
            {
              is_new_report = true;
            }
            dash.save(is_new_report)
            .then(function (id) {
                $scope.configTemplate.close('save');
                if (id) {
                   if (dash.id !== $routeParams.id) {
                       kbnUrl.change('/report/{{id}}', {id: dash.id});
                   }
                   lup.logUserOperation($http, 'POST','report', $route.current.params.id);
                }
             })
             .catch(notify.fatal);
        }

        $scope.save = function () {

          if (dash.title == 'Home') {
              // We can't allow anyone to save a Home Report so inform the user
              // about it
              //
              // There is some problem here... when we return first time,
              // things work fine but if a user press save with 'Home' again,
              // we end up throwing an error.. Can't find where the error is
              // coming from... need to look at this later..
              alert("You cannot create a report with name 'Home'. Please use a different name");
          } else {
              $state.title = dash.id = dash.title;
              saveReport(dash);
          }
        };

        var pendingVis = _.size($state.panels);
        $scope.$on('ready:vis', function () {
          if (pendingVis) pendingVis--;
          if (pendingVis === 0) {
            $state.save();
            $scope.refresh();
          }
        });

        // listen for notifications from the grid component that changes have
        // been made, rather than watching the panels deeply
        $scope.$on('change:vis', function () {
          $state.save();
        });

        // called by the saved-object-finder when a user clicks a vis
        $scope.addVis = function (hit) {
          $scope.cur_section.visuals.push({ id: hit.id, title: hit.title, icon: hit.icon, type: 'visualization'});
        };

        // called by the saved-object-finder when a user clicks a vis
        $scope.addSearch = function (hit) {
          $scope.cur_section.visuals.push({ id: hit.id, title: hit.title, icon: hit.icon, type: 'search'});
        };

        // Show the dashboard operational butttons on clicking the show toolbar button
        $scope.toggleToolbar = function(value) {
            $scope.show_toolbar = !$scope.show_toolbar;
        }

        // Expand search bar and close it on clicking the search button
        $scope.showSearchbar = function(value) {
            $scope.show_searchbar = !$scope.show_searchbar;
        }

        // if a search query exists. Do not collapse the
        // searchbar. Need not check for $scope.state.query as
        //$scope.state.query.query_string.query always exists
        if ($scope.state.query.query_string.query!='*')
        {
          $scope.show_searchbar=true;
        }

        // Setup configurable values for config directive, after objects are initialized
        $scope.opts = {
          report: dash,
          ui: $state.options,
          allowedRoles: allowedRoles,
          user_role_can_modify: user_role_can_modify,
          save: $scope.save,
          addVis: $scope.addVis,
          addSearch: $scope.addSearch,
          shareData: function () {
            return {
              link: $location.absUrl(),
              // This sucks, but seems like the cleanest way. Uhg.
              embed: '<iframe src="' + $location.absUrl().replace('?', '?embed&') +
                '" height="600" width="800"></iframe>'
            };
          }
        };

        init();
      }
    };
  });
});
