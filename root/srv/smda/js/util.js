let buttonTimeouts = {};

function setButtonMouseRepeat(btn, action, start, speedup) {
    let original_start = start;
    let repeat = function () {
        console.log('Performing action');
        action();
        buttonTimeouts[btn.attr('id')] = setTimeout(repeat, start);
        start = Math.max(50, start / speedup);
    };
    btn.mousedown(function() {
        repeat();
    });
    btn.mouseup(function() {
        start = original_start;
    });
};

function printStackTrace() {
  let e = new Error('dummy');
  let trace = e.stack.replace(/^[^\(]+?[\n$]/gm, '')
      .replace(/^\s+at\s+/gm, '')
      .replace(/^Object.<anonymous>\s*\(/gm, '{anonymous}()@');
      //.split('\n');
  console.log(trace);
}

function formattedReport(prefix, fields_list, total_width) {
  prefix = prefix ? prefix + '\n' : '';
  total_width = total_width ? total_width : 80;
  let field_length = {};
  let value_length = {};
  if(!Array.isArray(fields_list)) {
    fields_list = [fields_list];
  }
  for(let i in fields_list) {
    let fields = fields_list[i];
    let col = 0;
    for(let field in fields) {
      field_length[col] = Math.max(field_length[col] || 0, (field + '').length);
      let value = fields[field];
      if(typeof value == 'object') {
        try {
          value = JSON.stringify(value);
        }
        catch(e) { //Cyclic reference error
        }
      }
      value += '';
      value_length[col] = Math.max(value_length[col] || 0, value.length);
      col++;
    }
  }
  let s = '';
  for(let i in fields_list) {
    let fields = fields_list[i];
    let row = '';
    let col = 0;
    for(let field in fields) {
      let value = fields[field];
      if(typeof value == 'object') {
        try {
          value = JSON.stringify(value);
        }
        catch(e) { //Cyclic reference error
        }
      }
      value += '';
      let field_padding = field_length[col];
      let value_padding = value_length[col];
      row += (field + ': ' + value.padStart(value_padding)).padStart(
        field_padding + value_padding + 4);
      col++;
    }
    row = row.padEnd(total_width);
    s += row + '\n';
  }
  return prefix + s;
}

// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
function debounce(func, wait, immediate) {
	let timeout = null;
	return function() {
		let context = this;
    let args = arguments;
		let later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		let callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
};

/*
    callEventHandler
    Call a func or a list of functions with the given arguments and
    returns their results
*/
function callEventHandler(handler, args) {
  if(handler) {
    if(Array.isArray(handler)) {
      let result = [];
      for(let i in handler) {
        //handler[i](slice_i);
        result.push(handler[i].apply(null, args));
      }
      return result;
    }
    else {
      //handler(slice_i);
      return handler.apply(null, args);
    }
  }
  return undefined;
};

function parseFloatWithDefault(v) {
    let f = parseFloat(v);
    return !isNaN(f) ? f : 0.0;
}

function isNumber(n) {
    return !Number.isNaN(n) && Number.isFinite(n);
}

//Like Array.prototype.map for object o except that the passed
//function f accepts the key as the first argument and the value
//as the second argument
function kvMap(o, f) {
  return Object.entries(o).map(
    (kv) => (f(...kv))
  );
}

function kvFilter(o, f) {
  return Object.entries(o).filter(
    (kv) => (f(...kv))
  );
}

//Zips a list of objects into a single dict using all of their keys
function dictzip(L) {
  return Object.assign({}, ...L);
}
