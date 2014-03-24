FSphinx = {
  init: function(options) {
    var that = this;
    _.extend(this, options);
    
    // set up input
    var _query = $(FSphinx.input).val();
    $(FSphinx.input).tagit({
      onTagClicked: function(event, tag) {
        tag.toggleClass('tagit-inactive');
        $('ul.tagit').click();
      },
      onTagRemoved: function(event, tag) {
        $('ul.tagit').click();
      },
      onTagExists: function(event, tag) {
        $(tag).stop(true, true)
              .animate({'color': 'red'}, 100)
              .animate({'color': 'black'}, 500);
      },
      removeConfirmation: true,
      clearOnDuplicate: true
    });
    
    var movie = FSphinx.module('movie');
    var movies = new movie.List(FSphinx.data['results']);
    var movieView = new movie.Views.List({
      'collection': movies,
      'el': FSphinx.el
    });
    
    // Pagination
    var paginator = FSphinx.module('paginator');
    var pagination = new paginator.Model({
      'page': FSphinx.data['page'],
      'perpage': FSphinx.data['per_page'],
      'total': FSphinx.data['total_found']
    });
    var paginationView = new paginator.Views.Pagination({
      'model': pagination,
      'el': '#pagination'
    });
    
    // set up Facets
    var facet = FSphinx.module('facet');
    var facetGenres = new facet.List(FSphinx.data['facets']['genre']);
    var facetGenreTerms = new facet.Panel({
      'id': 'genre',
      'icon': 'film',
      'name': 'Genre',
      'collection': facetGenres
    });
    var facetKeywords = new facet.List(FSphinx.data['facets']['keyword']);
    var facetKeywordTerms = new facet.Panel({
      'id': 'keyword',
      'icon': 'tag',
      'name': 'Keyword',
      'collection': facetKeywords
    });
    var facetActors = new facet.List(FSphinx.data['facets']['actor']);
    var facetActorTerms = new facet.Panel({
      'id': 'actor',
      'icon': 'user',
      'name': 'Actor',
      'collection': facetActors
    });
    var facetDirectors = new facet.List(FSphinx.data['facets']['director']);
    var facetDirectorTerms = new facet.Panel({
      'id': 'director',
      'icon': 'facetime-video',
      'name': 'Director',
      'collection': facetDirectors
    });
    
    var facetViews = new facet.Views.List({
      'collection': [facetGenreTerms, facetKeywordTerms, facetActorTerms, facetDirectorTerms],
      'el': '#facets'
    });
    
    if (FSphinx.render) {
      facetViews.render();
      paginationView.render();
      movieView.render();
    }
    
    $('#logo').bind(FSphinx.queue.name + 'AjaxStart', function() {
      $(this).addClass('wait');
      $('#container').addClass('wait');
    });
    
    var Router = Backbone.Router.extend({
      routes: {
        ''               : 'index',
        'search?*params' : 'search',
        'search'         : 'search'
      },
      index: function() {
        // default data
        facetGenres.reset(FSphinx.data['facets']['genre']);
        facetKeywords.reset(FSphinx.data['facets']['keyword']);
        facetActors.reset(FSphinx.data['facets']['actor']);
        facetDirectors.reset(FSphinx.data['facets']['director']);
        facetViews.render();
        $(FSphinx.el).empty().append($('#template-index').html());
      },
      search: function(params) {
        var matches, query, page = null;
        if (params) matches = params.match(/^q=([^&]+)?(&p=(\d+))?/);
        page = matches && matches[3] ? parseInt(matches[3]) : 1;
        query = matches && matches[1] ? matches[1] : '';
        if (query) query = decodeURI(query).replace(/\+/g, ' '); // replace the + sign as well
        var router = this;
        FSphinx.queue.add({
          url: '/search',
          dataType: 'json',
          data: {q: query, p: page},
          abort: function() {
            $('#logo').removeClass('wait');
            $('#container').removeClass('wait');
          },
          success: function(data) {
            $('#logo').removeClass('wait');
            $('#container').removeClass('wait');
            $(FSphinx.el).empty();
            
            facetGenres.reset(data['facets']['genre']);
            facetKeywords.reset(data['facets']['keyword']);
            facetActors.reset(data['facets']['actor']);
            facetDirectors.reset(data['facets']['director']);
            movies.reset(data['results']);
            pagination.set({
              'page': data['page'],
              'perpage': data['per_page'],
              'total': data['total_found']
            });
            
            facetViews.render();
            paginationView.render();
            movieView.render();
          }
        });
      }
    });
    this.router = new Router();
    Backbone.history.start({
      pushState: true,
      silent: true
    });
    if (_query != $(FSphinx.input).val()) {
      this.router.navigate('/search?q=' + encodeURI($(FSphinx.input).val().replace(/\s/g, '+')), {
        trigger: false,
        replace: true
      });
    }
    $(FSphinx.input).bind(FSphinx.queue.name + 'AjaxStop', _.debounce(function() {
      var query = /^search\?q=([^&]+)/g.exec(Backbone.history.fragment);
      query = query ? decodeURI(query[1]).replace(/\+/g, ' ') : '';
      if (query != $(this).val()) {
        $(this).tagit('initTagsFromString', query);
        if (query != $(this).val()) {
          FSphinx.router.navigate('/search?q=' + encodeURI($(this).val().replace(/\s/g, '+')), {
            trigger: false,
            replace: true
          });
        }
      }
    }, 200));
    $(FSphinx.input).bind('query', function(event, page) {
      // if 2nd parameter is true, call the route handler
      // note: encodeURI will not encode the + sign
      page = page || 1;
      that.router.navigate('/search?q=' + encodeURI($(this).val().replace(/\s/g, '+')) + '&p=' + page, true);
    });
  },
  module: _.memoize(function(name) {
    return {Views: {}};
  })
  
};