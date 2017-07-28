define(function (require) {
  var module = require('ui/modules').get('app/alert');
  var _ = require('lodash');
  const Scanner = require('ui/utils/scanner');
  const lup = require('plugins/kibana/log_user_operation');
  // bring in the factory
  require('plugins/kibana/alert/services/_saved_alert');


  // Register this service with the saved object registry so it can be
  // edited by the object editor.
  require('plugins/kibana/settings/saved_object_registry').register({
    service: 'savedAlerts',
    title: 'alerts'
  });
  
  // This is the only thing that gets injected into controllers
  module.service('savedAlerts', function (Notifier, Promise, SavedAlert, kbnIndex, es, kbnUrl, savedVisualizations, $http) {
    const scanner = new Scanner(es, {
        index: kbnIndex,
        type: 'alert'
    });

    this.type = SavedAlert.type;
    this.Class = SavedAlert;
    this.loaderProperties = {
      name: 'alerts',
      noun: 'Alert',
      nouns: 'alerts'
    };

    var notify = new Notifier({
         location: 'Alert'
    });

    // Returns a single alert by ID, should be the name of the alert
    this.get = function (id) {
      // Returns a promise that contains a alert which is a subclass of docSource
      return (new SavedAlert(id)).init();
    };

    this.urlFor = function (id) {
      return kbnUrl.eval('#/alert/{{id}}', {id: id});
    };

    this.delete = function (selectedItems) {
      selectedItems = !_.isArray(selectedItems) ? [selectedItems] : selectedItems;
      return Promise.map(selectedItems, function (selectedItem) {
        return (new SavedAlert(selectedItem['id'])).delete().then(function (del_id) {
          // making a post call to vusmartmaps with 'alert_id', 'alert_title' and
          // 'action' (delete alert). This information will be
          // used to generate alerts.
          lup.logUserOperation($http, 'DELETE','alert', selectedItem['id']);
          var delete_alert = $http({
              method: 'POST',
              url: '/vuSmartMaps/api/alert_status/',
              data: {'alert_id': selectedItem['id'], 'alert_title':selectedItem['title'], 'action':'delete'},
              headers: {'Content-Type': 'application/x-www-form-urlencoded'},
          }).success(function (data, status, headers, config) {
          }).error(function (data, status, headers, config) {
              notify.error('Failed to notify for the alert change')
          });
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
        type: 'alert',
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
