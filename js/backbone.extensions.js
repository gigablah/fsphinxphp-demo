var DelegateCenter = _.extend({}, Backbone.Events);

var BaseView = function(options) {
  this.bindings = [];
  Backbone.View.apply(this, [options]);
}

_.extend(BaseView.prototype, Backbone.View.prototype, {

  bindTo: function(model, event, callback) {
    model.bind(event, callback, this);
    this.bindings.push({model: model, event: event, callback: callback});
  },
  unbindAll: function() {
    _.each(this.bindings, function(binding) {
      binding.model.unbind(binding.event, binding.callback);
    });
    this.bindings = [];
  },
  destroy: function() {
    this.unbindAll();
    this.unbind();
    this.remove();
  }

});

BaseView.extend = Backbone.View.extend;