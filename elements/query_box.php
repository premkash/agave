<?php

function query_box($name)
{
    ob_start();
    ?>
    <form class="query form-inline">
<!--        <label>--><?php //echo $name ?><!--</label>-->
        <button type="button" class="btn btn-info query-update"><i class="icon-search icon-white"></i></button>
        <input class="query-search" type="search" placeholder="Search tweet text"/>
        <input class="query-author" type="text" placeholder="@author"/>
        <label class="checkbox" title="Check to view retweets">
            <input class="query-rt" type="checkbox"> RT?
        </label>
        <label class="" title="Filter tweets with less than this many retweets">
            <input class="query-minrt" type="number" min="0" value="0"/> RTs
        </label>
        <select class="query-sentiment">
            <option selected="selected"></option>
            <option value="1">pos</option>
            <option value="0">neut</option>
            <option value="-1">neg</option>
        </select>
    </form>
    <?php
    return ob_get_clean();
}
