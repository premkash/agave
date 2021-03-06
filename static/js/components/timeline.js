define(['jquery',
    'underscore',
    'lib/d3',
    'util/events',
    'util/loader',
    'util/transform',
    'util/rectangle',
    'vis/histogram'], function ($, _, d3, events, loader, Transform, Rectangle, Histogram) {

    var AXIS_OFFSET = 3;

    var DEFAULT_DESIRED_BINS = 150;

    /**
     * A class for rendering and maintaining a basic timeline.
     *
     * A wrapper around a histogram that adds axes and data handling.
     *
     * Options must include:
     * - api: An API object
     * - into: a selection
     * - queries: a collection of Query objects
     * - interval: an Interval object
     *
     * Options may include:
     * - width
     * - height
     * - binSize
     * - utcOffset
     * - interpolation
     *
     * @param options
     * @constructor
     */
    var Timeline = function (options) {
        this.api = options.api;
        this.into = options.into || $('<div>');
        this.interval = options.interval;
        this.queries = options.queries;

        this._downsamplingFactor = 1;

        //Create a time scale for the timeline
        this._timeScale = d3.time.scale.utc();

        var basicTimeFormatter = this._timeScale.tickFormat();
        var timeFormatter = function(time) {
            var result = basicTimeFormatter(time);

            //remove leading zeros http://stackoverflow.com/a/6676498
            result = result.replace(/^0+/, '');

            //Lowercase and de-space AM and PM at the end
            result = result.replace(/ AM$/, 'am');
            result = result.replace(/ PM$/, 'pm');
            return result;
        };

        //Create an axis generator for the timeline
        this._timeAxis = d3.svg.axis()
            .scale(this._timeScale)
            .tickFormat(timeFormatter)
            .tickSubdivide(true)
            .orient("bottom");

        this._interpolation = options.interpolation || 'linear';

        //Some tweet data constants. Ideal bin count
        //is used when switching zoom levels to determine a binning
        //granularity based on viewable time range.
        this._binSize = options.binSize || 60 * 1000; //in ms

        this._desiredBinsShowing = options.desiredBins || DEFAULT_DESIRED_BINS;

        //The utc offset to render times at.
        this._utcOffset = options.utcOffset || 0;

        var self = this;

        //The function used to get the time value from count bins.
        //The utc offset is added to convert the time *out* of UTC, but
        //we pretend it is still in UTC.
        this._timeAccessor = function (d) {
            return d.time + self._utcOffset;
        };

        //A function for positioning highlights and annotations (THEY MUST HAVE a 'time' property)
        this._highlightXPosition = function (d) {
            return self._timeScale(self._timeAccessor(d));
        };

        this.initUI();
        this.attachEvents();
    };

    /**
     * Attach to model events.
     */
    Timeline.prototype.attachEvents = function () {
        this.interval.on('change', $.proxy(this._onIntervalChanged, this));

        var queryChange = $.proxy(this._onQueryChanged, this);
        this.queries.forEach(function (query) {
            query.on('change', queryChange);
        });
    };

    /**
     * Sets up the UI container and svg element.
     */
    Timeline.prototype.initUI = function () {
        this.ui = {};
        this.ui.svg = d3.select(this.into.selector)
            .append('svg');

        this.loader = loader({
            into: this.into
        });
    };

    /**
     * Render the timeline. Only should be called once.
     * Subsequently, use update.
     */
    Timeline.prototype.render = function () {

        this._buildBoxes();
        this._updateBoxes();
        this._updateTimeScaleRange();

        this._updateTarget();

        this._renderBackground();

        this._renderTimeAxis();
        this._renderHistogram();

        this._updateDownsamplingFactor();

        this._renderChartGroup();
        this._requestData();
    };

    /**
     * Update the timeline. Only should be called after render.
     */
    Timeline.prototype.update = function (animate) {
        this._updateBoxes();
        this._updateTimeScaleRange();

        this._updateTarget();
        this._updateBackground();

        this._updateTimeAxis();
        this._updateHistogram(animate);

        this._updateAnnotations();
        this._updateHighlights();

        this._updateChartGroup();
    };

    Timeline.prototype._renderChartGroup = function() {
        //A convenient container for anything that needs to be
        //in the same place as the inner box
        this.ui.chartGroup = this.ui.svg.append('svg')
            .classed('chart-group', true);

        this._updateChartGroup();
    };

    Timeline.prototype._updateChartGroup = function() {
        this.ui.chartGroup
            .call(this.boxes.inner);
    };

    /**
     * Request some data for this histogram
     * @private
     */
    Timeline.prototype._requestData = function () {
        //Meant to be overridden
    };


    /**
     * Update the svg element configuration.
     */
    Timeline.prototype._updateTarget = function () {
        this.ui.svg.call(this.boxes.outer);
    };

    /**
     * Render and size the background rectangle.
     */
    Timeline.prototype._renderBackground = function () {
        //Add a background
        this.ui.background = this.ui.svg.append('rect')
            .classed('main background', true);

        this._updateBackground();
    };


    /**
     * Update the size of the background rectangle, in case it has changed.
     */
    Timeline.prototype._updateBackground = function () {
        //Size the background
        this.ui.background
            .call(this.boxes.inner);
    };

    /**
     * Update the range of the timescale in case the box has changed sizes.
     */
    Timeline.prototype._updateTimeScaleRange = function () {
        this._timeScale.range([0, this.boxes.inner.width()]);
    };

    /**
     * Set up all the rectangles used to calculate sub-component sizes and positions.
     */
    Timeline.prototype._buildBoxes = function () {

        this.boxes = {
            outer: new Rectangle(),
            inner: new Rectangle()
        };
    };

    /**
     * Get the margins for the inner (chart) group.
     * @returns {{left: number, right: number, top: number, bottom: number}}
     * @private
     */
    Timeline.prototype._getMargins = function () {
        return {
            left: 60,
            right: 15,
            top: 0,
            bottom: 25
        };
    };

    Timeline.prototype._updateBoxes = function () {
        var margin = this._getMargins();

        var height = this.into.height();
        var width = this.into.width();

        this.boxes.outer.set({
            top: 0,
            left: 0,
            width: width,
            height: height
        });

        this.boxes.inner.set({
            top: this.boxes.outer.top() + margin.top,
            left: this.boxes.outer.left() + margin.left,
            right: this.boxes.outer.width() - margin.right,
            bottom: this.boxes.outer.height() - margin.bottom
        });
    };

    /**
     * Render the timeline.
     */
    Timeline.prototype._renderHistogram = function () {

        //Use a Histogram to draw the timeline
        this._histogram = new Histogram();

        //Configure the histogram itself
        this._histogram
            .className('histogram')
            .container(this.ui.svg)
            .box(this.boxes.inner)
            .xData(this._timeAccessor)
            .xScale(this._timeScale)
            .interpolate(this._interpolation)
            .render();

        this._updateHistogram(false);
    };

    Timeline.prototype._renderTimeAxis = function () {
        //Add an x axis
        this.ui.xAxis = this.ui.svg.append('g')
            .classed('x axis chart-label', true);

        this._updateTimeAxis();
    };

    /**
     * Translate from offset time into real, external UTC time.
     *
     * @param extent
     * @returns {Array}
     */
    Timeline.prototype.extentToUTC = function (extent) {
        return [
            extent[0] - this._utcOffset,
            extent[1] - this._utcOffset
        ];
    };

    /**
     * Translate from real, external UTC time into offset time.
     *
     * @param extent
     * @returns {Array}
     */
    Timeline.prototype.extentFromUTC = function (extent) {
        return [
            extent[0] + this._utcOffset,
            extent[1] + this._utcOffset
        ];
    };

    /**
     * Called when a query model changes.
     *
     * @param e Event
     * @param query
     * @param field
     */
    Timeline.prototype._onQueryChanged = function (e, query, field) {

    };

    /**
     * Called when the interval model changes.
     *
     * @param e Event
     * @param interval
     * @param field
     * @private
     */
    Timeline.prototype._onIntervalChanged = function (e, interval, field) {

    };

    /**
     * Calculate an updated downsampling factor. Returns true if it changed.
     * @private
     */
    Timeline.prototype._updateDownsamplingFactor = function () {
        var showing = this._timeScale.domain();
        var duration = showing[1] - showing[0];

        var binsShowing = duration / this._binSize;
        var newDownsamplingFactor = Math.floor(binsShowing / this._desiredBinsShowing);
        newDownsamplingFactor = Math.max(1, newDownsamplingFactor);

        if (this._downsamplingFactor !== newDownsamplingFactor) {
            this._downsamplingFactor = newDownsamplingFactor;
            return true;
        }
    };


    /**
     * Called when new data is available.
     *
     * @param e Event
     * @param result
     */
    Timeline.prototype._onData = function (e, result) {
        //Update the timeline
        this._updateHistogram(true);
        this._updateTimeAxis();
    };

    /**
     * Update the histogram.
     * @private
     */
    Timeline.prototype._updateHistogram = function (animate) {
        this._histogram.update(animate);
    };

    /**
     * Update the horizontal axis labels.
     * @private
     */
    Timeline.prototype._updateTimeAxis = function () {
        //Update the time axis
        this.ui.xAxis
            .attr('transform', new Transform('translate',
                this.boxes.inner.left(), this.boxes.inner.bottom() + AXIS_OFFSET))
            .call(this._timeAxis);
    };

    /**
     * Set up the display of linked tweets or other stuff.
     *
     * @private
     */
    Timeline.prototype._initHighlights = function () {

        var self = this;

        //A list of highlighted points in time
        this._highlights = [];

        //A lookup object for highlights by id
        this._highlightLookup = {};

        //A lookup for annotations that are currently brushed
        this._brushedAnnotations = {};

        this._highlightClass = function (d) {
            return d.type;
        };

        //A group element for containing the highlight points
        this.api.on('brush', function(e, brushed) {
            self._onBrush(brushed, true);
        });

        this.api.on('unbrush', function(e, brushed) {
            self._onBrush(brushed, false);
        });

        //Set up some default handlers
        this._brushHandlers = {
            'tweet': this._brushTweetOrKeyword,
            'keyword': this._brushTweetOrKeyword,
            'annotation': this._brushAnnotation
        };
    };

    Timeline.prototype._brushAnnotation = function(item, brushOn) {
        if (brushOn) {
            //Add mark that the item is being brushed
            this._brushedAnnotations[item.id] = true;
        } else {
            //Mark that the item is not being brushed
            delete this._brushedAnnotations[item.id];
        }
        this._updateAnnotations();
    };

    Timeline.prototype._brushTweetOrKeyword = function (item, brushOn) {

        //TODO: looks like we might have problems if data of different item.types has the same id
        if (brushOn && !this._highlightLookup[item.data.id]) {
            //We are not showing it yet and we should be
            var time;

            if (item.type === 'tweet') {
                time = item.data.created_at;
            } else if (item.type === 'keyword') {
                time = item.data.mid_point;
            } else {
                throw 'huh? bad item item.type ' + item.type;
            }

            //We need a uniform time property for these, and not much else
            var packaged = {
                id: item.id,
                time: time,
                type: item.type
            };

            this._highlights.push(packaged);
            this._highlightLookup[item.data.id] = packaged;

            this._updateHighlights();

        } else if (!brushOn && this._highlightLookup[item.data.id]) {
            //We are showing it and we should not be
            delete this._highlightLookup[item.data.id];
            this._highlights = _.values(this._highlightLookup);
            this._updateHighlights();
        }
    };

    /**
     * Called when some elements are brushed or unbrushed
     *
     * @param e
     * @param brushed
     * @private
     */
    Timeline.prototype._onBrush = function (brushed, brushOn) {
        var self = this;
        _.each(brushed, function (item) {
            if (item.type in self._brushHandlers) {
                self._brushHandlers[item.type].call(self, item, brushOn);
            } else {
                //unknown brush type! (not a big deal)
            }
        });
    };

    Timeline.prototype.addBrushHandler = function(brushType, handler) {
        this._brushHandlers[brushType] = handler;
    };

    /**
     * Updates the display of brushed/highlighted times.
     *
     * @private
     */
    Timeline.prototype._updateHighlights = function () {

        var boxHeight = this.boxes.inner.height();

        //Set the highlight positions
        var bind = this.ui.chartGroup.selectAll('line.highlight')
            .data(this._highlights);

        //Create new lines and position them, but make them have no height
        bind.enter().append('line')
            .classed('highlight', true);

        //Transition un-needed lines out and remove
        bind.exit()
            .remove();

        //Position the lines where they ought to be
        //Apply a class based on the data type
        bind.attr('class', this._highlightClass)
            .classed('highlight', true) //add the highlight class back in
            .attr('x1', this._highlightXPosition)
            .attr('x2', this._highlightXPosition)
            .attr('y1', 0)
            .attr('y2', boxHeight);
    };
    
    /**
     * Set up for the display of already created annotations.
     *
     * @private
     */
    Timeline.prototype._initAnnotations = function () {

        this.api.on('annotations', $.proxy(this._onAnnotationData, this));

    };

    /**
     * Called when new annotation data arrives.
     * @private
     */
    Timeline.prototype._onAnnotationData = function (e, result) {
        this._renderAnnotations(result.data);

        this._updateAnnotations();
    };

    /**
     * Render the data in this.annotations.
     */
    Timeline.prototype._renderAnnotations = function() {
        //do nothing
    };

    /**
     * Update the rendered annotations
     * @private
     */
    Timeline.prototype._updateAnnotations = function() {
        //do nothing
    };

    //Mix in events
    events(Timeline);

    return Timeline;
});