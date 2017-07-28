define(function (require) {
  var module = require('ui/modules').get('app/alert');
  var _ = require('lodash');

  // Used only by the savedAlerts service, usually no reason to change this
  module.factory('SavedAlert', function (courier, config) {
    // SavedAlert constructor. Usually you'd interact with an instance of this.
    // ID is option, without it one will be generated on save.
    _.class(SavedAlert).inherits(courier.SavedObject);
    function SavedAlert(id) {
      // Gives our SavedAlert the properties of a SavedObject
      SavedAlert.Super.call(this, {
        type: SavedAlert.type,
        mapping: SavedAlert.mapping,
        searchSource: SavedAlert.searchsource,

        // if this is null/undefined then the SavedObject will be assigned the defaults
        id: id,

        // default values that will get assigned if the doc is new
        defaults: {
          title: 'New Alert',
          description: '',
          ruleLevelThreshold: '',
          eval_criteria: '{}',
          ruleList:[],
          severity: '',
          summary: '',
          allowedRolesJSON: '',
          enable_throttle: '',
          throttle_duration: '',
          throttle_duration_type: '',
          alertByUI: false,
          alertByEmail: false,
          alertEmailId: '',
          description: '',
          last_modified_time: '',
          active_start_time: '',
          active_end_time: '',
          enable_alert: '',
          active_alert_check:'',
          weekdays: [],
        },

        // if an indexPattern was saved with the searchsource of a SavedAlert
        // object, clear it. It was a mistake
        clearSavedIndexPattern: true
      });

    }

    // save these objects with the 'alert' type
    SavedAlert.type = 'alert';

    // if type:alert has no mapping, we push this mapping into ES
    SavedAlert.mapping = {
      title: 'string',
      description: 'string',
      ruleList: 'object',
      ruleLevelThreshold: 'string',
      eval_criteria: 'string',
      severity: 'string',
      summary: 'string',
      allowedRolesJSON: 'string',
      enable_throttle: 'string',
      throttle_duration_type: 'string',
      throttle_duration:'string',
      alertByUI: 'boolean',
      alertByEmail: 'boolean',
      alertEmailId: 'string',
      description: 'string',
      last_modified_time:'string',
      active_start_time: 'string',
      active_end_time: 'string',
      enable_alert: 'string',
      active_alert_check:'string',
      weekdays: 'object',
    };

    SavedAlert.searchsource = true;

    return SavedAlert;
  });
});
