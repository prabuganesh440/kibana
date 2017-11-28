define(function (require) {
  var _ = require('lodash');
  var module = require('ui/modules').get('app/discover');

  require('ui/filters/short_dots');

var elasticsearch = require('node_modules/elasticsearch-browser/elasticsearch');
var client = new elasticsearch.Client({
  host: 'localhost:9200',
  log: 'trace'
});

// We define an Angular controller that returns query results,
// Inputs: $scope and the 'es' service
//------------------end---------------------------------

  module.directive('kbnTableHeader', function (shortDotsFilter) {

    var headerHtml = require('ui/doc_table/components/table_header.html');

    return {
      //require: '^?es',
      restrict: 'A',
      scope: {
        columns: '=',
        aliasName: '=',
        sorting: '=',
        indexPattern: '=',
      },
      template: headerHtml,
      controller: function ($scope,$rootScope) {

        var sortableField = function (field) {
          if (!$scope.indexPattern) return;
          var sortable = _.get($scope.indexPattern.fields.byName[field], 'sortable');
          return sortable;
        };

        $scope.tooltip = function (column) {
          if (!sortableField(column)) return '';
          return 'Sort by ' + shortDotsFilter(column);
        };

        $scope.canRemove = function (name) {
          return (name !== '_source' || $scope.columns.length !== 1);
        };

        $scope.canEdit = function (name) {
          // return (name !== '_source' || $scope.columns.length !== 1);
          return 1;
        };

        $scope.headerClass = function (column) {
          if (!sortableField(column)) return;

          var sorting = $scope.sorting;
          var defaultClass = ['fa', 'fa-sort-up', 'table-header-sortchange'];

          if (!sorting || column !== sorting[0]) return defaultClass;
          return ['fa', sorting[1] === 'asc' ? 'fa-sort-up' : 'fa-sort-down'];
        };

        $scope.moveLeft = function (column) {
          var index = _.indexOf($scope.columns, column);
          if (index === 0) return;

          _.move($scope.columns, index, --index);
        };

        $scope.moveRight = function (column) {
          var index = _.indexOf($scope.columns, column);
          if (index === $scope.columns.length - 1) return;

          _.move($scope.columns, index, ++index);
        };



        $scope.toggleColumn = function (fieldName) {
            $scope.deleteAliasById($rootScope.SearchName,fieldName);
          _.toggleInOut($scope.columns, fieldName);
        };

        $scope.saveAliasES = function(indexName,fieldName,userAliasName)
        {
          if(indexName)
          {
            client.index({
                index: indexName,
                type: 'alias',
                id: fieldName,
                body:{
                    properties:{
                      aliasName : userAliasName
                    }
                }
            });
          }

        }

        $scope.deleteAliasById = function(indexName,idName)
        {
          if(!format.test(idName))
          {
            idName = idName.replace(/[^a-zA-Z_0-9]/g, '');
          }
          client.delete({
                  index: indexName,
                  type: 'alias',
                  id: idName
            },function(response)
              {
          });
        }

        $scope.deleteAlias = function(indexName)
        {
          client.indices.delete({
              index: indexName
          });
        }

        $scope.initAlias = function()
        {
          // $scope.deleteAlias();
          var initAlias = "Initialize";
          var initField = "Init";
          setTimeout(function(){
            client.index({
                index: $rootScope.SearchName,
                type: 'alias',
                id: initField,
                body:{
                    properties:{
                      aliasName : initAlias
                    }
                }
            });
          },200);
        }

        $rootScope.$on('removeAliases', function (event, args) {
            $scope.deleteAliasById($rootScope.SearchName,args.removeField);
        });

        $rootScope.$on('saveAliases', function (event, args) {
            client.search({
            index: $rootScope.SearchName,
            type: 'alias',
            method:'GET',
            }).then(function (response) {
              if($rootScope.newReport)
              {
                $scope.deleteAlias($rootScope.SearchName);
                setTimeout(function(){
                  client.search({
                    index: args.searchName,
                    type: 'alias'
                  }).then(function(response){
                      $scope.hits = response.hits.hits;
                      if($scope.hits.length > 0)
                      {
                        $scope.deleteAlias(args.searchName);
                      }
                  })
                },200);
              }
              setTimeout(function(){
                $scope.hits = response.hits.hits;
                if($scope.hits.length > 0)
                {
                  for(var i=0;i<$scope.hits.length;i++)
                  {
                    $scope.saveAliasES(args.searchName,response.hits.hits[i]._id,response.hits.hits[i]._source.properties.aliasName);
                  }
                }
              },1000);
            });
        });

        $scope.getAliasES = function(fieldName)
        {
          var originalName = fieldName;
          if(!format.test(fieldName))
          {
            fieldName = fieldName.replace(/[^a-zA-Z_0-9]/g, '');
          }
          var alisName;
          $scope.newAlisName = undefined;
          if($rootScope.SearchName)
          {
            client.search({
            index: $rootScope.SearchName,
            type: 'alias',
            method:'GET',
            q:"_id:"+fieldName
            }).then(function (response) {
               $scope.hits = response.hits.hits;
               if($scope.hits.length > 0)
               {
                 $scope.newAlisName = $scope.hits[0]._source.properties.aliasName;
               }

               if(angular.isUndefined($scope.newAlisName))
               {
                 // alert("origina name = "+originalName);
                 $("#S_"+fieldName).text(originalName);
               }
               else {
                 // alert("new alias name = "+$scope.newAlisName);
                 $("#S_"+fieldName).text($scope.newAlisName);
               }
            });
          }
        }

        $scope.SCReplace = function(fieldName)
        {
          if(!format.test(fieldName))
          {
            $scope.rname = fieldName.replace(/[^a-zA-Z ]/g, '');
          }
        }

        $scope.AliasFilter = function(fieldName)
        {
          var originalName = fieldName;
          if(!format.test(fieldName))
          {
            fieldName = fieldName.replace(/[^a-zA-Z_0-9]/g, '');
          }
          if($rootScope.load)
          {
            setTimeout(function(){
              var alisName;
              $scope.newAlisName = undefined;
              if($rootScope.SearchName)
              {
                client.search({
                index: $rootScope.SearchName,
                type: 'alias',
                method:'GET',
                q:"_id:"+fieldName
                }).then(function (response) {
                   $scope.hits = response.hits.hits;
                   if($scope.hits.length > 0)
                   {
                     $scope.newAlisName = $scope.hits[0]._source.properties.aliasName;
                   }
                   if(angular.isUndefined($scope.newAlisName))
                   {
                     $("#S_"+fieldName).text(originalName);
                   }
                   else {
                     $("#S_"+fieldName).text($scope.newAlisName);
                   }
                });
              }
            },100);
            $rootScope.load = true;
          }
          else{
            $scope.deleteAlias($rootScope.SearchName);
            setTimeout(function(){
              $("#S_"+fieldName).text(originalName);
              $rootScope.load = true;
              $scope.initAlias();
            },100);
          }
        }

        var format = /^[a-z0-9\s]*$/i;
        $scope.formatt = /[^a-zA-Z ]/g;

        $scope.saveAlias = function(fieldName)
        {
          var originalName = fieldName;
          if(!format.test(fieldName))
          {
            fieldName = fieldName.replace(/[^a-zA-Z_0-9]/g, '');
          }

          var ModifiedAliasName;
          var aliasText = $("#T_"+fieldName).val();
          // alert("search name for save = "+$rootScope.SearchName);
          $scope.saveAliasES($rootScope.SearchName,fieldName,aliasText);
          setTimeout(function(){
              $scope.getAliasES(originalName);
              setTimeout(function(){
                // $("#\\"+fieldName).toggle();
                var spCheck= fieldName.charAt(0);
                if(format.test(spCheck))
                {
                  $("#"+fieldName).toggle();
                }
                else {
                  $("#\\"+fieldName).toggle();
                }
              },200);
          },1000);
        };

        $scope.setaliasName = function(fieldName)
        {
          var originalName = fieldName;
          if(!format.test(fieldName))
          {
            fieldName = fieldName.replace(/[^a-zA-Z_0-9]/g, '');
          }
          $scope.getAliasES(originalName);
          setTimeout(function(){
            if(angular.isUndefined($scope.newAlisName))
            {
              $("#T_"+fieldName).val(originalName);
            }
            else {
              $("#T_"+fieldName).val($scope.newAlisName);
            }

            // fieldName.includes("_")
            var spCheck= fieldName.charAt(0);
            if(format.test(spCheck))
            {
              $("#"+fieldName).toggle();
            }
            else {
              $("#\\"+fieldName).toggle();
            }
          },100);
        };

        $scope.sort = function (column) {
          if (!column || !sortableField(column)) return;

          var sorting = $scope.sorting = $scope.sorting || [];

          var direction = sorting[1] || 'asc';
          if (sorting[0] !== column) {
            direction = 'asc';
          } else {
            direction = sorting[1] === 'asc' ? 'desc' : 'asc';
          }

          $scope.sorting[0] = column;
          $scope.sorting[1] = direction;
        };
      }
    };
  });
});
