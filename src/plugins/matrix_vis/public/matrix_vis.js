define(function (require) {
  // we need to load the css ourselves
  require('plugins/matrix_vis/matrix_vis.less');

  // we also need to load the controller and used by the template
  require('plugins/matrix_vis/matrix_vis_controller');

  // our params are a bit complex so we will manage them with a directive
  require('plugins/matrix_vis/matrix_vis_params');

  // register the provider with the visTypes registry
  require('ui/registry/vis_types').register(MatrixVisProvider);

  // require the directives that we use as well
  require('ui/agg_table');
  require('ui/agg_table/agg_table_group');

  function MatrixVisProvider(Private) {
    const TemplateVisType = Private(require('ui/template_vis_type/TemplateVisType'));
    const Schemas = Private(require('ui/Vis/Schemas'));

    // return the visType object, which kibana will use to display and configure new
    // Vis object of this type.
    return new TemplateVisType({
      name: 'matrix',
      title: 'Matrix',
      description: 'A visualization to show information in a matrix like format',
      icon: 'fa-th-list',
      template: require('plugins/matrix_vis/matrix_vis.html'),
      params: {
        defaults: {
          perPage: 10,
          enableNoOfColumns: false,
          collapseTimeHeaders: false,
          enableTimeFormatter: false,
          inputTimeFormat: 'millisecond',
          outputTimeFormat: 'millisecond',
          NofColumns: 10,
          perPage: 10,
          colorSchema: [],
          interval: 'h',
          customInterval: 10,
          customIntervalType: 'm'
        },
        editor: '<matrix-vis-params></matrix-vis-params>'
      },
      hierarchicalData: function (vis) {
        return false;
      },
      schemas: new Schemas([
        {
          group: 'metrics',
          name: 'metric',
          title: 'Metric',
          min: 1,
          max: 1,
          // maximum of 1 metric is allowed.
          defaults: [
            { type: 'count', schema: 'metric' }
          ]
        },
        {
          group: 'buckets',
          name: 'bucket',
          title: 'Split Rows',
          // maximum of 1 sub bukcet is allowed.
          max: 2,
        },
      ])
    });
  }

  // export the provider so that the visType can be required with Private()
  return MatrixVisProvider;
});
