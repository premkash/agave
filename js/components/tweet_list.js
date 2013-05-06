define([
    'jquery',
    'underscore',
    'util/events',
    'util/transform',
    'util/rectangle'],
    function($, _, events, Transform, Rectangle) {

        //The max number of tweets to load.
        var TWEET_LIMIT = 50;

        /**
         * A class for rendering the tweet list
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

        var TweetList = function(options) {
            this.container = options.container || '#tweet-list';
            this.interval = options.interval;
            this.query = options.query;
            this.tweets = null;
            this.tweetTemplate = _.template("<li><%=text%></li>");


            this.initUI();

            this.update();
        };


        /**
         * Attach to model events.
         */
        TweetList.prototype.attachEvents = function () {
            this.interval.on('change', $.proxy(this._onIntervalChanged, this));
            this.query.on('change', $.proxy(this._onQueryChanged, this));
        };

        TweetList.prototype.render = function() {
            if(this.tweets !== undefined && this.tweets != null) {
                var self = this;

                //Remove all current tweets
                self.list.empty();

                //Add each tweet
                $.each(this.tweets, function(i, tweet) {
                    //Render the tweet using the template and append
                    self.list.append(self.tweetTemplate(tweet));
                });
            }
        }


        TweetList.prototype.update = function() {
            var self = this;

            console.log('updating tweet list')

            //Add the limit to the query object and submit
            var q = {
                from: this.interval.from(),
                to: this.interval.to(),
                limit: TWEET_LIMIT,
                search: this.query.search(),
                sort: 'retweet_count'
            };

            // grab tweets
            $.get('data/tweets.php', q)
                .done(function(data) {
                    self.tweets = data.payload;
                    self.render();
                })
                .error(function(xhr) {
                    console.log(xhr);
                    alert('failed to load tweets');
                });

        }


        /**
         * Interval Changed handler
         */
         TweetList.prototype._onIntervalChanged = function(e, interval, field) {
            console.log('interval changed');
            this.update();
         }

        /**
         * Query Changed handler
         */
         TweetList.prototype._onQueryChanged = function(e, query, field) {
            console.log('query changed');
            this.update();
         }


         TweetList.prototype.initUI = function() {
            this.list = $('<ul>').appendTo(this.container);
            this.attachEvents();
         }

        //Mix in events
        events(TweetList);

        return TweetList;

    });