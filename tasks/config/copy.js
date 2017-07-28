module.exports = function (grunt) {
  return {
    devSource: {
      options: { mode: true },
      src: [
        'report/**',
        'src/**',
        'bin/**',
        'installedPlugins/**',
        'webpackShims/**',
        'config/kibana.yml',
        '!src/**/__tests__/**',
        '!src/testUtils/**',
        '!src/fixtures/**',
        '!src/plugins/devMode/**',
        '!src/plugins/testsBundle/**',
        '!src/cli/cluster/**',
      ],
      dest: 'build/kibana',
      expand: true
    },
    copyCommonCss: {
      options: { mode: true },
      src: [
         'node_modules/bootstrap/less/print.less',
      ],
      dest: 'build/kibana/',
      expand: true
    },
  };
};
