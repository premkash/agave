define([
    'jquery',
    'underscore',
    'util/events',
    'lib/bootstrap'],
    function ($, _, events, Bootstrap) {

        var USER_TEMPLATE = _.template("<li class='user' data-id='<%=id%>'>" +
            "<div class='name'>@<%=screen_name%></div>" +
            "<div class='count'><%=count%> <span class='muted'>tweets</span></div>" +
            "</li>");


        /**
         * A class for rendering the tweet list
         *
         * Options must include:
         * - into: a jquery selector of the containing element
         * - interval: the interval model
         * - query: query model
         * - interval: an Interval object
         *
         * @param options
         * @constructor
         */

        var UserList = function (options) {
            this.into = options.into || $('<div>');
            this.interval = options.interval;
            this.query = options.query;
            this.api = options.api;

            this._initUI();
            this._attachEvents();
            this._requestData();
        };


        /**
         * Attach to model events.
         */
        UserList.prototype._attachEvents = function () {
            //When either the interval or query changes, request data directly
            this.interval.on('change', $.proxy(this._requestData, this));
            this.query.on('change', $.proxy(this._requestData, this));

            //Listen for new tweets on the API
            this.api.on('users', $.proxy(this._onData, this));
        };

   
        /**
         * called anytime an update occurs
         */
        UserList.prototype._requestData = function () {
            this.api.users({
                //need to know which query these tweets pertain to
                query_id: this.query.id(),
                from: this.interval.from(),
                to: this.interval.to(),
                search: this.query.search(),
                rt: this.query.rt(),
                min_rt: this.query.min_rt(),
                author: this.query.author(),
                sentiment: this.query.sentiment()
            });
        };

        /**
         * Called when new tweet data is available
         * @private
         */
        UserList.prototype._onData = function (e, result) {
            //Make sure these are tweets for our query, first of all
            if (result.params.query_id !== this.query.id()) {
                return;
            }

            var users = result.data;

            //Remove all current tweets
            this.ui.userList.empty();

            var self = this;

            //Add each tweet
            users.forEach(function (user) {
                //Render the tweet using the template and append

                var userUI = $(USER_TEMPLATE(user));

                //Bind the tweet data to the tweet element
                userUI.data('user', user);

                self.ui.userList.append(userUI);
            });
        };

        /**
         * Initialize the tweet list.
         */
        UserList.prototype._initUI = function () {
            this.ui = {};
            this.ui.userList = $('<ul>').appendTo(this.into);
        };

        //Mix in events
        events(UserList);

        return UserList;

    });