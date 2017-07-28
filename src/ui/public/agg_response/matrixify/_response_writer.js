define(function (require) {
  return function MatrixedAggResponseWriterProvider(Private) {
    var _ = require('lodash');
    var Table = Private(require('ui/agg_response/tabify/_table'));
    var TableGroup = Private(require('ui/agg_response/tabify/_table_group'));
    var getColumns = Private(require('ui/agg_response/tabify/_get_columns'));

    /**
     * Writer class that collects information about an aggregation response and
     * produces a table, or a series of tables.
     *
     * @param {Vis} vis - the vis object to which the aggregation response correlates
     */
    function MatrixedAggResponseWriter(vis, esResp, opts) {
      this.vis = vis;
      this.esResp = esResp;
      this.opts = opts || {};
      this.rowBuffer = [];

      // if true, values will be wrapped in aggConfigResult objects which link them
      // to their aggConfig and enable the filterbar and tooltip formatters
      this.asAggConfigResults = !!this.opts.asAggConfigResults;

      this.columns = getColumns(vis, this.minimalColumns);

      this.aggStack = _.pluck(this.columns, 'aggConfig');

      this.root = new TableGroup();
      var table = new Table();
      this.root.tables.push(table);
    }

    /**
     * Get the actual response
     *
     * @return {object} - the final table-tree
     */
    MatrixedAggResponseWriter.prototype.response = function () {
      return this.root;
    };

    return MatrixedAggResponseWriter;
  };
});
