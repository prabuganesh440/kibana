module.exports = function (kibana) {

  return new kibana.Plugin({

    uiExports: {
      visTypes: [
        'plugins/matrix_vis/matrix_vis'
      ]
    }

  });

};
