module.exports = function (kibana) {

  return new kibana.Plugin({

    uiExports: {
      visTypes: [
        'plugins/uvmap_vis/uvmap_vis'
      ]
    }

  });

};
