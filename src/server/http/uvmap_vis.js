export default function (server) {

  let _ = require('lodash');
  let fs = require('fs');
  var Promise = require('bluebird');
  var path = require('path')

  function replyWithError(e, reply) {
        reply({title: e.toString(), message: e.toString(), stack: e.stack}).code(400);
  }

  /*
   * This function is called to create a link with the passed information. It
   * also adds the created object into the passed all_links list.
   */
  function create_link(link_id, from_node_id, to_node_id, all_links) {
      var link_obj = {};
      link_obj['id'] = link_id;
      link_obj['from'] = from_node_id;
      link_obj['to'] = to_node_id;
      link_obj['label'] = '';
      link_obj['color'] = '#0D8EFF';
      link_obj['font'] = {};
      link_obj['font']['multi'] = 'html';

      all_links.push(link_obj);
      return link_obj;
  };


  /*
   * This is for handling Unified Visibility Map visualization. For ES
   * queries, it uses Timelion and for connections, it uses a in-house
   * grammar. It supports parameter as well as time based drilldowns.
   * There is also a way to load specified dashboards
   */
  return {
    uvmap_vis_handler(request, reply) {

          var grammar = fs.readFileSync(path.resolve(__dirname, '../../plugins/uvmap_vis/public/uvmap_vis.peg'), 'utf8');
          var PEG = require('pegjs');
          var Parser = PEG.buildParser(grammar);

          // Let us first parse the connection details from the configuration
          try {
              var connection = Parser.parse(request.payload.connection[0]);
          } catch(err) {
              console.log('An error occured');
              console.log(err);
              replyWithError(err, reply);
              return
          }

          // The below is to find the nodes, links from the connection
          // configuration
          var all_nodes_dict = {};
          var all_nodes = [];
          var all_links = [];
          var node_dashboard_dict = {}
          var node_id = 1;
          var to_node_id;
          var to_node;
          var from_node_id;
          var from_node;
          var link_id = 1;

          // pathvislist contains the list of objects created after grammar
          // parsing. It contains the nodes and their information..
          // Information looks like:
          // For 'isconnectedto', it will provide following:
          // {"connected": {
          //       "from":{"value":"10.10.10.1"},
          //       "to":{"value":"11.11.11.1"}
          //    }
          // },
          // For 'attributes', it will provide following:
          // {"node_type": {
          //      "type":{"value":"Server"},
          //      "name":{"value":"12.12.12.1"},
          //      "node":{"value":"12.12.12.1"},
          //      "x":{"value":"50"},
          //      "y":{"value":"-50"},
          //      "dashboard":{"value":"Heartbeat-Line"}
          //      }
          // }
          //
          // We iterate on this list and whenever we encounter either
          // 'connected' or 'node_type', we parse the information as mentioned
          // above and create the node and links
          console.log('Pathvis list is');
          console.log(JSON.stringify(connection.pathvislist));
          
          _.map(connection.pathvislist, function(connect) {
              // If its the isconnectedto syntax.. its used to create a
              // connection between two nodes
              if ('connected' in connect) {
                  var to_node_obj = {}
                  var from_node_obj = {}
                  to_node = connect.connected.to.value;
                  from_node = connect.connected.from.value;

                  // Check if the node is already seen or not...
                  if(to_node in all_nodes_dict) {
                      to_node_obj = all_nodes_dict[to_node];
                  } else {
                      // We are seeing this node first time, let us add this
                      // in the all nodes dict as well as all_nodes list
                      to_node_obj['id'] = node_id;
                      all_nodes_dict[to_node] = to_node_obj;
                      node_id += 1
                      all_nodes.push(to_node_obj);
                  }
                  to_node_id = to_node_obj['id'];

                  // Do the same for from-node as well
                  if (from_node in all_nodes_dict) {
                      from_node_obj = all_nodes_dict[from_node];
                  } else {
                      // We are seeing this node first time, let us add this
                      // in the all nodes dict as well as all_nodes list
                      from_node_obj['id'] = node_id;
                      all_nodes_dict[from_node] = from_node_obj;
                      node_id += 1
                      all_nodes.push(from_node_obj);
                  }
                  from_node_id = from_node_obj['id']; 

                  // Create the link..
                  var link_obj = create_link(link_id, from_node_id, to_node_id, all_links);
                  console.log("Adding node object");
                  console.log(from_node_obj);
                  console.log(to_node_obj);
                  console.log(link_obj);
                  link_id += 1
              } else if ('node_type' in connect) {
                  // For node attributes, node_type is used
                  var node = connect.node_type.node.value;
                  var name = connect.node_type.name.value;
                  var type = connect.node_type.type.value;
                  var x = connect.node_type.x.value;
                  var y = connect.node_type.y.value;
                  if (node in all_nodes_dict) {
                      // If we have seen this node already, let us update all
                      // the attributes
                      var node_obj = all_nodes_dict[node]
                      node_obj['font'] = {};
                      node_obj['font']['multi'] = 'html';
                      node_obj['label'] = name;
                      node_obj['group'] = type;
                      node_obj['x'] = x;
                      node_obj['y'] = y;
                      if ('dashboard' in connect.node_type ) {
                          node_dashboard_dict[node_obj['id']] = connect.node_type.dashboard.value;
                      }
                  }
              }
          });

          // For metric collection, we use ES queries similar to Timelion.. Let
          // us use that by invoking required functions.
          var tlConfig = require('../../../installedPlugins/timelion/server/handlers/lib/tl_config.js')({
                      server: server,
                      request: request
          });

          // This is basically invoking timelion code from here to parse the
          // expression..
          var chainRunnerFn = require('../../../installedPlugins/timelion/server/handlers/chain_runner.js');

          var chainRunner = chainRunnerFn(tlConfig);
          var sheet;
          try {
              sheet = chainRunner.processRequest(request.payload);
          } catch (e) {
              console.log("Got an error");
              console.log(e);
              replyWithError(e, reply);
              return;
          }

          return Promise.all(sheet).then(function (sheet) {
              _.forEach(all_nodes, function (node_obj) {
                  var data = ''; 
                  // Here we are trying to map the received ES response of
                  // metrics to the nodes. We check the node-label in the
                  // returned instance's label, if its available, we assume
                  // that the two are connected and use this metric to update
                  // the node label.
                  _.map(sheet[0].list, function(instance) {
                      if (instance.label.indexOf(node_obj['label']) !== -1) {
                          var data_value = instance.data[0][1];
                          if (typeof data_value === 'number') {
                              // If its a float, we use only two decimal points
                              if (Math.round(data_value) != data_value) {
                                  data_value = parseFloat(data_value).toFixed(2);
                              }
                          }
                          data = data + '\n\n<b>' + instance.label.split('>')[1] + ':' + data_value + '</b>';
                      }
                  });

                  // Now update the node-obj label
                  node_obj['label'] = '<i>' + node_obj['label'] + '</i>' + data; 
              });

              // We have built all the required information in all_nodes and
              // all_links, create a data object and send it as repsonse
              var data = {"nodes": all_nodes, "edges": all_links, "node_dashboard_dict": node_dashboard_dict};
              return reply({"data": data});
          }).catch(function (e) {
              if (e.isBoom) {
                  reply(e);
              } else {
                  replyWithError(e, reply);
              }
          });

      }
  }

};
