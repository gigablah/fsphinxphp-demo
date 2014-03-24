<?php

use \Ham\Ham;
use \FSphinx\FSphinxClient;
use \FSphinx\MultiFieldQuery;
use \FSphinx\Facet;
use \FSphinx\FacetGroupCache;

require(dirname(__FILE__) . '/lib/bootstrap.php');
define('PER_PAGE', 10);
define('STATIC_TIMESTAMP', 120312);

class Spam extends Ham {
  public $params;
  
  public function run() {
    $this->params = array(
      'q' => isset($_REQUEST['q']) ? $_REQUEST['q'] : null,
      'p' => isset($_REQUEST['p']) ? intval($_REQUEST['p']) : 1
    );
    echo $this();
  }
  
  public function search($query=null, $page=1) {
    $cl = new FSphinxClient();
    $cl->SetServer(SPHINX_HOST, SPHINX_PORT);
    $cl->SetDefaultIndex('items');
    $cl->SetMatchMode(SPH_MATCH_EXTENDED);
    $cl->SetSortMode(SPH_SORT_EXPR, '@weight * user_rating_attr * nb_votes_attr * year_attr / 100000');
    $cl->SetFieldWeights(array('title'=>30));
    $facet_genre = new Facet('genre');
    $facet_genre->AttachDataFetch($facet_genre, array('name'=>'genre_terms_attr'));
    $facet_keyword = new Facet('keyword', array('attr'=>'plot_keyword_attr'));
    $facet_keyword->AttachDataFetch($facet_keyword, array('name'=>'plot_keyword_terms_attr'));
    $facet_actor = new Facet('actor');
    $facet_actor->AttachDataFetch($facet_actor, array('name'=>'actor_terms_attr'));
    $facet_director = new Facet('director');
    $facet_director->AttachDataFetch($facet_director, array('name'=>'director_terms_attr'));
    $cl->AttachFacets(
      //new Facet('year'),
      $facet_genre,
      $facet_keyword,
      $facet_actor,
      $facet_director
    );
    //$group_func = 'sum(if (runtime_attr > 45, if (nb_votes_attr > 1000, if (nb_votes_attr < 10000, nb_votes_attr * user_rating_attr, 10000 * user_rating_attr), 1000 * user_rating_attr), 300 * user_rating_attr))';
    foreach ($cl->facets as $facet) {
      //$facet->SetGroupFunc($group_func);
      //$facet->SetOrderBy('@count', 'desc');
      $facet->SetMaxNumValues(5);
    }
    $multifieldquery = new MultiFieldQuery(array(
      'genre'=>'genres',
      'keyword'=>'plot_keywords',
      'actor'=>'actors',
      'director'=>'directors'
    ), array(
      'keyword'=>'plot_keyword_attr'
    ));
    $cl->AttachQueryParser($multifieldquery);
    $cl->SetFiltering(true);
    $cl->setLimits(($page - 1) * PER_PAGE, PER_PAGE);
    
    if ($query) {
      $terms = explode(',', $query);
      foreach ($terms as $index => $term) {
        $data = explode(':', $term);
        if (count($data) > 1) {
          $terms[$index] = '(@' . $data[0] . ' ' . $data[1] . ')';
        }
        else {
          $terms[$index] = '(@* ' . $term . ')';
        }
      }
      $query = implode(' ', $terms);
    }
    $results = $cl->Query($query);
    return $this->format($results);
  }
  
  public function format($results=array()) {
    $output = array(
      'total' => 0,
      'total_found' => 0,
      'results' => array(),
      'facets' => array(
        //'year' => array(),
        'genre' => array(),
        'keyword' => array(),
        'actor' => array(),
        'director' => array()
      )
    );
    
    if (isset($results['matches']) && count($results['matches'])) {
      $output['total'] = $results['total'];
      $output['total_found'] = $results['total_found'];
      $output['page'] = $this->params['p'] ?: 1;
      $output['per_page'] = PER_PAGE;
      foreach ($results['matches'] as $id => $result) {
        $genres = $keywords = array();
        $genre_terms = explode(',', $result['attrs']['genre_terms_attr']);
        while ($genre_id = array_shift($genre_terms)) {
          $genres[$genre_id] = array_shift($genre_terms);
        }
        $keyword_terms = explode(',', $result['attrs']['plot_keyword_terms_attr']);
        while ($keyword_id = array_shift($keyword_terms)) {
          $keywords[$keyword_id] = array_shift($keyword_terms);
        }
        $output['results'][] = array(
          'id' => $id,
          'title' => $result['attrs']['title_attr'],
          'plot' => $result['attrs']['plot_attr'],
          'year' => $result['attrs']['year_attr'],
          'genres' => $genres,
          'keywords' => $keywords
        );
      }
      foreach ($results['facets'] as $facet_name => $facet) {
        if (isset($facet['total_found']) && $facet['total_found'] > 0) {
          foreach ($facet['matches'] as $term) {
            if ($term['@selected'] == 'True') continue;
            $output['facets'][$facet_name][] = array(
              'id' => $term['@groupby'],
              'term' => $term['@term'],
              'facet' => $facet_name,
              'count' => $term['@count']
            );
          }
        }
      }
    }
    return $output;
  }
  
  public static function sanitize($input) {
    if (!$input) return '';
    return str_replace(array('"', '\'', '+'), array('', '', ' '), $input);
  }
  
  public function render($template, $data=null) {
    if (!is_array($data)) return $template;
    $keys = $values = array();
    foreach ($data as $key => $value) {
      if (is_array($value)) continue;
      $keys[] = '{{' . $key . '}}';
      $values[] = htmlspecialchars($value);
    }
    return str_replace($keys, $values, $template);
  }
  
  public function get_templates($template) {
    $partials = array();
    preg_match_all('#<script type="text/template" id="([^"]+)">(.*)</script>#Uis', $template, $matches, PREG_SET_ORDER);
    if ($matches && count($matches)) {
      foreach ($matches as $match) {
        $partials[$match[1]] = trim($match[2]);
      }
    }
    return $partials;
  }
}

$app = new Spam('fsphinx');
$app->route('/', function($app) {
  header('Location: /search');
});
$app->route('/search', function($app) {
  $query = $q = '';
  $page = $app->params['p'];
  if (isset($app->params['q'])) {
    $q = str_replace(' ', '+', $app->params['q']);
    $query = $app->sanitize($app->params['q']);
  }
  $data = $app->search($query, $page);
  //print_r($data);exit;
  
  if ($app->is_ajax_request()) {
    if (isset($_REQUEST['delay'])) sleep(intval($_REQUEST['delay'])); // for simulating delay
    header('Content-type: application/json; charset=utf-8');
    return json_encode($data);
  }
  
  $template = file_get_contents(dirname(__FILE__) . '/index.html');
  $partials = $app->get_templates($template);
  // template-movie
  $template_movies = array();
  foreach ($data['results'] as $index => $movie) {
    $tags = $template_tags = array();
    $tags['year'][''] = $movie['year'];
    $tags['genre'] = $movie['genres'];
    $tags['keyword'] = $movie['keywords'];
    foreach ($tags as $facet => $terms) {
      foreach ($terms as $id => $term) {
        $template_tags[] = str_replace('#',
          '/search?q=' . $q . ($q != '' ? ',' : '') . $facet . ':' . str_replace(' ', '+', $term),
          $app->render($partials['template-movietag'], array('term' => $term, 'id' => $id, 'facet' => $facet))
        );
      }
    }
    $template_movies[$index] = '<li class="row">' . $app->render($partials['template-movie'], $movie) . '</li>' . PHP_EOL;
    $template_movies[$index] = str_replace('<!--//tags//-->', implode(PHP_EOL, $template_tags), $template_movies[$index]);
  }
  $template_movies = '<ul class="results">' . PHP_EOL . implode($template_movies) . '</ul>' . PHP_EOL;
  
  // template-facetpanel
  // template-facetterm
  $template_facets = array();
  $facet_names = array('genre' => 'Genre', 'keyword' => 'Keyword', 'actor' => 'Actor', 'director' => 'Director');
  foreach ($data['facets'] as $facet => $terms) {
    $total = $max = 0;
    foreach ($terms as $term) {
      $total += intval($term['count']);
      $max = max(intval($term['count']), $max);
    }
    $template_facets[$facet] = '<div>' . PHP_EOL;
    $template_facets[$facet] .= $app->render($partials['template-facetpanel'], array('id' => $facet, 'name' => $facet_names[$facet]));
    $template_terms = array();
    if (count($terms)) {
      foreach ($terms as $index => $term) {
        $term['percent'] = floor(intval($term['count']) / $max / 1.3 * 100);
        $template_terms[$index] = '<li><a href="/search?q=' . $q . ($q != '' ? ',' : '') . $term['facet'] . ':' . str_replace(' ', '+', $term['term']) . '" id="' . $term['id'] . '" class="facetterm" data-term="' . $term['term'] . '" data-id="' . $term['id'] . '" data-facet="' . $term['facet'] . '">';
        $template_terms[$index] .= $app->render($partials['template-facetterm'], $term);
        $template_terms[$index] .= '</a></li>' . PHP_EOL;
        $template_terms[$index] = str_replace('width: 0%', 'width: ' . $term['percent'] . '%', $template_terms[$index]);
      }
      $template_terms = implode($template_terms);
    }
    else {
      $template_terms = '<li class="active"><a class="grey">No results.</a></li>' . PHP_EOL;
    }
    $template_facets[$facet] = str_replace('<!--//terms//-->', $template_terms, $template_facets[$facet]);
    $template_facets[$facet] .= '</div>' . PHP_EOL;
  }
  $template_facets = implode($template_facets);
  
  // pagination
  $template_pagination = '';
  $total = intval($data['total_found']);
  $perpage = PER_PAGE;
  $pages = ceil($total / $perpage);
  $prev = ($page > 1) ? $page - 1 : null;
  $next = ($page < $pages) ? $page + 1 : null;
  $buffer = ($page == 1 || $page == $pages) ? 5 :
            (($page == 2 || $page == ($pages - 1)) ? 4 :
            (($page == 3 || $page == ($pages - 2)) ? 3 : 2));
  $range = array(max(1, $page - $buffer), min($pages, $page + $buffer));
  $start = ($page - 1) * $perpage + 1;
  $end = min($total, $page * $perpage);
  
  if ($total) $template_pagination = '<h3>' . $start . '-' . $end . ' of ' . $total . '</h3>';
  else $template_pagination = '<h3>No results found. Sorry.</h3>';
  $template_pagination .= PHP_EOL . '<ul>' . PHP_EOL;
  if ($prev) $template_pagination .= '<li><a class="page" href="/search?q=' . $q . '&p=' . $prev . '" data-page="' . $prev . '">Prev</a></li>' . PHP_EOL;
  else $template_pagination .= '<li class="active"><a class="page" href="/search?q=' . $q . '&p=' . $prev . '">Prev</a></li>' . PHP_EOL;
  if ($total && $pages > 1) {
    if ($range[0] > 1) {
      $template_pagination .= '<li class="page"><a class="page" href="/search?q=' . $q . '&p=1" data-page="1">1</a></li>' . PHP_EOL;
    }
    for ($i = $range[0]; $i <= $range[1]; $i++) {
      $text = $i;
      if (($i == $range[0] && ($i - 1) > 1) || ($i == $range[1] && ($pages - $i) > 1)) $text = '...';
      $template_pagination .= '<li class="page' . ($page == $i ? ' active' : '') . '"><a class="page" href="/search?q=' . $q . '&p=' . $i . '" data-page="' . $i . '">' . $text . '</a></li>' . PHP_EOL;
    }
    if ($range[1] < $pages) {
      $template_pagination .= '<li class="page"><a class="page" href="/search?q=' . $q . '&p=' . $pages . '" data-page="' . $pages . '">' . $pages . '</a></li>' . PHP_EOL;
    }
  }
  if ($next) $template_pagination .= '<li><a class="page" href="/search?q=' . $q . '&p=' . $next . '" data-page="' . $next . '">Next</a></li>';
  else $template_pagination .= '<li class="active"><a class="page" href="/search?q=' . $q . '&p=' . $next . '">Next</a></li>';
  $template_pagination .= '</ul>' . PHP_EOL;
  
  return str_replace(array(
    's?">',
    'render: true',
    'bootstrap_data',
    'value=""',
    '<!--//paginator//-->',
    '<!--//movies//-->',
    '<!--//facets//-->'
  ), array(
    's?' . STATIC_TIMESTAMP . '">', // cache buster
    'render: false',                // 
    json_encode($data),
    'value="' . $query . '"',
    $template_pagination,
    $template_movies,
    $template_facets
  ), $template);
});
$app->run();
