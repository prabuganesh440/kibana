define(function (require) {
  var module = require('ui/modules').get('kibana/uvmap_vis');
  var _ = require('lodash');
  var vis = require('vis');

  module.directive('uvmapVisMap', function (kbnUrl) {

    return {
      restrict: 'E',
      scope: {
          mapData: '=',
          onNodeSelect: '=',
      },
      replace: true,
      template: '<div class="network-map"></div>',
      link: ($scope, element) => {

          // We watch mapData and if it changes, we draw the network
          $scope.$watch('mapData', function() {
              var visData, network;

              if (!$scope.mapData) {
                  console.log("uvmapVisMap: Returning as no mapData");
                  return;
              }

              var data = $scope.mapData;

              if (!data.nodes){
                  return
              }

              visData = {
                  nodes: new vis.DataSet(data.nodes),
                  edges: new vis.DataSet(data.edges)
              };

              var options = {

                  // These are the groups we support..
                  groups: {
                      PC: {
                          image: '/vienna_images/PC-active.png',
                          shape: 'image',
                          size: 30,
                          font: {
                              color:'#2E3458',
                              size:17
                          }
                      },
                      Wifi: {
                          image: '/vienna_images/wireless-access-active.png',
                          shape: 'image',
                          size: 30,
                          font: {
                              color:'#2E3458',
                              size:17
                          }
                      },
                      WifiAlert: {
                          image: '/vienna_images/wireless-access-alert.png',
                          shape: 'image',
                          size: 30,
                          font: {
                              color:'#2E3458',
                              size:17
                          }
                      },
                      Printer: {
                          image: '/vienna_images/printer-active.png',
                          shape: 'image',
                          size: 30,
                          font: {
                              color:'#2E3458',
                              size:17
                          }
                      },
                      PrinterAlert: {
                          image: '/vienna_images/printer-alert.png',
                          shape: 'image',
                          size: 30,
                          font: {
                              color:'#2E3458',
                              size:17
                          }
                      },
                      Mobile: {
                          image: '/vienna_images/mobile-active.png',
                          shape: 'image',
                          size: 30,
                          font: {
                              color:'#2E3458',
                              size:17
                          }
                      },
                      MobileAlert: {
                          image: '/vienna_images/mobile-alert.png',
                          shape: 'image',
                          size: 30,
                          font: {
                              color:'#2E3458',
                              size:17
                          }
                      },
                      Switch: {
                          image: '/vienna_images/switch-active.png',
                          shape: 'image',
                          size: 30,
                          font: {
                              color:'#2E3458',
                              size:17
                          }
                      },
                      SwitchAlert: {
                          image: '/vienna_images/switch-alert.png',
                          shape: 'image',
                          size: 30,
                          font: {
                              color:'#2E3458',
                              size:17
                          }
                      },
                      PCAlert: {
                          image: '/vienna_images/PC-alert.png',
                          shape: 'image',
                          size: 30,
                          font: {
                              color:'#2E3458',
                              size:17
                          }
                      },
                      Firewall: {
                          image: '/vienna_images/firewall-active.png',
                          shape: 'image',
                          size: 30,
                          font: {
                              color:'#2E3458',
                              size:17
                          }
                      },
                      FirewallAlert: {
                          image: '/vienna_images/firewall-alert.png',
                          shape: 'image',
                          size: 30,
                          font: {
                              color:'#2E3458',
                              size:17
                          }
                      },
                      Router: {
                          image: '/vienna_images/router-active.png',
                          shape: 'image',
                          size: 30,
                          font: {
                              color:'#2E3458',
                              size: 17
                          }
                      },
                      RouterAlert: {
                          image: '/vienna_images/router-alert.png',
                          shape: 'image',
                          size: 30,
                          font: {
                              color:'#2E3458',
                              size: 17
                          }
                      },
                      App: {
                          image: '/vienna_images/application.png',
                          shape: 'image',
                          size: 30,
                          font: {
                              color:'#2E3458',
                              size: 17
                          }
                      },
                      Device: {
                          image: '/vienna_images/network_element.png',
                          shape: 'image',
                          size: 30,
                          font: {
                              color:'#2E3458',
                              size: 17
                          }
                      },
                      Server: {
                          image: '/vienna_images/server-active.png',
                          shape: 'image',
                          size: 30,
                          font: {
                              color:'#2E3458',
                              size: 17
                          }
                      },
                      ServerAlert: {
                          image: '/vienna_images/server-alert.png',
                          shape: 'image',
                          size: 30,
                          font: {
                              color:'#2E3458',
                              size: 17
                          }
                      }
                 },

                 edges: {
                     arrows: {
                         middle: {
                             enabled: true,
                             scaleFactor: 0.5
                         }
                     },
                     physics: false,
                     smooth: {
                        enabled: false
                     }
                 },
                 nodes: {
                    physics: false,
                    font: {
                        ital: {
                          color: '#2e3458',
                          size: 14
                        },
                        bold: {
                            color: 'green',
                            size: 15
                        }
                    }
                 },
              }

              // Create a vis network using information received from backend
              network = new vis.Network(element[0], visData, options);

              // Let us immediately stablize the network immediately
              network.stabilize();
              network.fit();

              // Once network gets stablized, we stop the stablization
              network.on('stabilized', (params) => {
                  network.off('stabilized');
              });

              // When a node is selected, we check if there is a dashboard
              // associated with it, if so, we load that dashboard.
              network.on('selectNode', (params) => {
                  // Invoke the passed function
                  $scope.onNodeSelect(params);
              });

              // When a node is dragged, at the end, this function is called.
              // It just prints the locations of the nodes in console. This
              // will help people to fix 'x', 'y' for different nodes,
              // data.nodes will print the nodes information
              network.on('dragEnd', () => {
                  console.log(data.nodes);
                  console.log(network.getPositions());
              });
        });
     }
   };
 });
});
