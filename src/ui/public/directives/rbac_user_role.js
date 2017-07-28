define(function (require) {
  var module = require('ui/modules').get('kibana');
  var _ = require('lodash');
  var chrome = require('ui/chrome');
  require('ui/notify');

  module.directive('rbacUserRole', function ($injector, $http) {

    return {
      restrict: 'EA',
      scope: {
          allowedRoles: '='
      },
      template: require('ui/partials/rbac_user_role.html'),
      link: function ($scope) {
          $scope.rbac_options = false;
          current_user = chrome.getCurrentUser();

          // We need to get all the roles available every time someone is
          // trying to save an object. This is because we need to update the
          // role list in the object if a new role is created or an existing
          // one is deleted.
          // Now get all the roles available
          var posting = $http({
              method: 'GET',
              url: '/api/default/user_groups/'
          }).success(function (data, status, headers, config) {

              var user_roles = [];

              if ($scope.allowedRoles.length == 0) {

                  // This seems to be a request for a new object, let us create
                  // roles information for each existing role and add it. For
                  // current user's role, we automatically set the permission
                  // to modify
                  _.each(data.user_groups, function(role) {
                      var new_role = {'name': role.name, 'permission': '' };
                      // If the role is same as current user, mark the
                      // permission as 'modify'
                      if (role.name === current_user[1]) {
                          new_role.permission = 'modify';
                      }
                      user_roles.push(new_role);
                  });
              } else {

                  // Iterate on all roles from backend and check it in current
                  // allowed-roles list, if it exists there, copy it from
                  // allowed-roles list otherwise create a new one and push it
                  // With this logic, we should finally have the same roles in
                  // the allowed roles list as what we have in backend
                  _.each(data.user_groups, function(role) {
                      var role_found = false;
                      _.each($scope.allowedRoles, function(allow_role) {
                          if (role.name === allow_role.name) {
                              user_roles.push(allow_role);
                              role_found = true;
                          }
                      });

                      // If we didn't found this role in existing allowedRole,
                      // it means this is a newly created role
                      if (!role_found) {
                          var new_role = {'name': role.name, 'permission': '' };
                          user_roles.push(new_role);
                      }
                  });
              }
              $scope.allowedRoles = user_roles;
              $scope.toggle_rbac_options = function(value) {
                  $scope.rbac_options = !$scope.rbac_options;
              }
          }).error(function (data, status, headers, config) {
              notify.error('Unable to fetch user roles')
          });
      }
    };
  });
});
