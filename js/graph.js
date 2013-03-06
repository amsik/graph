;(function($){
    
    var canvas, ctx;

    $.fn.KGraph = function(options) {

        options         = options || {};
        options.node    = this;

        var 
            doteParams,
            graph   = new Graph(options),
            iDote   = new Image();

        //graph.testAreas(options.area.location.right);
        //return;

        $(this).css({'position' : 'relative'});

        // рисуем точки
        iDote.onload = function() {

            graph.setDoteParams({
                'w'     : iDote.width,
                'h'     : iDote.height,
                'img'   : iDote
            });
            
            graph.radius = iDote.width / 2;

            graph.render();

        }

        iDote.src = 'images/dote.png';
        

        // добавляем обработчик
        canvas.on('mousedown.KGraph', function(e) {

            if ( 2 == e.button ) {
                return;
            }

            var 
                offset = graph.getOffset(e),
                numDote, offsets; 

            if ( (numDote = graph.isPointInDote(offset)) !== false ) {
                $(document).on('mousemove.KGraph', function(e) {

                    //if ('CANVAS' != e.target.nodeName.toUpperCase()) {
                    //  $(this).off('mousemove.KGraph');                        
                    //  return;
                    //}

                    offsets = graph.getOffset(e);

                    graph.positions[numDote] = [ 
                        offsets.x - graph.radius,
                        offsets.y - graph.radius
                    ];

                    graph.setDirection(offset, offsets, numDote);
                    graph.render(true);
                });
            }

        });


        $(document).on('mouseup.KGraph', function() {
            $(this).off('mousemove.KGraph');
        });

        return this;

    }


    function Graph(options) {

        $.extend(this, options);

        canvas = $('<canvas/>', { 'id': 'canva_graph' })
                    .attr({ 
                        'width': options.node.width(), 
                        'height': options.node.height() + 50
                    })
                    .appendTo(options.node)
                    .css({
                        'top'       : '-20px',
                        'position'  : 'relative'
                    });

        ctx = canvas[0].getContext('2d');

    }

    Graph.prototype = {

        doteParams  : {},                       // основные св-ва точки
        positions   : [],                       // текущии позиции для точек
        direction   : {},                       // направления перетаскивания ( вверх/вниз || влево/вправо)

        setDoteParams: function(obj) {
            this.doteParams = obj;
        },

        setDirection: function(down, move, numDote) {

            this.direction = {
                'x' : down.x > move.x ? 'left'  : 'right',
                'y' : down.y > move.y ? 'up'    : 'down',
            };

            this.checkPositions(numDote);

        },

        inPathMatrix: function(loc, pos, axis) {

            var realPos = pos + this.radius;

            if ('x' == axis) {
                return loc[0] < realPos && (loc[0] + loc[2]) >= realPos;
            }

            if ('y' == axis) {
                return loc[1] < realPos && (loc[1] + loc[3]) >= realPos;
            }

            return false;

        },

        // проверка позиций
        checkPositions: function(num) {

            var party, aLoc;

            party = num < 2 ? 'left' : 'right';
            aLoc  = this.area.location[party];

            if (!this.direction.x || !this.direction.y) {
                return;
            }

            var checkTheSign = function(pos, comparison, sign) {
                return sign == 'less' ? pos > comparison : pos < comparison;
            }

            var comparisonX = {}, comparisonY = {};

            comparisonX = {
                'right' : 'left' == party ? (aLoc[0] + aLoc[2] - this.radius - 1) : aLoc[0] + aLoc[2] - this.radius + 2,
                'left'  : 'left' == party ? (aLoc[0] - this.radius - 1) : aLoc[0] - this.radius + 1,
                'sign'  : 'left' == this.direction.x ? 'less' : 'over'
            };


            comparisonY = {
                'down' : aLoc[3] - this.radius + 20,
                'up'   : 0 + this.radius + 4,
                'sign' : 'up' == this.direction.y ? 'less' : 'over'
            };

            // проверяем по оси X
            if ( !checkTheSign(this.positions[num][0], comparisonX[this.direction.x], comparisonX['sign']) ) {
                this.positions[num][0] = comparisonX[this.direction.x];
            }

            // проверяем по оси Y
            if ( !checkTheSign(this.positions[num][1], comparisonY[this.direction.y], comparisonY['sign']) ) {
                this.positions[num][1] = comparisonY[this.direction.y];
            }


            /**
            * Проверяем, чтобы кнопка не заходило за соседнюю кнопку
            */
            var 
                nOtherDote  = num + ('left' == this.direction.x ? -1 : 1),
                signX       = 'left' == this.direction.x ? 'over' : 'less';
            
            if ('undefined' == typeof this.positions[nOtherDote]) {
                return;
            }

            if ( checkTheSign(this.positions[num][0], this.positions[nOtherDote][0], signX) ) {
                this.positions[num][0] = this.positions[nOtherDote][0];   
            }


        },

        // рисуем 
        render: function(reDraw) {

            ctx.clearRect(0, 0, canvas.height(), canvas.width());

            if (!reDraw) {
    
                // соберем координаты в кучу
                for( var i = 0; i < 4; i++ ) {
                    this.positions[i] = this.toCoords(i, i < 2 ? 'left' : 'right');
                    this.positions[i][1] += 20;
                }

            }
                                

            // рисуем линии
            this.declare(this.startDrawLine, function(i) {

                var pos = [
                    this.positions[i][0] + (this.radius),
                    this.positions[i][1] + (this.radius),
                ];

                return new Line(pos).draw();

            }, function() {

                ctx.lineTo(
                    this.area.location.right[0] + this.area.location.right[2] + 10, 
                    this.positions[3][1] + (this.radius)
                );

                ctx.stroke();
                ctx.closePath();
            });


            // рисуем точки
            this.declare(null, function(i) {
                return new Dote(this.doteParams.img).draw(this.positions[i]);
            });

        },

        /**
        * На кнопке или не
        */
        isPointInDote: function(offset) {

            var pos = this.positions, shifts = [];

            for ( var i = 0; i < pos.length; i++ ) {
                
                shifts = [
                    pos[i][0] + this.doteParams['w'], 
                    pos[i][1] + this.doteParams['h'], 
                ];

                if ( this.between(pos[i][0], shifts[0], offset.x) && this.between(pos[i][1], shifts[1], offset.y) ) {
                    return i;
                }

            }

            return false;
        },

        between: function(from, to, that) {
            return from <= that && to >= that;
        },

        /**
        * startFunct - выполняется 1 раз
        * iFunc      - выполняется каждую итерацию
        * eFunc      - в конце выполняется
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
            ctx.clearRect(0, 0, canvas.width(), canvas.height());
            ctx.beginPath();

            ctx.moveTo(
                this.area.location.left[0] - 9, 
                this.positions[0][1] + this.radius
            );

            ctx.lineTo(
                this.positions[0][0] + (this.radius), 
                this.positions[0][1] + (this.radius)
            );

            ctx.strokeStyle = '#8695a2';
        },


        // конвертируем из значений в координаты
        toCoords: function(num, party) {

            var 
                aDote   = this.dotes[num], 
                aLoc    = this.area.location[party],
                aMark   = this.marking[party],
                coordX, coordY, division = {};

            // если правая область
            if ( 'right' == party ) {
                aDote['x'] = Math.abs(aMark['x']['min']) - Math.abs(aDote['x']);
            }


            function calcCoords(axis) {
                var c = division[axis] + division[axis] * aMark[axis].step * (aDote[axis] / aMark[axis].step);

                if ('y' == axis) {
                    c = aLoc[3] - c - (this.radius);
                } else {
                    c -= this.radius - 8;  
                }

                if ( 'x' == axis && 'right' == party ) {
                    c = c + aLoc[0] - this.area.location['left'][0];
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

        this.image  = img;
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