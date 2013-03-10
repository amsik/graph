;(function($){
    
    var canvas, ctx, targetsConf = {}, airFile, toConf = null;

    // -------------   Работа с файлами в Adobe AIR  -------------
    function AIRFile() {    

        // Читаем или записываем из файла
        this.fileName = air.File.applicationStorageDirectory.resolvePath('params_graph.ini');    

        if ( !this.fileName.exists ) {
            this.writeToFile('');
        }

        var config = this.readFromFile();

        config = this.parseConfig(config);

        // создаем объект из имен кнопок
        for( var i in config ) {

            targetsConf[i] = { 
                'time'     : config[i]['time'], 
                'volume'   : config[i]['volume'] 
            };

        }

    }

    AIRFile.prototype = {

        // запись в файл
        writeToFile: function(content, mode) {
            mode = mode || 'WRITE';

            var stream  = new air.FileStream();
            
            stream.open( this.fileName, air.FileMode[mode] );
            stream.writeMultiByte( content, air.File.systemCharset );
            stream.close();
        },

        // чтение из файла
        readFromFile: function() {
            var content = null;                                                       
            var stream  = new air.FileStream();
            
            stream.open( this.fileName, air.FileMode.READ );
            content = stream.readMultiByte( stream.bytesAvailable, air.File.systemCharset );
            stream.close(); 

            return content;     
        },

        // разбор конфига на объект
        parseConfig: function (content) {
            var elements, values = {};

            elements = content.split(';');

            for( var i = 0; i < elements.length; i++ ) {

                var 
                    elOnce = elements[i].split(":"),
                    params;

                if ("" == elOnce[0]) {
                    continue;
                }


                params = elOnce[1].split(',');

                values[elOnce[0]] = { 
                    'time'     : params[0], 
                    'volume'   : params[1] 
                };
            }

            return values;
        },

        // перевод объекта в строку для конфига
        toStr: function(obj) {
            var str = '';

            for( var i in obj ) {
                str += i + ":" + obj[i].time + "," + obj[i].volume + ";";
            }

            return str;
        }
    };


    function airTrace(obj) {
        for(var i in  obj) {

            if ('object' == typeof obj[i]) {
                air.trace(i + ": ");    

                for(var j in obj[i]) {
                    air.trace(j + ": " + obj[i][j]);
                }
            } else {
                air.trace(i + ": " + obj[i]); 
            }
            
        }
    }

    if ('undefined' != typeof air) {
        airFile = new AIRFile();
    }

    $.fn.KGraph = function(options) {

        options         = options || {};
        options.node    = this;

        var 
            doteParams,
            graph   = new Graph(options),
            iDote   = new Image();

        graph.countDotes = options.dotes.length;        // кол-во точек

        graph.offsetY    = 22;                          // смещение по оси Y
        graph.offsetX    = 0;                           // смещение по оси X

        if ('undefined' != typeof air) {
            
            var conf = airFile.parseConfig(airFile.readFromFile());           

            $.each(conf, function(index, element) {
                graph.dotes[index].x = element.time;
                graph.dotes[index].y = element.volume;
            });
             airTrace(graph.dotes);
        }

        // рисуем точки
        iDote.onload = function() {

            graph.setDoteParams({
                'w'     : iDote.width,
                'h'     : iDote.height,
                'img'   : iDote
            });
            
            graph.radius = iDote.width / 2;

            graph.render();
            graph.calculateValue();
            graph.displayData();
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

                    // отображаем значения громкости / скорости вверху
                    graph.displayData();
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
                        'top'        : '-20px',
                        'position'   : 'relative',
                        'marginLeft' : '6px',
                        'marginTop'  : '22px'
                    });

        ctx = canvas[0].getContext('2d');

    }

    Graph.prototype = {

        doteParams  : {},                       // основные св-ва точки
        positions   : [],                       // текущии позиции для точек
        direction   : {},                       // направления перетаскивания ( вверх/вниз || влево/вправо)
        values      : [],

        setDoteParams: function(obj) {
            this.doteParams = obj;
        },

        getPosition: function(i) {
            return {
                'x'     : this.positions[i][0],
                'y'     : this.positions[i][1],
                'party' : this.positions[i][2]   
            }
        },

        checkVal: function(that, who) {

            if ( that > who['max'] ) 
                return who['max'];

            if ( that < who['min'] )
                return who['min'];

            return that;

        },

        calculateValue: function(n) {

            if (!n && n != 0) { 
                for( var i = 0; i < this.countDotes; i++ ) {
                    this.values[i] = _getValue.call(this, this.getPosition(i));
                    targetsConf[i] = this.values[i];
                }
            } else {
                this.values[n] = _getValue.call(this, this.getPosition(n));

                // аргументы для callback функций
                var clbArguments = [this.values[n]['time'], this.values[n]['volume'], n, this.values];

                // диспатчим событие на элементе
                if ('string' == typeof this.event) {
                    this.node.trigger(this.event, clbArguments);    
                }

                if ('function' == typeof this.callback) {
                    this.callback.apply(this, clbArguments);
                }

                targetsConf[n] = this.values[n];
            }

            
            if ('undefined' != typeof air) {
                clearTimeout(toConf);    
    
                toConf = setTimeout(function() {
                    airFile.writeToFile( airFile.toStr(targetsConf) );
                }, 3000);
            }


            // получение значения из координат
            function _getValue(coords) {

                // сдвиг по координатам по оси Х
                // TODO: исправлено на одинаковый сдвиг
                //var shiftX = coords.party == 'left' ? 1 : 1;
                //var shiftY = coords.party == 'left' ? 1.5 : 1.5;

                var shiftY = 1.5;
                var shiftX = 1;


                var c = {
                    'x' : coords.x + this.radius - shiftX,
                    'y' : coords.y + this.radius - shiftY
                };

                var 
                    aArea = this.area.location[coords['party']],        // активная локация
                    aMark = this.marking[coords['party']],              // активная маркировка
                    params = {};


                params = {
                    'x' : {
                        'values'  : Math.abs( aMark['x']['max'] - aMark['x']['min'] ),
                        'percent' : (c.x - aArea[0]) / aArea[2]
                    },
                    'y' : {
                        'values'  : Math.abs( aMark['y']['max'] - aMark['y']['min'] ),
                        'percent' : (c.y - 20) / aArea[3]
                    }
                };


                var rTime   = params['x']['percent'] * params['x']['values']
                var rVolume = Math.ceil(params['y']['percent'] * params['y']['values'])

                if (coords.party == 'right') {
                    rTime = rTime - params['x']['values']
                }

                return {
                    'time'   : this.checkVal(rTime.toFixed(1), aMark['x']),
                    'volume' : this.checkVal(aMark['y']['max'] - rVolume, aMark['y'])
                }

            }


        },

        displayData: function() {

            // позиции для значений кнопок
            var posPushBtns = getPosData();

            var text, a, layout = [];

            ctx.clearRect(0, 0, 250, 12);

            for( var i = 0; i < 4; i++ ) {

                a = posPushBtns[i];

                text = new Text(a['mainText']).display();
               
                layout = ['(', this.values[i]['time'], '*', this.values[i]['volume'], ')'];

                a['extraText']['text'] = layout.join('');
                text.addText(a['extraText']);

            }


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

            party = this.dotes[num].area; 
            aLoc  = this.area.location[party];

            this.positions[num][2] = party;

            if (!this.direction.x || !this.direction.y) {
                return;
            }

            var checkTheSign = function(pos, comparison, sign) {
                return sign == 'less' ? pos > comparison : pos < comparison;
            }

            var comparisonX = {}, comparisonY = {};

            comparisonX = {
                'right' : 'left' == party ? (aLoc[0] + aLoc[2] - this.radius) : aLoc[0] + aLoc[2] - this.radius + 3,
                'left'  : 'left' == party ? (aLoc[0] - this.radius - 1) : aLoc[0] - this.radius + 2,
                'sign'  : 'left' == this.direction.x ? 'less' : 'over'
            };


            comparisonY = {
                'down' : aLoc[3] - this.radius + this.offsetY,
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
                otherDote = ('left' == this.direction.x ? -1 : 1),
                n         = num + otherDote,
                signX     = 'left' == this.direction.x ? 'over' : 'less';



            if ('undefined' != typeof this.positions[n]) {

                var otherPos  = this.positions[n][0];

                if ( checkTheSign(this.positions[num][0], otherPos, signX) ) {
                    this.positions[num][0] = otherPos;   

                }
            }

            // считаем значения
            this.calculateValue(num);
        },

        // рисуем 
        render: function(reDraw) {

            ctx.clearRect(0, 10, canvas.height(), canvas.width());

            if (!reDraw) {
    
                // соберем координаты в кучу
                for( var i = 0; i < this.countDotes; i++ ) {
                    this.positions[i] = this.toCoords(i, this.dotes[i].area);

                    // делаем сдвиг
                    this.positions[i][0] += this.offsetX;
                    this.positions[i][1] += this.offsetY;
                    this.positions[i][2] = this.dotes[i]['area'];
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

            for( var i = 0; i < this.countDotes; i++ ) {
                iFunc.call(this, i);
            }
            
            if ('function' == typeof eFunc) {
                eFunc.apply(this);
            }

        },

        startDrawLine: function() {
            ctx.clearRect(0, 10, canvas.width(), canvas.height());
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


    function Text(params) {

        this.font       = 'normal normal 12px Tahoma';
        this.fillStyle  = '#fff';

        $.extend(this, params);

        this.startText = this.text;

        this.display = function() {

            if (!this.text) {
                return;
            }

            ctx.save();
            ctx.font        = this.font;
            ctx.fillStyle   = this.fillStyle;

            ctx.fillText(this.text, this.x, this.y);
            ctx.restore();

            return this;
        }

        this.addText = function(params) {
            $.extend(this, params);
            
            var m           = ctx.measureText(this.startText);
            var metricWidth = params['metric'] || 2;

            this.x += m.width + metricWidth;

            this.display();
        }

    }





    function getPosData() {
        return {
            '0' : {
                'mainText' : {
                    'text' : 'A', 'x' : 0, 'y' : 10, 'font' : 'bold normal 11px Tahoma'
                },
                'extraText' : {
                    'fillStyle' : '#b4c1ca', 'font' : 'normal normal 11px Tahoma'                        
                }
            },
            '1' : {
                'mainText' : {
                    'text' : 'B', 'x' : 59, 'y' : 10, 'font' : 'bold normal 11px Tahoma'
                },
                'extraText' : {
                    'fillStyle' : '#b4c1ca', 'font' : 'normal normal 11px Tahoma'                        
                }                    
            },
            '2' : {
                'mainText' : {
                    'text' : 'C', 'x' : 118, 'y' : 10, 'font' : 'bold normal 11px Tahoma'
                },
                'extraText' : {
                    'fillStyle' : '#b4c1ca', 'font' : 'normal normal 11px Tahoma'                        
                }                    
            },
            '3' : {
                'mainText' : {
                    'text' : 'D', 'x' : 182, 'y' : 10, 'font' : 'bold normal 11px Tahoma'
                },
                'extraText' : {
                    'fillStyle' : '#b4c1ca', 'font' : 'normal normal 11px Tahoma'                        
                }                    
            },

        }
    }

})(jQuery);

    
var _c = function (log) {
    console.log(log)
}