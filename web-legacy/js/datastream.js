/**
 * Top-level render function for a single datastream
 */
function enable_dark_mode(checked) {
	d3.select('body').attr('class', checked ? 'night':'');
}

function hide_footer(checked) {
	d3.select('#footer').style('display', checked ? 'none' : '');
}

function show_footer(parent, object) {
	// render the footer
   	var footer_div = parent.append('div').attr('id', 'footer');

   	if(object.review_date) {
   		footer_div.append('span').text("date: " + (new Date(object.review_date * 1000)));
	}

	if(object.version) {
		footer_div.append('span').text("version: " + object.version);
	}

	if(object.sample_interval) {
		footer_div.append('span').text("sample interval: " + secondsTo(object.sample_interval));
	}

	if(object.command) {
		footer_div.append('span').text("command: " + object.command).style('display', 'block');
	}
}

function make_options(parent, object) {
	var options_details = parent.append('details').attr('id', 'options');
	options_details.append('summary')
		.text('Options')
		.attr('class', 'same'); // make it look good

	var div = options_details.append('div')
		.style('padding-left', '1.25em');

	var nm_label = div.append('label')
		.attr('class', 'options_label')
		.style('display', 'block');
	var night_mode_cb = nm_label.append('input')
		.attr('type', 'checkbox')
		.attr('onchange', 'enable_dark_mode(this.checked)');

	nm_label.append('span').text('Night Mode');

	var hf_lable = div.append('label')
		.style('display', 'block');
	var hide_footer_cb = hf_lable.append('input')
		.attr('type', 'checkbox')
		.attr('onchange', 'hide_footer(this.checked)');

	hf_lable.append('span').text('Hide Footer');
}

function secondsTo(seconds) {
	seconds = parseInt(seconds);

	var days = Math.floor(seconds / (60 * 60 * 24));
	seconds -= days * (60 * 60 * 24);

	var hours = Math.floor(seconds / (60 * 60));
	seconds -= hours * (60 * 60);

	var minutes = Math.floor(seconds / (60));
	seconds -= minutes * (60);

	var str = "";

	if (days > 1) {
		str +=  " " + days + " days";
	} else if (days === 1) {
		str +=  " " + days + " day";
	}

	if (hours > 1) {
		str += " " + hours + " hours";
	} else if (hours === 1) {
		str += " " + hours + " hour";
	}

	if (minutes > 1) {
		str += " " + minutes + " minutes";
	} else if (minutes === 1) {
		str += " " + minutes + " minute";
	}

	if (seconds > 1) {
		str += " " + seconds + " seconds";
	} else if (seconds === 1) {
		str += " " + seconds + " second";
	}

	return str;
}

function render_datastream(parent, object) {
	// render header

	var header_div = parent.append('div').attr('id', 'header');
	header_div.append('span').text(object.path);

	parent.append('br');

	// render contents
	for (var i in object.contents)
        render_object(parent, object.contents[i]);

    // render the footer
    make_options(parent, object);
    parent.append("div").style("height", "25vh");
    show_footer(parent, object);
}

/**
 * Top-level render function for a comparison of datastreams
 */
function render_datastream_diff(parent, object) {
	// render header
	var header_div = parent.append('div').attr('id', 'header');
	header_div.append('span').text(object.old_path + " (old)");
	header_div.append('br');
	header_div.append('span').text(object.new_path + " (new)");

	parent.append('br');

	// Expand/collapse sections button
	parent.append('button')
		.attr('class', 'expander_button')
		.text('Expand Changed Sections')
		.on('click', function() {
			d3.select('#main').selectAll('summary.changed')
				.each(function(){
					d3.select(this.parentNode).attr('open', '');
					try {
						d3.select(this).on('click')();
					}
					catch(err) {}
				});
		});
	parent.append('br');
	
	// render contents
	for (var i in object.contents)
        render_object(parent, object.contents[i]);

    // render options
    make_options(parent, object);
    // add a buffer
    parent.append("div").style("height", "25vh");
    // render footer
   	show_footer(parent, object);
}

function setHeaderWidths() {
	var table = this;

	var x = table.selectAll("tbody tr:first-child td")[0];
	var y = table.selectAll("thead tr th")[0];
	var z = table.selectAll("tfoot tr th")[0];

	var tStyle = window.getComputedStyle(table[0][0]);
	var border = parseInt(tStyle.borderSpacing.split(" ")[0]); // get the horizontal spacing

	var totalWidth = border; // there are n+1 spaces for the border

	// set widths
	for(var i = 0; i < x.length; i++) {
		var xStyle = window.getComputedStyle(x[i]);
		var yStyle = window.getComputedStyle(y[i]);

		// qc does not have a footer, but I didn't want to create an entirely new method
		try {
			var zStyle = window.getComputedStyle(z[i]);
		} catch(err) {
			// yes i know this is hacky, but saves a few lines of code
			z = y;
			zStyle = yStyle;
		}

		var width = Math.max(
			parseInt(xStyle.width), 
			parseInt(yStyle.width), 
			parseInt(zStyle.width + 3));

		var padding = Math.max(
			parseInt(xStyle.paddingLeft) + parseInt(xStyle.paddingRight),
			parseInt(yStyle.paddingLeft) + parseInt(yStyle.paddingRight),
			parseInt(zStyle.paddingLeft) + parseInt(zStyle.paddingRight));

		x[i].style.minWidth = width;
		y[i].style.minWidth = width;
		z[i].style.minWidth = width;

		y[i].style.width = width;
		z[i].style.width = width;

		totalWidth += width + padding + border;
	}

	// set table body width 
	var a = table.selectAll("tbody")[0];
	var b = table.selectAll("thead:first-child")[0];
	var c = table.selectAll("thead:last-of-type")[0];

	try {
		a[0].style.width = totalWidth;
		b[0].style.width = totalWidth;
		c[0].style.width = totalWidth;
	} catch (err) {

	}
	
}

function setHeaderHeights() {
	// returns true if the table is large and will contain 
	// a expand/collapse button. otherwise, return false so
	// we don't have useless buttons lying around everywhere

	// set table body height
	var table = this;
	var a = table.select('tbody');
	// for some reason, IE11 sets the height to "auto"
	// this is not too much of an issue, however it means
	// that the table is not scrollable
	// we simply return false because the auto
	// does not trigger any of our if statements
	var height = parseInt(a.style('height'));

	if(height > 0) {	// when tbody is not rendered, it has a height of 0
		a.style('max-height', height);
	}

	if(height > 480 ) { // default height 
		a.style('height', 480);
		return true;
	}
	return false;
}

function buttonPressed(button_id, table_id) {

	if(button_id === undefined || table_id === undefined) {
		var button = this.select("button");
		var tbody = this.select("table tbody");
	} else {
		var button = d3.select(button_id);
		var tbody = d3.select(table_id).select("tbody");
	}

	if(button.text() === "Expand") {
		button.text("Collapse");
		tbody.style('display', 'table-row-group');
	}
	else {
		button.text("Expand");
		tbody.style('display', 'block');
	}
}

function setHeader(MAKE_BUTTON) {
	// "this" referes to the table
	// because we bound table to the function setHeader

	// we do not want setHeader to be called more than once
	var parent = d3.select(this.node().parentNode);
	parent.on("toggle", null);

	// safari does not support a scrollable table
	this.select("tbody").style("display", isSafari ? "table-row-group" : "block");	

	// we use a .call to set the "this" inside
	// of setHeaderWidths to be the table
	setHeaderWidths.call(this);

	if(setHeaderHeights.call(this) && !isSafari) {	
		// if we had to set a max height
		// var button = parent.append('input').attr('type', 'button').attr('value', 'Expand').style('display', 'inline');
		if(MAKE_BUTTON !== undefined) return;

		var button = parent.append('button')
			.attr('class', 'expander_button')
			.text('Expand')
   			.style('display', 'inline')
   			.on('click', buttonPressed.bind(parent));

		// so we don't pop anyone's space bubble
		parent.append('br');
		parent.append('br');
	} else {
		// the tbody is tiny. do not let them resize it
		this.select("tbody").style('resize', 'none');
	}

}

function render_summary(parent, object) {

	if(object['data'] !== undefined && object['data']['Header'] !== undefined) {

		LENGTH = Object.keys(object['data']['Header']).length;

		var sorted = [];
		for(var key in object['data']) {
    		sorted[sorted.length] = key;
		}
		sorted.sort();

		var colspan = (LENGTH-2)/2;
		var varDropDown = parent.append("details");
		var summary = varDropDown.append("summary").text("Variable Data Summary").attr("class", 'summary');

		var table = varDropDown.append('table').attr('class', 'summary_table').attr('id', 'single_sum_table');
		// the toggle will only occur once, then we remove the event in the setHeader function
		varDropDown.on("toggle", setHeader.bind(table));
		window.addEventListener("resize", setHeaderWidths.bind(table));

		var thead = table.append('thead');
		var tbody = table.append('tbody');

		var tr = thead.append('tr');

		var dict = {
			'n' : 'number of values',
			'miss' : 'number of missing values',
			'% nmiss'  : 'percentage of missing values',
			'nans' : 'total NOT A NUMBER values',
			'infs' : 'total INFINITY values',
			'fill' : 'total FILL values',
			'+limit' : 'number of values > 10^10',
			'-limit' : 'number of values < -10^10 (if measured in deg C, values < -273)'
		};

		for(var i = 0; i < object['data']['Header'].length; i++) {
			var value = object['data']['Header'][i];
			if(value == 'Variable') {
				tr.append('th').text((value)).style('text-align', 'left');
			} else {
				tr.append('th').text(value).style('text-align', 'right');
			}
		}

		for(var k = 0; k < sorted.length; k++) {
			var key = sorted[k];
			if(key === 'Total' || key === 'Header') {
				continue;
			}
			tr = tbody.append('tr');
			tr.append('td').text(key);
			for(var i = 0; i < object['data'][key].length;) {
				var value = object['data'][key][i];
				var td = tr.append('td').text(value)
					.attr('title', dict[value])
					.style('text-align','right')
					.attr("class", String(value)==='100.0' ? 'red' : 'black');

				if(td.text() === '100.0')
					td.style('font-weight', 'bold');

				if(i > 2 && value != '0') {
					td.style('font-weight', 'bold');
				}
				i++;
			}
		}

		var tfoot = table.append('tfoot');
		tr = tfoot.append('tr');
		tr.append('th').text('Total').style('text-align', 'left');
		for(var i = 0; i < object['data']['Total'].length; i++) {
			var value = object['data']['Total'][i];
			tr.append('th').text(value).style('text-align', 'right');
		}
	}

	if(object['qc_data'] !== undefined && object['qc_data']['Bits'] !== undefined) {
		if (object['qc_data']['Bits'] === 0) {
			return;
		}

		var qcDropDown = parent.append("details");
		var summary = qcDropDown.append("summary").text("QC Variable Summary").attr("class", "summary").attr('title', 'Checks the qc data of each variable for each file in the directory passed in via command line arguments, ' +
				'returning the percentage of time when each bit is non-zero. 100s are shown in red. ' +
				'The qc data is interpreted as Bit 1 being the rightmost bit, Bit 2 being the second to rightmost bit, etc.');

		var table = qcDropDown.append("table").attr("class", "summary_table").attr('id', 'single_qc_table');

		qcDropDown.on("toggle", setHeader.bind(table));
		window.addEventListener("resize", setHeaderWidths.bind(table));

		var thead = table.append("thead");
		var tbody = table.append("tbody");
		var tr = thead.append("tr");
		tr.append('th').text("Variable").style('text-align', 'left');

		for(var i = 0; i < object['qc_data']["Bits"]; i++) {
			tr.append("th")
			.text("Bit " + (i+1))
			.attr("title", "2^("+(i+1)+"-1) = "+String(Math.pow(2,i)))
			.style('text-align', 'right');
		}
		tr.append("th")
			.text("n")
			.attr("title", " total number of data points for each variable")
			.style('text-align', 'right');

		var sorted = [];
		for(var key in object['qc_data']) {
    		sorted[sorted.length] = key;
		}
		sorted.sort();

		for(var k = 0; k < sorted.length; k++) {
			var key = sorted[k];
			if(key === 'Bits') continue;
			tr = tbody.append('tr');
			tr.append('td').text(key).style('text-align', 'left');
			for(var i = 0; i < object['qc_data']['Bits']; i++) {
				value = object['qc_data'][key][i];
				if (value === undefined || value < 0) value = '--'
				var td = tr.append('td').text(value).style('text-align', 'right').attr("class", value==='100.0' ? 'red' : 'black');
				if(td.text() === '100.0')
					td.style('font-weight', 'bold');
			}
			tr.append('td').text(-1 * object['qc_data'][key][  object['qc_data'][key].length - 1  ]).style('text-align', 'right');
		}
	}
}

function render_summary_diff(parent, object) {
	// var main_div = parent.append('div');
	// main_div.append('h1').text('Summary').attr('class', 'summary');
	// div = main_div.append('div')
	// 	.style('border-top', '1px solid black');
	// parent.append("br");


	// WILL NOT BE NECCESSARY AFTER VERSION 0.9 (7/13/17)
	// KEEP FOR BACKWARDS COMPATABILIY
	if(object['different_times'] !== undefined){
		var dtDropDown = parent.append("details");
		var summary = dtDropDown.append("summary").text("Changes in Dimensions-time").attr('class', 'summary');

		var table = dtDropDown.append('table').attr('class', 'summary_table');
		dtDropDown.on("toggle", setHeader.bind(table));
		window.addEventListener("resize", setHeaderWidths.bind(table));

		var thead = table.append('thead');
		var tbody = table.append('tbody');
		var tfoot = table.append('tfoot');
		var tr = thead.append('tr');
		tr.append('th').text('Date').style('text-align', 'left');
		tr.append('th').text('Old').style('text-align', 'right');
		tr.append('th').text('New').style('text-align', 'right');
		tr.append('th').text('Diff').style('text-align', 'right');
		var k = -1;
		for (var i in object['different_times']) {
			var arr = object['different_times'][i];
			var date = arr[0];
			if(date === 'Total') {
				k = i;
				continue;
			}
			var old = arr[1];
			var _new = arr[2];
			var diff = arr[3];

			var tr2 = tbody.append('tr');
			tr2.append('td').text(String(epoch2utc(date)).substring(4, 15));
			tr2.append('td').text(old).style('text-align', 'right');
			tr2.append('td').text(_new).style('text-align', 'right');
			tr2.append('td').text(diff).style('text-align', 'right');
		}
		if (k > -1) {
			var tr2 = tfoot.append('tr');
			tr2.append('th').text(object['different_times'][k][0]).style('text-align', 'left').style('font-weight', 'bold');
			tr2.append('th').text(object['different_times'][k][1]).style('text-align', 'right').style('font-weight', 'bold');
			tr2.append('th').text(object['different_times'][k][2]).style('text-align', 'right').style('font-weight', 'bold');
			tr2.append('th').text(object['different_times'][k][3]).style('text-align', 'right').style('font-weight', 'bold');
		}

	}
	// END BACKWARDS COMPATABILITY
	var table_id = 1;
	if(object['dimension_changes'] !== undefined) {

		var dtDropDown = parent.append("details");
		dtDropDown.append('summary')
			.attr('class', 'summary')
			.text('Dimension Changes');

		for(var KEY in object['dimension_changes']) {

			var table = dtDropDown.append('table')
				.attr('class', 'summary_table')
				.attr('id', 'table' + String(table_id));

			table.append('caption').text(String(KEY).charAt(0).toUpperCase() + String(KEY).slice(1));
			dtDropDown[0][0].addEventListener("toggle", setHeader.bind(table, false));
			dtDropDown.append('button')
				.attr('id', 'button' + String(table_id))
				.attr('class', 'expander_button')
				.text('Expand')
	   			.style('display', 'inline')
	   			.on('click', buttonPressed.bind(dtDropDown, '#button' + String(table_id), '#table' + String(table_id)));
			window.addEventListener("resize", setHeaderWidths.bind(table));
			table_id++;

			var thead = table.append('thead');
			var tbody = table.append('tbody');

			var OLD_DATA_END = (object['dimension_changes'][KEY][0].length)/2;
	

			tr = thead.append('tr');
			// add the headers
			for(var i = 0; i < object['dimension_changes'][KEY][0].length; i++) {
				tr.append('th').text(object['dimension_changes'][KEY][0][i]).style('text-align', 'left');
			}

			for(var i = 1; i < object['dimension_changes'][KEY].length; i++) {	// starting at index 1 because header info is at the beginning
				tr = tbody.append('tr');

				function secondsToReadableDate(seconds) {
					if(seconds === '---') return '---';
					var date = new Date(epoch2utc(seconds).getTime());
					return date.getFullYear() + ("0" + (date.getMonth() + 1)).slice(-2) + ("0" + date.getDate()).slice(-2) + " " + ("0" + date.getHours()).slice(-2) + ("0" + date.getMinutes()).slice(-2) + ("0" + date.getSeconds()).slice(-2);
				}

				for(var j = 0; j < OLD_DATA_END; j++) {
					var old_td_value = "" + object['dimension_changes'][KEY][i][j],
				 		new_td_value = "" + object['dimension_changes'][KEY][i][j + OLD_DATA_END];

					tr.append('td').text(j === OLD_DATA_END -1 ? old_td_value : secondsToReadableDate(old_td_value))
						.attr('class', old_td_value === new_td_value || old_td_value === '---' || new_td_value === '---' ? 'same' : 'changed')
						.style('text-align', 'right');
				}

				for(var j = OLD_DATA_END; j < object['dimension_changes'][KEY][i].length; j++) {
					var old_td_value = "" + object['dimension_changes'][KEY][i][j - OLD_DATA_END],
				 		new_td_value = "" + object['dimension_changes'][KEY][i][j];

					tr.append('td').text(j === object['dimension_changes'][KEY][i].length-1 ? new_td_value : secondsToReadableDate(new_td_value))
						.attr('class', old_td_value === new_td_value || old_td_value === '---' || new_td_value === '---' ? 'same' : 'changed')
						.style('text-align', 'right');
				}

			}

			dtDropDown.append('br');
			dtDropDown.append('br');
		}
		
	}

	if(object['data'] !== undefined && object['data']['Header'] !== undefined) {

		LENGTH = Object.keys(object['data']['Header']).length;

		OLD_START = 1;
		NEW_CAP = LENGTH-1;

		OLD_CAP = (NEW_CAP)/2;
		NEW_START = OLD_CAP + 1;

		var sorted = [];
		for(var key in object['data']) {
    		sorted[sorted.length] = key;
		}
		sorted.sort();

		var varDropDown = parent.append("details");
		//var par = varDropDown.append('p').text('A more-detailed analysis of misses, NaNs, INFs, and fills.');
		var summary = varDropDown.append("summary").text("Variable Data Summary").attr("class", "summary");

		var table = varDropDown.append('table').attr('class', 'summary_table').attr('id', 'double_sum_table');

		varDropDown.on("toggle", setHeader.bind(table));
		window.addEventListener("resize", setHeaderWidths.bind(table));

		var thead = table.append("thead");
		var tbody = table.append("tbody");
		var tfoot = table.append("tfoot");

		colspan = (NEW_CAP)/2;

		var tr = thead.append('tr');
		tr.append('td').text(''); // slide over because of the variable column
		tr.append('td').text('OLD DATA').attr('colspan', String(colspan)).style('text-align', 'center');
		//tr.append('td').text('');
		tr.append('td').text('NEW DATA').attr('colspan', String(colspan)).style('text-align', 'center');

		tr = thead.append('tr');

		var dict = {
			'n' : 'number of values',
			'miss' : 'number of missing values',
			'% nmiss'  : 'percentage of missing values',
			'nans' : 'total NOT A NUMBER values',
			'infs' : 'total INFINITY values',
			'fill' : 'total FILL values',
			'+limit' : 'number of values > 10^10',
			'-limit' : 'number of values < -10^10 (if measured in deg C, values < -273)'
		};

		for(var i = 0; i < object['data']['Header'].length; i++) {
			var value = object['data']["Header"][i];
			if (value === '') continue;
			var th = tr.append('th').text(value)
				.attr('title', dict[value])
				.style('text-align', 'left')
				.style("padding-left", "");
		}

		for(var k = 0; k < sorted.length; k++) {
			var key = sorted[k];
			if(key === 'Total' || key === 'Header') {
				continue;
			}

			tr = tbody.append('tr');
			tr.append('td').text(key);
			var i = 0;
			for(var j = 0; j < object['data'][key].length; j++) {
				var value = object['data'][key][j];

				if (value === '') continue;
				
				function getColorClass(index, current_value, total) {
					var cls = 'same';
					if (current_value != '--') {
						if (index < OLD_CAP && (object['data'][key][index + NEW_START] != '--')) {

							if (total != undefined) {
								index--;
							}

							if(current_value === object['data'][key][index + NEW_START]) {
								cls = 'same';
							}
							else if(current_value > object['data'][key][index + NEW_START]) {
								cls = 'changed';
							}
							else if (current_value < object['data'][key][index + NEW_START]){
								cls = 'changed';
							}	
						}
						
						else if (index < NEW_CAP && (object['data'][key][index - NEW_START + OLD_START] != '--')) {

							if(current_value === object['data'][key][index - NEW_START + OLD_START]) {
								cls = 'same';
							}
							else if(current_value > object['data'][key][index - NEW_START + OLD_START]) {
								cls = 'changed';
							}
							else if (current_value < object['data'][key][index - NEW_START + OLD_START]){
								cls = 'changed';
							}	
						}
						
					}
					return cls;
				}

				var cls = getColorClass(i, value);
				var td = tr.append('td').text(value).style('text-align','right').attr('class', cls);
				if(value === '100.0')
					td.attr('class', 'red');
				if(td.text() === '100.0')
					td.style('font-weight', 'bold');

				if ( ((i+1 > OLD_START + 2 && i+1 <= OLD_CAP) || (i+1 > NEW_START + 2 && i+1 <= NEW_CAP)) && String(value) != '0' && String(value) != '--') {
					td.style('font-weight', 'bold');
				}

				i++;
			}
		}

		tr = tfoot.append('tr');
		tr.append('th').text('Total').style('text-align', 'left');
		for(var i = 0; i < object['data']['Total'].length; i++) {
			var value = object['data']['Total'][i];
			if (value === '') continue;
			key = 'Total';
			var cls = 'total' + getColorClass(i, value, true);
			tr.append('th').text(value).style('text-align', 'right').attr('class', cls);
		}
	}

	if(object['qc_data'] !== undefined && object['qc_data']['Bits'] !== undefined) {
		old_len = object['qc_data']['Bits'][0] - 1;
		new_len = object['qc_data']['Bits'][1] - 1;

		var qcDropDown = parent.append("details");
		var summary = qcDropDown.append("summary").text("QC Variable Summary").attr('class', 'summary').attr('title', 'Checks the qc data of each variable for each file in the directory passed in via command line arguments, ' + 
				'returning the percentage of time when each bit is non-zero. 100s are shown in red. ' +
				'The qc data is interpreted as Bit 1 being the rightmost bit, Bit 2 being the second to rightmost bit, etc.');

		var table = qcDropDown.append('table').attr('class', 'summary_table');

		qcDropDown.on("toggle", setHeader.bind(table));
		window.addEventListener("resize", setHeaderWidths.bind(table));

		var thead = table.append('thead');
		var tbody = table.append('tbody');

		var tr = thead.append('tr');
		tr.append('td').text('');
		tr.append('td').text('OLD DATA').attr('colspan', String(old_len + 1)).style('text-align', 'center');
		tr.append('td').text('NEW DATA').attr('colspan', String(new_len + 1)).style('text-align', 'center');


		tr = thead.append('tr');
		tr.append('th').text('Variable').style('text-align', 'left');

		var sorted = [];
		for(var key in object['qc_data']) {
    		sorted[sorted.length] = key;
		}
		sorted.sort();

		// old bits
		for(var i=0; i < old_len; i++) {
			tr.append('th')
			.text('Bit ' + (i+1))
			.attr("title", "2^("+(i+1)+"-1) = "+String(Math.pow(2,i)))
			.style('text-align', 'right');
		}
		tr.append('th').text('n').style('text-align', 'left');

		// new  bits
		//tr.append('th').text('Bit -1').style('text-align', 'left').style('color', '#FFFFFF');
		for(var i=0; i < new_len; i++) {
			var th = tr.append('th')
			.text('Bit ' + (i+1))
			.attr("title", "2^("+(i+1)+"-1) = "+String(Math.pow(2,i)))
			.style('text-align', 'right');

			//if (i === 0) th.style('padding-left', '100px');
		}
		tr.append('th').text('n').style('text-align', 'left');

		for(var v = 0; v < sorted.length; v++) {
			var variable = sorted[v];
			if(variable === 'Bits') {
				continue;
			}
			tr = tbody.append('tr');
			tr.append('td').text(variable).style('text-align', 'left');

			for(var i=0; i < old_len; i++) {
				var text = object['qc_data'][variable][0][i];
				if(text === undefined  || text < 0) text = '--';
				var color = '';
				var td = tr.append('td').text(text)
					.style('text-align', 'right')
					.attr('class', text!=object['qc_data'][variable][1][i] 
						&& object['qc_data'][variable][1][i] >= 0 
						&& String(text) != '100.0' 
						&& object['qc_data'][variable][1][i] != undefined 
						&& String(text) != '--' ? 'changed' : color=(String(text) === '100.0' ? "red" : "black"));
				if(td.text() === '100.0') {
					td.style('font-weight', 'bold');
					td.attr('class', 'red');
				}
			}
			// we stored these as negative values to avoid confusion with other values in the json
			var old_text = -1 * object['qc_data'][variable][0][  object['qc_data'][variable][0].length - 1  ];
			var new_text = -1 * object['qc_data'][variable][1][  object['qc_data'][variable][1].length - 1  ];
			if (old_text === undefined || isNaN(old_text))
				old_text = '--'
			if (new_text === undefined || isNaN(new_text))
				new_text = '--'
			tr.append("td")
			.text(old_text)
			.style('text-align', 'right')
			.attr('class',old_text!=new_text && old_text != '--'  ? 'changed' : null);


			for(var i=0; i < new_len; i++) {
				var text = object['qc_data'][variable][1][i];
				if(text === undefined || text < 0) text = '--';
				var color = '';
				var td = tr.append('td').text(text)
					.style('text-align', 'right')
					.attr('class', text!=object['qc_data'][variable][0][i] 
						&& object['qc_data'][variable][0][i] >= 0 
						&& String(text) != '100.0' 
						&& object['qc_data'][variable][0][i] != undefined 
						&& String(text) != '--' ? 'changed' : color=(String(text) === '100.0' ? "red" : "black"));
				if(td.text() === '100.0') {
					td.style('font-weight', 'bold');
					td.attr('class', 'red');
				}
			}
			var old_text = -1 * object['qc_data'][variable][0][  object['qc_data'][variable][0].length - 1  ];
			var new_text = -1 * object['qc_data'][variable][1][  object['qc_data'][variable][1].length - 1  ];
			if (old_text === undefined || isNaN(old_text))
				old_text = '--'
			if (new_text === undefined || isNaN(new_text))
				new_text = '--'
			tr.append("td")
			.text(new_text)
			.style('text-align', 'right')
			.attr('class',old_text!=new_text  && new_text != '--' ? 'changed' : null);
		}
	}
}