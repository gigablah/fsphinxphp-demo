(function(Paginator) {

  Paginator.Model = Backbone.Model.extend({
    defaults: {
      page: 1,
      perpage: 10,
      total: 0,
      url: '/'
    }
  });

  Paginator.Views.Pagination = Backbone.View.extend({
    initialize: function() {
    },
    template: function(data) {
      var total = parseInt(data.total) || 0;
      var page = parseInt(data.page) || 1;
      var perpage = parseInt(data.perpage) || 10;
      var pages = Math.ceil(total / perpage);
      var prev = (page > 1) ? page - 1 : null;
      var next = (page < pages) ? page + 1 : null;
      var buffer = (page == 1 || page == pages) ? 5 :
                   ((page == 2 || page == (pages - 1)) ? 4 :
                   ((page == 3 || page == (pages - 2)) ? 3 : 2));
      var range = [Math.max(1, page - buffer), Math.min(pages, page + buffer)];
      var start = (page - 1) * perpage + 1;
      var end = Math.min(total, page * perpage);
      var el = $(this.el);
      if (total) {
        el.append($('<h3/>').html(start + '-' + end + ' of ' + total));
      }
      else {
        el.append($('<h3/>').html('No results found. Sorry.'));
      }
      var pg = $('<ul/>');
      if (prev) {
        pg.append($('<li/>').html($('<a/>').addClass('page').attr('href', '#').attr('data-page', prev).text('Prev')));
      }
      else {
        pg.append($('<li/>').addClass('active').html($('<a/>').addClass('page').attr('href', '#').text('Prev')));
      }
      if (total && pages > 1) {
        if (range[0] > 1) {
          pg.append($('<li/>').addClass('page').html($('<a/>').addClass('page').attr('href', '#').attr('data-page', 1).text(1)));
        }
        for (var i = range[0]; i <= range[1]; i++) {
          var text = i;
          if ((i == range[0] && (i - 1) > 1) || (i == range[1] && (pages - i) > 1)) text = '...';
          pg.append($('<li/>').addClass('page').addClass(page == i ? 'active' : '').html($('<a/>').addClass('page').attr('href', '#').attr('data-page', i).text(text)));
        }
        if (range[1] < pages) {
          pg.append($('<li/>').addClass('page').html($('<a/>').addClass('page').attr('href', '#').attr('data-page', pages).text(pages)));
        }
      }
      if (next) {
        pg.append($('<li/>').html($('<a/>').addClass('page').attr('href', '#').attr('data-page', next).text('Next')));
      }
      else {
        pg.append($('<li/>').addClass('active').html($('<a/>').addClass('page').attr('href', '#').text('Next')));
      }
      el.append(pg);
    },
    render: function() {
      $(this.el).empty();
      this.template({
        page: this.model.get('page'),
        perpage: this.model.get('perpage'),
        total: this.model.get('total'),
        url: this.model.get('url')
      });
      //$(this.el).html(html);
      this.delegateEvents();
    },
    events: {
      'click a.page': 'paginate'
    },
    paginate: function(event) {
      var pg = $(event.currentTarget);
      var page = pg.attr('data-page');
      if (page) {
        $(FSphinx.input).trigger('query', page);
      }
      return false;
    }
  });

})(FSphinx.module('paginator'));