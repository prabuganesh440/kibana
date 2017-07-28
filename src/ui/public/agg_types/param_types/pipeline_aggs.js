define(function (require) {
  return function PipeLineAggParamFactory(Private) {
    var _ = require('lodash');

    var BaseAggParam = Private(require('ui/agg_types/param_types/base'));
    var editorHtml = require('ui/agg_types/controls/pipeline_aggs.html');

    _.class(PipeLineAggParam).inherits(BaseAggParam);
    function PipeLineAggParam(config) {
      // force name override
      config = _.defaults(config, { name: 'pipeline_aggs' });
      PipeLineAggParam.Super.call(this, config);
    }
    PipeLineAggParam.prototype.editor = editorHtml;


    /**
     * Write the aggregation parameter.
     *
     * @param  {AggConfig} aggConfig - the entire configuration for this agg
     * @param  {object} output - the result of calling write on all of the aggregations
     *                         parameters.
     * @param  {object} output.params - the final object that will be included as the params
     *                               for the agg
     * @return {undefined}
     */
    PipeLineAggParam.prototype.write = function (aggConfig, output) {
      if (aggConfig.params[this.name] && aggConfig.params[this.name].length) {
          output.params[this.name] = aggConfig.params[this.name];
      }
    };
    return PipeLineAggParam;
  };
});
