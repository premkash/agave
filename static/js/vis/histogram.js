define(['lib/d3', 'underscore',
    'util/rectangle'],
    function (d3, _, Rectangle) {

        /**
         * Basic histogram visualization, created via an area chart.
         */
        var Histogram = function () {
            var self = this;

            this._showing = false;

            //Set up a default box for the histogram
            this._box = new Rectangle({
                top: 0,
                left: 0,
                width: 200,
                height: 200
            });

            //Whether or not the vertical baseline is auto scaled or fixed at 0
            this._autoBaseline = false;

            //Optional classname to add to the histogram container
            this._className = "";

            //Optional class name to add to the histogram data series
            this._seriesClass = '';

            //Whether or not the histogram is vertically flipped
            this._flipped = false;

            //Function that retrieves the x dimension from the data
            this._xAccessor = function (d) {
                return d.time;
            };
            //Function that retrieves the y dimension from the data
            this._yAccessor = function (d) {
                return d.count;
            };

            //Set up the scales
            this._xScale = d3.time.scale();
            this._yScale = d3.scale.linear();

            //Immutable functions for scaling the x and y data, not meant to be changed.
            //Only the scales and the accessors should be changeable.
            var _scaledX = function (d) {
                return self._xScale(self._xAccessor(d));
            };
            var _scaledY = function (d) {
                return self._yScale(self._yAccessor(d));
            };

            //The svg area generator uses the scaling functions
            this._area = d3.svg.area()
                .x(_scaledX)
                .y1(_scaledY);

            this._useLine = false;
            this._line = d3.svg.line()
                .x(_scaledX)
                .y(_scaledY);
        };

        Histogram.USE_VISIBLE_SECTION = true;

        _.extend(Histogram.prototype, {

            bold: function (bolded) {
                this._target.select("path")
                    .classed('bold', bolded);
            },

            line: function (useLine) {
                if (!arguments.length) {
                    return this._useLine;
                }
                this._useLine = useLine;
                return this;
            },

            seriesClass: function (className) {
                if (!arguments.length) {
                    return this._seriesClass;
                }
                this._seriesClass = className;
                return this;
            },

            /**
             * Update the scales based on the data
             */
            _updateScales: function () {
                //Redo the x range in case the box has changed
                this._xScale.range([0, this._box.width()]);

                //Redo the y range in case the box or flipped has changed
                if (this._flipped) {
                    this._yScale.range([0, this._box.height()]);
                } else {
                    this._yScale.range([this._box.height(), 0]);
                }

                //Update the area baseline with any changes to the y scale.
                //Unlike y1, y0 does not update based on the data.
                this._area.y0(this._yScale(0));
            },

            /**
             * Render the histogram background elements.
             */
            _renderTarget: function () {

                //Add an svg document. It is ok if this is nested inside another svg.
                this._svg = this._container.append('svg');

                //Create a group to be the rendering target.
                this._target = this._svg.append('g');
            },

            /**
             * Make the histogram invisible.
             */
            hide: function () {
                var self = this;
                this._showing = false;
                this._svg.classed('in', false);
                this._showHideTimeout = setTimeout(function () {
                    self._svg.style('display', 'none');
                }, 500);
            },

            /**
             * Make the histogram visible.
             */
            show: function () {
                this._showing = true;

                if (this._showHideTimeout) {
                    clearTimeout(this._showHideTimeout);
                    this._showHideTimeout = null;
                }

                this._svg.style('display', 'inline');
                //Force reflow
                this._svg[0][0].offsetWidth;
                this._svg.classed('in', true);
            },

            isShowing: function () {
                return this._showing;
            },

            /**
             * Render the histogram.
             */
            render: function () {
                this._renderTarget();

                this._updateScales();

                this._updateTarget();

                this._renderPath();
            },

            /**
             * Update the histogram.
             */
            update: function (animate) {
                if (animate === undefined) {
                    animate = true;
                }

                this._updateScales();
                this._updateTarget();
                this._updatePath(animate);
            },

            /**
             * Update the size of the target, if the box size has changed.
             */
            _updateTarget: function () {
                this._svg.call(this._box);

                this._svg.attr('class', this._className, true);
                this._svg.classed('in', this._showing);
            },

            /**
             * Add the path element for rendering the area.
             */
            _renderPath: function () {
                var path = this._target.append("path");

                this._updatePath(false);
            },

            /**
             * Update the path using the area generator.
             */
            _updatePath: function (animate) {
                var data = this.data();
                if (data) {
                    if (Histogram.USE_VISIBLE_SECTION) {
                        //Select the part of the data we are showing
                        var visibleRange = this._visibleRange(data);
                        if (visibleRange) {
                            data = data.slice(visibleRange[0], visibleRange[1]);
                        }
                    }
                    //Bind the data to the target
                    this._target.datum(data);
                }

                var path = this._target.select("path");
                path.attr('class', this._seriesClass);

                var generator = this._area;
                var classToSet = 'area';
                if (this._useLine) {
                    generator = this._line;
                    classToSet = 'line';
                }

                path.classed(classToSet, true);

                //Only update if there is data
                if (this._target.datum()) {
                    //Adjust the path to fit the data
                    if (animate) {
                        path.transition()
                            .attr('d', generator);
                    } else {
                        path.attr('d', generator);
                    }
                }
            },

            /**
             * Returns an array [from, to] referring to the segment of the input
             * array that is inside the visible part of the histogram.
             * @param data
             * @private
             */
            _visibleRange: function (data) {
                var from = 0, to = data.length, time, i;
                var visible = this._xScale.domain();
                var shrunk = false;

                //Find the start time
                for (i = 0; i < data.length; i++) {
                    time = this._xAccessor(data[i]);
                    if (time < visible[0]) {
                        from = i - 1;
                        shrunk = true;
                    } else {
                        //save the last time that was before the range
                        break;
                    }
                }

                for (i = data.length - 1; i >= 0; i--) {
                    time = this._xAccessor(data[i]);
                    if (time > visible[1]) {
                        to = i + 2;
                        shrunk = true;
                    } else {
                        //Save the last time that was after the range
                        break;
                    }
                }

                if (shrunk) {
                    return [Math.max(from, 0), Math.min(to, data.length - 1)];
                }
            },

            /**
             * Auto size the x scale domain to the data.
             */
            xScaleDomainAuto: function (data) {
                this._xScale.domain(d3.extent(data, this._xAccessor));
                return this;
            },

            /**
             * Auto size the y scale domain to the data.
             */
            yScaleDomainAuto: function (data, autoBaseline) {
                if (!autoBaseline) {
                    this._yScale.domain([0, d3.max(data, this._yAccessor)]);
                } else {
                    this._yScale.domain(d3.extent(data, this._yAccessor));
                }
                return this;
            }
        });

        /**
         * Add a bunch of accessors/mutators
         */
        _.extend(Histogram.prototype, {
            /**
             * Get or set the histogram's container element.
             *
             * An svg element will be added to the container.
             */
            container: function (selection) {
                if (!arguments.length) {
                    return this._container;
                }
                this._container = selection;
                return this;
            },

            /**
             * Get or set the data for the histogram
             */
            data: function (data) {
                if (!arguments.length) {
                    return this._data;
                }

                this._data = data;
                return this;
            },

            /**
             * Get the histogram's render target.
             */
            target: function () {
                return this._target;
            },

            /**
             * Get or set the classname that will be added to the histogram's svg element.
             */
            className: function (value) {
                if (!arguments.length) {
                    return this._className;
                }

                this._className = value;
                return this;
            },

            /**
             * Get or set whether or not the histogram is flipped vertically.
             */
            flipped: function (flipped) {
                if (!arguments.length) {
                    return this._flipped;
                }
                this._flipped = flipped;
                return this;
            },

            /**
             * Get or set the interpolation mode for the histogram area.
             */
            interpolate: function (value) {
                if (!arguments.length) {
                    return this._area.interpolate();
                }

                this._area.interpolate(value);
                this._line.interpolate(value);
                return this;
            },

            /**
             * Get or set the histogram box.
             */
            box: function (value) {
                if (!arguments.length) {
                    return this._box;
                }
                this._box = value;
                return this;
            },

            /**
             * Get or set the x accessor function.
             */
            xData: function (fun) {
                if (!arguments.length) {
                    return this._xAccessor;
                }
                this._xAccessor = fun;
                return this;
            },

            /**
             * Get or set the y accessor function.
             */
            yData: function (fun) {
                if (!arguments.length) {
                    return this._yAccessor;
                }
                this._yAccessor = fun;
                return this;
            },

            /**
             * Get or set the x scale.
             */
            xScale: function (scale) {
                if (!arguments.length) {
                    return this._xScale;
                }
                this._xScale = scale;
                return this;
            },

            /**
             * Get or set the y scale.
             */
            yScale: function (scale) {
                if (!arguments.length) {
                    return this._yScale;
                }
                this._yScale = scale;
                return this;
            }
        });

        return Histogram;

    });