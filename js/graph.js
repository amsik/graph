;(function($){
	
	var canvas, ctx;

	$.fn.KGraph = function(options) {

		options 		= options || {};
		options.node 	= this;

		var 
			doteParams,
			graph 	= new Graph(options),
			iDote 	= new Image();

		//graph.testAreas(options.area.location.left);

		// рисуем точки
		iDote.onload = function() {

			graph.setDoteParams({
				'w' 	: iDote.width,
				'h' 	: iDote.height,
				'img' 	: iDote
			});
			
			graph.render();

		}

		iDote.src = 'images/dote.png';
		

		// добавляем обработчик
		canvas.on('mousedown.KGraph', function(e) {
			var offset = graph.getOffset(e); 

			_c(offset)

		});

	}


	function Graph(options) {

		$.extend(this, options);

		canvas = $('<canvas/>', { 'id': 'canva_graph' })
					.attr({ 'width': options.node.width(), 'height': options.node.height() })
					.appendTo(options.node);

		ctx = canvas[0].getContext('2d');

	}

	Graph.prototype = {

		doteParams 	: {},						// основные св-ва точки
		positions   : [],

		setDoteParams: function(obj) {
			this.doteParams = obj;
		},

		// рисуем 
		render: function() {

			// соберем координаты в кучу
			for( var i = 0; i < 4; i++ ) {
				this.positions[i] = this.toCoords(i, i < 2 ? 'left' : 'right');
			}

			// рисуем линии
			this.declare(this.startDrawLine, function(i) {
				var pos = [
					this.positions[i][0] + (this.doteParams['w'] / 2),
					this.positions[i][1] + (this.doteParams['h'] / 2),
				];

				return new Line(pos).draw();
			}, function() {
				ctx.stroke();
			});


			// рисуем точки
			this.declare(null, function(i) {
				return new Dote(this.doteParams.img).draw(this.positions[i]);
			});

		},

		/**
		* startFunct - выполняется 1 раз
		* iFunc		 - выполняется каждую итерацию
		* eFunc		 - в конце выполняется
		*/
		declare: function(startFunc, iFunc, eFunc) {

			if ('function' == typeof startFunc) {
				startFunc.apply(this);
			}

			for( var i = 0; i < 4; i++ ) {
				iFunc.call(this, i);
			}
			
			if ('function' == typeof eFunc) {
				eFunc.apply(this);
			}

		},

		startDrawLine: function() {
			ctx.moveTo(
				this.positions[0][0] + (this.doteParams['w'] / 2), 
				this.positions[0][1] + (this.doteParams['h'] / 2)
			);
			ctx.strokeStyle = '#8695a2';
		},


		// конвертируем из значений в координаты
		toCoords: function(num, party) {

			var 
				aDote 	= this.dotes[num], 
				aLoc	= this.area.location[party],
				aMark	= this.marking[party],
				coordX, coordY, division = {};

			// если правая область
			if ( 'right' == party ) {
				aDote['x'] = Math.abs(aMark['x']['min']) - Math.abs(aDote['x']);
			}


			function calcCoords(axis) {
				var c = division[axis] + division[axis] * aMark[axis].step * (aDote[axis] / aMark[axis].step);

				if ('y' == axis) {
					c = aLoc[3] - c - (this.doteParams['w'] / 2);
				} else {
					c -= this.doteParams['w'] / 2 - 8;	
				}

				if ( 'x' == axis && 'right' == party ) {
					c += aLoc[0] - this.area.location['left'][0];
				}

				return c;
			}

			var x = 'right' == party ? aMark.x.min : aMark.x.max;

			// 1 деление в сетке
			division = {
				'x' : Math.abs( aLoc[2] / x ),
				'y' : aLoc[3] / aMark.y.max
			}


			return [
				calcCoords.apply(this, ['x']), 
				calcCoords.apply(this, ['y'])
			];

		},

		// получение св-ва Offset
		getOffset: function(event, what) {

			var offset = {
				'x' : (typeof event.offsetX != 'undefined') ? event.offsetX : event.originalEvent.layerX,
				'y' : (typeof event.offsetY != 'undefined') ? event.offsetY : event.originalEvent.layerY
			}

			return 'all' == what || !what ? offset : offset[what];

		},

		// Тест области
		testAreas: function(b) {
			ctx.strokeStyle = '#fff';
			ctx.rect.apply(ctx, b);
			ctx.stroke();
		}

	};



	function Dote(img) {

		this.image 	= img;
		this.coords = [];

		this.draw = function(coords) {
			this.coords[0] = this.coordX = coords[0] + this.image.width / 2;
			this.coords[1] = this.coordY = coords[1] + this.image.width / 2;


			ctx.drawImage(this.image, coords[0], coords[1]);

			return this;
		}		

		return this;
	};


	function Line(dote) {
		this.coords = dote;

		this.draw = function() {
			ctx.lineTo(this.coords[0], this.coords[1]);
		}

		return this;

	};

})(jQuery);

	
var _c = function (log) {
	console.log(log)
}