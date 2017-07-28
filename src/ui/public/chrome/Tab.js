const _ = require('lodash');
const reEsc = require('lodash').escapeRegExp;
const { parse, format } = require('url');

const urlJoin = (a, b) => {
  if (!b) return a;
  return `${a}${ a.endsWith('/') ? '' : '/' }${b}`;
};

export default class Tab {
  constructor(spec = {}) {
    this.id = spec.id || '';
    this.title = spec.title || '';
    this.resetWhenActive = !!spec.resetWhenActive;
    this.activeIndicatorColor = spec.activeIndicatorColor || null;
    if (_.isFunction(this.activeIndicatorColor)) {
      // convert to a getter
      Object.defineProperty(this, 'activeIndicatorColor', {
        get: this.activeIndicatorColor
      });
    }

    this.active = false;

    this.baseUrl = spec.baseUrl || '/';
    this.rootUrl = urlJoin(this.baseUrl, this.id);

    // As the rootUrl now carries '/Home', we need to change the rootRegExp to
    // still use the old URL. This is used to make a particular tab active
    // based on the URL accessed. Here are the URLs example:
    // Root url for report is:
    // http://127.0.0.1/app/kibana#/report/Home
    // URLs from Report tab would contains
    // http://127.0.0.1/app/kibana#/report/<report-name>(Other things in url)
    // So if rootRegExp uses the above mentioned rootURL, the URLs from object instance
    // can never match the regex and so the tab will be set to active.
    // Please refer to the code in this.consumeRouteUpdate() in file
    // src/ui/public/chrome/TabCollection.js
    this.rootUrlWoHome = this.rootUrl.replace(/\/Home/, "");
    this.rootRegExp = new RegExp(`^${reEsc(this.rootUrlWoHome)}(/|$|\\?|#)`);

    this.lastUrlStoreKey = `lastUrl:${this.id}`;
    this.lastUrlStore = spec.lastUrlStore;
    this.lastUrl = this.lastUrlStore ? this.lastUrlStore.getItem(this.lastUrlStoreKey) : null;
  }

  href() {
    if (this.active) {
      return this.resetWhenActive ? this.rootUrl : null;
    }
    return this.lastUrl || this.rootUrl;
  }

  updateLastUrlGlobalState(globalState) {
    let lastPath = this.getLastPath();
    let { pathname, query, hash } = parse(lastPath, true);

    query = query || {};
    if (!globalState) delete query._g;
    else query._g = globalState;

    // If pathname is available, it means we are pointing to an instance
    if (pathname) {
        this.setLastUrl(`${this.rootUrlWoHome}${format({ pathname, query, hash })}`);
    } else {
        this.setLastUrl(`${this.rootUrl}${format({ pathname, query, hash })}`);
    }
  }

  getLastPath() {
    let { id, rootUrl } = this;
    let lastUrl = this.getLastUrl();

    if (!lastUrl.startsWith(this.rootUrlWoHome)) {
      throw new Error(`Tab "${id}" has invalid root "${rootUrl}" for last url "${lastUrl}"`);
   }

    let splice_len;
    if (lastUrl.search(/\/Home$/) == -1) {
        splice_len = this.rootUrlWoHome.length;
    } else {
        splice_len = rootUrl.length;
    }

    //return lastUrl.slice(rootUrl.length);
    return lastUrl.slice(splice_len);
  }

  setLastUrl(url) {
    this.lastUrl = url;
    if (this.lastUrlStore) this.lastUrlStore.setItem(this.lastUrlStoreKey, this.lastUrl);
  }

  getLastUrl() {
    return this.lastUrl || this.rootUrl;
  }
}
