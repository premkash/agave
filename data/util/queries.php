<?php

/**
 * The Queries class contains all of the SQL queries for retrieving data.
 * It also encapsulates the database connection.
 *
 * For convenience, each query is defined right above the function
 * where it is used.
 *
 * To add new operations, add a new _build_*() function to prepare
 * the query along with a paired get_*() function.
 */
class Queries
{

    private $db;
    private $queries;
    private $originals;
    private $performance = NULL;
    private $utc;

    /**
     * Construct a new Queries object.
     *
     * $params may either be an associative array containing 'host', 'port', 'user', 'password', and 'schema'
     * or it may be the string name of a .ini file containing those variables.
     *
     * If $params is not provided, 'db.ini' will be searched for parameters.
     *
     * @param mixed $params
     */
    public function __construct($params = NULL)
    {
        $this->utc = new DateTimeZone('UTC');

        if ($params === NULL) {
            $params = parse_ini_file('db.ini');
        } else if (is_string($params)) {
            $params = parse_ini_file($params);
        } else if (!is_array($params)) {
            print "No DB params";
            die();
        }

        if (!array_key_exists('port', $params)) {
            $params['port'] = 3306;
        }

        $this->db = new mysqli($params['host'],
            $params['user'],
            $params['password'],
            $params['schema'],
            $params['port']);

        $this->build_queries();
        $this->set_timezone();
        $this->set_encoding();
    }

    /**
     * Provide a performance tracker to the Queries object.
     *
     * @param Performance $performance
     */
    public function record_timing($performance)
    {
        $this->performance = $performance;
    }

    /**
     * Mark the start of a query for performance measurement.
     * @param type $query_name
     */
    private function start($query_name)
    {
        if ($this->performance !== NULL) {
            $this->performance->counter($query_name);
            $this->performance->start($query_name);
        }
    }

    /**
     * Mark the stop of a query for performance measurement.
     * @param type $query_name
     */
    private function stop($query_name)
    {
        if ($this->performance !== NULL) {
            $this->performance->stop($query_name);
        }
    }

    /**
     * Set the timezone to GMT.
     */
    private function set_timezone()
    {
        $this->db->query("set time_zone = '+00:00'");
    }

    /**
     * Set the encoding to utf8mb4
     */
    private function set_encoding()
    {
        $this->db->query('set names utf8mb4');
    }

    /**
     * Initialize the prepared statements.
     *
     * This runs all of the methods of the Queries object
     * to find those that start with "_build".
     */
    private function build_queries()
    {
        $this->queries = new stdClass();

        // Get all of the query builder methods
        $methods = get_class_methods($this);
        foreach ($methods as $method) {
            if (substr_compare($method, '_build', 0, 6) === 0) {
                call_user_func(array($this, $method));
            }
        }
    }

    /**
     * Execute a query. Expects a query name, MySQLi type string, and list of parameters to bind.
     * @param type $queryname
     * @param type $typestr
     * @return type
     */
    private function run($queryname, $typestr = NULL)
    {
        $query = $this->queries->{$queryname};

        $args = array_slice(func_get_args(), 1);
        if ($args) {
            call_user_func_array(array($query, 'bind_param'), refValues($args));
        }

        $this->start($queryname);

        if ($query->execute() === FALSE) {
            echo "Execute $queryname failed: ({$this->db->errno}) {$this->db->error}";
            $this->stop($queryname);

        } else {
            $result = $query->get_result();

            $this->stop($queryname);

            if ($result) {
                return $result;
            } else {
                return TRUE;
            }
        }
    }

    private function _build_insert_annotation()
    {
        $this->queries->insert_annotation = $this->db->prepare(
            "INSERT INTO annotations (created, user, label, time)
            VALUES (?, ?, ?, ?)"
        );

        if (!$this->queries->insert_annotation) {
            echo "Prepare insert_annotation failed: (" . $this->db->errno . ") " . $this->db->error;
        }
    }

    /**
     * Insert an annotation into the database.
     *
     * @param $user
     * @param $label
     * @param $datetime
     * @return mixed
     */
    public function insert_annotation($user, $label, $datetime)
    {
        $now = new DateTime('now', $this->utc);
        $created = $now->format('Y-m-d H:i:s');

        $datetime = $datetime->format('Y-m-d H:i:s');

        $this->run('insert_message', 'ssss', $created, $user, $label, $datetime);
        return $this->db->insert_id;
    }

    private function _build_annotations() {
        $this->queries->annotations = $this->db->prepare(
            "SELECT UNIX_TIMESTAMP(created) as created,
            user, label,
            UNIX_TIMESTAMP(time) as time
            FROM annotations"
        );

        if (!$this->queries->annotations) {
            echo "Prepare annotations failed: (" . $this->db->errno . ") " . $this->db->error;
        }
    }

    /**
     * Retrieve annotations from the database.
     *
     * @return mixed
     */
    public function get_annotations()
    {
        return $this->run('annotations');
    }

    private function _build_insert_message()
    {
        $this->queries->insert_message = $this->db->prepare(
            "INSERT INTO messages (created, user, message, discussion_id)
            VALUES (?, ?, ?, ?)"
        );

        if (!$this->queries->insert_message) {
            echo "Prepare insert_messages failed: (" . $this->db->errno . ") " . $this->db->error;
        }

        $this->queries->insert_discussion = $this->db->prepare(
            "INSERT INTO discussions (created)
            VALUES (?)"
        );

        if (!$this->queries->insert_discussion) {
            echo "Prepare insert_discussion failed: (" . $this->db->errno . ") " . $this->db->error;
        }
    }

    /**
     * Gets message for the given discussion. Returns a MySQLi result set object.
     *
     * @param string $user
     * @param string $message
     * @param int $discussion_id
     * @return mysqli_result
     */
    public function insert_message($user, $message, $discussion_id)
    {
        $now = new DateTime('now', $this->utc);
        $time = $now->format('Y-m-d H:i:s');

        if (!$discussion_id) {
            $this->run('insert_discussion', 's', $time);
            $discussion_id = $this->db->insert_id;
        }

        $this->run('insert_message', 'sssi', $time, $user, $message, $discussion_id);
        return $this->db->insert_id;
    }

    private function _build_message()
    {
        $this->queries->message = $this->db->prepare(
            "SELECT id, discussion_id, UNIX_TIMESTAMP(created) as created, user, message
             FROM messages
             WHERE id = ?"
        );

        if (!$this->queries->message) {
            echo "Prepare message failed: (" . $this->db->errno . ") " . $this->db->error;
        }
    }

    /**
     * Simply get a message by id. Returns the row.
     *
     * @param $message_id
     * @return array
     */
    public function get_message($message_id) {
        $result = $this->run('message', 'i', $message_id);

        $row = $result->fetch_assoc();

        $result->free();

        return $row;
    }

    private function _build_discussion_messages()
    {
        $this->queries->discussion_messages = $this->db->prepare(
            "SELECT id, discussion_id, UNIX_TIMESTAMP(created) as created, user, message
            FROM messages
            WHERE discussion_id = ?
            ORDER BY created desc"
        );

        if (!$this->queries->discussion_messages) {
            echo "Prepare discussion_messages failed: (" . $this->db->errno . ") " . $this->db->error;
        }
    }

    /**
     * Gets message for the given discussion. Returns a MySQLi result set object.
     *
     * @param int $discussion_id
     *
     * @return mysqli_result
     */
    public function get_discussion_messages($discussion_id)
    {
        $result = $this->run('discussion_messages', 'i', $discussion_id);
        return $result;
    }

    private function _build_discussions()
    {
        $this->queries->discussions = $this->db->prepare(
            "SELECT discussion_id AS id,
                COUNT(*) as message_count,
                GROUP_CONCAT(DISTINCT user ORDER BY created DESC SEPARATOR ', ') AS users,
                GROUP_CONCAT(message SEPARATOR '... ') as subject,
                UNIX_TIMESTAMP(MIN(created)) AS started_at,
                UNIX_TIMESTAMP(MAX(created)) AS last_comment_at
            FROM messages
            GROUP BY discussion_id
            ORDER BY last_comment_at desc;"
        );

        if (!$this->queries->discussions) {
            echo "Prepare discussions failed: (" . $this->db->errno . ") " . $this->db->error;
        }
    }

    /**
     * Gets a list of discussions.
     *
     * @return mysqli_result
     */
    public function get_discussions()
    {
        $result = $this->run('discussions');
        return $result;
    }

    private function _build_originals()
    {
        $base_query = "SELECT t.*, UNIX_TIMESTAMP(t.created_at) AS created_at, u.screen_name
            FROM tweets t
            INNER JOIN users u on u.id = t.user_id
            WHERE NOT t.is_retweet
            AND t.created_at >= ?
            AND t.created_at < ?
            AND t.retweet_count >= ?
            ORDER BY t.%s desc
            LIMIT ?";

        $base_query_like = "SELECT t.*, UNIX_TIMESTAMP(t.created_at) AS created_at, u.screen_name
            FROM tweets t
            INNER JOIN users u on u.id = t.user_id
            WHERE NOT t.is_retweet
            AND t.created_at >= ?
            AND t.created_at < ?
            AND t.retweet_count >= ?
            AND t.text LIKE ?
            ORDER BY t.%s desc
            LIMIT ?";


        $this->queries->originals = $this->db->prepare(
            sprintf($base_query, 'created_at')
        );
        if (!$this->queries->originals) {
            echo "Prepare originals failed: (" . $this->db->errno . ") " . $this->db->error;
        }

        $this->queries->originals_like = $this->db->prepare(
            sprintf($base_query_like, 'created_at')  
        );
        if (!$this->queries->originals_like) {
            echo "Prepare originals_like failed: (" . $this->db->errno . ") " . $this->db->error;
        }

        /* sorted by retweet count */
        $this->queries->originals_orderby_retweet = $this->db->prepare(
            sprintf($base_query, 'retweet_count')
        );
        if (!$this->queries->originals_orderby_retweet) {
            echo "Prepare originals failed: (" . $this->db->errno . ") " . $this->db->error;
        }

        $this->queries->originals_like_orderby_retweet = $this->db->prepare(
            sprintf($base_query_like, 'retweet_count')
        );
        if (!$this->queries->originals_like_orderby_retweet) {
            echo "Prepare originals_like failed: (" . $this->db->errno . ") " . $this->db->error;
        }

    }


    /**
     * Gets tweets in the specified interval. Returns a MySQLi result set object.
     *
     * @param DateTime $start_datetime
     * @param DateTime $stop_datetime
     * @param int $noise_threshold The minimum retweet count to be returned
     *
     * @return mysqli_result
     */
    public function get_originals($start_datetime, $stop_datetime, $limit, $noise_threshold, $text_search = NULL, $sort = NULL)
    {
        $start_datetime = $start_datetime->format('Y-m-d H:i:s');
        $stop_datetime = $stop_datetime->format('Y-m-d H:i:s');



        if ($text_search === NULL) {
            $query_name = 'originals';
            if($sort == 'retweet_count') {
                $query_name .= '_orderby_retweet';
            }
            $result = $this->run($query_name, 'ssii', $start_datetime,
                $stop_datetime, $noise_threshold, $limit);
        } else {
            $query_name = 'originals_like';
            if($sort == 'retweet_count') {
                $query_name .= '_orderby_retweet';
            }
            $search = "%$text_search%";
            $result = $this->run($query_name, 'ssisi', $start_datetime,
                $stop_datetime, $noise_threshold, $search, $limit);
        }
        return $result;
    }

    private function _build_grouped_originals()
    {
        $this->queries->grouped_originals = $this->db->prepare(
            "SELECT UNIX_TIMESTAMP(?) + ? * FLOOR((UNIX_TIMESTAMP(created_at)-UNIX_TIMESTAMP(?)) / ?) AS binned_time,
                COUNT(*) as count,
                SUM(IF(sentiment=1,1,0)) AS positive,
                SUM(IF(sentiment=0,1,0)) AS neutral,
                SUM(IF(sentiment=-1,1,0)) AS negative
            FROM tweets
            WHERE NOT is_retweet
            AND created_at >= ?
            AND created_at < ?
            AND retweet_count >= ?
            GROUP BY binned_time
            ORDER BY binned_time"
        );

        if (!$this->queries->grouped_originals) {
            echo "Prepare grouped_originals failed: (" . $this->db->errno . ") " . $this->db->error;
        }

        $this->queries->grouped_originals_like = $this->db->prepare(
            "SELECT UNIX_TIMESTAMP(?) + ? * FLOOR((UNIX_TIMESTAMP(created_at)-UNIX_TIMESTAMP(?)) / ?) AS binned_time,
                COUNT(*) as count,
                SUM(IF(sentiment=1,1,0)) AS positive,
                SUM(IF(sentiment=0,1,0)) AS neutral,
                SUM(IF(sentiment=-1,1,0)) AS negative
            FROM tweets
            WHERE NOT is_retweet
            AND created_at >= ?
            AND created_at < ?
            AND retweet_count >= ?
            AND text LIKE ?
            GROUP BY binned_time
            ORDER BY binned_time"
        );

        if (!$this->queries->grouped_originals_like) {
            echo "Prepare grouped_originals_like failed: (" . $this->db->errno . ") " . $this->db->error;
        }
    }

    /**
     * Counts tweets in the specified interval, grouped by time. Returns a MySQLi result set object.
     *
     * @param DateTime $start_datetime
     * @param DateTime $stop_datetime
     * @param int $group_seconds
     * @param int $noise_threshold The minimum retweet count to be returned.
     * @param string $text_search
     * @return mysqli_result
     */
    public function get_grouped_originals($start_datetime, $stop_datetime, $group_seconds, $noise_threshold, $text_search = NULL)
    {
        $start_datetime = $start_datetime->format('Y-m-d H:i:s');
        $stop_datetime = $stop_datetime->format('Y-m-d H:i:s');

        if ($text_search === NULL) {
            $result = $this->run('grouped_originals', 'sisissi',
                $start_datetime, $group_seconds, $start_datetime,
                $group_seconds, $start_datetime, $stop_datetime,
                $noise_threshold);
        } else {
            $search = "%$text_search%";
            $result = $this->run('grouped_originals_like', 'sisissis',
                $start_datetime, $group_seconds, $start_datetime,
                $group_seconds, $start_datetime, $stop_datetime,
                $noise_threshold, $search);
        }


        return $result;
    }

    private function _build_grouped_retweets()
    {
        $this->queries->grouped_retweets = $this->db->prepare(
            "SELECT UNIX_TIMESTAMP(?) + ? * FLOOR((UNIX_TIMESTAMP(created_at)-UNIX_TIMESTAMP(?)) / ?) AS binned_time,
                COUNT(*) as count
            FROM tweets
            WHERE is_retweet
            AND created_at >= ?
            AND created_at < ?
            GROUP BY binned_time
            ORDER BY binned_time"
        );

        if (!$this->queries->grouped_retweets) {
            echo "Prepare grouped_retweets failed: (" . $this->db->errno . ") " . $this->db->error;
        }

        $this->queries->grouped_retweets_like = $this->db->prepare(
            "SELECT UNIX_TIMESTAMP(?) + ? * FLOOR((UNIX_TIMESTAMP(created_at)-UNIX_TIMESTAMP(?)) / ?) AS binned_time,
                COUNT(*) as count
            FROM tweets
            WHERE is_retweet
            AND created_at >= ?
            AND created_at < ?
            AND text LIKE ?
            GROUP BY binned_time
            ORDER BY binned_time"
        );

        if (!$this->queries->grouped_retweets_like) {
            echo "Prepare grouped_retweets_like failed: (" . $this->db->errno . ") " . $this->db->error;
        }
    }

    /**
     * Get retweet counts grouped over a time interval.
     *
     * @param DateTime $start_datetime
     * @param DateTime $stop_datetime
     * @param int $group_seconds
     * @param string $text_search
     * @return mysqli_result
     */
    public function get_grouped_retweets($start_datetime, $stop_datetime, $group_seconds, $text_search = NULL)
    {
        $start_datetime = $start_datetime->format('Y-m-d H:i:s');
        $stop_datetime = $stop_datetime->format('Y-m-d H:i:s');

        if ($text_search === NULL) {
            $result = $this->run('grouped_retweets', 'sisiss', $start_datetime,
                $group_seconds, $start_datetime, $group_seconds,
                $start_datetime, $stop_datetime);
        } else {
            $search = "%$text_search%";
            $result = $this->run('grouped_retweets_like', 'sisisss',
                $start_datetime, $group_seconds, $start_datetime,
                $group_seconds, $start_datetime, $stop_datetime, $search);
        }

        return $result;
    }

    private function _build_grouped_retweets_of_id()
    {
        $this->queries->grouped_retweets_of_id = $this->db->prepare(
            "SELECT UNIX_TIMESTAMP(?) + ? * FLOOR((UNIX_TIMESTAMP(created_at)-UNIX_TIMESTAMP(?)) / ?) AS binned_time,
                COUNT(*) as count
            FROM tweets
            WHERE is_retweet
            AND created_at >= ?
            AND created_at < ?
            AND retweet_of_status_id = ?
            GROUP BY binned_time
            ORDER BY binned_time"
        );

        if (!$this->queries->grouped_retweets_of_id) {
            echo "Prepare grouped_retweets_of_id failed: (" . $this->db->errno . ") " . $this->db->error;
        }
    }

    /**
     * Get retweet counts of a specific tweet, grouped over a time interval.
     *
     * @param long $tweet_id
     * @param DateTime $start_datetime
     * @param DateTime $stop_datetime
     * @param int $group_seconds
     * @return mysqli_result
     */
    public function get_grouped_retweets_of_id($tweet_id, $start_datetime, $stop_datetime, $group_seconds)
    {
        $start_datetime = $start_datetime->format('Y-m-d H:i:s');
        $stop_datetime = $stop_datetime->format('Y-m-d H:i:s');

        $result = $this->run('grouped_retweets_of_id', 'sisisss',
            $start_datetime, $group_seconds, $start_datetime,
            $group_seconds, $start_datetime, $stop_datetime, $tweet_id);

        return $result;
    }

    private function _build_grouped_retweets_of_range()
    {
        $this->queries->grouped_retweets_of_range = $this->db->prepare(
            "SELECT UNIX_TIMESTAMP(?) + ? * FLOOR((UNIX_TIMESTAMP(rt.created_at)-UNIX_TIMESTAMP(?)) / ?) AS binned_time,
                COUNT(*) as count,
                SUM(IF(rt.sentiment=1,1,0)) AS positive,
                SUM(IF(rt.sentiment=0,1,0)) AS neutral,
                SUM(IF(rt.sentiment=-1,1,0)) AS negative
            FROM tweets t0, tweets rt
            WHERE t0.id = rt.retweet_of_status_id
            AND rt.created_at >= ?
            AND rt.created_at < ?
            AND t0.created_at >= ?
            AND t0.created_at < ?
            GROUP BY binned_time
            ORDER BY binned_time"
        );

        if (!$this->queries->grouped_retweets_of_range) {
            echo "Prepare grouped_retweets_of_range failed: (" . $this->db->errno . ") " . $this->db->error;
        }
    }

    /**
     * Get retweet counts of tweets in an interval, grouped over another time interval.
     *
     * @param DateTime $tweets_start_datetime
     * @param DateTime $tweets_stop_datetime
     * @param DateTime $start_datetime
     * @param DateTime $stop_datetime
     * @param int $group_seconds
     * @return mysqli_result
     */
    public function get_grouped_retweets_of_range($tweets_start_datetime, $tweets_stop_datetime, $start_datetime, $stop_datetime, $group_seconds)
    {
        $tweets_start_datetime = $tweets_start_datetime->format('Y-m-d H:i:s');
        $tweets_stop_datetime = $tweets_stop_datetime->format('Y-m-d H:i:s');

        $start_datetime = $start_datetime->format('Y-m-d H:i:s');
        $stop_datetime = $stop_datetime->format('Y-m-d H:i:s');

        $result = $this->run('grouped_retweets_of_range', 'sisissss',
            $start_datetime, $group_seconds, $start_datetime,
            $group_seconds, $start_datetime, $stop_datetime,
            $tweets_start_datetime, $tweets_stop_datetime);

        return $result;
    }

    private function _build_grouped_noise()
    {
        $this->queries->grouped_noise = $this->db->prepare(
            "SELECT UNIX_TIMESTAMP(?) + ? * FLOOR((UNIX_TIMESTAMP(created_at)-UNIX_TIMESTAMP(?)) / ?) AS binned_time,
                COUNT(*) as count
            FROM tweets
            WHERE NOT is_retweet
            AND created_at >= ?
            AND created_at < ?
            AND retweet_count < ?
            GROUP BY binned_time
            ORDER BY binned_time"
        );
        if (!$this->queries->grouped_noise) {
            echo "Prepare grouped_noise failed: (" . $this->db->errno . ") " . $this->db->error;
        }

        $this->queries->grouped_noise_like = $this->db->prepare(
            "SELECT UNIX_TIMESTAMP(?) + ? * FLOOR((UNIX_TIMESTAMP(created_at)-UNIX_TIMESTAMP(?)) / ?) AS binned_time,
                COUNT(*) as count
            FROM tweets
            WHERE NOT is_retweet
            AND created_at >= ?
            AND created_at < ?
            AND retweet_count < ?
            AND text LIKE ?
            GROUP BY binned_time
            ORDER BY binned_time"
        );
        if (!$this->queries->grouped_noise_like) {
            echo "Prepare grouped_noise_like failed: (" . $this->db->errno . ") " . $this->db->error;
        }
    }

    /**
     * Gets noise tweets in the specified interval. Returns a MySQLi result set object.
     *
     * @param DateTime $start_datetime
     * @param DateTime $stop_datetime
     * @param int $group_seconds The bin size in seconds
     * @param int $noise_threshold The maximum retweet count to return.
     * @param string $text_search Optional text search
     * @return mysqli_result
     */
    public function get_grouped_noise($start_datetime, $stop_datetime, $group_seconds, $noise_threshold, $text_search = NULL)
    {
        $start_datetime = $start_datetime->format('Y-m-d H:i:s');
        $stop_datetime = $stop_datetime->format('Y-m-d H:i:s');

        if ($text_search === NULL) {
            $result = $this->run('grouped_noise', 'sisissi', $start_datetime,
                $group_seconds, $start_datetime, $group_seconds,
                $start_datetime, $stop_datetime, $noise_threshold);
        } else {
            $search = "%$text_search%";
            $result = $this->run('grouped_noise_like', 'sisissis',
                $start_datetime, $group_seconds, $start_datetime,
                $group_seconds, $start_datetime, $stop_datetime,
                $noise_threshold, $search);
        }

        return $result;
    }

    private function _build_grouped_counts()
    {
        $this->queries->grouped_counts = $this->db->prepare(
            "SELECT UNIX_TIMESTAMP(?) + ? * FLOOR((UNIX_TIMESTAMP(created_at)-UNIX_TIMESTAMP(?)) / ?) AS binned_time,
                COUNT(*) as count
            FROM tweets
            WHERE created_at >= ?
            AND created_at < ?
            GROUP BY binned_time
            ORDER BY binned_time"
        );
        if (!$this->queries->grouped_counts) {
            echo "Prepare grouped_tweets failed: (" . $this->db->errno . ") " . $this->db->error;
        }
    }

    /**
     * Count tweets in the specified interval. Returns a MySQLi result set object.
     *
     * @param DateTime $start_datetime
     * @param DateTime $stop_datetime
     * @param int $group_seconds The bin size in seconds
     * @return mysqli_result
     */
    public function get_grouped_counts($start_datetime, $stop_datetime, $group_seconds)
    {
        $start_datetime = $start_datetime->format('Y-m-d H:i:s');
        $stop_datetime = $stop_datetime->format('Y-m-d H:i:s');

        $result = $this->run('grouped_counts', 'sisiss', $start_datetime,
            $group_seconds, $start_datetime, $group_seconds,
            $start_datetime, $stop_datetime);
        return $result;
    }

    private function _build_grouped_counts_filtered()
    {
        $this->queries->grouped_counts_filtered = $this->db->prepare(
            "SELECT UNIX_TIMESTAMP(?) + ? * FLOOR((UNIX_TIMESTAMP(created_at)-UNIX_TIMESTAMP(?)) / ?) AS binned_time,
                COUNT(*) as count,
                SUM(IF(sentiment=1,1,0)) AS positive,
                SUM(IF(sentiment=0,1,0)) AS neutral,
                SUM(IF(sentiment=-1,1,0)) AS negative
            FROM tweets
            WHERE created_at >= ?
            AND created_at < ?
            GROUP BY binned_time
            ORDER BY binned_time"
        );

        if (!$this->queries->grouped_counts_filtered) {
            echo "Prepare grouped_counts_filtered failed: (" . $this->db->errno . ") " . $this->db->error;
        }

        $this->queries->grouped_counts_filtered_like = $this->db->prepare(
            "SELECT UNIX_TIMESTAMP(?) + ? * FLOOR((UNIX_TIMESTAMP(created_at)-UNIX_TIMESTAMP(?)) / ?) AS binned_time,
                COUNT(*) as count,
                SUM(IF(sentiment=1,1,0)) AS positive,
                SUM(IF(sentiment=0,1,0)) AS neutral,
                SUM(IF(sentiment=-1,1,0)) AS negative
            FROM tweets
            WHERE created_at >= ?
            AND created_at < ?
            AND text LIKE ?
            GROUP BY binned_time
            ORDER BY binned_time"
        );

        if (!$this->queries->grouped_counts_filtered_like) {
            echo "Prepare grouped_counts_filtered_like failed: (" . $this->db->errno . ") " . $this->db->error;
        }
    }

    /**
     * Counts tweets in the specified interval, grouped by time. Returns a MySQLi result set object.
     *
     * @param DateTime $start_datetime
     * @param DateTime $stop_datetime
     * @param int $group_seconds
     * @param string $text_search
     * @return mysqli_result
     */
    public function get_grouped_counts_filtered($start_datetime, $stop_datetime, $group_seconds, $text_search = NULL)
    {
        $start_datetime = $start_datetime->format('Y-m-d H:i:s');
        $stop_datetime = $stop_datetime->format('Y-m-d H:i:s');

        if ($text_search === NULL) {
            $result = $this->run('grouped_counts_filtered', 'sisiss',
                $start_datetime, $group_seconds, $start_datetime,
                $group_seconds, $start_datetime, $stop_datetime);
        } else {
            $search = "%$text_search%";
            $result = $this->run('grouped_counts_filtered_like', 'sisisss',
                $start_datetime, $group_seconds, $start_datetime,
                $group_seconds, $start_datetime, $stop_datetime,
                $search);
        }

        return $result;
    }
}

/**
 * Converts an array of values into references.
 *
 * http://php.net/manual/en/mysqli-stmt.bind-param.php
 *
 * @param type $arr
 * @return type
 */
function refValues($arr)
{
    if (strnatcmp(phpversion(), '5.3') >= 0) //Reference is required for PHP 5.3+
    {
        $refs = array();
        foreach ($arr as $key => $value)
            $refs[$key] = & $arr[$key];
        return $refs;
    }
    return $arr;
}
