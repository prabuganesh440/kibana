define(function (require) {
  const module = require('ui/modules').get('app/dashboard');
  const _ = require('lodash');
  const Scanner = require('ui/utils/scanner');
  const lup = require('plugins/kibana/log_user_operation');

  // bring in the factory
  require('plugins/kibana/dashboard/services/_saved_dashboard');


  // Register this service with the saved object registry so it can be
  // edited by the object editor.
  require('plugins/kibana/settings/saved_object_registry').register({
    service: 'savedDashboards',
    title: 'dashboards'
  });

  // This is the only thing that gets injected into controllers
  module.service('savedDashboards', function (Notifier, Promise, SavedDashboard, kbnIndex, es, kbnUrl, savedVisualizations, $http) {
    const scanner = new Scanner(es, {
      index: kbnIndex,
      type: 'dashboard'
    });

    this.type = SavedDashboard.type;
    this.Class = SavedDashboard;

    var notify = new Notifier({
         location: 'Dashboard'
    });

    this.loaderProperties = {
      name: 'dashboards',
      noun: 'Dashboard',
      nouns: 'dashboards'
    };

    // Returns a single dashboard by ID, should be the name of the dashboard
    this.get = function (id) {
      // Returns a promise that contains a dashboard which is a subclass of docSource
      return (new SavedDashboard(id)).init();
    };

    this.urlFor = function (id) {
      return kbnUrl.eval('#/dashboard/{{id}}', {id: id});
    };

    this.delete = function (ids) {
      ids = !_.isArray(ids) ? [ids] : ids;
      return Promise.map(ids, function (id) {
           return (new SavedDashboard(id)).init().then(function(dashboard) {
               var optionsJSON_obj = angular.fromJson(dashboard.optionsJSON);
               var return_list = [optionsJSON_obj, dashboard];
               return return_list;
           })
           .then( function(return_list) {
               return (new SavedDashboard(id)).delete()
               .then(function () {
                  return savedVisualizations.get(return_list[0].category)
                 .then(function (visual) {
                  lup.logUserOperation($http, 'DELETE', 'dashboard', id);
                  var dashboard_url = return_list[1].title;
                  visual['visState'].params.dashboards = _.without(visual['visState'].params.dashboards, dashboard_url)
                  return visual.save()
                 })
              })
           })
           .catch(function () {
               notify.error("Failed in delete dashboard");
           })
        }, { concurrency: 1 });
    };

    this.scanAll = function (queryString, pageSize = 1000) {
      return scanner.scanAndMap(queryString, {
        pageSize,
        docCount: Infinity
      }, (hit) => this.mapHits(hit));
    };

    this.mapHits = function (hit) {
      const source = hit._source;
      source.id = hit._id;
      source.url = this.urlFor(hit._id);
      return source;
    };

    this.find = function (searchString, size = 100) {
      let body;
      if (searchString) {
        body = {
          query: {
            simple_query_string: {
              query: searchString + '*',
              fields: ['title^3', 'description'],
              default_operator: 'AND'
            }
          }
        };
      } else {
        body = { query: {match_all: {}}};
      }

      return es.search({
        index: kbnIndex,
        type: 'dashboard',
        body: body,
        size: size
      })
      .then((resp) => {
        return {
          total: resp.hits.total,
          hits: resp.hits.hits.map((hit) => this.mapHits(hit))
        };
      });
    };
  });
});
