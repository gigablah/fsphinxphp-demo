(function(Movie) {
  
  Movie.Model = Backbone.Model.extend({
    defaults: {
      title: '',
      plot: '',
      year: 0,
      genres: {},
      keywords: {}
    }
  });
  
  Movie.Views.Item = Backbone.View.extend({
    tagName: 'li',
    className: 'row',
    initialize: function() {
    },
    template: function() {
      var template = _.template($('#template-movie').html());
      return template.apply(this, arguments);
    },
    render: function() {
      var data = {
        title: this.options.title,
        plot: this.options.plot,
        year: this.options.year
      };
      $(this.el).html(this.template(data));
      return this;
    }
  });
  
  Movie.Views.List = Backbone.View.extend({
    initialize: function() {
    },
    render: function() {
      $(this.el).empty();
      if (this.collection.models.length) {
        var that = this;
        var movies = $('<ul/>').addClass('results');
        this.collection.each(function(item) {
          var data = {
            title: item.get('title'),
            plot: item.get('plot'),
            year: item.get('year'),
            genres: item.get('genres'),
            keywords: item.get('keywords')
          };
          //var html = that.template(data);
          var html = new Movie.Views.Item(data);
          html.render();
          var tags = $(html.el).find('.tags');
          var taghtml = _.template($('#template-movietag').html());
          tags.append(taghtml({
            'id': null,
            'term': item.get('year'),
            'facet': 'year'
          }));
          _(data.genres).each(function(genre, id) {
            tags.append(taghtml({
              'id': id,
              'term': genre,
              'facet': 'genre'
            }));
          });
          _(data.keywords).each(function(keyword, id) {
            tags.append(taghtml({
              'id': id,
              'term': keyword,
              'facet': 'keyword'
            }));
          });
          movies.append(html.el);
        });
        $(this.el).append(movies);
        this.delegateEvents();
      }
      return this;
    },
    events: {
      'click a.tag': 'addFacet'
    },
    addFacet: function(event) {
      var tag = $(event.currentTarget);
      $('#query').tagit('addTag', tag.attr('data-term'), {
        id: tag.attr('data-id'),
        facet: tag.attr('data-facet')
      }, true);
      return false;
    }
  });
  
  Movie.List = Backbone.Collection.extend({
    model: Movie.Model
  });
  
})(FSphinx.module('movie'));