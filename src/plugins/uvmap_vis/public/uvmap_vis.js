define(function (require) {
  // we also need to load the controller and used by the template
  require('plugins/uvmap_vis/uvmap_vis_controller');
  require('plugins/uvmap_vis/uvmap_vis_params_controller');

  // Styling
  require('plugins/uvmap_vis/uvmap_vis.less');

  // register the provider with the visTypes registry so that other know it exists
  require('ui/registry/vis_types').register(UVMapVisProvider);

  console.log("Registering UVMapVisProvider");
  function UVMapVisProvider(Private) {
    var TemplateVisType = Private(require('ui/template_vis_type/TemplateVisType'));

    // return the visType object, which kibana will use to display and configure new
    // Vis object of this type.
    return new TemplateVisType({
      name: 'uvmap_vis',
      title: 'Unified Visibility Map',
      icon: 'fa-sitemap',
      description: 'Create Unified Visibility Map Visualization charts using ' +
        'the expression and connection language. Perfect for visualizing ' +
        'application dependency, service path etc. using nodes and links',
      template: require('plugins/uvmap_vis/uvmap_vis.html'),
      params: {
        editor: require('plugins/uvmap_vis/uvmap_vis_params.html')
      },
      requiresSearch: false
    });
  }

  // export the provider so that the visType can be required with Private()
  return UVMapVisProvider;
});
