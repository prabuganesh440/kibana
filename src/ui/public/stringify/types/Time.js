define(function (require) {
  return function _TimeProvider(Private) {
    var _ = require('lodash');
    var FieldFormat = Private(require('ui/index_patterns/_field_format/FieldFormat'));

    require('ui/field_format_editor/samples/samples');

    _.class(_Time).inherits(FieldFormat);
    function _Time(params) {
      _Time.Super.call(this, params);
    }

    _Time.id = 'time';
    _Time.title = 'Time';
    _Time.fieldType = [
      'number',
    ];

    _Time.paramDefaults = {
      transform: false
    };
    
    _Time.editor = require('ui/stringify/editors/time.html');

    _Time.inputType = [
      { id: false, name: '- none -' },
      { id: 'millisecond', name: 'Millisecond' },
      { id: 'second', name: 'Second' },
      { id: 'minute', name: 'Minute' },
      { id: 'hour', name: 'Hour'},
      { id: 'day', name: 'Day' },

    ];

    _Time.sampleInputs = [
      1.344445,
      220.4564,
      999.126000,
      59.66640411,
      0.009,
      0.019,
      0.09999999,
      0.9999999,
      1000,
      4600,
      10000,
      160000,
    ];

    // Defining the constants that will be used for 
    // interconversion between different units of time
    var HRS_IN_DAY = 24;
    var MINS_IN_HR = 60;
    var SECONDS_IN_MIN = 60;
    var MILLISECONDS_IN_SECOND = 1000;
    var ROUND_OFF_CONSTANT = 1000;

    // This function will convert the hour, minutes, seconds, to 2 digit format : HH, MM, SS
    //Example 
    //8 hours to 08 
    //6 minutes to 06
    //12 seconds to 12 
    format_two_digits = function(unit_of_time) {
        unit_of_time = unit_of_time < 10 ? '0' + unit_of_time : unit_of_time;
        return String(unit_of_time);
    }

    // This function will set the milliseconds to this format - "mmm"
    //Example 
    //2 ms to 002
    //22 ms to 022
    //433 ms to 433
    format_three_digits = function(unit_of_time) {
        if(unit_of_time < 10)
        {
            unit_of_time = '00' + unit_of_time;
        }
        else if(unit_of_time>=10 && unit_of_time<100)
        {
            unit_of_time = '0' + unit_of_time;
        }
        else
        {
            unit_of_time = unit_of_time;
        }
        return String(unit_of_time);
    }

    // This function will take the hr ,min and sec as input and
    // prepares the output in time format( DD HH:MM:SS.MS )
    displayInDateTimeFormat = function(day, hr, min, sec, ms)
    {
        if(day > 0)
        {
            result = String(day) + 'd' + ' '
                      + String(format_two_digits(hr)) + ':'
                      + String(format_two_digits(min)) + ':'
                      + String(format_two_digits(sec));
        }
        else if(day==0 && hr==0 && min==0 && sec==0)
        {
            result = String(ms) + 'ms';
        }
        else
        {
            result = String(format_two_digits(hr)) + ':'
                      + String(format_two_digits(min)) + ':'
                      + String(format_two_digits(sec)) + '.'
                      + String(format_three_digits(ms));
        }
        return result;
    }

    // This function will convert the given input to
    // time format( DD HH:MM:SS.MS ). This will always
    // take input in milliseconds
    convertToTimeFormat = function(val) {
        day = 0;
        hr = 0;
        min = 0;
        sec = 0;
        ms = 0;
        if(val < MILLISECONDS_IN_SECOND)
        {
            // In order to display the floating point numbers rounded
            // off to 3 digit after the decimal point, we multiply the val
            // by 1000 and divide the result by 1000. 
            //Here ROUND_OFF_CONSTANT =1000
            ms = Math.round(val*ROUND_OFF_CONSTANT)/ROUND_OFF_CONSTANT;
        }
        else
        {
            ms = parseInt(val % MILLISECONDS_IN_SECOND);
            sec = parseInt(val/MILLISECONDS_IN_SECOND);
            if(sec >= 0 && sec < SECONDS_IN_MIN)
            {
                sec = sec;
            }
            else
            {
                min = parseInt(sec/SECONDS_IN_MIN);
                sec = sec % SECONDS_IN_MIN;
                if(min >= 0 && min < SECONDS_IN_MIN)
                {
                    min = min;
                }
                else
                {
                  hr = parseInt(min/MINS_IN_HR);
                  min = min % SECONDS_IN_MIN;
                  if(hr >= 0 && hr < HRS_IN_DAY)
                  {
                      hr = hr;
                  }
                  else
                  {
                      day = parseInt(hr/HRS_IN_DAY);
                      hr = hr % HRS_IN_DAY;
                  }
                }
            }
        }
        result = displayInDateTimeFormat(day, hr, min, sec, ms);
        return result;
    }

    // This function is called when the input is in milliseconds
    // This will call the "convertToTimeFormat" to get the output in
    //  DD HH:MM:SS.MS format.
    millisecToTimeFormatConverter = function(val)
    {
        result = convertToTimeFormat(val);
        return result;
    }

    // This function is called when the input is in seconds.
    // The input is converted to milliseconds and then 
    // the "millisecToTimeFormatConverter" is called to get the output in
    // DD HH:MM:SS.MS format.
    secondsToTimeFormatConverter = function(val)
    {
        new_val = val * MILLISECONDS_IN_SECOND;
        result = millisecToTimeFormatConverter(new_val);
        return result;
    }
    
    // This function is called when the input is in minutes.
    // The input is converted to milliseconds and then 
    // the "secondsToTimeFormatConverter" is called to get the output in
    // DD HH:MM:SS.MS format.
    minutesToTimeFormatConverter = function(val)
    {
        new_val = val * SECONDS_IN_MIN;
        result = secondsToTimeFormatConverter(new_val);
        return result;
    }

    // This function is called when the input is in hours.
    // The input is converted to milliseconds and then 
    // the "minutesToTimeFormatConverter" is called to get the output in
    // DD HH:MM:SS.MS format.
    hourToTimeFormatConverter = function(val)
    {
        new_val = val * MINS_IN_HR;
        result = minutesToTimeFormatConverter(new_val);
        return result;
    }

    // This function is called when the input is in days.
    // The input is converted to milliseconds and then 
    // the "hourToTimeFormatConverter" is called to get the output in
    // DD HH:MM:SS.MS format.
    dayToTimeFormatConverter = function(val)
    {
        new_val = val * HRS_IN_DAY;
        result = hourToTimeFormatConverter(new_val);
        return result;
    }

    _Time.prototype._convert = function (val) {
      if(val==undefined || isNaN(val)) {
        return val;
      }
      result='';
      switch (this.param('transform')) {

        case 'millisecond': result = millisecToTimeFormatConverter(val);
                            return result;

        case 'second':      result = secondsToTimeFormatConverter(val);
                            return result;

        case 'minute':      result = minutesToTimeFormatConverter(val);
                            return result;

        case 'hour':        result = hourToTimeFormatConverter(val);
                            return result;

        case 'day':         return  dayToTimeFormatConverter(val);

        default:            return val;
      }
    };

    return _Time;
  };
});