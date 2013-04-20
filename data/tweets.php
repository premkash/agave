<?php
/**
 * tweets.php gets individual tweets in a time range.
 *
 * It only returns non-retweet tweets, and a limit parameter is required.
 *
 * Optionally, a noise threshold can be provided. Only tweets with at least this
 * number of retweets will be returned.
 */
include_once 'util/data.php';
include_once 'util/request.php';

$request = new Request();
$perf = $request->timing();
$db = $request->db();

/**
 * Required parameters: grouped time parameters (from, to, interval) and limit.
 * Optional: noise_threshold and search.
 */
$params = $request->get(array('limit'), array('noise_threshold', 'search'));
$timeParams = $request->timeParameters();

$from = $timeParams->from;
$to = $timeParams->to;
$limit = $params->limit;
$noise_threshold = $params->noise_threshold;
$search = $params->search;
if ($noise_threshold === NULL)
{
    //Default noise threshold of 0
    $noise_threshold = 0;
}

$result = $db->get_originals($from, $to, $limit, $noise_threshold, $search);

$perf->start('processing');

$tweets = array();
while ($row = $result->fetch_assoc())
{
    $tweets[] = $row;
}
$result->free();

$perf->stop('processing');

$request->response($tweets);
