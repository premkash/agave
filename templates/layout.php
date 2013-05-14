<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <title>Twitter Vis!</title>
        <meta name="description" content="A neat twitter visualization">
        <meta name="viewport" content="width=device-width">
        <link rel="stylesheet" href="css/main.css">
    </head>
    <body>
        <?php echo nav_bar(); ?>
        <div class="content row">
            <div class="padding-all">
                <div class="explorer col">
                    <div class="timeline-controls row">
                        <?php echo timeline_controls(); ?>
                    </div>
                    <div class="tweet-timeline-panel row">
                        <div class="tweet-timeline padding-bottom">
                        </div>
                    </div>
                    <div class="tweet-overview-panel row">
                        <div class="tweet-overview padding-bottom">
                        </div>
                    </div>

                    <div class="details row">
                        <div class="details-left col">
                            <div class="padding-right-half">
                                <?php echo query_box('Series 1') ?>
                                <?php echo details_tabs(1); ?>
                            </div>
                        </div>
                        <div class="details-right col">
                            <div class="padding-left-half">
                                <?php echo query_box('Series 2') ?>
                                <?php echo details_tabs(2); ?>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="collaborator-wrapper col">
                    <div class="collaborator padding-left show-left">
                        <div class="sliding-panel col">
                            <div class="user-box col">
                                <div class="header row">
                                    <div class="title">Sign in to discuss!</div>
                                </div>
                                <div class="row form">
                                    <input type="text" placeholder="Choose a user name"/><br/>
                                    <button type="button" class="user-submit btn btn-large btn-primary">Sign in</button>
                                </div>
                            </div>
                            <div class="discussions col">
                                <div class="header row">
                                    <div class="title">Discussions</div>
                                    <button type="button" class="btn btn-primary new-button">New Discussion</button>
                                    <p>Join an existing discussion:</p>
                                </div>
                                <div class="discussion-list row scroll-y"></div>
                            </div>
                            <div class="discussion-view col">
                                <div class="comment-box row">
                                    <button type="button" class="btn back-button">
                                        <i class="icon-arrow-left"></i> Back to discussion list
                                    </button>
                                    <span class="user-display"></span>
                                    <br/>
                                    <textarea></textarea>
                                    <button type="button" data-toggle="button"
                                            class="btn-success reference-button btn">
                                        <i class="icon-white icon-map-marker"></i> Ref. Tweet/User/Note
                                    </button>
                                    <button type="button"
                                            class="send-button btn btn-primary">
                                        <i class="icon-white icon-comment"></i> Post message
                                    </button>
                                </div>
                                <div class="comments row scroll-y"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            window.require = {
                baseUrl: 'js',
                paths: {
                    'underscore': 'lib/underscore-amd',
                    'backbone': 'lib/backbone-amd',
                    'jquery' : 'lib/jquery',
                    'moment': 'lib/moment',
                    'spin': 'lib/spin'
                },
                shim: {
                    'lib/d3': {
                        exports: 'd3'
                    },
                    'lib/bootstrap': ['jquery'],
                    'lib/Uri': {
                        exports: 'Uri'
                    }
                }
            };
        </script>

        <script src="js/lib/require.js" data-main="main"></script>
    </body>
</html>