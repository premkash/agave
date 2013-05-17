define(function (require) {

    //Using long-form syntax because there are soooo many dependencies
    var $ = require('jquery');
    var _ = require('underscore');
    var urls = require('util/urls');
    var functions = require('util/functions');
    var Display = require('model/display');
    var Interval = require('model/interval');
    var Query = require('model/query');
    var User = require('model/user');
    var TimelineControls = require('components/timeline_controls');
    var QueryControls = require('components/query_controls');
    var TweetList = require('components/tweet_list');
    var KeywordList = require('components/keyword_list');
    var UserList = require('components/user_list');
    var OverviewTimeline = require('components/overview_timeline');
    var FocusTimeline = require('components/focus_timeline');
    var DiscussionList = require('components/discussion_list');
    var DiscussionView = require('components/discussion_view');
    var SignIn = require('components/sign_in');
    var API = require('util/api');

    /**
     * This class orchestrates the overall setup of the application.
     *
     * @param config
     */
    var App = function (config) {
        this.config = config;
    };

    /**
     * Start the application.
     */
    App.prototype.start = function () {
        this.api = new API();

        this.initUI();
        this.initModels();

        this.updateModelsFromUrl();

        this.initTimelineControls();
        this.initQueryControls();

        this.initFocusTimeline();
        this.initContextTimeline();

        this.initDetailsPanel();
        this.initTweetList();
        this.initKeywordList();
        this.initUserList();

        this.initSignInView();
        this.initDiscussionList();
        this.initDiscussionView();

        this.windowResize();

        urls.watch_url_changes();
        urls.on('change', $.proxy(this.updateModelsFromUrl, this));
    };

    App.prototype.initModels = function() {
        //Initialize the user model
        this.user = new User();

        this.display = new Display();
        this.display.on('change', $.proxy(this.displayChanged, this));

        this.interval = new Interval();
        this.interval.on('change', $.proxy(this.intervalChanged, this));

        //The query collection
        this.queries = [];

        var self = this;
        this.ui.explorer.find('.query').each(function (index) {
            //Build a new query model from the URL
            var query = new Query({
                id: index
            });

            //Save the query in our list
            self.queries.push(query);

            //When the model changes, we need to know
            query.on('change', $.proxy(self.queryUpdated, self));
        });
    };

    /**
     * Set up the display model and timeline controls.
     */
    App.prototype.initTimelineControls = function() {

        this.ui.timelineControls = this.ui.explorer.find('.timeline-controls');

        this.timelineControls = new TimelineControls({
            model: this.display,
            into: this.ui.timelineControls
        });
    };

    /**
     * Set up the query object, based on the url.
     */
    App.prototype.initQueryControls = function () {

        this.queryControls = [];

        //One query model per query control
        var self = this;
        this.ui.explorer.find('.query').each(function (index) {
            var query = self.queries[index];

            //Go ahead and set up the query view at the same time
            var ui = $(this);

            //Pass the model and target along to the view
            var view = new QueryControls({
                model: query,
                into: ui,
                api: self.api
            });
            self.queryControls.push(view);

        });
    };

    /**
     * Grab some regions for rendering UI components
     */
    App.prototype.initUI = function () {
        this.ui = {};

        var content = $('body > .content');
        this.ui.explorer = content.find('.explorer');
        this.ui.collaborator = content.find('.collaborator');

    };

    /**
     * Set up the small context timeline visualization.
     */
    App.prototype.initContextTimeline = function () {
        this.ui.overviewTimeline = this.ui.explorer.find('.tweet-overview');

        this.overviewTimeline = new OverviewTimeline({
            into: this.ui.overviewTimeline,
            api: this.api,
            queries: this.queries,
            interval: this.interval,
            from: this.config.overview_from * 1000,
            to: this.config.overview_to * 1000,
            binSize: this.config.overview_bin_size * 1000,
            utcOffset: this.config.utc_offset_millis
        });

        var self = this;
        this.overviewTimeline.on('selection-change', function (e, extent) {
            self.focusTimeline.domain(extent);
            self.focusTimeline.update(false);
        });

        this.overviewTimeline.render();
    };

    /**
     * Set up the larger focus timeline visualization.
     */
    App.prototype.initFocusTimeline = function () {
        this.ui.focusTimeline = this.ui.explorer.find('.tweet-timeline');

        this.focusTimeline = new FocusTimeline({
            into: this.ui.focusTimeline,
            api: this.api,
            user: this.user,
            queries: this.queries,
            interval: this.interval,
            display: this.display,
            from: this.config.overview_from * 1000,
            to: this.config.overview_to * 1000,
            binSize: 30,
            utcOffset: this.config.utc_offset_millis
        });

        this.focusTimeline.render();
    };

    /**
     * Find the details panel and tab groups
     */
    App.prototype.initDetailsPanel = function () {
        this.ui.detailsPanel = this.ui.explorer.find('.details');
        this.ui.detailsTabGroups = [];

        var self = this;
        this.ui.detailsPanel.find('.tab-group').each(function (index, tabGroup) {
            self.ui.detailsTabGroups.push({
                root: $(tabGroup)
            });
        });
    };

    /**
     * Set up the tweet list component
     */
    App.prototype.initTweetList = function () {

        this.tweetLists = [];

        var self = this;
        this.ui.detailsTabGroups.forEach(function(group, index) {
            var query = self.queries[index];

            group.tweetList = group.root.find('.tweet-list');
            var spinner = group.root.find('.tweet-list-spinner');

            self.tweetLists.push(new TweetList({
                api: self.api,
                interval: self.interval,
                query: query,
                into: group.tweetList,
                spinner: spinner
            }));
        });
    };
    
    // Setting up the users list component
    App.prototype.initUserList = function () {
        
        this.userLists = [];
        
        var self = this;
        this.ui.detailsTabGroups.forEach(function(group, index) {
            var query = self.queries[index];
            
            group.userList = group.root.find('.users-list');
            var spinner = group.root.find('.user-list-spinner');

            self.userLists.push(new UserList ( {
                api: self.api,
                interval: self.interval,
                query: query,
                into: group.userList,
                spinner: spinner
            }));
        });
    };

    /**
     * Set up the other list
     */
    App.prototype.initKeywordList = function() {
        this.keywordLists = [];

        var self = this;
        this.ui.detailsTabGroups.forEach(function(group, index) {
            var query = self.queries[index];

            group.keywordList = group.root.find('.keywords-list');
            var spinner = group.root.find('.keywords-list-spinner');

            self.keywordLists.push(new KeywordList({
                api: self.api,
                interval: self.interval,
                query: query,
                into: group.keywordList,
                spinner: spinner
            }));
        });

    };

    App.prototype.setDiscussionState = function(cssClass) {
        this.ui.collaborator
            .removeClass('show-left show-mid show-right')
            .addClass(cssClass);
    };

    App.prototype.initSignInView = function() {
        this.ui.signIn = this.ui.collaborator.find('.user-box');

        this.signIn = new SignIn({
            into: this.ui.signIn,
            user: this.user
        });

        var self = this;

        //When a user is available...
        this.user.on('signed-in', function() {
            //Hide the sign-in box, show the discussions
            self.discussionList.show();
            self.signIn.hide();
            self.setDiscussionState('show-mid');
        });

    };

    App.prototype.initDiscussionList = function () {
        this.ui.discussions = this.ui.collaborator.find('.discussions');

        this.discussionList = new DiscussionList({
            into: this.ui.discussions,
            api: this.api,
            user: this.user
        });

        var self = this;
        this.discussionList.on('show-discussion', function (e, id) {
            self.discussionList.hide();
            self.discussionView.show(id);
            self.setDiscussionState('show-right');
        });
    };

    App.prototype.initDiscussionView = function () {
        this.ui.discussionView = this.ui.collaborator.find('.discussion-view');

        this.discussionView = new DiscussionView({
            into: this.ui.discussionView,
            api: this.api,
            user: this.user
        });

        var self = this;
        this.discussionView.on('back', function () {
            self.discussionView.hide();
            self.discussionList.show();
            self.setDiscussionState('show-mid');
        });

        this.discussionView.on('restore-state', $.proxy(this.restoreViewState, this));
    };

    App.prototype.windowResize = function () {
        var self = this;
        $(window).on('resize', function () {
            self.focusTimeline.update();
            self.overviewTimeline.update();
        });
    };

    /**
     * Update the url based on the current query.
     */
    App.prototype.updateUrl = function () {
        //Get the basic parameters
        var params = _.extend({
            from: Math.round(this.interval.from() / 1000),
            to: Math.round(this.interval.to() / 1000)
        }, {
            mode: this.display.mode(),
            focus: this.display.focus()
        });

        //Get the query data objects
        var query_data = this.queries.map(function (query) {
            return query.data;
        });

        urls.update_url(params, query_data);
    };

    App.prototype.queryUpdated = function () {
        this.updateUrl();
    };

    App.prototype.displayChanged = function(e, display, changedFields) {
        if (changedFields === 'annotations' || changedFields.indexOf('annotations') >= 0) {
            //Don't update if annotations was the updated field.
            return;
        }

        this.updateUrl();
    };

    App.prototype.intervalChanged = function (extent) {
        //and update the url
        this.updateUrl();
    };

    App.prototype.restoreViewState = function(e, stateString) {
        urls.set_query_string(stateString);
    };

    App.prototype.updateModelsFromUrl = function() {

        //Parse the url
        var params = urls.parse();

        functions.queue_changes();

        this.display.set({
            mode: params.get('mode', this.config.defaults.mode),
            focus: params.get('focus', this.config.defaults.focus)
        }, true);

        //Do silent updates

        //Initialize the interval -- multiplying by 1000 to convert from url times (seconds) to ms
        this.interval.set({
            from: params.get('from', this.config.defaults.from) * 1000,
            to: params.get('to', this.config.defaults.to) * 1000
        }, true);

        var self = this;
        this.queries.forEach(function (query, index) {
            //Build a new query model from the URL
            var data = {};

            var search = params.get_at('search', index, undefined);
            if (search !== undefined) {
                data.search = search;
            }

            var author = params.get_at('author', index, undefined);
            if (author !== undefined) {
                data.author = author;
            }

            var rt = params.get_at('rt', index, undefined);
            if (rt !== undefined) {
                data.rt = rt;
            }

            var min_rt = params.get_at('min_rt', index, undefined);
            if (min_rt !== undefined) {
                data.min_rt = min_rt;
            }

            var sentiment = params.get_at('sentiment', index, undefined);
            if (sentiment !== undefined) {
                data.sentiment = sentiment;
            }

            query.set(data, true);
        });

        functions.release_changes();
    };

    return App;
});
