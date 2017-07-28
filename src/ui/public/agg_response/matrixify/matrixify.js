define(function (require) {
  return function matrixifyAggResponseProvider(Private, Notifier, timefilter) {
    var _ = require('lodash');
    var moment = require('moment');
    var AggConfig = Private(require('ui/Vis/AggConfig'));
    var MatrixedAggResponseWriter = Private(require('ui/agg_response/matrixify/_response_writer'));
    var notify = new Notifier({ location: 'agg_response/matrixify'});
    var AggConfigResult = require('ui/Vis/AggConfigResult');

    // variables used to store time constants that can be used
    // for calcuation
    var HRS_IN_DAY = 24;
    var MINS_IN_HR = 60;
    var SECONDS_IN_MIN = 60;
    var MILLISECONDS_IN_SECOND = 1000;

    // This function will round of a given number to 1 point 
    // after decimal
    var roundOffToOneDigit = function (new_val) {
      return Math.round(new_val*10)/10;
    }

    // This function will take input values in any units of time
    // and convert the input values to milli seconds
    var convert_to_milliseconds = function (inputTimeFormat, value) {
      switch (inputTimeFormat) {

        case 'millisecond': return value;

        case 'second':  return value * MILLISECONDS_IN_SECOND;

        case 'minute':  return value * MILLISECONDS_IN_SECOND * SECONDS_IN_MIN;

        case 'hour':  return value * MILLISECONDS_IN_SECOND * SECONDS_IN_MIN * MINS_IN_HR;

        case 'day':  return value * MILLISECONDS_IN_SECOND * SECONDS_IN_MIN * MINS_IN_HR * HRS_IN_DAY;

        default:   return value;
      }
    }

    // This function will take time values in one unit and convert it to another
    // unit.
    // inputTimeFormat: input unit of time( it can be in ms, sec, min, hour, day)
    // outputTimeFormat: output unit of time ( it can be in ms, sec, min, hour, day)
    // value: can positive integers of time values
    var changeOutputTimeFormat = function ( inputTimeFormat, outputTimeFormat, value )
    {
      var new_val = convert_to_milliseconds(inputTimeFormat, value);
      
      switch (outputTimeFormat) {

        case 'millisecond': return new_val;

        case 'second':     new_val = new_val / MILLISECONDS_IN_SECOND;
                           return roundOffToOneDigit(new_val);

        case 'minute':     new_val = new_val / MILLISECONDS_IN_SECOND / SECONDS_IN_MIN;
                           return roundOffToOneDigit(new_val);

        case 'hour':     new_val = new_val / MILLISECONDS_IN_SECOND / SECONDS_IN_MIN / MINS_IN_HR;
                         return roundOffToOneDigit(new_val);

        case 'day':     new_val = new_val / MILLISECONDS_IN_SECOND /SECONDS_IN_MIN / MINS_IN_HR / HRS_IN_DAY;
                        return roundOffToOneDigit(new_val);

        default:        return new_val;
      }
    }

    function matrixifyAggResponse(vis, esResponse, respOpts) {

      // This is used to get the start time and 
      // end time from global time selector.
      // We then calculate the duration, start date
      // no of days which will be used in the below code 
      // to get the collapsed time headers
      var input = timefilter.getActiveBounds();
      if (_.isPlainObject(input)) {
          bounds = [input.min, input.max];
      }
      else {
          bounds = _.isArray(input) ? input : [];
      }
      var moments = _(bounds)
                    .map(_.ary(moment, 1))
                    .sortBy(Number);

      // moments.pop() gives the end time
      // moments.shift() gives the start time
      // calculate the time duration using them.
      duration = moment.duration(moments.pop() - moments.shift(),'ms');
      startDate = moments.shift()._d;
      startDay = new Date(startDate).getDate();
      noOfDays = duration._data.days;

      var write = new MatrixedAggResponseWriter(vis, esResponse, respOpts);

      if(esResponse.aggregations)
      {
          processAggregations(vis, write, esResponse.aggregations);
      }

      return write.response();
    }

    var monthNames =  ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
                      ];

    // This function takes date time attributes and round them off to 
    // 2 digit numbers.
    Number.prototype.padLeft = function(base,chr) {
               var  len = (String(base || 10).length - String(this).length)+1;
               return len > 0? new Array(len).join(chr || '0')+this : this;
            }

    function processAggregations(vis, write, aggregations) {

      // Get the configured aggregations from the stack..
      var agg_1_agg = write.aggStack[0];
      var key_agg = write.aggStack[1];
      // If sub-aggrgation is not configured, don't populate value-agg
      if ( write.aggStack.length > 2 ) {
          var value_agg = write.aggStack[2];
      }

      // Columns are based on first level of aggregations.. we need to get the
      // key of the first level and that will make the columns

      // We are interested in buckets alone, iterate on aggStack from Vis
      // First level is based on aggregation configuration
      var buckets = aggregations[agg_1_agg.id].buckets;
      var key;
      var rows = [];
      var row_dict = {};
      var columns = [];
      var column;

      // We add the first column only if we have a sub-aggregation
      if (write.aggStack.length > 2) {
          // First column is the name of the aggregation
          column = { title: key_agg.makeLabel(),
                     aggConfig: agg_1_agg
                   };
          columns.push(column);
      }

      // Iterate on buckets to populate the columns.. Columns are populated
      // using the first aggregation configured under bucket.. Usually it will
      // be Date-Histogram but it can be a term as well

      // dCount is used to display dates in D1,D2... format
      var dCount = 1;

      // dayOffsetDataList is a list which will hold the index of all the dates
      // for which there are values
      var dayOffsetDataList = [];
      buckets.map( function(bucket) {
          // Get the key_as_string or key
          // prepare and display the date time string in the format:
          // YYYY MM DD HH:MM:SS
          if (_.has(bucket, 'key_as_string') ) {
              // Only Date Histogram buckets have key_as_string
              // Terms do not have these.
              dateObj = new Date(bucket.key_as_string);

              if (isNaN( dateObj.getTime())) {
                  // This is the case where 'Date()' doesn't understand the
                  // format. We currently know one of the format which Date()
                  // doesn't understand.. try to check for that.. we check it
                  // based on the length of the words separated by space.
                  key_array = bucket.key_as_string.split(' ');

                  // If key_as_string have 2016-12-03 19:12:00, we can parse it
                  // to create similar key
                  if ( key_array.length == 2 ) {
                      date_array = key_array[0].split('-');
                      var month = monthNames[parseInt(date_array[1]) - 1];
                      var date_string = date_array[2] + " " + month + " " + date_array[0];
                      var time_string = key_array[1];

                      // if collapseTimeHeaders checkbox is enabled then
                      // prepare the date headers  in D1, D2... format
                      if(vis.params.collapseTimeHeaders === true) {

                        var cur_day = moment(dateObj);
                        var stDate =  moment(startDate);
                        var day_diff = cur_day.diff(stDate, 'days', true);
                        var day_offset = day_diff + 1;

                        // Add the missing column headers / date headers
                        if(dCount < day_offset)
                        { 
                          var diff = day_offset-dCount;
                          for(item=0; item<diff; item=item+1)
                          {
                            key = 'D' + dCount;

                            // Populate the title and aggConfigResult... aggConfigResult is used
                            // by Filtering to allow drill-down
                            column = { title: key,
                                       aggConfigResult: new AggConfigResult(agg_1_agg, 'undefined', key, key),
                                       aggConfig: agg_1_agg 
                                     };
                            columns.push(column);
                            dCount = dCount + 1;
                          }
                        }

                        // If date header exists add it to dayOffsetDataList
                        dayOffsetDataList.push(dCount);
                        key = 'D' + dCount;
                        column = { title: key,
                                     aggConfigResult: new AggConfigResult(agg_1_agg, 'undefined', key, key),
                                     aggConfig: agg_1_agg 
                                   };
                        columns.push(column);
                        dCount = dCount + 1;
                      }
                      else {
                        dayOffsetDataList.push(dCount);
                        key = dateString + " " + timeString;
                        // Populate the title and aggConfigResult... aggConfigResult is used
                        // by Filtering to allow drill-down
                        column = { title: key,
                                   aggConfigResult: new AggConfigResult(agg_1_agg, 'undefined', key, key),
                                   aggConfig: agg_1_agg 
                                 };
                        columns.push(column);
                        dCount = dCount + 1;
                      }
                  } else {
                      // We really don't understand this date format so let us
                      // use the same as what we have received
                      key = bucket.key_as_string;
                  }
              } else {
                  // Looks like Date() understand the date, lets parse it and
                  // create the proper one
                  var month = monthNames[dateObj.getMonth()];
                  var day = dateObj.getDate().padLeft();
                  var year = dateObj.getFullYear().padLeft();
                  var hour = dateObj.getHours().padLeft();
                  var minute = dateObj.getMinutes().padLeft();
                  var second = dateObj.getSeconds().padLeft();
                  var dateString = day + " " + month + " " + year;
                  var timeString = hour + ":" + minute + ":" + second;
                  
                  // if collapseTimeHeaders checkbox is enabled then
                  // prepare the date headers  in D1, D2... format
                  if(vis.params.collapseTimeHeaders === true) {

                    var cur_day = moment(dateObj);
                    var stDate =  moment(startDate);

                    // find the duration in no of days by finding the 
                    // difference between start time(stDate) and current
                    // time(cur_day) in days
                    var day_diff = cur_day.diff(stDate, 'days', true);
                    var day_offset = day_diff + 1;

                    // Add the missing column headers / date headers
                    if(dCount < day_offset)
                    { 
                      var diff = day_offset-dCount;
                      for(item=0; item<diff; item=item+1)
                      {
                      
                        key = 'D' + dCount;
                        // Populate the title and aggConfigResult... aggConfigResult is used
                        // by Filtering to allow drill-down
                        column = { title: key,
                                   aggConfigResult: new AggConfigResult(agg_1_agg, 'undefined', key, key),
                                   aggConfig: agg_1_agg 
                                 };
                        columns.push(column);
                        dCount = dCount + 1;
                      }
                    }
                
                    // If date header exists add it to dayOffsetDataList
                    dayOffsetDataList.push(dCount);
                    key = 'D' + dCount;
                    column = { title: key,
                                 aggConfigResult: new AggConfigResult(agg_1_agg, 'undefined', key, key),
                                 aggConfig: agg_1_agg 
                               };
                    columns.push(column);
                    dCount = dCount + 1;
                
                  }
                  else {
                    dayOffsetDataList.push(dCount);
                    key = dateString + " " + timeString;
                    // Populate the title and aggConfigResult... aggConfigResult is used
                    // by Filtering to allow drill-down
                    column = { title: key,
                               aggConfigResult: new AggConfigResult(agg_1_agg, 'undefined', key, key),
                               aggConfig: agg_1_agg 
                             };
                    columns.push(column);
                    dCount = dCount + 1;
                  }
              }
          } else {
              dayOffsetDataList.push(dCount);
              key = bucket.key;
              // Populate the title and aggConfigResult... aggConfigResult is used
              // by Filtering to allow drill-down
              column = { title: key,
                         aggConfigResult: new AggConfigResult(agg_1_agg, 'undefined', key, key),
                         aggConfig: agg_1_agg 
                       };
              columns.push(column);
              dCount = dCount + 1;
          }
      });

      if(vis.params.collapseTimeHeaders === true) {
        while(dCount<=noOfDays) {
          key = 'D' + dCount;
          // Populate the title and aggConfigResult... aggConfigResult is used
          // by Filtering to allow drill-down
          column = { title: key,
                     aggConfigResult: new AggConfigResult(agg_1_agg, 'undefined', key, key),
                     aggConfig: agg_1_agg 
                   };
          columns.push(column);
          dCount+=1
        }
      }

      // To create rows, iterate on the buckets and then iterate on internal
      // buckets
      var count = 0;

      // offsetCount is used as an index to dayOffsetDataList
      var offsetCount = 0;

      // These variables will be used to show the dates from D1 to D30
      // always. When last 30 days is selected from current date, If 
      // current date is 9th May and April 9th is the start date, With the 
      // help of these variables we normalize the dates such that 9th April
      // becomes D1, 10th April becomes D2 and so on.
      dCount = 1;
      var int_dCount;
      var row = [];
      var int_count;
      buckets.map( function(bucket) {

          // If buckets are available, there may be multiple rows..
          if ( _.has(bucket, key_agg.id) && _.has(bucket[key_agg.id], 'buckets')) {

              // Get buckets using id of the key aggregation
              int_buckets = bucket[key_agg.id].buckets;

              int_buckets.map( function( int_bucket ) {

                  // Get the key and the value
                  key = int_bucket.key;
                  value = value_agg.getValue(int_bucket);

                  // Find the row in which we need to push this value
                  if (key in row_dict) {
                      row = row_dict[key]

                  } else {

                      row = [];

                      // This key does not exist, let us create a new row for this
                      // and add it in dict as well for future lookup
                      key_row = new AggConfigResult(key_agg, 'undefined', key, key);
                      // Always push the key row into this newly created row
                      row.push(key_row);

                      // Also add it in the dictionay and global rows
                      row_dict[key] = row;
                      rows.push(row);

                  }
                    
                  // Get the current length of the row
                  row_length = row.length;

                  // Count is the number of buckets available.. and row_length
                  // is the number of items we have received in a row + the
                  // first column that has the key name.. so if we are seeing a
                  // key first time, row.lenth here will be 1 (key name in the

                  // If the row_length is not same as count, it means there
                  // was one bucket which did not respond with this key in the
                  // earlier buckets.. 
                  if ( count >= row_length) {
                      addEmptyCells(value_agg, row, (count - row_length + 1));
                  }

                  int_count = dayOffsetDataList[offsetCount];
                  int_dCount = dCount;
                  while (int_dCount < int_count) {
                      addEmptyCells(value_agg, row, 1);
                      int_dCount += 1;
                  }

                  // If enable checkbox under collapse time headers is checked
                  // then values in matrix vis can be converted to any units of time
                  // through select box provided. the conversion is handled in 
                  // changeOutputTimeFormat() function
                  if(vis.params.enableTimeFormatter === true) {
                    value = changeOutputTimeFormat(vis.params.inputTimeFormat, 
                                                   vis.params.outputTimeFormat,
                                                   value)
                  }
                  // Push this value into the row
                  value_row = new AggConfigResult(value_agg, 'undefined', value, value);
                  row.push(value_row);

             });
          } else {

              // If there is no sub-aggregation, the response won't have
              // buckets and in such case, there will be only one row possible,
              // we create that row here..

              // If this is the first time, we are coming in, let us push the
              // row to the global rows array
              if (count == 0) {
                  rows.push(row);
              }

              // Get the value from the key-aggregation
              value = key_agg.getValue(bucket);
              value_row = new AggConfigResult(key_agg, 'undefined', value, value);
              row.push(value_row);
          }

          // Increment the counter
          count = int_count;
          offsetCount += 1;
          dCount = int_count + 1;

      });

      // Iterate on rows and see if we have values for each column. There is a
      // case where we may not have values in row for each column
      rows.map( function(row) {
          // If length of this is less than length of columns, we need to add
          // more entries into row
          if (columns.length > row.length) {
              count = columns.length - row.length;
              if (write.aggStack.length > 2) {
                  addEmptyCells(value_agg, row, count);
              } else {
                  addEmptyCells(key_agg, row, count);
              }
          }
      });

      // If we have MetricsInPercentage flag enabled, let us iterate on each
      // row and calculate the sum for each row and update the aggConfigResult
      if (write.opts.metricsInPercentage) {
          rows.map( function(row) {
              var sum = 0;
              row.map( function(cell) {
                  if (cell.type == "metric" && cell.value != '' ) {
                      sum += cell.value;
                  }
              });
              row.map( function(cell) {
                  if (cell.type == "metric" && cell.value != '' ) {
                      cell.sum = sum;
                  }
              });
          });
      }

      // Update the rows and columns in root
      write.root.tables[0].rows = rows;
      write.root.tables[0].columns = columns;

    };

    // Add empty cells in a row.. This is called when a particular key doesn't
    // exist for a given aggregation
    function addEmptyCells(agg, row, count) {
         while( count > 0 ) {
             var new_row = new AggConfigResult(agg, 'undefined', '', '');
             row.push(new_row);
             count = count - 1;
         }
    }

    return notify.timed('matrixify agg response', matrixifyAggResponse);
  };
});
