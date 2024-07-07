// barg_svg_width = 1000;
// barg_svg_height = 400;
// barg_width = barg_svg_width - margins.left - margins.right;
// barg_height = barg_svg_height - margins.top - margins.bottom;



function Bargraph(parent, logs) {

	console.log(logs);

	var data = [];
	var start_times = [];
	var end_times = [];
	logs.splice(0,1);

	for(var i = 0; i < logs.length; i++) {
		logs[i][0] = epoch2utc(logs[i][0]).getTime();
		logs[i][1] = epoch2utc(logs[i][1]).getTime();

		start_times.push(logs[i][0]);
		end_times.push(logs[i][1]);

		data.push(logs[i][2]);
	}

	console.log(start_times);

	// ======================== GRAPH ============================
	var zoom = d3.behavior.zoom()
		.on('zoom', draw);

	var start_time = logs[0][0];
	var end_time = logs[logs.length-1][1];

	var height = 400 - margins.top - margins.bottom;
	var width = 1000 - margins.left - margins.right;

	var svg = parent.append("svg")
		.attr('width', width + margins.left + margins.right)
		.attr('height', height + margins.bottom + margins.top);

	var x = d3.time.scale()
		.domain([start_time, end_time])
		.range([margins.left, width+margins.left]);

	var y = d3.scale.linear()
		.domain([0, d3.max(data)])
   	 	.range([height+margins.top, margins.top]);

   	var mouseMap = d3.scale.linear()
   		.domain([margins.left, width])
   		.range([0, 1]);

   	var xAxis = d3.svg.axis()
	    .scale(x)
	    .orient("bottom");

	var yAxis = d3.svg.axis()
	    .scale(y)
	    .orient("left");

	var listen_pane = svg.append('g').append('rect')
		.attr('class', 'listener')
		.attr('width', plot_width)
		.attr('height', plot_height)
		.attr('x', margins.left)
		.attr('y', margins.top)
		.on('mousedown', setMouseDown)
		.on('mouseup', setMouseUp)
		.on('mousemove', getMousePos)
		.call(zoom);

    var xAxisG = svg.append("g")
	    .attr("class", "x axis")
	    .attr("transform", "translate(0," + (height+margins.top) + ")")
	    .call(xAxis);

	var yAxisG = svg.append("g")
	    .attr("class", "y axis")
	    .attr("transform", "translate(" + (margins.left) + ",0)")
	    .call(yAxis);

    // methods
    zoom.scaleExtent([0, Infinity]);

    var MOUSE_X = -1;
    var MOUSE_DOWN = false;
    var SCALED = false;
    var LAST_MOUSE_X = -1;
    var adjusted_start_millis = start_time;
    var adjusted_end_millis = end_time;
    var last_scale = 1;
    draw();

    function getMousePos() {
    	coords = d3.mouse(this);
    	LAST_MOUSE_X = MOUSE_X;
    	MOUSE_X = coords[0];
    }

    function setMouseDown() {
    	MOUSE_DOWN = true;
    }

    function setMouseUp() {
    	MOUSE_DOWN = false;
    }

	function draw() {

		var scale = zoom.scale();
		var ZOOMING_IN = scale - last_scale;
		if (scale > last_scale) {
			// we are zooming in
			ZOOMING_IN = 1;
		} else if(scale === last_scale) {
			// just panning
			ZOOMING_IN = 0;
		} else {
			ZOOMING_IN = -1;
		}
		last_scale = scale;

		// 0 -> left point of graph
		// 1 -> right point of graph
		var adj_mx = mouseMap(MOUSE_X);

		if(adj_mx < 0) {
			adj_mx = 0;
		}

		var delta = adjusted_end_millis - adjusted_start_millis;

		if (ZOOMING_IN !== 0) {
			// zooming
			ZOOMING_IN *= 1.3;
			var time_offset_millis = (delta)/30 * ZOOMING_IN; // no effect if panning
			var Ltrim = adj_mx * time_offset_millis;
			var Rtrim = (1-adj_mx) * time_offset_millis;

			adjusted_start_millis += Ltrim;
			adjusted_end_millis -= Rtrim;
		}
		else if(ZOOMING_IN === 0 && MOUSE_DOWN) {
			// panning
			var DIRECTION = LAST_MOUSE_X - MOUSE_X;
			var adj_amount = delta/(500);

			var future_start_millis = adjusted_start_millis + (adj_amount * DIRECTION);
			var future_end_millis = adjusted_end_millis + (adj_amount * DIRECTION);

			if(future_start_millis <= start_time || future_end_millis >= end_time) {
				future_start_millis = adjusted_start_millis;
				future_end_millis = adjusted_end_millis;
			}

			adjusted_start_millis = future_start_millis;
			adjusted_end_millis = future_end_millis;

		}

		if (adjusted_start_millis > adjusted_end_millis) {
			adjusted_start_millis = adjusted_end_millis;
		}

		if (adjusted_end_millis < adjusted_start_millis) {
			adjusted_end_millis = adjusted_start_millis;
		}

		adjusted_start_millis = Math.max(start_time, adjusted_start_millis);
		adjusted_end_millis = Math.min(end_time, adjusted_end_millis);

		var visible_logs = [];
		var visible_data = [];

		// start and ending indexes in range
		var visible_start_index = d3.bisectLeft(start_times, adjusted_start_millis);
		var visible_end_index = d3.bisectRight(end_times, adjusted_end_millis);

		visible_start_index = Math.max(0, visible_start_index-1);
		visible_end_index = Math.min(logs.length, visible_end_index+1);

		visible_logs = logs.slice(visible_start_index, visible_end_index);
		visible_data = data.slice(visible_start_index, visible_end_index);

		// if(visible_data.length < 5 ) {
		// 	console.log('resize');
		// 	zoom.scaleExtent([0, zoom.scale() * 2]);
		// }

		x.domain([adjusted_start_millis, adjusted_end_millis]);
		y.domain([0, d3.max(visible_data)]);
		xAxisG.call(xAxis);
		yAxisG.call(yAxis);

		// JOIN
		var bar = svg.selectAll('rect:not(.listener)')
			.data(visible_data);

		// remove surplus
		bar.exit().remove();

		// update current bars
		bar.attr('begin', function(d, i) {return visible_logs[i][0]})
		    .attr('end', function(d, i) {return visible_logs[i][1]})
		    .attr('value', function(d) {return d})
			.attr('width', function(d, i) {return Math.max(x(visible_logs[i][1]) - x(visible_logs[i][0]),0)})
			.attr('x', function(d, i) {return x(visible_logs[i][0])})
		    .attr('y', function(d, i) {return y(d)})
		    .attr('height', function(d, i) {return height + margins.top - y(d)})
		    .on('mousedown', setMouseDown)
		    .on('mouseup', setMouseUp)
		    .on('mouseenter', updateTable)
		    .on('mousemove', getMousePos);

		// add bars as needed
		bar.enter()
			.append('rect')
			.attr('begin', function(d, i) {return visible_logs[i][0]})
	    	.attr('end', function(d, i) {return visible_logs[i][1]})
	    	.attr('value', function(d) {return d})
	    	.style('fill', function(d, i) {return i % 2 == 0 ? "darkgray" : "darkgray"})
	    	.attr('width', function(d, i) {return Math.max(x(visible_logs[i][1]) - x(visible_logs[i][0]), 0)})
	    	.attr('x', function(d, i) {return x(visible_logs[i][0])})
	    	.attr('y', function(d, i) {return y(d)})
	    	.attr('height', function(d, i) { return height + margins.top - y(d)})
	    	.on('mousedown', setMouseDown)
	    	.on('mouseup', setMouseUp)
	    	.on('mouseenter', updateTable)
	    	.on('mousemove', getMousePos)
	    	.call(zoom);

		// also need to update the ends so they aren't hanging over the edge
		var rect_width = svg.select('svg > rect:first-of-type').attr('width');
		svg.select('svg > rect:first-of-type')
			.attr('x', margins.left)
			.attr('width', Math.max(rect_width - (margins.left - x(visible_logs[0][0])), 0));

		var xpos = svg.select('svg > rect:last-of-type').attr('x');
		svg.select('svg > rect:last-of-type')
			.attr('width', Math.max((width + margins.left - xpos), 0));

		function updateTable() {
    		var table = d3.select('#bargraph_table');
			var begin = this.getAttribute('begin');
			var end = this.getAttribute('end');
			var value = this.getAttribute('value');
			console.log(begin);
			begin = new Date(parseInt(begin));
			begin = begin.getFullYear() + ("0" + (begin.getMonth()+1)).slice(-2) + ("0" + begin.getDate()).slice(-2) + " " + ("0" + begin.getHours()).slice(-2) + ("0" + begin.getMinutes()).slice(-2) + ("0" + begin.getSeconds()).slice(-2);
			end = new Date(parseInt(end));
			end = end.getFullYear() + ("0" + (end.getMonth()+1)).slice(-2) + ("0" + end.getDate()).slice(-2) + " " + ("0" + end.getHours()).slice(-2) + ("0" + end.getMinutes()).slice(-2) + ("0" + end.getSeconds()).slice(-2);

			table.select('td:nth-of-type(1)').text(begin);
			table.select('td:nth-of-type(2)').text(end);
			table.select('td:nth-of-type(3)').text(value);
		}

	}

  	//   ========================= TABLE ==============================

  	var table = parent.append("table").attr('id', 'bargraph_table');

  	var tr = table.append('tr');
  	tr.append('th').text('beg');
  	tr.append('td').text('___');
  	tr.append('th').text('end');
  	tr.append('td').text('___');
  	tr.append('th').text('val');
  	tr.append('td').text('___');
  
}



function BargraphDiff(parent, old_logs, new_logs) {

	var old_data = [],
		new_data = [],
		old_start_times = [],
		new_start_times = [],
		old_end_times = [],
		new_end_times = [];

	var old_start_time_millis,
		new_start_time_millis,
		old_end_time_millis,
		new_end_time_millis;

	var HAS_OLD_DATA = true,
		HAS_NEW_DATA = true;

	console.log(old_logs);
	console.log(new_logs);

	if (old_logs.length === 0) {
		old_logs = new_logs;
		HAS_OLD_DATA = false;
	}
	if (new_logs.length === 0) {
		new_logs = old_logs;
		HAS_NEW_DATA = false;
	}

	for(var i = 0; i < old_logs.length; i++) {
		old_start_times.push(epoch2utc(old_logs[i].beg).getTime());
		old_end_times.push(epoch2utc(old_logs[i].end).getTime());
		old_data.push(parseInt(HAS_OLD_DATA ? old_logs[i].val : 0));
	}

	for(var i = 0; i < new_logs.length; i++) {
		new_start_times.push(epoch2utc(new_logs[i].beg).getTime());
		new_end_times.push(epoch2utc(new_logs[i].end).getTime());
		new_data.push(parseInt(HAS_NEW_DATA ? new_logs[i].val : 0));
	}

	
	


	// if (old_start_times.length === 0) {
	// 	console.log("no old data");
	// 	HAS_OLD_DATA = false;
	// 	old_start_times = new_start_times;
	// 	old_end_times = new_end_times;
	// 	for(var i = 0; i < old_start_times.length; i++) {
	// 		old_data.push(-1);
	// 	}
	// }

	// if (new_start_times.length === 0) {
	// 	console.log("no new data");
	// 	HAS_NEW_DATA = false;
	// 	new_start_times = old_start_times;
	// 	new_end_times = old_end_times;
	// 	for(var i = 0; i < new_start_times.length; i++) {
	// 		new_data.push(-1);
	// 	}
	// }

	old_start_time_millis = old_start_times[0];
	old_end_time_millis = old_end_times[old_end_times.length-1];

	new_start_time_millis = new_start_times[0];
	new_end_time_millis = new_end_times[new_end_times.length-1];

	start_time_millis = Math.min(old_start_time_millis, new_start_time_millis);
	end_time_millis = Math.max(old_end_time_millis, new_end_time_millis);

	var zoom = d3.behavior.zoom()
		.on('zoom', draw);

	var height = 400 - margins.top - margins.bottom;
	var width = 1000 - margins.left - margins.right;

	var svg = parent.append("svg")
		.attr('width', width + margins.left + margins.right)
		.attr('height', height + margins.bottom + margins.top);
 
	var x = d3.time.scale()
		.domain([start_time_millis, end_time_millis])
		.range([margins.left, width+margins.left]);

	var y = d3.scale.linear()
		.domain([0, Math.max(d3.max(old_data), d3.max(new_data))])
   	 	.range([height+margins.top, margins.top]);

   	var mouseMap = d3.scale.linear()
   		.domain([margins.left, width])
   		.range([0, 1]);

   	var xAxis = d3.svg.axis()
	    .scale(x)
	    .orient("bottom");

	var yAxis = d3.svg.axis()
	    .scale(y)
	    .orient("left");

	var listen_pane = svg.append('g').append('rect')
		.attr('class', 'listener')
		.attr('width', plot_width)
		.attr('height', plot_height)
		.attr('x', margins.left)
		.attr('y', margins.top)
		.on('mousedown', setMouseDown)
		.on('mouseup', setMouseUp)
		.on('mousemove', getMousePos)
		.call(zoom);

    var xAxisG = svg.append("g")
	    .attr("class", "x axis")
	    .attr("transform", "translate(0," + (height+margins.top) + ")")
	    .call(xAxis);

	var yAxisG = svg.append("g")
	    .attr("class", "y axis")
	    .attr("transform", "translate(" + (margins.left) + ",0)")
	    .call(yAxis);

	// methods
    zoom.scaleExtent([0, Infinity]);

    var MOUSE_X = -1,
    	MOUSE_Y = -1;
    var MOUSE_DOWN = false;
    var SCALED = false;
    var LAST_MOUSE_X = -1;
    var adjusted_start_millis = start_time_millis;
    var adjusted_end_millis = end_time_millis;
    var last_scale = 1;

    var old_group = svg.append('g').attr('class', 'old_bars');
    var new_group = svg.append('g').attr('class', 'new_bars');

    var old_visible_starts = [],
		new_visible_start = [],
		old_visible_ends = [],
		new_visible_ends = [],
		old_visible_data = [],
		new_visible_data = [];

	var old_visible_start_index,
		old_visible_end_index,
		new_visible_start_index,
		new_visible_end_index;

    // TABLE

    var table = parent.append('table');
   	var tr1 = table.append('tr');
   	var tr2 = table.append('tr');
   	var tr3 = table.append('tr');

   	tr1.append('td');
   	tr1.append('th').text('Begin');
   	tr1.append('th').text('End');
   	tr1.append('th').text('Value');

   	tr2.append('th').text('Old');
   	tr2.append('td').text('---');
   	tr2.append('td').text('---');
   	tr2.append('td').text('---');

   	tr3.append('th').text('New');
   	tr3.append('td').text('---');
   	tr3.append('td').text('---');
   	tr3.append('td').text('---');

   	draw();

   	function getMousePos() {
    	coords = d3.mouse(this);
    	LAST_MOUSE_X = MOUSE_X;
    	MOUSE_X = coords[0];
    	MOUSE_Y = coords[1];
    	updateTable();
    }

   	function setMouseDown() {
		MOUSE_DOWN = true;
	}

	function setMouseUp() {
		MOUSE_DOWN = false;
	}

	function updateTable() {
		// find the old bar
		var found_old = false;
		var found_new = false;

		// ADD ONE TO THE MONTH EVERY TIME TODO

		for(var i = 0; i < old_visible_starts.length; i++) {
			// x.invert turns pixels into the time stamp millis values for comparison
			if(x.invert(MOUSE_X) >= old_visible_starts[i] && x.invert(MOUSE_X) <= old_visible_ends[i] && y.invert(MOUSE_Y) <= old_visible_data[i]) {
				setOld(i);
				found_old = true;
				break;
			}
		}

		if(!found_old) {
			setOld(-1);
		}
		

		// find the new bar

		for(var i = 0; i < new_visible_starts.length; i++) {
			if(x.invert(MOUSE_X) >= new_visible_starts[i] && x.invert(MOUSE_X) <= new_visible_ends[i] && y.invert(MOUSE_Y) <= new_visible_data[i]) {
				setNew(i);
				found_new = true;
				break;
			}
		}

		if(!found_new) {
			setNew(-1);
		}

		function setOld(i) {
			// we have the right date
			if(i >= 0) {
				var begin = old_visible_starts[i];
				var end   = old_visible_ends[i];
				var value  = old_visible_data[i];

				begin = new Date(parseInt(begin));
				begin = begin.getFullYear() + ("0" + (begin.getMonth() + 1)).slice(-2) + ("0" + begin.getDate()).slice(-2) + " " + ("0" + begin.getHours()).slice(-2) + ("0" + begin.getMinutes()).slice(-2) + ("0" + begin.getSeconds()).slice(-2);
				end = new Date(parseInt(end));
				end = end.getFullYear() + ("0" + (end.getMonth()+1)).slice(-2) + ("0" + end.getDate()).slice(-2) + " " + ("0" + end.getHours()).slice(-2) + ("0" + end.getMinutes()).slice(-2) + ("0" + end.getSeconds()).slice(-2);
			}  else {
				var begin = '---';
				var end = '---';
				var value = '---';
			}

			if (!HAS_OLD_DATA){
				begin = 'N/A';
				end = 'N/A';
				value = 'N/A';
			}

			table.select('tr:nth-of-type(2) td:first-of-type').text(begin);
			table.select('tr:nth-of-type(2) td:nth-of-type(2)').text(end);
			table.select('tr:nth-of-type(2) td:last-of-type').text(value);
		}

		function setNew(i) {
			// we have the right date
			if(i >= 0) {
				var begin = new_visible_starts[i];
				var end   = new_visible_ends[i];
				var value  = new_visible_data[i];

				begin = new Date(parseInt(begin));
				begin = begin.getFullYear() + ("0" + (begin.getMonth()+1)).slice(-2) + ("0" + begin.getDate()).slice(-2) + " " + ("0" + begin.getHours()).slice(-2) + ("0" + begin.getMinutes()).slice(-2) + ("0" + begin.getSeconds()).slice(-2);
				end = new Date(parseInt(end));
				end = end.getFullYear() + ("0" + (end.getMonth()+1)).slice(-2) + ("0" + end.getDate()).slice(-2) + " " + ("0" + end.getHours()).slice(-2) + ("0" + end.getMinutes()).slice(-2) + ("0" + end.getSeconds()).slice(-2);
			} else {
				var begin = '---';
				var end = '---';
				var value = '---';
			}

			if (!HAS_NEW_DATA){
				begin = 'N/A';
				end = 'N/A';
				value = 'N/A';
			} 

			table.select('tr:nth-of-type(3) td:first-of-type').text(begin);
			table.select('tr:nth-of-type(3) td:nth-of-type(2)').text(end);
			table.select('tr:nth-of-type(3) td:last-of-type').text(value);
		}

	}

	function draw() {	    

		//console.log('\n');
		var scale = zoom.scale();
		var ZOOMING_IN = scale - last_scale;
		if (scale > last_scale) {
			// we are zooming in
			ZOOMING_IN = 1;
		} else if(scale === last_scale) {
			// just panning
			ZOOMING_IN = 0;
		} else {
			ZOOMING_IN = -1;
		}
		last_scale = scale;

		// 0 -> left point of graph
		// 1 -> right point of graph
		var adj_mx = mouseMap(MOUSE_X);

		if(adj_mx < 0) {
			adj_mx = 0;
		}

		var delta = adjusted_end_millis - adjusted_start_millis;

		if (ZOOMING_IN !== 0) {
			// zooming
			ZOOMING_IN *= 1.3;
			var time_offset_millis = (delta)/30 * ZOOMING_IN; // no effect if panning
			var Ltrim = adj_mx * time_offset_millis;
			var Rtrim = (1-adj_mx) * time_offset_millis;

			adjusted_start_millis += Ltrim;
			adjusted_end_millis -= Rtrim;
		}
		else if(ZOOMING_IN === 0 && MOUSE_DOWN) {
			// panning
			var DIRECTION = LAST_MOUSE_X - MOUSE_X;
			var adj_amount = delta/(500);

			var future_start_millis = adjusted_start_millis + (adj_amount * DIRECTION);
			var future_end_millis = adjusted_end_millis + (adj_amount * DIRECTION);

			if(future_start_millis <= start_time_millis || future_end_millis >= end_time_millis) {
				future_start_millis = adjusted_start_millis;
				future_end_millis = adjusted_end_millis;
			}

			adjusted_start_millis = future_start_millis;
			adjusted_end_millis = future_end_millis;

		}

		if (adjusted_start_millis > adjusted_end_millis) {
			adjusted_start_millis = adjusted_end_millis;
		}

		if (adjusted_end_millis < adjusted_start_millis) {
			adjusted_end_millis = adjusted_start_millis;
		}

		adjusted_start_millis = Math.max(start_time_millis, adjusted_start_millis);
		adjusted_end_millis = Math.min(end_time_millis, adjusted_end_millis);

		// start and ending indexes in range
		old_visible_start_index = d3.bisectLeft(old_start_times, adjusted_start_millis);
		old_visible_end_index = d3.bisectRight(old_end_times, adjusted_end_millis);

		new_visible_start_index = d3.bisectLeft(new_start_times, adjusted_start_millis);
		new_visible_end_index = d3.bisectRight(new_end_times, adjusted_end_millis);

		old_visible_start_index = Math.max(0, old_visible_start_index-1);
		old_visible_end_index = Math.min(old_logs.length, old_visible_end_index+1);

		new_visible_start_index = Math.max(0, new_visible_start_index-1);
		new_visible_end_index = Math.min(new_logs.length, new_visible_end_index+1);

		old_visible_starts = old_start_times.slice(old_visible_start_index, old_visible_end_index);
		old_visible_ends   =   old_end_times.slice(old_visible_start_index, old_visible_end_index);
		old_visible_data   =        old_data.slice(old_visible_start_index, old_visible_end_index);

		new_visible_starts = new_start_times.slice(new_visible_start_index, new_visible_end_index);
		new_visible_ends   =   new_end_times.slice(new_visible_start_index, new_visible_end_index);
		new_visible_data   =        new_data.slice(new_visible_start_index, new_visible_end_index);

		// if(visible_data.length < 5 ) {
		// 	console.log('resize');
		// 	zoom.scaleExtent([0, zoom.scale() * 2]);
		// }

		x.domain([adjusted_start_millis, adjusted_end_millis]);
		y.domain([0, Math.max(d3.max(old_visible_data), d3.max(new_visible_data))]);
		xAxisG.call(xAxis);
		yAxisG.call(yAxis);

		// ======================================== OLD ================================================

		// JOIN
		var old_bar = old_group.selectAll('rect')
			.data(old_visible_data);

		// remove surplus
		old_bar.exit().remove();


		// update current bars
		old_bar.attr('begin', function(d, i) {return old_visible_starts[i]})
		    .attr('end', function(d, i) {return old_visible_ends[i]})
		    .attr('value', function(d) {return d})
			.attr('width', function(d, i) {return Math.max(x(old_visible_ends[i]) - x(old_visible_starts[i]),0)})
			.attr('x', function(d, i) {return x(old_visible_starts[i])})
		    .attr('y', function(d, i) {return y(d)})
		    .attr('height', function(d, i) {return height + margins.top - y(d)})
		    .on('mousedown', setMouseDown)
		    .on('mouseup', setMouseUp)
		    .on('mousemove', getMousePos);

		// add bars as needed
		old_bar.enter()
			.append('rect')
			.attr('begin', function(d, i) {return old_visible_starts[i]})
	    	.attr('end', function(d, i) {return old_visible_ends[i]})
	    	.attr('value', function(d) {return d})
	    	.attr('class', 'old bar')
	    	.attr('width', function(d, i) {return Math.max(x(old_visible_ends[i]) - x(old_visible_starts[i]), 0)})
	    	.attr('x', function(d, i) {return x(old_visible_starts[i])})
	    	.attr('y', function(d, i) {return y(d)})
	    	.attr('height', function(d, i) { return height + margins.top - y(d)})
	    	.on('mousedown', setMouseDown)
	    	.on('mouseup', setMouseUp)
	    	.on('mousemove', getMousePos)
	    	.call(zoom);

	    // also need to update the ends so they aren't hanging over the edge
	    try {
	    	var xpos = parseFloat(old_group.select('rect:first-of-type').attr('x'));
			var bwidth = parseFloat(old_group.select('rect:first-of-type').attr('width'));

			old_group.select('rect:first-of-type')
				.attr('x', function() {
					if(xpos < margins.left)
						return margins.left;
					return xpos;
				})
				.attr('width', function(){
					if(xpos < margins.left)
						return Math.max(bwidth - (margins.left - x(old_visible_starts[0])), 0);
					return bwidth;
				});

			// we have to recalculate incase there's only one rect
			xpos = parseFloat(old_group.select('rect:last-of-type').attr('x'));
			bwidth = parseFloat(old_group.select('rect:last-of-type').attr('width'));

			old_group.select('rect:last-of-type')
				.attr('width', function() {
					if(xpos + bwidth < width + margins.left)
						return bwidth;
					return Math.max((width + margins.left - xpos), 0);
				});
			} catch (err) {
				console.log("could not update old data");
			}
	    
		// need more logic to not get a too wide thingy use the new values for comparison

	 //    // ======================================== NEW ================================================

	    var new_bar = new_group.selectAll('rect')
			.data(new_visible_data);

		// remove surplus
		new_bar.exit().remove();

		// update current bars
		new_bar.attr('begin', function(d, i) {return new_visible_starts[i]})
		    .attr('end', function(d, i) {return new_visible_ends[i]})
		    .attr('value', function(d) {return d})
			.attr('width', function(d, i) {return Math.max(x(new_visible_ends[i]) - x(new_visible_starts[i]),0)})
			.attr('x', function(d, i) {return x(new_visible_starts[i])})
		    .attr('y', function(d, i) {return y(d)})
		    .attr('height', function(d, i) {return height + margins.top - y(d)})
		    .on('mousedown', setMouseDown)
		    .on('mouseup', setMouseUp)
		    .on('mousemove', getMousePos);

		// add bars as needed
		new_bar.enter()
			.append('rect')
			.attr('begin', function(d, i) {return new_visible_starts[i]})
	    	.attr('end', function(d, i) {return new_visible_ends[i]})
	    	.attr('value', function(d) {return d})
	    	.attr('class', 'new bar')
	    	.attr('width', function(d, i) {return Math.max(x(new_visible_ends[i]) - x(new_visible_starts[i]), 0)})
	    	.attr('x', function(d, i) {return x(new_visible_starts[i])})
	    	.attr('y', function(d, i) {return y(d)})
	    	.attr('height', function(d, i) { return height + margins.top - y(d)})
	    	.on('mousedown', setMouseDown)
	    	.on('mouseup', setMouseUp)
	    	.on('mousemove', getMousePos)
	    	.call(zoom);

		// also need to update the ends so they aren't hanging over the edge
		try {
			var xpos = parseFloat(new_group.select('rect:first-of-type').attr('x'));
			var bwidth = parseFloat(new_group.select('rect:first-of-type').attr('width'));
			new_group.select(' rect:first-of-type')
				.attr('x', function() {
					if(xpos < margins.left)
						return margins.left;
					return xpos;
				})
				.attr('width', function(){
					if(xpos < margins.left)
						return Math.max(bwidth - (margins.left - x(new_visible_starts[0])), 0);
					return bwidth;
				});

			var xpos = parseFloat(new_group.select('rect:last-of-type').attr('x'));
			var bwidth = parseFloat(new_group.select('rect:last-of-type').attr('width'));
			new_group.select('rect:last-of-type')
				.attr('width', function() {
					if(xpos + bwidth < width + margins.left)
						return bwidth;
					return Math.max((width + margins.left - xpos), 0);
			});
		} catch (err) {
			console.log("could not update new data");
		}
	}
}


function render_bargraph(parent, object) {
	logs = object['logs'];
	var bargraph = new Bargraph(parent, logs);
}


function render_bargraph_diff(parent, object) {
	load_csv(parent, data_id, object.old_data, function(old_logs) {
		load_csv(parent, data_id, object.new_data, function(new_logs) {
			var bargraph = new BargraphDiff(parent, old_logs, new_logs);
		});
	});
}