define(function (require) {
  var module = require('ui/modules').get('app/report');
  var angular = require('angular');
  var _ = require('lodash');
  var moment = require('moment');

  // Used only by the savedReports service, usually no reason to change this
  module.factory('SavedReport', function (courier, config) {
    // SavedReport constructor. Usually you'd interact with an instance of this.
    // ID is option, without it one will be generated on save.
    _.class(SavedReport).inherits(courier.SavedObject);
    function SavedReport(id) {
      // Gives our SavedReport the properties of a SavedObject
      SavedReport.Super.call(this, {
        type: SavedReport.type,
        mapping: SavedReport.mapping,
        searchSource: SavedReport.searchsource,

        // if this is null/undefined then the SavedObject will be assigned the defaults
        id: id,

        // default values that will get assigned if the doc is new
        defaults: {
          title: 'New Report',
          hits: 0,
          description: '',
          panelsJSON: '[]',
          sectionJSON: '[]',
          allowedRolesJSON: '[]',
          optionsJSON: angular.toJson({
            darkTheme: true,
            category: ''
          }),
          uiStateJSON: '{}',
          version: 1,
          timeRestore: false,
          preparedBy:'',
          execSummary:'',
          timeTo: undefined,
          timeFrom: undefined,
          schedule: '{}',
          owner: '{}',
          company_name: ''
        },

        // if an indexPattern was saved with the searchsource of a SavedReport
        // object, clear it. It was a mistake
        clearSavedIndexPattern: true
      });

    }

    // save these objects with the 'report' type
    SavedReport.type = 'report';

    // if type:report has no mapping, we push this mapping into ES
    SavedReport.mapping = {
      title: 'string',
      hits: 'integer',
      description: 'string',
      panelsJSON: 'string',
      allowedRolesJSON: 'string',
      sectionJSON: 'string',
      optionsJSON: 'string',
      uiStateJSON: 'string',
      version: 'integer',
      timeRestore: 'boolean',
      preparedBy:'string',
      execSummary:'string',
      timeTo: 'string',
      timeFrom: 'string',
      schedule: 'string',
      owner: 'string',
      company_name: 'string'
    };

    SavedReport.searchsource = true;

    return SavedReport;
  });
});
