define(function (require) {
  // we need to load the css ourselves
  require('plugins/category_vis/category_vis.less');

  // we also need to load the controller and used by the template
  require('plugins/category_vis/category_vis_controller');

  // register the provider with the visTypes registry so that other know it exists
  require('ui/registry/vis_types').register(CategoryVisProvider);

  function CategoryVisProvider(Private) {
    var TemplateVisType = Private(require('ui/template_vis_type/TemplateVisType'));

    // return the visType object, which kibana will use to display and configure new
    // Vis object of this type.
    return new TemplateVisType({
      name: 'category',
      title: 'Category widget',
      icon: 'fa-users',
      description: 'Useful for displaying group of dashboards.',
      template: require('plugins/category_vis/category_vis.html'),
      params: {
        defaults: {
          images: ['server.png', 'network_element.png', 'application.png', 'security.png', 'administration.png', 'others.png'],
          name: '',
          description: '',
          dashboards: [],
          themes: ['Voilet-Color', 'Blue-Grey-Color', 'Blue-Ink-Color', 'Green-Blue-Color'],
        },
        editor: require('plugins/category_vis/category_vis_params.html')
      },
      requiresSearch: false
    });
  }

  // export the provider so that the visType can be required with Private()
  return CategoryVisProvider;
});
