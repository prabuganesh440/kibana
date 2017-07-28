module.exports = function (kibana) {

  return new kibana.Plugin({

    uiExports: {
      visTypes: [
        'plugins/category_vis/category_vis'
      ]
    }

  });

};
