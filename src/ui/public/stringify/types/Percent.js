define(function (require) {
  return function _PercentProvider(Private) {
    var _ = require('lodash');
    var FieldFormat = Private(require('ui/index_patterns/_field_format/FieldFormat'));

    require('ui/field_format_editor/samples/samples');

    _.class(_Percent).inherits(FieldFormat);
    function _Percent(params) {
      _Percent.Super.call(this, params);
    }

    _Percent.id = 'percentage';
    _Percent.title = 'Percentage';
    _Percent.fieldType = [
      'number',
    ];

    _Percent.paramDefaults = {
      transform: false
    };

    _Percent.editor = require('ui/stringify/editors/percent.html');

    _Percent.inputType = [
      { id: false, name: '- none -' },
      { id: '0-1_range', name: 'Fraction (0-1)' },
      { id: '0-100_range', name: 'Percentage (0-100)' },
    ];

    _Percent.sampleInputs = [
      77,
      66.677,
      99.126000,
      59.66640411,
      0.009,
      0.9,
      0.09,
      9,
      90,
      3.567888,
      1.56,
      1,
      100,
    ];

    roundOffToThreeDigits = function(val) {
      return Math.round(val*1000)/1000
    }

    zeroToOneRangeConverter = function(val) {
        val = roundOffToThreeDigits(val*100);
        return String(val) + '%';
    }

    oneToHundredRangeConverter = function(val) {
        val = roundOffToThreeDigits(val);
        return String(val) + '%';
    }

    _Percent.prototype._convert = function (val) {
      if(val==undefined || isNaN(val)) {
        return val;
      }
      result='';
      switch (this.param('transform')) {

        case '0-1_range':        result = zeroToOneRangeConverter(val);
                                 return result;

        case '0-100_range':      result = oneToHundredRangeConverter(val);
                                 return result;

        default:                 return val;
      }
    };

    return _Percent;
  };
});