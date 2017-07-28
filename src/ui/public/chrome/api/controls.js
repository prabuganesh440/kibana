var _ = require('lodash');

module.exports = function (chrome, internals) {
  /**
   * ui/chrome Controls API
   *
   *   Exposes controls for the Kibana chrome
   *
   *   Visible
   *     determines if the Kibana chrome should be displayed
   */

  var def = true;
  internals.setVisibleDefault = (_def) => def = Boolean(_def);

  /**
   * @param {boolean} display - should the chrome be displayed
   * @return {chrome}
   */
  chrome.setVisible = function (display) {
    internals.visible = Boolean(display);
    return chrome;
  };

  chrome.showOptionsTab = function() {
      if(internals.app.id == 'statusPage')
      {
         return false;
      }
      else
      {
        return true;
      }
  }



  /**
   * @return {boolean} - display state of the chrome
   */
  chrome.getVisible = function () {
    if (_.isUndefined(internals.visible)) return def;
    return internals.visible;
  };

  /**
   * @return {current user, role and permission} - get current user
   */
  chrome.getCurrentUser = function () {
    return [internals.user_name, internals.user_role, internals.user_permission];
  };

  chrome.getShipperUrl = function () {
    return internals.shipper_url;
  };

  chrome.isCurrentUserAdmin = function () {
    if (internals.user_permission === 'admin') {
        return true;
    } else {
        return false;
    }
  };

  /**
   * @return {current user, role and permission} - Return True if the current
   * logged in user is allowed to create new objects
   */
  chrome.canCurrentUserCreateObject = function () {
    if (internals.user_permission === 'modify' || internals.user_permission === 'admin') {
        return true;
    } else {
        return false;
    }
  };

  // Find if the current logged in user can modify a object. We figure this out
  // by checking if the current user's user-role is allowed to modify the
  // object
  chrome.canCurrentUserModifyPermissions = function(allowedRoles) {

     // For a new object, let us allow
     if (allowedRoles.length == 0) {
         return true;
     } else {

         var user_allowed_to_modify = false;

         // If the user has a modify permission on this object, we allow him to
         // modify the permissions as well
         _.each(allowedRoles, function(role) {
             if (role.name === internals.user_role && role.permission === 'modify') {
                 user_allowed_to_modify = true;
             }
         });

         return user_allowed_to_modify;
     }
  };

  chrome.getUserHomeDashboard = function() {
      if (internals.user_home_dashboard == '') {
          return '/' + chrome.getInjected('kbnDefaultAppId', 'dashboard')
      }
      return '/dashboard/' + internals.user_home_dashboard;
  };

};
