var fnMain = (function() {
    function render(deltaMs, state) {
        requestAnimationFrame(function(timestamp){
            render(timestamp, state);
        });
        state.app.renderer.render(state.app.stage);
        state.recorder.capture(state.app.renderer.view);
    }

    function getConfig() {
        const pstring = '#72969D,#DCAD68,#834D6F,cyan';
        const palette = pstring.split(',');
        //const palette = ['#0F694D', '#520CC2', '#D8C026', '#14F7E2'];
        //const palette = ['yellow', 'navy'];
        //const palette = ['red', 'green', 'blue'];
        return {
            numShapes: 80,
            nSides: 4,
            shapeRadius: 0.44,
            shapeHolePercent: 0.9,
            spinDuration: 1800,
            spinOffset: 0.6,
            spinEasing: 'easeInOutCirc',
            screenMargin: 0.03, //percent on each edge not included in 'board' rectangle
            colorScale: chroma.scale(palette).mode('lch'), //modes: lch, lab, hsl, rgb
            shapeAlpha: 1,
            shapeBlendMode: PIXI.BLEND_MODES.MULTIPLY,
            palette: palette,
            backgroundColor: 0xFFFFFF,
        };
    }

    function makeBoardRectangle(margin, viewRectangle) {
        const xmargin = Math.round(margin * viewRectangle.width);
        const ymargin = Math.round(margin * viewRectangle.height);
        const boardWidth = viewRectangle.width - (xmargin * 2);
        const boardHeight = viewRectangle.height - (ymargin * 2);
        return new PIXI.Rectangle(xmargin, ymargin, boardWidth, boardHeight);
    }

    function makeRange(n) {
        var arr = Array.apply(null, Array(n));
        return arr.map(function (x, i) { return i });
    };

    function randomColor(colorScale) {
        const colorArray = colorScale(Math.random()).rgb();
        const colorNumber = RGBTo24bit(colorArray);
        return colorNumber;
    }

    function RGBTo24bit(rgbArray) {
        let result = Math.floor(rgbArray[2])
            | Math.floor(rgbArray[1]) << 8
            | Math.floor(rgbArray[0]) << 16;
        return result;
    }

    function portion(i, size) {
        return i / ((size -1) || 1);
    }

    function drawNSideRegular(graphics, nSides, centerX, centerY, radius, color24, alpha) {
        graphics.beginFill(color24, alpha);
        const points = makeRange(nSides).map((x,i) => {
            const fixedRotation = 0.25;
            const amountAround = i / nSides + fixedRotation;
            const vx = radius * Math.cos(Math.PI * 2 * amountAround) + centerX;
            const vy = radius * Math.sin(Math.PI * 2 * amountAround) + centerY;
            const point = new PIXI.Point(Math.round(vx) + 0.5, Math.round(vy) + 0.5);
            return point;
        });
        graphics.drawPolygon(points);
        graphics.endFill();
    }

    function makeShapes(config, board, renderer) {
        function makeShape(i) {
            const g = new PIXI.Graphics();
            g.cacheAsBitmap = true;
            const diameter = config.shapeRadius * 2;
            g.width = diameter;
            g.height = diameter;
            const color = RGBTo24bit(config.colorScale(i / config.numShapes)
                .luminance(0.25)
                .brighten(2)
                //.saturate(0.25)
            .rgb());
            drawNSideRegular(g, config.nSides, config.shapeRadius, config.shapeRadius, config.shapeRadius, color, config.shapeAlpha);
            drawNSideRegular(g, config.nSides, config.shapeRadius, config.shapeRadius, config.shapeRadius * config.shapeHolePercent, config.backgroundColor, 1);
            const texture = PIXI.RenderTexture.create(diameter, diameter);
            renderer.render(g, texture);
            const sprite = new PIXI.Sprite(texture);
            sprite.x = Math.round(board.width / 2) + board.left;
            sprite.y = Math.round(board.height / 2) + board.top;
            sprite.anchor.set(0.5, 0.5);
            sprite.blendMode = config.shapeBlendMode;
            const shape = {
                sprite: sprite,
            };
            return shape;
        }
        let shapes = makeRange(config.numShapes).map((x, i) => {
            return makeShape(i);
        });
        return shapes;
    }

    function animateShapes(shapes, board, config) {
        const timeline = anime.timeline({
            autoplay: false,
            loop: true
        });
        for(let i = 0; i < shapes.length; i++) {
            const shape = shapes[i];
            //const left = i % 2 == 0 ? -1 : 1;
            timeline.add({
                targets: shape.sprite,
                rotation:  Math.PI / config.nSides,
                easing: config.spinEasing,
                offset: (1 - portion(i, shapes.length)) * (config.spinDuration * config.spinOffset),
                duration: config.spinDuration,
            }).add({
                targets: shape.sprite,
                rotation:  Math.PI * 2 / config.nSides,
                easing: config.spinEasing,
                offset: (config.spinDuration * config.spinOffset + config.spinDuration) + (1 - portion(i, shapes.length)) * (config.spinDuration * config.spinOffset),
                duration: config.spinDuration,
            });
        }
        return timeline;
    }

    return (function() {
        const config = getConfig();
        const mainel = document.getElementById("main");
        let app = new PIXI.Application({
            width: mainel.width,
            height: mainel.height,
            view: mainel,
            autoResize: true,
            antialias: true,
            autoStart: false,
        });
        app.renderer.backgroundColor = config.backgroundColor;
        app.renderer.render(app.stage);
        //note: this prevents ticker starting when a listener is added. not when the application starts.
        app.ticker.autoStart = false;
        app.ticker.stop();

        let board = makeBoardRectangle(config.screenMargin, app.screen);
        const smaller = board.width < board.height ? board.width : board.height;
        config.shapeRadius = Math.round(config.shapeRadius * smaller);
        const shapes = makeShapes(config, board, app.renderer);
        for(let s of shapes) {
            app.stage.addChild(s.sprite);
        }
        const animation = animateShapes(shapes, board, config);
        let state = {
            config: config,
            app: app,
            board: board,
            animation: animation,
            shapes: shapes,
        };
        return function(recorder) {
            state.recorder = recorder || {capture: function(){}};
            app.start();
            render(Date.now(), state);
            animation.play();
            return state;
        }
    })();
})();