function plot2(parent) {

	var SIDE = 300;
	SCALAR = 0.95;	// 0 means diamter is 0, 1 means diameter is SIDE
	HEAD_SIZE = SIDE/50;
	DIAMETER = (SIDE) * (SCALAR);
	RADIUS = DIAMETER/2;

	var svg = parent.append('svg')
		.attr('width', SIDE)
		.attr('height', SIDE);

	var g = svg.append('g')
		.attr('width', SIDE)
		.attr('height', SIDE);
		
	var c1 = g.append('circle')
		.attr('cx', SIDE/2)
		.attr('cy', SIDE/2)
		.attr('r', RADIUS)
		.style('fill', 'none')
		.style('stroke', 'black');

	var north = g.append('text')
		.text('N')
		.attr('x', SIDE/2)
		.attr('y', SIDE/2 - 3*RADIUS/4)
		.attr('font-family', 'sans-serif')
		.attr('font-size', '30px')
		.attr('text-anchor', 'middle')
		.attr('fill', 'steelblue');

	var trainglePoints = "0,0.866 1,-0.866, -1,-0.866";

	var min_tick = g.append('polygon')
		.attr('points', trainglePoints)
		.attr('fill', 'green')
		.attr('transform', rotateTo(0));


	var max_tick = g.append('polygon')
		.attr('points', trainglePoints)
		.attr('fill', 'red')
		.attr('transform', rotateTo(0));

	var svg2 = parent.append('svg')
		.attr('width', SIDE)
		.attr('height', SIDE);

	var legend = svg2.append('g');

	var rect = legend.append('rect')
		.attr('x', 1)
		.attr('y', 1)
		.attr('width', SIDE-2)
		.attr('height', 100-1)
		.attr('fill', 'white')
		.attr('stroke', 'black')
		.attr('stroke-width', 1);

	var text = legend.append('text')
		.text('Legend')
		.attr('x', 10)
		.attr('y', 25)
		.attr('font-family', 'sans-serif')
		.attr('font-size', '20px')
		.attr('text-anchor', 'left')
		.attr('fill', 'black');

	var gt = legend.append('polygon')
		.attr('points', trainglePoints)
		.attr('fill', 'green')
		.attr('transform', 'translate(20, 50)scale(8)');


	var rt = legend.append('polygon')
		.attr('points', trainglePoints)
		.attr('fill', 'red')
		.attr('transform', 'translate(20, 75)scale(8)');

	var gtext = legend.append('text')
		.text('Minimum Wind Direction')
		.attr('x', 50)
		.attr('y', 55)
		.attr('font-family', 'sans-serif')
		.attr('font-size', '16px')
		.attr('text-anchor', 'left')
		.attr('fill', 'black');

	var gtext = legend.append('text')
		.text('Maximum Wind Direction')
		.attr('x', 50)
		.attr('y', 80)
		.attr('font-family', 'sans-serif')
		.attr('font-size', '16px')
		.attr('text-anchor', 'left')
		.attr('fill', 'black');


		
	function rotateTo(degree) {
		degree %= 360;
		var rad = degree * Math.PI / 180;
		// these values are flipped so 0˚N is on the π/2 angle
		var dx = Math.sin(rad) * RADIUS;
		var dy = Math.cos(rad) * RADIUS;
		return 'translate(' + (SIDE/2 + dx) + ', ' + (SIDE/2 - dy) + ')scale(' + HEAD_SIZE + ')rotate(' + degree + ')';
	}

	obj = {};

	obj.moveToPoint = function(log) {
		min_tick.transition()
			.duration(0)
			.attr('transform', rotateTo(log['min']));

		max_tick.transition()
			.duration(0)
			.attr('transform', rotateTo(log['max']));
	}

	return obj;
}