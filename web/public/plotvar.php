<?php

$ncrplot = __DIR__ . "/../../../../bin/ncrplot";

$result = [
    'cmd' => "",
    'plot' => "",
    'error' => ""
];

// https://stackoverflow.com/questions/834303/startswith-and-endswith-functions-in-php
function endsWith( $haystack, $needle ) {
    $length = strlen( $needle );
    if( !$length ) {
        return true;
    }
    return substr( $haystack, -$length ) === $needle;
}

try {
    $dir = $_REQUEST['dir'];
    $var = $_REQUEST['var'];
    $beg = $_REQUEST['beg'];
    $end = $_REQUEST['end'];

    // Validate parameters
    if (!$dir || !preg_match('/^[a-zA-Z0-9_\-\.:\/]+\z/', $dir)) {
        throw new Exception("Parameter 'dir' does not appear to specify a valid path.");
    }
    else if (!preg_match('/^\//', $dir)) {
        throw new Exception("Parameter 'dir' must specify an absolute path.");
    }
    else if (!is_dir($dir)) {
        throw new Exception("Data directory does not exist: $dir");
    }
    else if (count(glob("$dir/*")) === 0) {
        throw new Exception("Data directory is empty: $dir");
    }
    else if (!$var || !preg_match('/^\w+\z/', $var)) {
        throw new Exception("Parameter 'var' does not appear to specify a valid variable name.");
    }
    else if (!$beg || !preg_match('/^\d{8}(.\d{6})?\z/', $beg)) {
        throw new Exception("Parameter 'beg' must match the following format: YYYYMMDD-hhmmss");
    }
    else if (!$end || !preg_match('/^\d{8}(.\d{6})?\z/', $end)) {
        throw new Exception("Parameter 'end' must match the following format: YYYYMMDD-hhmmss");
    }

    if (endsWith($dir, '\\') || endsWith($dir, '/')) {
        preg_replace('/[\/\\\\]+$/', "", $dir);
    }
    preg_match('/^\d{8}/', $beg, $matches);
    $beg_day = $matches[0];
    preg_match('/^\d{8}/', $end, $matches);
    $end_day = $matches[0];

    $cmd = "$ncrplot $dir $var -b $beg_day -e $end_day";
    $result['cmd'] = $cmd;

    $output = exec($cmd . " 2>&1");

    if ($output === false) {
        throw new Exception("Execution failed: bad command.");
    }
    $out_json = json_decode($output, false);
    if ($out_json === null) {
        throw new Exception("Execution failed: $output");
    }
    $result['plot'] = $out_json->img;
    $result['error'] = implode('\n<br>\n', $out_json->errors);
}
catch (Exception $e) {
    $result['error'] = $e->getMessage();
}

header('Content-Type: application/json');
print json_encode($result);
