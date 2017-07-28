define(function (require) {
  var module = require('ui/modules').get('app/report');
  var _ = require('lodash');
  const Scanner = require('ui/utils/scanner');
  const lup = require('plugins/kibana/log_user_operation');
  // bring in the factory
  require('plugins/kibana/report/services/_saved_report');


  // Register this service with the saved object registry so it can be
  // edited by the object editor.
  require('plugins/kibana/settings/saved_object_registry').register({
    service: 'savedReports',
    title: 'reports'
  });
  
  // This is the only thing that gets injected into controllers
  module.service('savedReports', function (Notifier, Promise, SavedReport, kbnIndex, es, kbnUrl, savedVisualizations, $http) {
    const scanner = new Scanner(es, {
         index: kbnIndex,
         type: 'report'
    });
    this.type = SavedReport.type;
    this.Class = SavedReport;
    this.loaderProperties = {
      name: 'reports',
      noun: 'Report',
      nouns: 'reports'
    };


    var notify = new Notifier({
         location: 'Report'
    });

    // Returns a single report by ID, should be the name of the report
    this.get = function (id) {
      // Returns a promise that contains a report which is a subclass of docSource
      return (new SavedReport(id)).init();
    };

    this.urlFor = function (id) {
      return kbnUrl.eval('#/report/{{id}}', {id: id});
    };

    this.delete = function (ids) {
      ids = !_.isArray(ids) ? [ids] : ids;
      return Promise.map(ids, function (id) {
         return (new SavedReport(id)).delete().then(function () {
         lup.logUserOperation($http, 'DELETE','report', id);
       });
      });
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
        type: 'report',
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
