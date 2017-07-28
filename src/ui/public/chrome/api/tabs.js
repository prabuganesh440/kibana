var _ = require('lodash');
var TabCollection = require('../TabCollection');

module.exports = function (chrome, internals) {

  internals.tabs = new TabCollection({
    defaults: {
      baseUrl: `${chrome.getAppUrl()}#/`
    }
  });

  /**
   * ui/chrome tabs API
   *
   *   The navbar at the top of the page can be assigned links which will
   *   pile up on the left. Each of these links has several properties that define
   *   how it is rendered, how it looks when it's "active" and what happens when
   *   it's clicked.
   *
   *   To define a set of tabs, pass setTabs an array of TabSpec objects,
   *   which are just plain objects with the following properties:
   *
   *   id {string}
   *     a unique value for this tab, should match the first path segment of
   *     routes that are supposed to belong to this tab and is matched against the route
   *     everytime it changes. When clicking the tab for the first time the user will be
   *     sent to the '/${tab.id}' url which you can use to redirect to another url if needed
   *
   *   title {string}
   *     the text the tab should show
   *
   *   resetWhenActive {boolean}
   *     when the the tab is considered active, should clicking it
   *     cause a redirect to just the id?
   *
   *   trackLastUrl {boolean}
   *     When this tab is active, should the current path be tracked
   *     and persisted to session storage, then used as the tabs href attribute when the user navigates
   *     away from the tab?
   *
   *   activeIndicatorColor {string}
   *     css color string that will be used to style the active
   *     indicator applied to tabs which are currently active.
   */

  /**
   * @param {TabSpec[]} tabSpecs
   * @return {chrome}
   */
  chrome.setTabs = function (tabSpecs) {
    internals.tabs.set(tabSpecs);
    return chrome;
  };

  /**
   * @param {Object} defaults - defaults used for each tab
   * @return {chrome}
   */
  chrome.setTabDefaults = function (defaults) {
    internals.tabs.setDefaults(defaults);
    return chrome;
  };

  /**
   * @return {Tab[]}
   */
  chrome.getTabs = function () {
    return internals.tabs.get();
  };

 /**
   * This function will return the first 3 tabs which
   * are displayed as navbar. These are most commonly used tabs.
   */
  chrome.getNavbarTabs = function () {
    return  internals.tabs.get().slice(0,3); // get the first three tabs from chrome.setTabs
  }

/**
   * This function will return the last 3 tabs which
   * are displayed as dropdown. These are not commonly used by the user.
   */
  chrome.getDropdownTabs = function () {
    return  internals.tabs.get().slice(3,6); // get the last three tabs from chrome.setTabs
  }

  /**
   * @return {Tab}
   */
  chrome.getActiveTab = function () {
    return internals.tabs.getActive();
  };

  
  chrome.getDropdownActiveTab = function () {
      var config_options = chrome.getDropdownTabs(); // get all the tab objects for dropdown
      var config_options_title = [];                 // initializing an array for tab titles
      for(var count=0; count<config_options.length; count++) //preparing array of titles of
                                                             // the dropdown tabs
      {
          config_options_title.push(config_options[count].title);
      }
      // checking if the current active tab selected is present under dropdown
      // if present return the tab title
      // else return string 'options'
      if(config_options_title.indexOf(chrome.getActiveTabTitle()) >= 0)
      {
          return chrome.getActiveTabTitle().toUpperCase();
      }
      else
      {
          return 'OPTIONS';
      }
  }

  /**
   * @param {any} def - the default value if there isn't any active tab
   * @return {any}
   */
  chrome.getActiveTabId = activeGetter('id');

  /**
   * @param {any} def - the default value if there isn't any active tab
   * @return {any}
   */
  chrome.getActiveTabTitle = activeGetter('title');

  // create a getter for properties of the active tab
  function activeGetter(prop) {
    return function (def) {
      var active = chrome.getActiveTab();
      return !active ? def : active[prop];
    };
  }

};
