<?php

// https://stackoverflow.com/questions/834303/startswith-and-endswith-functions-in-php
function endsWith( $haystack, $needle ) {
    $length = strlen( $needle );
    if( !$length ) {
        return true;
    }
    return substr( $haystack, -$length ) === $needle;
}

try {
    $id  = isset($_REQUEST['id']) ? $_REQUEST['id'] : null;
    $num = isset($_REQUEST['num']) ? $_REQUEST['num'] : null;
    // TODO: $id and $num really need to be validated.
    //   - $num should definitely be only a set of digits.
    //   - How to validate $id as an arbitrary directory?
    //   - We do *always* append final filenames to $path (.json or .csv) (so validating $num is critical),
    //       but that doesn't mean $id can't be something arbitrarily detrimental.
    $path = "";
    if (is_null($id))
        throw new Exception("request must specify an id");
    if (strpos($id, '/') !== false) {
        $path = $id;
        if (!endsWith($path, '/')) {
            $path .= '/';
        }
    } else {
        $dirs = [
            '/data/tmp',
            '/data/tmp-engr',
        ];
        foreach ($dirs as $dir) {
            $p = "$dir/ncreview/$id/";
            if (file_exists($p) && is_readable($p)) {
                $path = $p;
                break;
            }
        }
        if (empty($path)) {
            throw new Exception("Cannot find directory $id in any /data/tmp");
        }
    }
    if (is_null($num)) {
        $path .= "ncreview.json";
    } else {
        $path .= "ncreview.$num.csv";
    }

    if (!file_exists($path) || !is_readable($path)) {
        throw new Exception("File $path is unreadable or does not exist.");
    }
    print file_get_contents($path);

} catch (Exception $e) {
    header($_SERVER['SERVER_PROTOCOL'] . ' 500 Internal Server Error', true, 500);
    print $e->getMessage();
}
