define(function (require) {
  const _ = require('lodash');
  const angular = require('angular');
  const moment = require('moment');
  const ConfigTemplate = require('ui/ConfigTemplate');
  const getSort = require('ui/doc_table/lib/get_sort');
  const rison = require('ui/utils/rison');
  const chrome = require('ui/chrome');
  const lup = require('plugins/kibana/log_user_operation');

  const dateMath = require('ui/utils/dateMath');
  var $ = require('jquery');

  require('ui/directives/rbac_user_role');
  require('ui/doc_table');
  require('ui/visualize');
  require('ui/notify');
  require('ui/fixedScroll');
  require('ui/directives/validate_json');
  require('ui/filters/moment');
  require('ui/courier');
  require('ui/index_patterns');
  require('ui/state_management/app_state');
  require('ui/timefilter');
  require('ui/highlight/highlight_tags');
  require('ui/share');

  const app = require('ui/modules').get('apps/discover', [
    'kibana/notify',
    'kibana/courier',
    'kibana/index_patterns'
  ]);

  require('ui/routes')
  .when('/discover/Home', {
    template: require('plugins/kibana/discover/index.html'),
    reloadOnSearch: false,
    resolve: {
      list_search: function() {return true;},
      ip: function (Promise, courier, config, $location) {
        return courier.indexPatterns.getIds()
        .then(function (list) {
          const stateRison = $location.search()._a;

          let state;
          try { state = rison.decode(stateRison); }
          catch (e) { state = {}; }

          const specified = !!state.index;
          const exists = _.contains(list, state.index);
          const id = exists ? state.index : config.get('defaultIndex');

          return Promise.props({
            list: list,
            loaded: courier.indexPatterns.get(id),
            stateVal: state.index,
            stateValFound: specified && exists
          });
        });
      },
      savedSearch: function (courier, savedSearches, $route) {

        return savedSearches.get();
        },
      is_new_search: function () {
        return false;
      }
      }
    })
  .when('/discover/:id?', {
    template: require('plugins/kibana/discover/index.html'),
    reloadOnSearch: false,
    resolve: {
      list_search: function() {return false;},
      ip: function (Promise, courier, config, $location) {
        return courier.indexPatterns.getIds()
        .then(function (list) {
          const stateRison = $location.search()._a;

          let state;
          try { state = rison.decode(stateRison); }
          catch (e) { state = {}; }

          const specified = !!state.index;
          const exists = _.contains(list, state.index);
          const id = exists ? state.index : config.get('defaultIndex');

          return Promise.props({
            list: list,
            loaded: courier.indexPatterns.get(id),
            stateVal: state.index,
            stateValFound: specified && exists
          });
        });
      },
      savedSearch: function (courier, savedSearches, $route, $http) {
        lup.logUserOperation($http, 'GET','search', $route.current.params.id);
        return savedSearches.get($route.current.params.id)
        .catch(courier.redirectWhenMissing({
          'search': '/discover',
          'index-pattern': '/settings/objects/savedSearches/' + $route.current.params.id
        }))
        .catch(courier.redirectWhenNotAllowed({
          'search': '/discover',
          'index-pattern': '/settings/objects/savedSearches/' + $route.current.params.id
        }));
      },
      // This flag indicates if new search is being
      // created.
      is_new_search: function ($route) {
        if( $route.current.params.id === undefined) {
          return true;
        }
        else {
          return false;
        }
      },
      loaded_search_id: function($route) {
        return $route.current.params.id;
      }
    }
  });

  app.controller('discover', function ($scope, config, courier, $route, $window, Notifier,
    AppState, timefilter, Promise, Private, kbnUrl, highlightTags, $http,$rootScope) {

    const Vis = Private(require('ui/Vis'));
    const docTitle = Private(require('ui/doc_title'));
    const brushEvent = Private(require('ui/utils/brush_event'));
    const HitSortFn = Private(require('plugins/kibana/discover/_hit_sort_fn'));
    const queryFilter = Private(require('ui/filter_bar/query_filter'));
    const filterManager = Private(require('ui/filter_manager'));
    var is_new_search = $route.current.locals.is_new_search;
    var loaded_search_id = $route.current.locals.loaded_search_id;
    const notify = new Notifier({
      location: 'Discover'
    });

    // alert("new search = "+is_new_search);
    // alert("saved search = "+loaded_search_id);
    if(is_new_search)
    {
      $rootScope.SearchName = "newsearch";
      $rootScope.load = false;
      $rootScope.newReport = true;
    }
    else {
      $rootScope.SearchName = loaded_search_id;
      $rootScope.load = true;
    }

    $scope.intervalOptions = Private(require('ui/agg_types/buckets/_interval_options'));
    $scope.showInterval = false;

    $scope.intervalEnabled = function (interval) {
      return interval.val !== 'custom';
    };

    $scope.toggleInterval = function () {
      $scope.showInterval = !$scope.showInterval;
    };

    // config panel templates
    $scope.configTemplate = new ConfigTemplate({
      load: require('plugins/kibana/discover/partials/load_search.html'),
      save: require('plugins/kibana/discover/partials/save_search.html'),
      share: require('plugins/kibana/discover/partials/share_search.html')
    });

    $scope.timefilter = timefilter;

    // the saved savedSearch
    const savedSearch = $route.current.locals.savedSearch;
    const list_search = $route.current.locals.list_search;
    $scope.$on('$destroy', savedSearch.destroy);

    // the actual courier.SearchSource
    $scope.searchSource = savedSearch.searchSource;
    $scope.indexPattern = resolveIndexPatternLoading();
    $scope.list_search = list_search;
    $scope.searchSource.set('index', $scope.indexPattern);

    if (savedSearch.id) {
      docTitle.change(savedSearch.title);
    }

    const $state = $scope.state = new AppState(getStateDefaults());
    $scope.uiState = $state.makeStateful('uiState');

    // Populate allowedRoles from dashboard
    var allowedRoles = savedSearch.allowedRolesJSON ? JSON.parse(savedSearch.allowedRolesJSON) : [];

    // Get current user
    var current_user = chrome.getCurrentUser();

    // Set whether the current logged in user be allowed to create a new
    // object or not
    $scope.creation_allowed = false;
    if ( chrome.canCurrentUserCreateObject() ) {
        $scope.creation_allowed = true;
    }

    // For an admin used, we always show modify permissions during save..
    var user_role_can_modify = true;
    if ( chrome.isCurrentUserAdmin() ) {
       user_role_can_modify = true;
    } else {
       // Set a flag whether the current user's role can modify this object
       user_role_can_modify = chrome.canCurrentUserModifyPermissions(allowedRoles);
    }

    function getStateDefaults() {
      // alert("init");
      //  alert(savedSearch.aliasName);
      return {
        query: $scope.searchSource.get('query') || '',
        sort: getSort.array(savedSearch.sort, $scope.indexPattern),
        columns: savedSearch.columns || ['_source'],
        aliasName : savedSearch.aliasName,
        index: $scope.indexPattern.id,
        interval: 'auto',
        filters: _.cloneDeep($scope.searchSource.getOwn('filter'))
      };
    }

    $state.index = $scope.indexPattern.id;
    $state.sort = getSort.array($state.sort, $scope.indexPattern);
    $scope.$watchCollection('state.columns', function () {
      console.log("new column add -------------------------------------------------");
      $state.save();
    });

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

    // if a search query exists. Do not collapse the searchbar
    if($scope.state.query !== '')
      {
        if ($scope.state.query.query_string.query!='*')
        {
          $scope.show_searchbar=true;
        }
      }


    $scope.opts = {
      // number of records to fetch, then paginate through
      sampleSize: config.get('discover:sampleSize'),
      // Index to match
      index: $scope.indexPattern.id,
      allowedRoles: allowedRoles,
      user_role_can_modify: user_role_can_modify,
      timefield: $scope.indexPattern.timeFieldName,
      savedSearch: savedSearch,
      // aliasName : savedSearch.aliasName ? JSON.parse(savedSearch.aliasName) : [],
      indexPatternList: $route.current.locals.ip.list
    };

    console.log("my ref---------------------------------------------");
    console.log(savedSearch);

    const init = _.once(function () {
      const showTotal = 5;
      $scope.failuresShown = showTotal;
      $scope.showAllFailures = function () {
        $scope.failuresShown = $scope.failures.length;
      };
      $scope.showLessFailures = function () {
        $scope.failuresShown = showTotal;
      };

      $scope.updateDataSource()
      .then(function () {
        $scope.$listen(timefilter, 'fetch', function () {
          $scope.fetch();
        });

        $scope.$watchCollection('state.sort', function (sort) {
          if (!sort) return;

          // get the current sort from {key: val} to ["key", "val"];
          const currentSort = _.pairs($scope.searchSource.get('sort')).pop();

          // if the searchSource doesn't know, tell it so
          if (!angular.equals(sort, currentSort)) $scope.fetch();
        });

        // update data source when filters update
        $scope.$listen(queryFilter, 'update', function () {
          return $scope.updateDataSource().then(function () {
            $state.save();
            // console.console.log("----------------filter------------------------");
            // console.log($state);
          });
        });

        // update data source when hitting forward/back and the query changes
        $scope.$listen($state, 'fetch_with_changes', function (diff) {
          if (diff.indexOf('query') >= 0) $scope.fetch();
        });

        // fetch data when filters fire fetch event
        $scope.$listen(queryFilter, 'fetch', $scope.fetch);

        $scope.$watch('opts.timefield', function (timefield) {
          timefilter.enabled = !!timefield;
        });

        $scope.$watch('state.interval', function (interval, oldInterval) {
          if (interval !== oldInterval && interval === 'auto') {
            $scope.showInterval = false;
          }
          $scope.fetch();
        });

        $scope.$watch('vis.aggs', function () {
          // no timefield, no vis, nothing to update
          // if (!$scope.opts.timefield) return;

          const buckets = $scope.vis.aggs.bySchemaGroup.buckets;

          if (buckets && buckets.length === 1) {
            $scope.intervalName = 'by ' + buckets[0].buckets.getInterval().description;
          } else {
            $scope.intervalName = 'auto';
          }
        });

        $scope.$watchMulti([
          'rows',
          'fetchStatus'
        ], (function updateResultState() {
          let prev = {};
          const status = {
            LOADING: 'loading', // initial data load
            READY: 'ready', // results came back
            NO_RESULTS: 'none' // no results came back
          };

          function pick(rows, oldRows, fetchStatus) {
            // initial state, pretend we are loading
            if (rows == null && oldRows == null) return status.LOADING;

            const rowsEmpty = _.isEmpty(rows);
            // An undefined fetchStatus means the requests are still being
            // prepared to be sent. When all requests are completed,
            // fetchStatus is set to null, so it's important that we
            // specifically check for undefined to determine a loading status.
            const preparingForFetch = _.isUndefined(fetchStatus);
            if (preparingForFetch) return status.LOADING;
            else if (rowsEmpty && fetchStatus) return status.LOADING;
            else if (!rowsEmpty) return status.READY;
            else return status.NO_RESULTS;
          }

          return function () {
            const current = {
              rows: $scope.rows,
              fetchStatus: $scope.fetchStatus
            };

            $scope.resultState = pick(
              current.rows,
              prev.rows,
              current.fetchStatus,
              prev.fetchStatus
            );

            prev = current;
          };
        }()));

        $scope.searchSource.onError(function (err) {
          notify.error(err);
        }).catch(notify.fatal);

        function initForTime() {
          return setupVisualization().then($scope.updateTime);
        }

        return Promise.resolve($scope.opts.timefield && initForTime())
        .then(function () {
          init.complete = true;
          $state.replace();
          $scope.$emit('application.load');
        });
      });
    });

    $scope.opts.saveDataSource = function () {
      console.log("-----------------------------saved items--------------------");
      console.log(savedSearch);
      // alert($scope.state.aliasName);
      // alert("New Serch Report = "+savedSearch.title);
      $rootScope.$emit('saveAliases', { searchName: savedSearch.title });
      return $scope.updateDataSource()
      .then(function () {
        savedSearch.id = savedSearch.title;
        savedSearch.columns = $scope.state.columns;
        savedSearch.sort = $scope.state.sort;
        savedSearch.aliasName = $scope.state.aliasName;
        savedSearch.allowedRolesJSON = angular.toJson($scope.opts.allowedRoles);
        // if a search is loaded and saved as another
        // search, It is a new search. Hence set the flag to true.
        if( loaded_search_id !== savedSearch.id )
        {
          is_new_search = true;
        }
        return savedSearch.save(is_new_search)
        .then(function (id) {
          $scope.configTemplate.close('save');
          if (id) {
            lup.logUserOperation($http, 'POST','search', id);
            notify.info('Saved Data Source "' + savedSearch.title + '"');
            if (savedSearch.id !== $route.current.params.id) {
              kbnUrl.change('/discover/{{id}}', { id: savedSearch.id });

            } else {
              // Update defaults so that "reload saved query" functions correctly
              $state.setDefaults(getStateDefaults());
            }
          }
        });
      })
      .catch(notify.error);
    };

    $scope.opts.fetch = $scope.fetch = function () {
      // ignore requests to fetch before the app inits
      if (!init.complete) return;

      $scope.updateTime();

      $scope.updateDataSource()
      .then(setupVisualization)
      .then(function () {
        $state.save();
        return courier.fetch();
      })
      .catch(notify.error);
    };

    $scope.searchSource.onBeginSegmentedFetch(function (segmented) {

      function flushResponseData() {
        $scope.hits = 0;
        $scope.faliures = [];
        $scope.rows = [];
        $scope.fieldCounts = {};
      }

      if (!$scope.rows) flushResponseData();

      const sort = $state.sort;
      const timeField = $scope.indexPattern.timeFieldName;
      const totalSize = $scope.size || $scope.opts.sampleSize;

      /**
       * Basically an emum.
       *
       * opts:
       *   "time" - sorted by the timefield
       *   "non-time" - explicitly sorted by a non-time field, NOT THE SAME AS `sortBy !== "time"`
       *   "implicit" - no sorting set, NOT THE SAME AS "non-time"
       *
       * @type {String}
       */
      const sortBy = (function () {
        if (!_.isArray(sort)) return 'implicit';
        else if (sort[0] === '_score') return 'implicit';
        else if (sort[0] === timeField) return 'time';
        else return 'non-time';
      }());

      let sortFn = null;
      if (sortBy !== 'implicit') {
        sortFn = new HitSortFn(sort[1]);
      }

      $scope.updateTime();
      if (sort[0] === '_score') segmented.setMaxSegments(1);
      segmented.setDirection(sortBy === 'time' ? (sort[1] || 'desc') : 'desc');
      segmented.setSortFn(sortFn);
      segmented.setSize($scope.opts.sampleSize);

      // triggered when the status updated
      segmented.on('status', function (status) {
        $scope.fetchStatus = status;
      });

      segmented.on('first', function () {
        flushResponseData();
      });

      segmented.on('segment', notify.timed('handle each segment', function (resp) {
        if (resp._shards.failed > 0) {
          $scope.failures = _.union($scope.failures, resp._shards.failures);
          $scope.failures = _.uniq($scope.failures, false, function (failure) {
            return failure.index + failure.shard + failure.reason;
          });
        }
      }));

      segmented.on('mergedSegment', function (merged) {
        $scope.mergedEsResp = merged;
        $scope.hits = merged.hits.total;

        const indexPattern = $scope.searchSource.get('index');

        // the merge rows, use a new array to help watchers
        $scope.rows = merged.hits.hits.slice();

        notify.event('flatten hit and count fields', function () {
          let counts = $scope.fieldCounts;

          // if we haven't counted yet, or need a fresh count because we are sorting, reset the counts
          if (!counts || sortFn) counts = $scope.fieldCounts = {};

          $scope.rows.forEach(function (hit) {
            // skip this work if we have already done it
            if (hit.$$_counted) return;

            // when we are sorting results, we need to redo the counts each time because the
            // "top 500" may change with each response, so don't mark this as counted
            if (!sortFn) hit.$$_counted = true;

            const fields = _.keys(indexPattern.flattenHit(hit));
            let n = fields.length;
            let field;
            while (field = fields[--n]) {
              if (counts[field]) counts[field] += 1;
              else counts[field] = 1;
            }
          });
        });
      });

      segmented.on('complete', function () {
        if ($scope.fetchStatus.hitCount === 0) {
          flushResponseData();
        }

        $scope.fetchStatus = null;
      });
    }).catch(notify.fatal);

    $scope.updateTime = function () {
      $scope.timeRange = {
        from: dateMath.parse(timefilter.time.from),
        to: dateMath.parse(timefilter.time.to, true)
      };
    };

    $scope.resetQuery = function () {
      kbnUrl.change('/discover/{{id}}', { id: $route.current.params.id });
    };

    $scope.newQuery = function () {
      kbnUrl.change('/discover');
    };

    $scope.updateDataSource = Promise.method(function () {
      $scope.searchSource
      .size($scope.opts.sampleSize)
      .sort(getSort($state.sort, $scope.indexPattern))
      .query(!$state.query ? null : $state.query)
      .set('filter', queryFilter.getFilters());

      if (config.get('doc_table:highlight')) {
        $scope.searchSource.highlight({
          pre_tags: [highlightTags.pre],
          post_tags: [highlightTags.post],
          fields: {'*': {}},
          require_field_match: false,
          fragment_size: 2147483647 // Limit of an integer.
        });
      }
    });

    // TODO: On array fields, negating does not negate the combination, rather all terms
    $scope.filterQuery = function (field, values, operation) {
      $scope.indexPattern.popularizeField(field, 1);
      filterManager.add(field, values, operation, $state.index);
    };

    $scope.toTop = function () {
      $window.scrollTo(0, 0);
    };

    let loadingVis;
    function setupVisualization() {
      // If we're not setting anything up we need to return an empty promise
      if (!$scope.opts.timefield) return Promise.resolve();
      if (loadingVis) return loadingVis;

      const visStateAggs = [
        {
          type: 'count',
          schema: 'metric'
        },
        {
          type: 'date_histogram',
          schema: 'segment',
          params: {
            field: $scope.opts.timefield,
            interval: $state.interval,
            min_doc_count: 0
          }
        }
      ];

      // we have a vis, just modify the aggs
      if ($scope.vis) {
        const visState = $scope.vis.getState();
        visState.aggs = visStateAggs;

        $scope.vis.setState(visState);
        return Promise.resolve($scope.vis);
      }

      $scope.vis = new Vis($scope.indexPattern, {
        title: savedSearch.title,
        type: 'histogram',
        params: {
          addLegend: false,
          addTimeMarker: true
        },
        listeners: {
          click: function (e) {
            console.log(e);
            timefilter.time.from = moment(e.point.x);
            timefilter.time.to = moment(e.point.x + e.data.ordered.interval);
            timefilter.time.mode = 'absolute';
          },
          brush: brushEvent
        },
        aggs: visStateAggs
      });

      $scope.searchSource.aggs(function () {
        $scope.vis.requesting();
        return $scope.vis.aggs.toDsl();
      });

      // stash this promise so that other calls to setupVisualization will have to wait
      loadingVis = new Promise(function (resolve) {
        $scope.$on('ready:vis', function () {
          resolve($scope.vis);
        });
      })
      .finally(function () {
        // clear the loading flag
        loadingVis = null;
      });

      return loadingVis;
    }

    function resolveIndexPatternLoading() {
      const props = $route.current.locals.ip;
      const loaded = props.loaded;
      const stateVal = props.stateVal;
      const stateValFound = props.stateValFound;

      const own = $scope.searchSource.getOwn('index');

      if (own && !stateVal) return own;
      if (stateVal && !stateValFound) {
        const err = '"' + stateVal + '" is not a configured pattern. ';
        if (own) {
          notify.warning(err + ' Using the saved index pattern: "' + own.id + '"');
          return own;
        }

        notify.warning(err + ' Using the default index pattern: "' + loaded.id + '"');
      }
      return loaded;
    }

    init();
  });
});
