<?php

include_once 'util/queries.php';
include_once 'util/data.php';
include_once 'util/request.php';

$request = new Request();
$params = $request->get(array('from', 'to', 'interval', 'noise_threshold'));

$from = new DateTime("@$params->from");
$to = new DateTime("@$params->to");
$interval = (int) $params->interval;
$noise_threshold = (int) $params->noise_threshold;

$perf = $request->timing();
$db = new Queries('localhost', 'root', '', 'twitter_sagawards');
$db->record_timing($perf);

$positive_count_field = 'positive';
$negative_count_field = 'negative';
$neutral_count_field = 'neutral';
$count_field = 'count';
$time_field = 'binned_time';
$result = $db->get_grouped_originals($from, $to, $interval, $noise_threshold);

$perf->start('processing');

$bins = array();

$next_bin = (int) $params->from;
$end = (int) $params->to;

//Initialize all the bins
while ($next_bin < $end)
{
    $bin = new TimeBin($next_bin);
    $bin->sentiment_group(1);
    $bin->sentiment_group(-1);
    $bin->sentiment_group(0);
    $bins[] = $bin;

    $next_bin += $interval;
}

$next_bin = (int) $params->from;
$bin_index = 0;
while ($row = $result->fetch_assoc())
{
    $binned_time = $row[$time_field];

    while ($next_bin !== $binned_time)
    {
        $bin_index += 1;
        $next_bin += $interval;
    }

    $current_bin = $bins[$bin_index];
    $current_bin->count = $row[$count_field];

    $positive_group = $current_bin->sentiment_group(1);
    $positive_group->count = (int) $row[$positive_count_field];

    $negative_group = $current_bin->sentiment_group(-1);
    $negative_group->count = (int) $row[$negative_count_field];

    $neutral_group = $current_bin->sentiment_group(0);
    $neutral_group->count = (int) $row[$neutral_count_field];

    $next_bin += $interval;
    $bin_index += 1;
}
$result->free();

$perf->stop('processing');

$request->response($bins);
