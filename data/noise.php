<?php

include_once 'util/queries.php';
include_once 'util/data.php';
include_once 'util/request.php';

$request = new Request();
$params = $request->get(array('noise_threshold'), array('query'));
$timeParams = $request->binnedTimeParams();

$from = $timeParams->from;
$to = $timeParams->to;
$interval = $timeParams->interval;
$noise_threshold = (int) $params->noise_threshold;

$perf = $request->timing();
$db = new Queries('db.ini');
$db->record_timing($perf);

$count_field = 'count';
$time_field = 'binned_time';
$result = $db->get_grouped_noise($from, $to, $interval, $noise_threshold, $params->query);

$perf->start('processing');

$bins = array();

$next_bin = $from->getTimestamp();
$end = $to->getTimestamp();
while ($next_bin < $end)
{
    $bin = new CountBin($next_bin);
    $bins[] = $bin;

    $next_bin += $interval;
}

$next_bin = $from->getTimestamp();
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

    $next_bin += $interval;
    $bin_index += 1;
}
$result->free();

$perf->stop('processing');

$request->response($bins);
