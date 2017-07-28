define(function (require) {
  const _ = require('lodash');
  const chrome = require('ui/chrome');
  const lup = require('plugins/kibana/log_user_operation');

  require('plugins/kibana/visualize/saved_visualizations/saved_visualizations');
  require('plugins/kibana/visualize/editor/sidebar');
  require('plugins/kibana/visualize/editor/agg_filter');

  require('ui/visualize');
  require('ui/collapsible_sidebar');
  require('ui/share');

  require('ui/routes')
  .when('/visualize/Home', {
    template: require('plugins/kibana/visualize/editor/editor.html'),
    resolve: {
      list_vis: function() { return true;},
      savedVis: function (savedVisualizations, courier, $route, Private) {
        return savedVisualizations.get();
      },
      // This flag indicates if new dashboard is being
      // created.
      is_new_vis: function () {
        return false;
      }
    }
  })
  .when('/visualize/create', {
    template: require('plugins/kibana/visualize/editor/editor.html'),
    resolve: {
      list_vis: function() { return false;},
      savedVis: function (savedVisualizations, courier, $route, Private) {
        const visTypes = Private(require('ui/registry/vis_types'));
        const visType = _.find(visTypes, {name: $route.current.params.type});
        if (visType.requiresSearch && !$route.current.params.indexPattern && !$route.current.params.savedSearchId) {
          throw new Error('You must provide either an indexPattern or a savedSearchId');
        }

        return savedVisualizations.get($route.current.params)
        .catch(courier.redirectWhenMissing({
          '*': '/visualize'
        }))
        .catch(courier.redirectWhenNotAllowed({
          '*': '/visualize'
        }));
      },
      is_new_vis: function () {
        return true;
      }
    }
  })
  .when('/visualize/edit/:id', {
    template: require('plugins/kibana/visualize/editor/editor.html'),
    resolve: {
      list_vis: function() { return false;},
      savedVis: function (savedVisualizations, courier, $route, $http) {
        lup.logUserOperation($http, 'GET','visualization', $route.current.params.id);
        return savedVisualizations.get($route.current.params.id)
        .catch(courier.redirectWhenMissing({
          'visualization': '/visualize',
          'search': '/settings/objects/savedVisualizations/' + $route.current.params.id,
          'index-pattern': '/settings/objects/savedVisualizations/' + $route.current.params.id,
          'index-pattern-field': '/settings/objects/savedVisualizations/' + $route.current.params.id
        }))
        .catch(courier.redirectWhenNotAllowed({
          'visualization': '/visualize',
          'search': '/settings/objects/savedVisualizations/' + $route.current.params.id,
          'index-pattern': '/settings/objects/savedVisualizations/' + $route.current.params.id,
          'index-pattern-field': '/settings/objects/savedVisualizations/' + $route.current.params.id
        }));
      },
      is_new_vis: function () {
        return false;
      },
      loaded_vis_id: function ($route) {
        return $route.current.params.id;
      }
    }
  });

  require('ui/modules')
  .get('app/visualize', [
    'kibana/notify',
    'kibana/courier'
  ])
  .controller('VisEditor', function ($scope, $route, timefilter, AppState, $location, kbnUrl, $timeout, courier, Private, Promise, $http) {

    const angular = require('angular');
    const ConfigTemplate = require('ui/ConfigTemplate');
    const Notifier = require('ui/notify/notifier');
    const docTitle = Private(require('ui/doc_title'));
    const brushEvent = Private(require('ui/utils/brush_event'));
    const queryFilter = Private(require('ui/filter_bar/query_filter'));
    const filterBarClickHandler = Private(require('ui/filter_bar/filter_bar_click_handler'));

    const notify = new Notifier({
      location: 'Visualization Editor'
    });

    const savedVis = $route.current.locals.savedVis;
    const list_vis = $route.current.locals.list_vis;
    var is_new_vis = $route.current.locals.is_new_vis;
    var loaded_vis_id = $route.current.locals.loaded_vis_id;

    $scope.list_vis = list_vis;

    const vis = savedVis.vis;
    const editableVis = vis.createEditableVis();
    vis.requesting = function () {
      const requesting = editableVis.requesting;
      requesting.call(vis);
      requesting.call(editableVis);
    };

    var allowedRoles = savedVis.allowedRolesJSON ? JSON.parse(savedVis.allowedRolesJSON) : [];

    // Set whether the current logged in user be allowed to create a new
    // object or not
    $scope.creation_allowed = false;
    if ( chrome.canCurrentUserCreateObject() ) {
        $scope.creation_allowed = true;
    }

    // For an admin used, we always show modify permissions during save..
    if (savedVis.vis.type.title === 'Category widget') {
         $scope.user_role_can_modify = false;
    } else {
        if ( chrome.isCurrentUserAdmin() ) {
           $scope.user_role_can_modify = true;
        } else {
           // Set a flag whether the current user's role can modify this object
           $scope.user_role_can_modify = chrome.canCurrentUserModifyPermissions(allowedRoles);
        }
    }

    const searchSource = savedVis.searchSource;

    // config panel templates
    const configTemplate = new ConfigTemplate({
      save: require('plugins/kibana/visualize/editor/panels/save.html'),
      load: require('plugins/kibana/visualize/editor/panels/load.html'),
      share: require('plugins/kibana/visualize/editor/panels/share.html'),
    });

    if (savedVis.id) {
      docTitle.change(savedVis.title);
    }

    let $state = $scope.$state = (function initState() {
      const savedVisState = vis.getState();
      const stateDefaults = {
        uiState: savedVis.uiStateJSON ? JSON.parse(savedVis.uiStateJSON) : {},
        linked: !!savedVis.savedSearchId,
        query: searchSource.getOwn('query') || {query_string: {query: '*'}},
        filters: searchSource.getOwn('filter') || [],
        vis: savedVisState
      };

      $state = new AppState(stateDefaults);

      if (!angular.equals($state.vis, savedVisState)) {
        Promise.try(function () {
          vis.setState($state.vis);
          editableVis.setState($state.vis);
        })
        .catch(courier.redirectWhenMissing({
          'index-pattern-field': '/visualize'
        }));
      }

      return $state;
    }());

    function init() {
      // export some objects
      $scope.savedVis = savedVis;
      $scope.searchSource = searchSource;
      $scope.vis = vis;
      $scope.indexPattern = vis.indexPattern;
      $scope.editableVis = editableVis;
      $scope.state = $state;
      $scope.uiState = $state.makeStateful('uiState');

      // Populate allowedRoles from visualization
      $scope.allowedRoles = savedVis.allowedRolesJSON ? JSON.parse(savedVis.allowedRolesJSON) : [];

      $scope.conf = _.pick($scope, 'doSave', 'savedVis', 'shareData', 'allowedRoles', 'user_role_can_modify');
      $scope.configTemplate = configTemplate;

      editableVis.listeners.click = vis.listeners.click = filterBarClickHandler($state);
      editableVis.listeners.brush = vis.listeners.brush = brushEvent;

      // track state of editable vis vs. "actual" vis
      $scope.stageEditableVis = transferVisState(editableVis, vis, true);
      $scope.resetEditableVis = transferVisState(vis, editableVis);
      $scope.$watch(function () {
        return editableVis.getState();
      }, function (newState) {
        editableVis.dirty = !angular.equals(newState, vis.getState());

        $scope.responseValueAggs = null;
        try {
          $scope.responseValueAggs = editableVis.aggs.getResponseAggs().filter(function (agg) {
            return _.get(agg, 'schema.group') === 'metrics';
          });
        }
        // this can fail when the agg.type is changed but the
        // params have not been set yet. watcher will trigger again
        // when the params update
        catch (e) {} // eslint-disable-line no-empty
      }, true);

      $state.replace();

      $scope.$watch('searchSource.get("index").timeFieldName', function (timeField) {
        timefilter.enabled = !!timeField;
      });

      // update the searchSource when filters update
      $scope.$listen(queryFilter, 'update', function () {
        searchSource.set('filter', queryFilter.getFilters());
        $state.save();
      });

      // fetch data when filters fire fetch event
      $scope.$listen(queryFilter, 'fetch', $scope.fetch);


      $scope.$listen($state, 'fetch_with_changes', function (keys) {
        if (_.contains(keys, 'linked') && $state.linked === true) {
          // abort and reload route
          $route.reload();
          return;
        }

        if (_.contains(keys, 'vis')) {
          $state.vis.listeners = _.defaults($state.vis.listeners || {}, vis.listeners);

          // only update when we need to, otherwise colors change and we
          // risk loosing an in-progress result
          vis.setState($state.vis);
          editableVis.setState($state.vis);
        }

        // we use state to track query, must write before we fetch
        if ($state.query && !$state.linked) {
          searchSource.set('query', $state.query);
        } else {
          searchSource.set('query', null);
        }

        if (_.isEqual(keys, ['filters'])) {
          // updates will happen in filter watcher if needed
          return;
        }

        $scope.fetch();
      });

      // Without this manual emission, we'd miss filters and queries that were on the $state initially
      $state.emit('fetch_with_changes');

      $scope.$listen(timefilter, 'fetch', _.bindKey($scope, 'fetch'));

      $scope.$on('ready:vis', function () {
        $scope.$emit('application.load');
      });

      $scope.$on('$destroy', function () {
        savedVis.destroy();
      });
    }

    $scope.fetch = function () {
      $state.save();
      searchSource.set('filter', queryFilter.getFilters());
      if (!$state.linked) searchSource.set('query', $state.query);
      if ($scope.vis.type.requiresSearch) {
        courier.fetch();
      }
    };

     // Initializing the toolbar collapse variables to false.
    $scope.show_toolbar = false;

    // Show the dashboard operational butttons on clicking the show toolbar button
    $scope.toggleToolbar = function(value) {
        $scope.show_toolbar = !$scope.show_toolbar;
    }

    $scope.startOver = function () {
      kbnUrl.change('/visualize', {});
    };

    $scope.doSave = function () {
      savedVis.id = savedVis.title;
      savedVis.visState = $state.vis;
      savedVis.uiStateJSON = angular.toJson($scope.uiState.getChanges());
      savedVis.allowedRolesJSON = angular.toJson($scope.conf.allowedRoles);
      // if a visualization is loaded and saved as another
      // visualization, It is a new visualization. Hence set the flag to true.
      if( loaded_vis_id !== savedVis.id )
      {
        is_new_vis = true;
      }
      savedVis.save(is_new_vis)
      .then(function (id) {
        configTemplate.close('save');
        if (id) {
          lup.logUserOperation($http, 'POST','visualization', id);
          notify.info('Saved Visualization "' + savedVis.title + '"');
          if (savedVis.id === $route.current.params.id) return;
          kbnUrl.change('/visualize/edit/{{id}}', {id: savedVis.id});
        }
      }, notify.fatal);
    };

    $scope.unlink = function () {
      if (!$state.linked) return;

      $state.linked = false;
      const parent = searchSource.getParent(true);
      const parentsParent = parent.getParent(true);

      // display unlinking for 2 seconds, unless it is double clicked
      $scope.unlinking = $timeout($scope.clearUnlinking, 2000);

      delete savedVis.savedSearchId;
      parent.set('filter', _.union(searchSource.getOwn('filter'), parent.getOwn('filter')));

      // copy over all state except "aggs" and filter, which is already copied
      _(parent.toJSON())
      .omit('aggs')
      .forOwn(function (val, key) {
        searchSource.set(key, val);
      })
      .commit();

      $state.query = searchSource.get('query');
      $state.filters = searchSource.get('filter');
      searchSource.inherits(parentsParent);
    };

    // This is to get the panel background color based on theme for
    // category visualization. This is done only for Home dashboard
    // This code is at two places.. one for the visualization and one for the
    // dashboard panel. Look for it in
    // src/plugins/category_vis/public/category_vis_controller.js
    // src/plugins/kibana/public/dashboard/components/panel/panel.js
    $scope.getVisBackgroundColor = function() {
        if ($scope.vis.type.name !== 'category') {
            return {};
        }

        if ($scope.savedVis.vis.params.theme === 'Blue-Ink-Color' ) {
             return {'background-color': '#2C144A'}
        } else if ( $scope.savedVis.vis.params.theme === 'Green-Blue-Color') {
             return {'background-color': '#0e5c5c'}
        } else if ( $scope.savedVis.vis.params.theme === 'Voilet-Color') {
             return {'background-color': '#641A83'}
        } else if ( $scope.savedVis.vis.params.theme === 'Blue-Grey-Color') {
             return {'background-color': '#34495e'}
        } else {
             return {'background-color': '#34495e'}
        }
    };

    $scope.clearUnlinking = function () {
      if ($scope.unlinking) {
        $timeout.cancel($scope.unlinking);
        $scope.unlinking = null;
      }
    };

    function transferVisState(fromVis, toVis, fetch) {
      return function () {
        toVis.setState(fromVis.getState());
        editableVis.dirty = false;
        $state.vis = vis.getState();
        $state.save();

        if (fetch) $scope.fetch();
      };
    }

    init();
  });
});
