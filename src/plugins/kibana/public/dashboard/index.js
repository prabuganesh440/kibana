define(function (require) {
  const _ = require('lodash');
  const $ = require('jquery');
  const angular = require('angular');
  const ConfigTemplate = require('ui/ConfigTemplate');
  const chrome = require('ui/chrome');
  const lup = require('plugins/kibana/log_user_operation');

  require('ui/directives/config');
  require('ui/courier');
  require('ui/config');
  require('ui/notify');
  require('ui/typeahead');
  require('ui/share');

  require('plugins/kibana/dashboard/directives/grid');
  require('plugins/kibana/dashboard/components/panel/panel');
  require('plugins/kibana/dashboard/services/saved_dashboards');
  require('ui/directives/rbac_user_role');
  require('plugins/kibana/dashboard/styles/main.less');

  require('ui/saved_objects/saved_object_registry').register(require('plugins/kibana/dashboard/services/saved_dashboard_register'));


  const app = require('ui/modules').get('app/dashboard', [
    'elasticsearch',
    'ngRoute',
    'kibana/courier',
    'kibana/config',
    'kibana/notify',
    'kibana/typeahead'
  ]);

  require('ui/routes')
  .when('/dashboard', {
    template: require('plugins/kibana/dashboard/index.html'),
    resolve: {
      dash: function (savedDashboards, config) {
        return savedDashboards.get();
      },
      // Used when dashboard is saved - to attach the dashboard to a category
      categories: function(savedVisualizations,config) {
          return savedVisualizations.find_category_visualizations();
      },
      // This flag indicates if new dashboard is being
      // created.
      is_new_dashboard: function () {
        return true;
      }
    }
  })
  .when('/dashboard/:id', {
    template: require('plugins/kibana/dashboard/index.html'),
    resolve: {
      dash: function (savedDashboards, Notifier, $route, $location, courier, $http) {
        lup.logUserOperation($http, 'GET','dashboard', $route.current.params.id);
        return savedDashboards.get($route.current.params.id)
        .catch(courier.redirectWhenMissing({
          'dashboard' : '/dashboard'
        }))
        .catch(courier.redirectWhenNotAllowed({
          'dashboard' : '/dashboard'
        }));
      },
      // Used when dashboard is saved - to attach the dashboard to a category
      categories: function(savedVisualizations,config) {
          return savedVisualizations.find_category_visualizations();
      },
       is_new_dashboard: function () {
        return false;
      },
      loaded_dashboard_id: function ($route) {
        return $route.current.params.id;
      }
    }
  });

  app.directive('dashboardApp', function (Notifier, courier, AppState, timefilter, kbnUrl) {
    return {
      controller: function ($scope, $rootScope, $route, $routeParams, $location, Private, getAppState, savedDashboards, savedVisualizations, savedSearches, $http) {

        const queryFilter = Private(require('ui/filter_bar/query_filter'));

        const notify = new Notifier({
          location: 'Dashboard'
        });

        var is_new_dashboard = $route.current.locals.is_new_dashboard;
        var loaded_dashboard_id = $route.current.locals.loaded_dashboard_id;
        const dash = $scope.dash = $route.current.locals.dash;
        var categories = $scope.categories = $route.current.locals.categories.hits;

        if (dash.timeRestore && dash.timeTo && dash.timeFrom && !getAppState.previouslyStored()) {
          timefilter.time.to = dash.timeTo;
          timefilter.time.from = dash.timeFrom;
        }

        // Populate allowedRoles from dashboard
        var allowedRoles = dash.allowedRolesJSON ? JSON.parse(dash.allowedRolesJSON) : [];

        // Get current user
        var current_user = chrome.getCurrentUser();

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

        $scope.$on('$destroy', dash.destroy);

        const matchQueryFilter = function (filter) {
          return filter.query && filter.query.query_string && !filter.meta;
        };

        const extractQueryFromFilters = function (filters) {
          const filter = _.find(filters, matchQueryFilter);
          if (filter) return filter.query;
        };

        const stateDefaults = {
          title: dash.title,
          panels: dash.panelsJSON ? JSON.parse(dash.panelsJSON) : [],
          options: dash.optionsJSON ? JSON.parse(dash.optionsJSON) : {},
          uiState: dash.uiStateJSON ? JSON.parse(dash.uiStateJSON) : {},
          query: extractQueryFromFilters(dash.searchSource.getOwn('filter')) || {query_string: {query: '*'}},
          filters: _.reject(dash.searchSource.getOwn('filter'), matchQueryFilter),
        };

        const $state = $scope.state = new AppState(stateDefaults);
        const $uiState = $scope.uiState = $state.makeStateful('uiState');

        $scope.$watchCollection('state.options', function (newVal, oldVal) {
          if (!angular.equals(newVal, oldVal)) $state.save();
        });
        $scope.$watch('state.options.darkTheme', setDarkTheme);

        $scope.configTemplate = new ConfigTemplate({
          save: require('plugins/kibana/dashboard/partials/save_dashboard.html'),
          load: require('plugins/kibana/dashboard/partials/load_dashboard.html'),
          share: require('plugins/kibana/dashboard/partials/share.html'),
          pickVis: require('plugins/kibana/dashboard/partials/pick_visualization.html'),
          options: require('plugins/kibana/dashboard/partials/options.html')
        });

        $scope.refresh = _.bindKey(courier, 'fetch');

        timefilter.enabled = true;
        $scope.timefilter = timefilter;
        $scope.$listen(timefilter, 'fetch', $scope.refresh);
        $scope.template_address = '';
        $scope.template_name = '';
        //checking if incoming dashboard is new or existing
        //so as to handle the global edit button requirements.
        var category_obj = $scope.category_obj = angular.fromJson(dash.optionsJSON);
        if (category_obj.category == '') {
            $scope.non_edit_state = false;
        } else {
            $scope.non_edit_state = true;
        }

        courier.setRootSearchSource(dash.searchSource);

        function init() {
          updateQueryOnRootSource();

          const docTitle = Private(require('ui/doc_title'));
          if (dash.id) {
            docTitle.change(dash.title);
          }

          initPanelIndices();
          $scope.$emit('application.load');
        }

        function initPanelIndices() {
          // find the largest panelIndex in all the panels
          let maxIndex = getMaxPanelIndex();

          // ensure that all panels have a panelIndex
          $scope.state.panels.forEach(function (panel) {
            if (!panel.panelIndex) {
              panel.panelIndex = maxIndex++;
            }
          });
        }

        function getMaxPanelIndex() {
          let index = $scope.state.panels.reduce(function (idx, panel) {
            // if panel is missing an index, add one and increment the index
            return Math.max(idx, panel.panelIndex || idx);
          }, 0);
          return ++index;
        }

        function updateQueryOnRootSource() {
          const filters = queryFilter.getFilters();
          if ($state.query) {
            dash.searchSource.set('filter', _.union(filters, [{
              query: $state.query
            }]));
          } else {
            dash.searchSource.set('filter', filters);
          }
        }

        function setDarkTheme(enabled) {
          const theme = Boolean(enabled) ? 'theme-dark' : 'theme-light';
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

        $scope.newDashboard = function () {
          kbnUrl.change('/dashboard', {});
        };

        $scope.filterResults = function () {
          updateQueryOnRootSource();
          $state.save();
          $scope.refresh();
        };


        // This function is called to add the passed dashboard to the passed
        // category
        function addToCategory(dash, category_obj) {
            savedVisualizations.get(category_obj['category']).then(function(new_visual){
              var dashboard_url = dash.title;
              // Add the dashboard to the list
              if(!(new_visual['visState'].params.dashboards.includes(dashboard_url)) )
              {
                new_visual['visState'].params.dashboards.push(dashboard_url);
                new_visual.save().then(function (id) {
                   // Nothing needs to be done..
                }, notify.fatal);
              }
          }).catch(notify.fatal);
        }

        // This function is called to removed the passed dashboard from the
        // passed category
        function removeFromCategory(dash, category_obj) {
            savedVisualizations.get(category_obj['category']).then(function(new_visual){
                // Check if the visState is available, if not, it means it does
                // not exist
                if (new_visual.visState){
                     var dashboard_url = dash.title;
                     // Removed the dashboard from the list
                     new_visual['visState'].params.dashboards = _.without(new_visual['visState'].params.dashboards, dashboard_url);
                     new_visual.save().then(function (id) {
                         // Nothing needs to be done..
                     }, notify.fatal);
                }
            }).catch(notify.fatal);
        }

        function saveDashboard(dash){
            $state.save();
            dash.panelsJSON = angular.toJson($state.panels);
            dash.uiStateJSON = angular.toJson($uiState.getChanges());
            dash.allowedRolesJSON = angular.toJson($scope.opts.allowedRoles);
            dash.timeFrom = dash.timeRestore ? timefilter.time.from : undefined;
            dash.timeTo = dash.timeRestore ? timefilter.time.to : undefined;
            dash.optionsJSON = angular.toJson($state.options);
            var category_obj = angular.fromJson($state.options);
            // if a dashboard is loaded and saved as another
            // dashboard, It is a new dashboard. Hence set the flag to true.
            if( loaded_dashboard_id !== dash.id)
            {
              is_new_dashboard = true;
            }
            dash.save(is_new_dashboard)
            .then(function (id) {
                $scope.configTemplate.close('save');
                if (id) {
                   if (dash.id !== $routeParams.id) {
                       kbnUrl.change('/dashboard/{{id}}', {id: dash.id});
                       addToCategory(dash, category_obj);
                       $scope.category_obj = category_obj;
                   } else {
                       // If this dashboard had a category and the category is now
                       // changed, we need to remove the dashboard from old category
                       // and add it in the new category.. This also takes care
                       // of a case where dashboard category does not exist so
                       // someone is changing it
                       if ($scope.category_obj['category'] !== category_obj['category']) {
                           // Remove it from older category
                           removeFromCategory(dash, $scope.category_obj);
                           // Add it to the new category..
                           addToCategory(dash, category_obj);
                           $scope.category_obj = category_obj;
                       }
                   }
                lup.logUserOperation($http, 'POST', 'dashboard', dash.id);
                }
             })
             .catch(notify.fatal);
        }

        function saveVisual(panel, visual) {
            var ip_address_regex = /([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/;

            // If visualization has IP address in
            // name, we replace that as well
            var visual_num = panel.id.search(ip_address_regex);
            if( visual_num == -1) {
                // Append ip address
                new_visual_id = panel.id + '-' + $scope.template_address;
                new_visual_title = visual.title + ' ' + $scope.template_address;
            } else {
                new_visual_id = panel.id.replace(ip_address_regex, $scope.template_address);
                new_visual_title = visual.title.replace(ip_address_regex, $scope.template_address);
            }
            savedVisualizations.get().then(function(new_visual) {
                new_visual = visual;
                new_visual.id = new_visual_id;
                new_visual.title = new_visual_title;
                // name_id is same as
                // new_visual_id
                new_visual.save().then(function (name_id) {
                    var hit = panel;
                    hit.id = name_id;
                    $scope.addVisSave(hit);
                    num_panels_created = num_panels_created + 1;
                    if ( num_panels_created == num_panels ) {
                        saveDashboard(dash);
                    }
                })
                 .catch(notify.fatal);
            })
             .catch(notify.fatal);
        }

        function createSearch(new_search_id, search, visual, panel) {
            var ip_address_regex = /([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/;
            var new_search_title = new_search_id.replace(/-/g, ' ');
            savedSearches.get(new_search_id).then(function(new_search) {
                saveVisual(panel, visual);
            }).catch(function(errors) {
                savedSearches.get().then(function(new_search) {
                    // new_search = search;
                    new_search.id = new_search_id;
                    new_search.title = new_search_title;
                    new_search.hits = search.hits;
                    new_search.sort = search.sort;
                    new_search.columns = search.columns;
                    new_search.aliasName = search.aliasName;
                    new_search.version = search.version;
                    new_search.searchSource = search.searchSource;
                    searchSourceInJson = new_search.searchSource.toJSON()
                    newQueryString = searchSourceInJson.query.query_string.query.replace(ip_address_regex, $scope.template_address);
                    searchSourceInJson.query.query_string.query = newQueryString;
                    new_search.save().then(function (name_id) {
                         saveVisual(panel, visual);
                    })
                     .catch(notify.fatal);
                })
                 .catch(notify.fatal);
             })
              .catch(notify.fatal);
        }

        function createSearchDashboard(new_search_id, new_search_title, search, dash, panel) {
            var ip_address_regex = /([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/;
            savedSearches.get(new_search_id).then(function(new_search) {
                var hit = panel;
                hit.id = new_search_id;
                $scope.addSearchSave(hit);
                num_panels_created = num_panels_created + 1;
                if ( num_panels_created == num_panels ) {
                    saveDashboard(dash);
                }
            }).catch(function(errors) {
                savedSearches.get().then(function(new_search) {
                    new_search.id = new_search_id;
                    new_search.title = new_search_title;
                    new_search.hits = search.hits;
                    new_search.sort = search.sort;
                    new_search.columns = search.columns;
                    new_search.aliasName = search.aliasName;
                    new_search.version = search.version;
                    new_search.searchSource = search.searchSource;
                    searchSourceInJson = new_search.searchSource.toJSON()
                    newQueryString = searchSourceInJson.query.query_string.query.replace(ip_address_regex, $scope.template_address);
                    searchSourceInJson.query.query_string.query = newQueryString;
                    new_search.save().then(function (name_id) {
                        var hit = panel;
                        hit.id = name_id;
                        $scope.addSearchSave(hit);
                        num_panels_created = num_panels_created + 1;
                        if ( num_panels_created == num_panels ) {
                            saveDashboard(dash);
                        }
                    })
                     .catch(notify.fatal);
                 })
                  .catch(notify.fatal);
              })
               .catch(notify.fatal);
         }

        $scope.editClickCtrl = function() {
              $scope.non_edit_state = $scope.non_edit_state === true ? false : true;

              if(!$scope.non_edit_state)
              {
                $("#dashboardWidget").addClass("gridsterwithborder");
                $("li").css("padding-right","8px");
              }
              else {
                $("#dashboardWidget").removeClass("gridsterwithborder");
                $("li").css("padding-right","0px");
              }

         }

         $scope.save = function () {
          $scope.non_edit_state = true;
          $state.title = dash.id = dash.title;
          var category_obj = angular.fromJson($state.options);
          var ip_address_regex = /([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/;

          if( $scope.template_name != '') {
              savedDashboards.get($scope.template_name).then(function(chosen_dash) {
                  dash_json = angular.toJson(chosen_dash);
                  panel_json = JSON.parse(chosen_dash.panelsJSON);
                  // Total length of panels in this
                  $state.options = angular.fromJson(chosen_dash.optionsJSON);
                  num_panels = panel_json.length;
                  num_panels_created = 0;
                  panel_json.map(function(panel) {
                       return create_visual_search(panel);
                  }); // _each
               })
                .catch(notify.fatal);
          }
          else {
              saveDashboard(dash);
           }
         };

        function create_visual_search(panel) {
            var ip_address_regex = /([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/;
            var create = true;
            var getting_visual = false;
            if (panel.type == 'visualization') {
                // Get the visualization details
                var getting_visual = true;
                savedVisualizations.get(panel.id).then(function(visual) {
                    getting_visual = false;
                    if ((typeof visual.savedSearchId === 'undefined') || (visual.savedSearchId == '')) {
                        var hit = panel;
                        hit.id = panel.id;
                        $scope.addVisSave(hit);
                        num_panels_created = num_panels_created + 1;
                        if ( num_panels_created == num_panels ) {
                            saveDashboard(dash);
                        }
                    } else {
                        // Get the search details
                        savedSearches.get(visual.savedSearchId).then(function(search) {
                            // Now check if there is an IP address
                            // here in query string
                            var num = search.kibanaSavedObjectMeta.searchSourceJSON.search(ip_address_regex);
                            if(num == -1) {
                                var hit = panel;
                                hit.id = panel.id;
                                $scope.addVisSave(hit);
                                num_panels_created = num_panels_created + 1;
                                if ( num_panels_created == num_panels ) {
                                   saveDashboard(dash);
                                }
                            } else {
                                searchSourceJSON = search.kibanaSavedObjectMeta.searchSourceJSON.replace(ip_address_regex, $scope.template_address);
                                // Create a new id, most probably the
                                // name will be using the IP address
                                // if its not using, we append the IP
                                // address otherwise we replace
                                var title_num = visual.savedSearchId.search(ip_address_regex);
                                if( title_num == -1) {
                                    // Append ip address
                                    new_search_id = visual.savedSearchId + '-' + $scope.template_address;
                                } else {
                                    new_search_id = visual.savedSearchId.replace(ip_address_regex, $scope.template_address);
                                }

                                // Update it in the visual as well
                                visual.savedSearchId = new_search_id;

                                createSearch(new_search_id, search, visual, panel);
                            }
                        })
                        .catch(notify.fatal);
                    }
                })
                .catch(notify.fatal);
            } else if(panel.type == 'search') {
                // Get the search details
                savedSearches.get(panel.id).then(function(search) {
                    getting_visual = true;
                    var num = search.kibanaSavedObjectMeta.searchSourceJSON.search(ip_address_regex);
                    if( num == -1) {
                         var hit = panel;
                         $scope.addSearchSave(hit);

                         num_panels_created = num_panels_created + 1;
                         if ( num_panels_created == num_panels ) {
                             saveDashboard(dash);
                         }
                    } else {

                        // Create a new id, most probably the
                        // name will be using the IP address
                        // if its not using, we append the IP
                        // address otherwise we replace
                        var title_num = search.id.search(ip_address_regex);
                        if( title_num == -1) {
                            // Append ip address
                            new_search_id = search.id + '-' + $scope.template_address;
                            new_search_title = search.title + ' ' + $scope.template_address;
                        } else {
                            new_search_id = search.id.replace(ip_address_regex, $scope.template_address);
                            new_search_title = search.title.replace(ip_address_regex, $scope.template_address);
                        }
                        createSearchDashboard(new_search_id, new_search_title, search, dash, panel);
                     }
              })
              .catch(notify.fatal);
           }
        }

        // called by save-dashboard handler to add a newly created
        // visualization
        $scope.addVisSave = function (hit) {
          pendingVis++;
          $state.panels.push(hit);
        };

        // called by save-dashboard handler to add a newly created search
        $scope.addSearchSave = function (hit) {
          pendingVis++;
          $state.panels.push(hit);
        };

        $scope.addTemplate = function (hit, ip_address) {
            $scope.template_address = ip_address;
            $scope.template_name = hit.id;
        };

        //Function to check if dashboard templates are used at the time of dashboard creation.
        $scope.is_dashboard_using_templates = function () {
            return $scope.template_name !='';
        };

        let pendingVis = _.size($state.panels);
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
          pendingVis++;
          $state.panels.push({ id: hit.id, type: 'visualization', panelIndex: getMaxPanelIndex() });
          notify.info("Visualization " + "'" + hit.title + "'" + ' has been added successfully');
        };

        $scope.addSearch = function (hit) {
          pendingVis++;
          $state.panels.push({ id: hit.id, type: 'search', panelIndex: getMaxPanelIndex() });
          notify.info("Search " + "'" + hit.title + "'" + ' has been added successfully');
        };

        // Initializing the toolbar and searchbar collapse variables to false.
        $scope.show_toolbar = false;
        $scope.show_searchbar = false;

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
          dashboard: dash,
          categories: categories,
          ui: $state.options,
          allowedRoles: allowedRoles,
          user_role_can_modify: user_role_can_modify,
          save: $scope.save,
          addVis: $scope.addVis,
          addSearch: $scope.addSearch,
          addTemplate: $scope.addTemplate,
          is_dashboard_using_templates: $scope.is_dashboard_using_templates
        };

        init();
      }
    };
  });
});
