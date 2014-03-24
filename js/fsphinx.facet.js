(function(Facet) {

  Facet.Model = Backbone.Model.extend({
    defaults: {
      id: 0,
      count: 0,
      facet: 'facet',
      term: 'FacetTerm'
    }
  });
  
  Facet.List = Backbone.Collection.extend({
    model: Facet.Model
  });
  
  Facet.Panel = Backbone.Model.extend({
    defaults: {
      id: 'facet',
      name: 'Facet',
      type: 'list',
      collection: null
    },
    getTotal: function() {
      return this.get('collection').pluck('count').reduce(function (a, b) {
        return a + b;
      }, 0);
    },
    getMax: function() {
      return this.get('collection').pluck('count').reduce(function (a, b) {
        return Math.max(a, b);
      }, 0);
    }
  });
  
  Facet.Views.Term = Backbone.View.extend({
    tagName: 'a',
    className: 'facetterm',
    initialize: function() {
    },
    template: function() {
      var template = _.template($('#template-facetterm').html());
      return template.apply(this, arguments);
    },
    render: function() {
      $(this.el).attr('data-term', this.options.term)
                .attr('data-id', this.options.id)
                .attr('data-facet', this.options.facet)
                .html(this.template({
         term: this.options.term,
         count: this.options.count,
         percent: this.options.percent
      }));
      return this;
    }
  });

  Facet.Views.Panel = Backbone.View.extend({
    tagName: 'div',
    initialize: function() {
      //_.bindAll(this, 'render');
      this.collection = this.model.get('collection');
      //this.collection.bind('refresh', this.render);
      this.id = 'facet-' + this.model.get('id');
      //this.render();
    },
    template: function() {
      var template = _.template($('#template-facetpanel').html());
      return template.apply(this, arguments);
    },
    render: function() {
      var data = {
        id: this.model.get('id'),
        name: this.model.get('name')
      };
      var html = this.template(data);
      var list = $(this.el).html(html).find('ul');
      if (this.collection.models.length) {
        var that = this;
        var max = this.model.getMax();
        this.collection.each(function(item) {
          var data = {
            id: item.get('id'),
            count: item.get('count'),
            facet: item.get('facet'),
            term: item.get('term'),
            percent: Math.floor(item.get('count') / max / 1.3 * 100)
          };
          var html = new Facet.Views.Term(data);
          list.append($('<li/>').html(html.render().el));
        });
      }
      else {
        list.append($('<li/>').addClass('active').html($('<a/>').addClass('grey').text('No results.')));
      }
      return this;
    }
  });
  
  Facet.Views.List = Backbone.View.extend({
    initialize: function() {
      var that = this;
      this._facetPanels = [];
      _(this.collection).each(function(facetPanel) {
        that._facetPanels.push(new Facet.Views.Panel({
          model: facetPanel,
          parentView: that
        }));
      });
    },
    render: function() {
      var that = this;
      $(this.el).empty();
      _(this._facetPanels).each(function(panel) {
        $(that.el).append(panel.render().el);
      });
      this.delegateEvents();
      if (document.defaultView && document.defaultView.getComputedStyle) {
        (this.el).style.display = document.defaultView.getComputedStyle(this.el)['display'];
      }
      $(this.el).find('span.term-fill').each(function() {
        $(this).css('width', $(this).attr('data-fill') + '%');
      });
    },
    events: {
      'click a.facetterm': 'addFacet'
    },
    addFacet: function(event) {
      var tag = $(event.currentTarget);
      $('#query').tagit('addTag', tag.attr('data-term'), {
        id: tag.attr('data-id'),
        facet: tag.attr('data-facet')
      }, true);
      //$('ul.tagit', '#form-query').click();
      return false;
    }
  });

})(FSphinx.module('facet'));