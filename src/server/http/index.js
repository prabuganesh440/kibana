  module.exports = function (kbnServer, server, config) {
  let _ = require('lodash');
  let fs = require('fs');
  let Boom = require('boom');
  let http = require('http');
  let Hapi = require('hapi');
  let Request = require('request');
  let parse = require('url').parse;
  let format = require('url').format;
  var Promise = require('bluebird');

  let getDefaultRoute = require('./getDefaultRoute');

  var path = require('path')
  var childProcess = require('child_process')
  var phantomjs = require('phantomjs')
  var binPath = phantomjs.path

  server = kbnServer.server = new Hapi.Server();

  const shortUrlLookup = require('./short_url_lookup')(server);

  // Get uvmap vis functions
  const uvmap_vis = require('./uvmap_vis')(server);

  function replyWithError(e, reply) {
        reply({title: e.toString(), message: e.toString(), stack: e.stack}).code(400);
  }

  // Create a new connection
  var connectionOptions = {
    host: config.get('server.host'),
    port: config.get('server.port'),
    routes: {
      cors: config.get('server.cors'),
      payload: {
        maxBytes: config.get('server.maxPayloadBytes')
      }
    }
  };

  // enable tls if ssl key and cert are defined
  if (config.get('server.ssl.key') && config.get('server.ssl.cert')) {
    connectionOptions.tls = {
      key: fs.readFileSync(config.get('server.ssl.key')),
      cert: fs.readFileSync(config.get('server.ssl.cert'))
    };
  }

  server.connection(connectionOptions);

  // provide a simple way to expose static directories
  server.decorate('server', 'exposeStaticDir', function (routePath, dirPath) {
    this.route({
      path: routePath,
      method: 'GET',
      handler: {
        directory: {
          path: dirPath,
          listing: true,
          lookupCompressed: true
        }
      },
      config: {auth: false}
    });
  });

  // provide a simple way to expose static files
  server.decorate('server', 'exposeStaticFile', function (routePath, filePath) {
    this.route({
      path: routePath,
      method: 'GET',
      handler: {
        file: filePath
      },
      config: {auth: false}
    });
  });

  // helper for creating view managers for servers
  server.decorate('server', 'setupViews', function (path, engines) {
    this.views({
      path: path,
      isCached: config.get('optimize.viewCaching'),
      engines: _.assign({ jade: require('jade') }, engines || {})
    });
  });

  server.decorate('server', 'redirectToSlash', function (route) {
    this.route({
      path: route,
      method: 'GET',
      handler: function (req, reply) {
        return reply.redirect(format({
          search: req.url.search,
          pathname: req.url.pathname + '/',
        }));
      }
    });
  });

  // attach the app name to the server, so we can be sure we are actually talking to kibana
  server.ext('onPreResponse', function (req, reply) {
    let response = req.response;

    if (response.isBoom) {
      response.output.headers['kbn-name'] = kbnServer.name;
      response.output.headers['kbn-version'] = kbnServer.version;
    } else {
      response.header('kbn-name', kbnServer.name);
      response.header('kbn-version', kbnServer.version);
    }

    return reply.continue();
  });

  /*
   * This is for handling Unified Visibility Map visualization. For ES
   * queries, it uses Timelion and for connections, it uses a in-house
   * grammar. It supports parameter as well as time based drilldowns.
   * There is also a way to load specified dashboards
   */
  server.route({
      method: ['POST', 'GET'],
      path: '/api/uvmap_vis/run/',
      handler: function (request, reply) {
          return uvmap_vis.uvmap_vis_handler(request, reply);
      }
  });

  server.route({
    path: '/',
    method: 'GET',
    handler: function (req, reply) {
      return reply.view('rootRedirect', {
        hashRoute: `${config.get('server.basePath')}/app/kibana`,
        defaultRoute: getDefaultRoute(kbnServer),
      });
    }
  });

  server.route({
    path: '/vienna_company_name/',
    method: 'GET',
    handler: function (req, reply) {
      return reply({company_name: 'Wipro'});
    }
  });

  server.route({
    method: 'POST',
    path: '/vienna_print_report/',
    handler: function (req, reply) {
      let path = req.path;
      var time = Date.now();

      var url = 'http://127.0.0.1:8080/app/kibana#/report/print/' + req.payload.report_name;
      var duration = req.payload.time_duration;
      var user_name = req.payload.username;
      var user_role = req.payload.user_role;
      var user_permissions = req.payload.permissions;
      var file_name = req.payload.report_name + '.pdf';
      var file_name_with_time = req.payload.report_name + '-' + time + '.pdf';
      var file_path = '/tmp/' + file_name_with_time;
      var shipper_url = req.payload.shipper_url;
      var childArgs = [
          '/opt/kibana/report/report.js',
          url,
          file_path,
          user_name,
          user_role,
          user_permissions,
          duration,
          shipper_url,
      ];

      server.log(['info'], 'Executing' + binPath + ' with url ' + url + ' with user ' + user_name + ' with role ' + user_role + ' for duration ' + duration + 'with shipper url ' + shipper_url );

      childProcess.execFile(binPath, childArgs, function(err, stdout, stderr) {
         reply.file(file_path)
                    .header('Content-Type', 'application/pdf')
                    .header('content-disposition', file_name);
      });
   }
 });

  server.route({
    method: 'GET',
    path: '/{p*}',
    handler: function (req, reply) {

      let path = req.path;

      if (path === '/' || path.charAt(path.length - 1) !== '/') {
        return reply(Boom.notFound());
      }

      return reply.redirect(format({
        search: req.url.search,
        pathname: path.slice(0, -1),
      }))
      .permanent(true);
    }
  });

  server.route({
    method: 'GET',
    path: '/goto/{urlId}',
    handler: async function (request, reply) {
      const url = await shortUrlLookup.getUrl(request.params.urlId);
      reply().redirect(config.get('server.basePath') + url);
    }
  });

  server.route({
    method: 'POST',
    path: '/shorten',
    handler: async function (request, reply) {
      const urlId = await shortUrlLookup.generateUrlId(request.payload.url);
      reply(urlId);
    }
  });

  return kbnServer.mixin(require('./xsrf'));
};
