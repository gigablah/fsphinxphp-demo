<?php

require(dirname(__FILE__) . '/ham.php');
require(dirname(__FILE__) . '/sphinxapi.php');
require(dirname(__FILE__) . '/fsphinxapi.php');

// Sphinx connection parameters
define('SPHINX_HOST', '127.0.0.1');
define('SPHINX_PORT', 9312);

// Redis connection parameters
define('REDIS_HOST', '127.0.0.1');
define('REDIS_PORT', 6379);