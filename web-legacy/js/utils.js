// utilities

margins = {
    top   : 10,
    bottom: 30,
    left  : 80,
    right : 120
};

DEBUG_MODE = Boolean(location.search.split('&').indexOf('debug=true') > 0);

// this detects if the current web browser is safari
// we use this in the summary section of datastream.js to 
// disable unsupported functionality
var isSafari = navigator.vendor 
	&& navigator.vendor.indexOf('Apple') > -1 
	&&navigator.userAgent 
	&& !navigator.userAgent.match('CriOS');

// console.log(isSafari);

function debug_print(o, line) {
	if(DEBUG_MODE) {
		console.log(line);
		console.log(o);
	}
} 

/**
 * Compare values and return their status as same/changed/etc.
 * if a single value is given, it is assumed to be a diff and arg.old and arg.new are compared
 */
function difference(o, n) {

	if (o === null) {
		debug_print(o, "o is null");
		// if there is new data, then choose added
		return n === null ? 'same' : 'added';
	}

	else if (n === null) {
		debug_print(n, "n is null");
		// if there is old data, choose removed
		return o === null ? 'same' : 'removed';
	}
	
	else if (n !== undefined) {
		debug_print(n, "line 24: new data from utils.py is not undefined");
		return o == n ? 'same' :
			   o === null || o == '' ? 'added' :
			   n === null || n == '' ? 'removed' :
			   'changed';
	}

	else {
		debug_print(n, "line 46: new data from utils.py IS undefined");
		return difference(o.old, o.new);
	}
}

format = d3.time.format('%Y%m%d.%H%M%S');

/**
 * Get the average of two times
 */
function mean_time(diff) {
	return new Date((diff.beg.getTime()+diff.end.getTime())/2);
}

/**
 * Convert seconds since epoch to a psuedo-utc date, by timezoneoffset to the date.
 */
function epoch2utc(epoch) {
	d = new Date(epoch * 1000);
	return new Date(d.getTime() + d.getTimezoneOffset()*60*1000);
}

/**
 * Returns a rect (aka log, diff, etc.) in rects such that rect.beg <= x0 <= rect.end
 * If none are found, return null
 */
function get_rect_at(x0, rects) {
	var rect = null;
	//var min_dist = Infinity;
	for (var i=0; i < rects.length; i++) {
		if (rects[i].beg <= x0 && x0 <= rects[i].end) {
			rect = rects[i];
			break;
		}
	}
	return rect;
}

/**
 * Returns a rect (aka log, diff, etc.) in rects such that rect.beg <= x0 <= rect.end
 * If none are found, returns the rect closest to x0.
 */
function get_rect_near(x0, rects) {
	var rect = null;
	var min_dist = Infinity;
	for (var i=0; i < rects.length; i++) {
		if (rects[i].beg <= x0 && x0 <= rects[i].end) {
			rect = rects[i];
			break;
		}
		dist = Math.min(
			Math.abs(rects[i].beg-x0),
			Math.abs(rects[i].end-x0)
			);
		if (dist < min_dist) {
			min_dist = dist;
			rect = rects[i];
		}
	}
	return rect;
}

function select_i(selection, n) {
	return selection.filter(function(d, i){return i==n;});
}