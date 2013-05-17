<?php

function details_tabs($index)
{
    $tweetListId = "tweet-list-$index";
    $usersListId = "users-list-$index";
    $keywordsListId = "keywords-list-$index";

    ob_start();
    ?>
    <div class="tab-group row">
        <ul class="nav nav-pills row">
            <li class="active"><a data-target="#<?php echo $tweetListId ?>" data-toggle="tab">Tweets <i class="tweet-list-spinner spinner-16"></i></a>
            </li>
            <li><a data-target="#<?php echo $usersListId ?>" data-toggle="tab">Users <i class="user-list-spinner spinner-16"></i></a></li>
            <li><a data-target="#<?php echo $keywordsListId ?>" data-toggle="tab">Keywords <i class="keyword-list-spinner spinner-16"></i></a></li>
        </ul>

        <div class="tab-content row content-panel">
            <div class="tab-pane fade in active tweet-list" id="<?php echo $tweetListId ?>">
                <div class="tab-pane-body row col scroll-y"></div>
            </div>
            <div class="tab-pane fade users-list" id="<?php echo $usersListId ?>">
                <div class="tab-pane-body row col scroll-y"></div>
            </div>
            <div class="tab-pane fade keywords-list" id="<?php echo $keywordsListId ?>">
                <div class="tab-pane-body row col scroll-y"></div>
            </div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}