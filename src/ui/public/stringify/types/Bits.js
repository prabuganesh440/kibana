define(function (require) {
  return function _BitsProvider(Private) {
    var _ = require('lodash');
    var FieldFormat = Private(require('ui/index_patterns/_field_format/FieldFormat'));

    require('ui/field_format_editor/samples/samples');

    _.class(_Bits).inherits(FieldFormat);
    function _Bits(params) {
      _Bits.Super.call(this, params);
    }

    _Bits.id = 'bits';
    _Bits.title = 'Bits';
    _Bits.fieldType = [
      'number',
    ];

    _Bits.paramDefaults = {
      transform: false
    };

    _Bits.sampleInputs = [
      2500,
      60000,
      10000000,
      120000,
      10000000000000,
      15,
      35000,
      1000,
    ];

  // Function takes input in bits or higher unit of bits (kb,mb,gb) 
  // to round off to 3 digits after decimal point
  roundOffToThreeDigits = function(bits) {
      return Math.round(bits*1000)/1000
  }

  // This function takes the value in bits and converts to higher order
  convertToHigherOrderBits = function(val_in_bits, exponent, bit_unit) {
      var bit_value = val_in_bits/Math.pow(10,exponent);
      bit_value = roundOffToThreeDigits(bit_value);
      bit_value = String(bit_value) + bit_unit;
      return  bit_value;
  }

  _Bits.editor = require('ui/stringify/editors/bits.html');

    _Bits.prototype._convert = function (val) {
        if(val==undefined || isNaN(val)) {
        return val;
        }
        var val_in_bits = val * 8;
              if(val_in_bits < 1000)
              {
                  val_in_bits = roundOffToThreeDigits(val_in_bits);
                  return String(val_in_bits) + 'b';
              }
              else if(val_in_bits >= Math.pow(10,3) && val_in_bits < Math.pow(10,6))
              {
                  return convertToHigherOrderBits(val_in_bits, 3, 'kb');
              }
              else if(val_in_bits >= Math.pow(10,6) && val_in_bits < Math.pow(10,9))
              {
                 return convertToHigherOrderBits(val_in_bits, 6, 'mb');
              }
              else if(val_in_bits >= Math.pow(10,9) && val_in_bits < Math.pow(10,12))
              {
                  return convertToHigherOrderBits(val_in_bits, 9, 'gb');
              }
              else
              {
                  return convertToHigherOrderBits(val_in_bits, 12, 'tb');;
              }
    };

    return _Bits;
  };
});