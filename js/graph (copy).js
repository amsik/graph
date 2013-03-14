;(function($){
    
    var /*canvas, ctx, ctx = [],*/ targetsConf = {}, airFile, toConf = null, positions;

    if ( typeof document.onselectstart != 'undefined' ) {
        document.onselectstart = function() {
            return false;
        }
    }

    $('body').css('MozUserSelect', 'none');

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
        for ( var i in config ) {

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

            for ( var i = 0; i < elements.length; i++ ) {

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

            for ( var i in obj ) {
                str += i + ":" + obj[i].time + "," + obj[i].volume + ";";
            }

            return str;
        },

        airTrace : function(obj) {
            for(var i in obj) {

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
    };


    if ('undefined' != typeof air) {
        airFile = new AIRFile();
    }

    $.fn.KGraph = function(options) {

        options         = options || {};
        options.node    = this;

        options.cssClasses = {
            'dote_name'  : 'dote_name',
            'dote_value' : 'dote_value'
        };

        var 
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
            
        }

        // рисуем точки
        iDote.onload = function() {

            graph.setDoteParams({
                'w'     : iDote.width,
                'h'     : iDote.height,
                'img'   : iDote
            });
            
            graph.radius = iDote.width / 2;

            // рисуем точки и линии
            graph.render();

            // подсчет и отображение значений точек
            graph.calculateValue();
            graph.displayData();
        }

        iDote.src = 'images/dote.png';

        // добавляем обработчик
        graph.canvas.on('mousedown', function(e) {

            if ( 2 == e.button ) {
                return;
            }

            var 
                offset = graph.getOffset(e),
                numDote, offsets; 

            if ( (numDote = graph.isPointInDote(offset)) !== false ) {
                $(document).on('mousemove.KGraph_' + graph.blockId, function(e) {
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
            $(this).off('mousemove.KGraph_' + graph.blockId);
        });

        return this;

    }


    function Graph(options) {

        $.extend(this, options);

        var blockId  = 'graph_' + Math.floor(Math.random() * 10000);

        this.canvas = $('<canvas/>', { 'id': 'canva_' + blockId })
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

        this.ctx = document.getElementById('canva_' + blockId).getContext('2d');

        this.node.prepend('<div class="pushbuttons" id="'+ this.blockId +'"></div>');

        this.blockId = blockId;

        var 
            doteBlock, 
            dataParent  = this.node.find('.pushbuttons'),
            literas     = ['A', 'B', 'C', 'D'], 
            currBlock   = $('#' + this.blockId);


        for ( var i = 0; i < 4; i++ ) {

            doteBlock = $('<div class="dote_block"></div>').prependTo(dataParent);

            doteBlock
                .prepend( $('<span/>').addClass(this.cssClasses['dote_name']))
                .append( $('<span/>').addClass(this.cssClasses['dote_value']));

            doteBlock.find('.' + this.cssClasses['dote_name']).text(literas[i]);
        }

    }

    Graph.prototype = {

        doteParams  : {},   // основные св-ва точки
        positions   : [],   // текущии позиции для точек
        direction   : {},   // направления перетаскивания ( вверх/вниз || влево/вправо)
        values      : [],   // значения для точек

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

        createGroup: function(n, vol) {

            if (!this.groups) {
                return;
            }

            var gId;

            n = n || this.groups[0];

            for ( var i = 0; i < this.groups.length; i++ ) {
                gId = this.groups[i];

                if (false != vol) {
                    this.values[gId]['volume']  = this.values[n]['volume'];    
                }
                
                this.positions[gId][1] = this.positions[n][1];
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
                for ( var i = 0; i < this.countDotes; i++ ) {
                    this.values[i] = targetsConf[i] = _getValue.call(this, this.getPosition(i));
                }
            } else {
                this.values[n] = targetsConf[n] = _getValue.call(this, this.getPosition(n));

                // аргументы для callback функций
                var clbArguments = [this.values[n]['time'], this.values[n]['volume'], n, this.values];

                // диспатчим событие на элементе
                if ('string' == typeof this.event) {
                    this.node.trigger(this.event, clbArguments);    
                }

                if ('function' == typeof this.callback) {
                    this.callback.apply(this, clbArguments);
                }

                // добавляем группировку кнопок
                if (this.groups && this.groups.indexOf(n) >= 0) {
                    this.createGroup(n);
                }                 

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

            var 
                text, doteBlock, a, 
                layout = [], currBlock = this.node.find('.pushbuttons');

            for ( var i = 0; i < 4; i++ ) {
               layout = ['(', this.values[i]['time'], '*', this.values[i]['volume'], ')'];

               doteBlock = currBlock.find('.dote_block').eq(i);

               doteBlock.find('.' + this.cssClasses['dote_value']).text(layout.join('')); 
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

            this.ctx.clearRect(0, 10, this.canvas.height(), this.canvas.width());

            if (!reDraw) {
    
                // соберем координаты в кучу
                for ( var i = 0; i < this.countDotes; i++ ) {
                    this.positions[i] = this.toCoords(i, this.dotes[i].area);

                    // делаем сдвиг
                    this.positions[i][0] += this.offsetX;
                    this.positions[i][1] += this.offsetY;
                    this.positions[i][2] = this.dotes[i]['area'];

                }

                    
                if (this.groups) {
                    this.createGroup(false, false);    
                }
                
            }


            // рисуем линии
            this.declare(this.startDrawLine, function(i) {

                var pos = [
                    this.positions[i][0] + (this.radius),
                    this.positions[i][1] + (this.radius),
                ];

                return new Line(pos, this.ctx).draw();

            }, function() {

                this.ctx.lineTo(
                    this.area.location.right[0] + this.area.location.right[2] + 10, 
                    this.positions[3][1] + (this.radius)
                );

                this.ctx.stroke();
                this.ctx.closePath();
            });


            // рисуем точки
            this.declare(null, function(i) {
                return new Dote(this.doteParams.img, this.ctx).draw(this.positions[i]);
            });


        },

        /**
        * На кнопке или не
        */
        isPointInDote: function(offset) {
            //_c(this.positions[0][0]);
            var pos = this.positions, shifts = [];
//_c(this.canvas.attr('id') + ": ")
//_c(offset)
            
            for ( var i = 0; i < pos.length; i++ ) {
                
                shifts = [
                    pos[i][0] + this.doteParams['w'], 
                    pos[i][1] + this.doteParams['h'], 
                ];

//_c(shifts)

//_c('-----------------------------')

                if ( this.between(pos[i][0], shifts[0], offset.x) && this.between(pos[i][1], shifts[1], offset.y) ) {
                    return i;
                }

            }

//_c('+++++++++++++++++++++++++++++')
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

            for ( var i = 0; i < this.countDotes; i++ ) {
                iFunc.call(this, i);
            }
            
            if ('function' == typeof eFunc) {
                eFunc.apply(this);
            }

        },

        startDrawLine: function() {
            this.ctx.clearRect(0, 10, this.canvas.width(), this.canvas.height());
            this.ctx.beginPath();

            this.ctx.moveTo(
                this.area.location.left[0] - 9, 
                this.positions[0][1] + this.radius
            );

            this.ctx.lineTo(
                this.positions[0][0] + (this.radius), 
                this.positions[0][1] + (this.radius)
            );

            this.ctx.strokeStyle = '#8695a2';
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
            this.ctx.strokeStyle = '#fff';
            this.ctx.rect.apply(ctx, b);
            this.ctx.stroke();
        }

    };



    function Dote(img, ctx) {

        this.image  = img;
        this.coords = [];
        this.ctx = ctx;

        this.draw = function(coords) {
            this.coords[0] = this.coordX = coords[0] + this.image.width / 2;
            this.coords[1] = this.coordY = coords[1] + this.image.width / 2;


            this.ctx.drawImage(this.image, coords[0], coords[1]);

            return this;
        }       

        return this;
    };


    function Line(dote, ctx) {
        this.coords = dote;
        this.ctx = ctx;

        this.draw = function() {
            this.ctx.lineTo(this.coords[0], this.coords[1]);
        }

        return this;
    };


    function Text(params, ctx) {

        this.ctx = ctx;
        
        this.font       = 'normal normal 12px Tahoma';
        this.fillStyle  = '#fff';
        
        $.extend(this, params);

        this.startText = this.text;

        this.display = function() {

            if (!this.text) {
                return;
            }

            this.ctx.save();
            this.ctx.font        = this.font;
            this.ctx.fillStyle   = this.fillStyle;

            this.ctx.fillText(this.text, this.x, this.y);
            this.ctx.restore();

            return this;
        }

        this.addText = function(params) {
            $.extend(this, params);
            
            var m           = this.ctx.measureText(this.startText);
            var metricWidth = params['metric'] || 2;

            this.x += m.width + metricWidth;

            this.display();
        }

    }


})(jQuery);

    
var _c = function (log) {
    console.log(log)
}