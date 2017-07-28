define(function (require) {
  return function tabifyAggResponseProvider(Private, Notifier) {
    var _ = require('lodash');

    var AggConfig = Private(require('ui/Vis/AggConfig'));
    var TabbedAggResponseWriter = Private(require('ui/agg_response/tabify/_response_writer'));
    var Buckets = Private(require('ui/agg_response/tabify/_buckets'));
    var notify = new Notifier({ location: 'agg_response/tabify'});

    function tabifyAggResponse(vis, esResponse, respOpts) {
      var write = new TabbedAggResponseWriter(vis, respOpts);

      var topLevelBucket = _.assign({}, esResponse.aggregations, {
        doc_count: esResponse.hits.total
      });

      // If metricsInPercentage is true, it means we need to show the metric
      // along with percentage in brackets
      if (respOpts && respOpts.metricsInPercentage) {
          calculateSum(write, topLevelBucket);
      }

      collectBucket(write, topLevelBucket);

      return write.response();
    }

    // This function is called when a flag MetricsInPercentage is enabled and
    // it calculates the SUM of the numbers for each term which is later
    // used to calculate percentage.
    //
    // A table with 1 term and 1 metric with percentage will look as follows:
    //
    // term-1      Metric (count)
    // 1.1.1.1     20  (50%)
    // 2.2.2.2     20  (50%)
    //
    // This function calculates the sum (20+20 = 40) and add it into sumDict
    // with '.single-term' as the key which is later used when sum is
    // populated in AggConfigResult
    //
    // A table with 2 Metrics (count, sum) and 2 terms will looks as follows:
    //
    // term-1      term-2      Metric-1 (count)   Metric-2 (sum)
    // 1.1.1.1     eth0         5                 5000
    // 1.1.1.1     eth1         5                 10000
    // 1.1.1.1     eth2         5                 20000
    // 1.1.1.1     eth3         5                 15000
    // 2.2.2.2     eth0         10                1000
    // 2.2.2.2     eth1         20                1000
    //
    // This function calculate sum for 1st metric as 20 and second metric as
    // 50000 for 1.1.1.1 and 30 for 1st metric and 2000 for 2nd metric for
    // 2.2.2.2. It is then populated in AggConfigResult and used to calculate
    // the %age of each metric. This is how it will look like:
    //
    // term-1      term-2      Metric-1 (count)   Metric-2 (sum)
    // 1.1.1.1     eth0         5 (25%)            5000  (10%)
    // 1.1.1.1     eth1         5 (25%)            10000 (20%)
    // 1.1.1.1     eth2         5 (25%)            20000 (40%)
    // 1.1.1.1     eth3         5 (25%)            15000 (30%)
    // 2.2.2.2     eth0         10 (33.33%)        1000 (50%)
    // 2.2.2.2     eth1         20 (66.66%)        1000 (50%)
  
    function calculateSum(write, bucket, key) {
      var agg = write.aggStack.shift();
      switch (agg.schema.group) {
        case 'buckets':
          var buckets = new Buckets(bucket[agg.id]);
          if (buckets.length) {
            var splitting = write.canSplit && agg.schema.name === 'split';
            // Currently we don't support splitting
            if (!splitting) {
              buckets.forEach(function (subBucket, key) {
                write.calcSum(agg, agg.getKey(subBucket, key), function () {
                  calculateSum(write, subBucket, agg.getKey(subBucket, key));
                });
              });
            }
          }
          break;
        case 'metrics':
          var value = agg.getValue(bucket);
          var sumValDict;
          if (write.calcSumRowBuffer.length > 1) {
              if (write.calcSumRowBuffer[0] in write.sumDict) {
                sumValDict = write.sumDict[write.calcSumRowBuffer[0]];
              } else {
                write.sumDict[write.calcSumRowBuffer[0]] = {};
                sumValDict = write.sumDict[write.calcSumRowBuffer[0]];
              }
          } else {
              if ('.single-term' in write.sumDict) {
                sumValDict = write.sumDict['.single-term'];
              } else {
                write.sumDict['.single-term'] = {};
                sumValDict = write.sumDict['.single-term'];
              }
          }
          
          var sum = 0;
          if (agg.id in sumValDict) {
              sum = sumValDict[agg.id];
          } else {
              sumValDict[agg.id] = 0;
          }
          sum += value
          sumValDict[agg.id] = sum
          if (write.aggStack.length) {
              // process the next agg at this same level
              calculateSum(write, bucket, key);
          }
      }
      write.aggStack.unshift(agg);
    }

    /**
     * read an aggregation from a bucket, which is *might* be found at key (if
     * the response came in object form), and will recurse down the aggregation
     * tree and will pass the read values to the ResponseWriter.
     *
     * @param {object} bucket - a bucket from the aggResponse
     * @param {undefined|string} key - the key where the bucket was found
     * @returns {undefined}
     */
    function collectBucket(write, bucket, key) {
      var agg = write.aggStack.shift();

      switch (agg.schema.group) {
        case 'buckets':
          var buckets = new Buckets(bucket[agg.id]);
          if (buckets.length) {
            var splitting = write.canSplit && agg.schema.name === 'split';
            if (splitting) {
              write.split(agg, buckets, function forEachBucket(subBucket, key) {
                collectBucket(write, subBucket, agg.getKey(subBucket), key);
              });
            } else {
              buckets.forEach(function (subBucket, key) {
                write.cell(agg, agg.getKey(subBucket, key), function () {
                  collectBucket(write, subBucket, agg.getKey(subBucket, key));
                });
              });
            }
          } else if (write.partialRows && write.metricsForAllBuckets && write.minimalColumns) {
            // we don't have any buckets, but we do have metrics at this
            // level, then pass all the empty buckets and jump back in for
            // the metrics.
            write.aggStack.unshift(agg);
            passEmptyBuckets(write, bucket, key);
            write.aggStack.shift();
          } else {
            // we don't have any buckets, and we don't have isHierarchical
            // data, so no metrics, just try to write the row
            write.row();
          }
          break;
        case 'metrics':
          var value = agg.getValue(bucket);
          write.cell(agg, value, function () {
            if (!write.aggStack.length) {
              // row complete
              write.row();
            } else {
              // process the next agg at this same level
              collectBucket(write, bucket, key);
            }
          });
          break;
      }

      write.aggStack.unshift(agg);
    }

    // write empty values for each bucket agg, then write
    // the metrics from the initial bucket using collectBucket()
    function passEmptyBuckets(write, bucket, key) {
      var agg = write.aggStack.shift();

      switch (agg.schema.group) {
        case 'metrics':
          // pass control back to collectBucket()
          write.aggStack.unshift(agg);
          collectBucket(write, bucket, key);
          return;

        case 'buckets':
          write.cell(agg, '', function () {
            passEmptyBuckets(write, bucket, key);
          });
      }

      write.aggStack.unshift(agg);
    }

    return notify.timed('tabify agg response', tabifyAggResponse);
  };
});
