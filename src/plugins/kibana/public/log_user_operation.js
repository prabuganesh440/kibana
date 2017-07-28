// This function will make a api call to vusmartmaps
    // to log the user operations like load, save and delete.
    // This will take the request method, vienna object type and
    // object id as input
define( function(logUserOperation) {
    return {
      logUserOperation:  function($http, method, type, id) 
      {
        var operationObject = $http({
          method: method,
          url: '/vuSmartMaps/api/1/vienna/' + type + '/' + id +'/',
          data: {},
          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        }).success(function (data, status, headers, config) {});
      }
    }
  });

