/*
* jQuery UI Tag-it!
*
* @version v2.0 (06/2011)
*
* Copyright 2011, Levy Carneiro Jr.
* Released under the MIT license.
* http://aehlke.github.com/tag-it/LICENSE
*
* Homepage:
*   http://aehlke.github.com/tag-it/
*
* Authors:
*   Levy Carneiro Jr.
*   Martin Rehfeld
*   Tobias Schmidt
*   Skylar Challand
*   Alex Ehlke
*
* Maintainer:
*   Alex Ehlke - Twitter: @aehlke
*
* Dependencies:
*   jQuery v1.4+
*   jQuery UI v1.8+
*/
(function($) {

    $.widget('ui.tagit', {
        options: {
            itemName          : 'item',
            fieldName         : 'tags',
            availableTags     : [],
            tagSource         : null,
            removeConfirmation: false,
            caseSensitive     : true,
            placeholderText   : null,

            // When enabled, quotes are not neccesary
            // for inputting multi-word tags.
            allowSpaces: false,

            // Whether to animate tag removals or not.
            animate: true,
            
            // Whether to clear text input upon duplicate tag match
            clearOnDuplicate: false,

            // The below options are for using a single field instead of several
            // for our form values.
            //
            // When enabled, will use a single hidden field for the form,
            // rather than one per tag. It will delimit tags in the field
            // with singleFieldDelimiter.
            //
            // The easiest way to use singleField is to just instantiate tag-it
            // on an INPUT element, in which case singleField is automatically
            // set to true, and singleFieldNode is set to that element. This 
            // way, you don't need to fiddle with these options.
            singleField: false,

            singleFieldDelimiter: ',',

            // Set this to an input DOM node to use an existing form field.
            // Any text in it will be erased on init. But it will be
            // populated with the text of tags as they are created,
            // delimited by singleFieldDelimiter.
            //
            // If this is not set, we create an input node for it,
            // with the name given in settings.fieldName, 
            // ignoring settings.itemName.
            singleFieldNode: null,

            // Optionally set a tabindex attribute on the input that gets
            // created for tag-it.
            tabIndex: null,


            // Event callbacks.
            onTagAdded: null,
            onTagRemoved: null,
            onTagClicked: null,
            onTagChanged: null,
            onTagExists: null
        },


        _create: function() {
            var that = this;
            this._tagList = {};
            
            // There are 2 kinds of DOM nodes this widget can be instantiated on:
            //     1. UL, OL, or some element containing either of these.
            //     2. INPUT, in which case 'singleField' is overridden to true,
            //        a UL is created and the INPUT is hidden.
            if (this.element.is('input')) {
                this.tagList = $('<ul></ul>').insertAfter(this.element);
                this.options.singleField = true;
                this.options.singleFieldNode = this.element;
                this.element.css('display', 'none');
            } else {
                this.tagList = this.element.find('ul, ol').andSelf().last();
            }

            this._tagInput = $('<input type="text" />');
            if (this.options.tabIndex) {
                this._tagInput.attr('tabindex', this.options.tabIndex);
            }
            if (this.options.placeholderText) {
                this._tagInput.attr('placeholder', this.options.placeholderText);
            }

            this.options.tagSource = this.options.tagSource || function(search, showChoices) {
                var filter = search.term.toLowerCase();
                var choices = $.grep(this.options.availableTags, function(element) {
                    // Only match autocomplete options that begin with the search term.
                    // (Case insensitive.)
                    return (element.toLowerCase().indexOf(filter) === 0);
                });
                showChoices(this._subtractArray(choices, this.assignedTags()));
            };

            // Bind tagSource callback functions to this context.
            if ($.isFunction(this.options.tagSource)) {
                this.options.tagSource = $.proxy(this.options.tagSource, this);
            }

            this.tagList
                .addClass('tagit')
                // Create the input field.
                .append($('<li class="tagit-new"></li>').append(this._tagInput))
                .click(function(e) {
                    var target = $(e.target);
                    if (target.hasClass('tagit-close')) {
                        e.stopPropagation();
                    }
                    else if (target.is('.tagit-choice, .tagit-label, .icon')) {
                        that._trigger('onTagClicked', e, target.closest('.tagit-choice'));
                        if (that.options.singleField) {
                			var tags = that.assignedTags();
                			that._updateSingleTagsField(tags);
                			$(that.options.singleFieldNode).trigger('query');
            			}
                    }
                    else {
                        // Sets the focus() to the input field, if the user
                        // clicks anywhere inside the UL. This is needed
                        // because the input field needs to be of a small size.
                        that._tagInput.focus();
                    }
                });

			// Set input tag default width.
			this._updateInputTagWidth();

			// Add existing tags from the list, if any.
            this.tagList.children('li').each(function() {
                if (!$(this).hasClass('tagit-new')) {
                    that.addTag($(this).html(), $(this).clone().data(), false, true);
                    $(this).remove();
                }
            });

            // Single field support.
            if (this.options.singleField) {
                if (this.options.singleFieldNode) {
                    this.initTagsFromString($(this.options.singleFieldNode).val());
                    //$(this.options.singleFieldNode).val('');
                } else {
                    // Create our single field input after our list.
                    this.options.singleFieldNode = this.tagList.after('<input type="hidden" style="display:none;" value="" name="' + this.options.fieldName + '" />');
                }
            }

            // Events.
            this._tagInput
                .focus(function(event) {
                    that.tagList.addClass('focus');
              }).bind('paste', function(event) {
                    // Pasted input doesn't get captured immediately, so defer
                    setTimeout(function() {
                        that._updateInputTagWidth();
                    }, 0);
              }).keydown(function(event) {
                    // Backspace is not detected within a keypress, so it must use keydown.
                    if (event.which == $.ui.keyCode.BACKSPACE && that._tagInput.val() === '') {
                        var tag = that._lastTag();
                        if (!that.options.removeConfirmation || tag.hasClass('remove')) {
                            // When backspace is pressed, the last tag is deleted.
                            that.removeTag(tag);
                        } else if (that.options.removeConfirmation) {
                            tag.addClass('remove');
                        }
                    } else if (that.options.removeConfirmation) {
                        that._lastTag().removeClass('remove');
                    }

                    // Comma/Space/Enter are all valid delimiters for new tags,
                    // except when there is an open quote or if setting allowSpaces = true.
                    // Tab will also create a tag, unless the tag input is empty, in which case it isn't caught.
                    if (
                        event.which == $.ui.keyCode.COMMA ||
                        event.which == $.ui.keyCode.ENTER ||
                        (
                            event.which == $.ui.keyCode.TAB &&
                            that._tagInput.val() !== ''
                        ) ||
                        (
                            event.which == $.ui.keyCode.SPACE &&
                            that.options.allowSpaces !== true &&
                            (
                                $.trim(that._tagInput.val()).replace( /^s*/, '' ).charAt(0) != '"' ||
                                (
                                    $.trim(that._tagInput.val()).charAt(0) == '"' &&
                                    $.trim(that._tagInput.val()).charAt($.trim(that._tagInput.val()).length - 1) == '"' &&
                                    $.trim(that._tagInput.val()).length - 1 !== 0
                                )
                            )
                        )
                    ) {
                        event.preventDefault();
                        //that.createTag(that._cleanedInput());
                        that.addTagsFromString(that._cleanedInput());
                        that._tagInput.val('');
                        that._updateInputTagWidth();

                        // The autocomplete doesn't close automatically when TAB is pressed.
                        // So let's ensure that it closes.
                        // that._tagInput.autocomplete('close');
                    } else {
						// Input text changed, update input tag width.
						that._updateInputTagWidth();
					}
                }).blur(function(e){
                    // Create a tag when the element loses focus (unless it's empty).
                    //that.createTag(that._cleanedInput());
                    that.tagList.removeClass('focus');
                });
                

            // Autocomplete.
            if (this.options.availableTags || this.options.tagSource) {
                /*this._tagInput.autocomplete({
                    source: this.options.tagSource,
                    select: function(event, ui) {
                        // Delete the last tag if we autocomplete something despite the input being empty
                        // This happens because the input's blur event causes the tag to be created when
                        // the user clicks an autocomplete item.
                        // The only artifact of this is that while the user holds down the mouse button
                        // on the selected autocomplete item, a tag is shown with the pre-autocompleted text,
                        // and is changed to the autocompleted text upon mouseup.
                        if (that._tagInput.val() === '') {
                            that.removeTag(that._lastTag(), false);
                        }
                        that.createTag(ui.item.value);
                        // Preventing the tag input to be updated with the chosen value.
                        return false;
                    }
                });*/
            }
            
            this._tagInput.focus();
        },

		_updateInputTagWidth : function()
		{
			// Updates width of the input tag based on the width of text inside.
			// Calculate text width
			var sensor = $('<span />').css({
				'font-family':    this._tagInput.css('font-family'),
				'font-size':      this._tagInput.css('font-size'),
				'font-style':     this._tagInput.css('font-style'),
				'font-variant':   this._tagInput.css('font-variant'),
				'font-spacing':   this._tagInput.css('font-spacing'),
				'margin':         this._tagInput.css('margin'),
				'line-height':    this._tagInput.css('line-height'),
				'letter-spacing': this._tagInput.css('letter-spacing'),
				'padding':        this._tagInput.css('padding')});
			sensor.text(this._tagInput.val() + 'W');
			$('body').append(sensor);
			var w  = Math.min(sensor.width(), this.tagList.width() - this._tagInput.position().left - 4);
			sensor.remove();
			/*this._tagInput.css('width', 20);
			var w = this.tagList.width() - this._tagInput.position().left - 4;*/
			
			// Update input tag width
			this._tagInput.css('width', w);
		},

        _cleanedInput: function() {
            // Returns the contents of the tag input, cleaned and ready to be passed to createTag
            return $.trim(this._tagInput.val().replace(/^"(.*)"$/, '$1'));
        },

        _lastTag: function() {
            return this.tagList.children('.tagit-choice:last');
        },

        assignedTags: function() {
            // Returns an array of tag string values
            var that = this;
            var tags = [];
			/*if (this.options.singleField) {
                this._trigger('fromSingleField', null, [this, tags]);
                if (tags[0] === '') {
                    tags = [];
                }
            }*/
            this.tagList.children('.tagit-choice').each(function() {
    			var metadata = $(this).clone().data(); // clone() removes data set by jQuery UI effects
                tags.push({value: that.tagLabel(this), metadata: metadata, disabled: $(this).hasClass('tagit-inactive')});
            });
            return tags;
        },

        _updateSingleTagsField: function(tags) {
            // Takes a list of tag string values, updates this.options.singleFieldNode.val
            // to the tags delimited by this.options.singleFieldDelimiter
            $(this.options.singleFieldNode).val(this._toSingleField(tags));
        },

        _subtractArray: function(a1, a2) {
            var result = [];
            for (var i = 0; i < a1.length; i++) {
                if ($.inArray(a1[i], a2) == -1) {
                    result.push(a1[i]);
                }
            }
            return result;
        },

        tagLabel: function(tag) {
            // Returns the tag's string label.
            if (this.options.singleField) {
                return $(tag).children('.tagit-label').text();
            } else {
                return $(tag).children('input').val();
            }
        },

        _isNew: function(value, metadata) {
            var that = this;
            var isNew = true;
            var id = this._tagId(value, metadata);
            if (id in this._tagList) {
                isNew = false;
                that._trigger('onTagExists', null, $('#' + id));
                return false;
            }
            /*
            this.tagList.children('.tagit-choice').each(function(i) {
                if (that._formatStr(value) == that._formatStr(that.tagLabel(this))) {
                    isNew = false;
                    that._trigger('onTagExists', null, this);
                    return false;
                }
            });*/
            return isNew;
        },
        
        _isValid: function(data) {
            if (typeof data == 'string') {
                // Automatically trims the value of leading and trailing whitespace.
                value = $.trim(data);
            }
            else {
                value = $.trim(data.value);
            }
            return (value != '');
        },

        _formatStr: function(str) {
            if (this.options.caseSensitive) {
                return str;
            }
            return $.trim(str.toLowerCase());
        },
        
        _tagId: function(value, metadata) {
            var id = value.replace(/\s/g, '').toLowerCase();
            if (metadata) {
                for (key in metadata) id += '-' + key + '-' + metadata[key];
            }
            return id;
        },
        
        _buildTag: function(value, metadata, disabled) {
            var that = this;
            disabled = disabled || false;

            //var label = $(this.options.onTagClicked ? '<a class="tagit-label"></a>' : '<span class="tagit-label"></span>').text(value);
            var label = $('<span class="tagit-label"></span>').text(value);
            var icon = metadata && metadata.facet ? '<i class="icon-' + metadata.facet + '"></i> ' : '';

            // Button for removing the tag.
            var removeTag = $('<a class="close"> </a>')
                .addClass('tagit-close')
                .click(function(e) {
                    // Removes a tag when the little 'x' is clicked.
                    that.removeTag(tag);
                });

            // Create tag.
            var tag = $('<li></li>')
                .addClass('tagit-choice')
                .append(removeTag)
                .append(icon)
                .append(label);
            
            if (metadata && 'class' in metadata) tag.addClass(metadata['class']);
            if (disabled) tag.addClass('tagit-inactive');
            
            for (key in metadata) {
                tag.attr('data-' + key, metadata[key]);
            }
            
            tag.attr('id', this._tagId(value, metadata));
            
            if (!this.options.singleField) {
                var escapedValue = label.html();
                tag.append('<input type="hidden" style="display:none;" value="' + escapedValue + '" name="' + this.options.itemName + '[' + this.options.fieldName + '][]" />');
            }
            
            return tag;
        },
        
        createTag: function(value, metadata) {
            if (this.addTag(value, metadata)) {
                // Cleaning the input.
                this._tagInput.val('');
                this._updateInputTagWidth();
                this._trigger('onTagChanged', null);
            }
        },

        addTag: function(value, metadata, animate, silent) {
            animate = animate || false;
            silent = silent || false;
            var disabled = (value && value[0] == '-');
            value = value.replace(/^-+/, '');
            var that = this;

            if (!this._isNew(value, metadata)) {
        		if (this.options.clearOnDuplicate) {
        			this._tagInput.val('');
        		}
                return false;
            }
            if (!this._isValid(value)) {
        		return false;
        	}
            
            var tag = this._buildTag(value, metadata, disabled);
            
            // Unless options.singleField is set, each tag has a hidden input field inline.
            if (this.options.singleField) {
                var tags = this.assignedTags();
                tags.push({value: value, metadata: metadata, disabled: disabled});
                this._updateSingleTagsField(tags);
            }
            
            // Since tags may be added programmatically, we can't rely on keydown to clear selected tags
            if (this.options.removeConfirmation) {
                this._lastTag().removeClass('remove');
            }
            
            this._tagList[this._tagId(value, metadata)] = true;
            this._trigger('onTagAdded', null, tag);

            // insert tag
            tag.insertBefore(this._tagInput.parent());
            if (animate) {
                //tag.attr('visibility', 'hidden');
                //this._updateInputTagWidth();
                /*if (document.defaultView && document.defaultView.getComputedStyle) {
                    var width = document.defaultView.getComputedStyle(tag.get(0))['width'];
                    tag.css('width', '1px');
                    (tag).get(0).style.display = document.defaultView.getComputedStyle(tag.get(0))['display'];
                    tag.css('width', width);
                }*/
                tag.show('blind', {direction: 'horizontal'}, 'fast');
            }
            else {
                //this._updateInputTagWidth();
            }
            
            if (!silent && this.options.singleField) {
                $(this.options.singleFieldNode).trigger('query');
            }

            return true;
        },
        
        removeTag: function(tag, animate, silent) {
            silent = silent || false;
            if (this.deleteTag(tag, animate)) {
                this._trigger('onTagChanged', null);
                if (!silent && this.options.singleField) {
                	$(this.options.singleFieldNode).trigger('query');
                }
            }
        },
        
        deleteTag: function(tag, animate) {
            animate = animate || this.options.animate;

            tag = $(tag);

            delete this._tagList[tag.attr('id')];
            this._trigger('onTagRemoved', null, tag);

            if (this.options.singleField) {
                var tags = this.assignedTags();
                var removedTagLabel = this.tagLabel(tag);
                var removedTagData = tag.clone().data();
                tags = $.grep(tags, function(el){
                    return el.value != removedTagLabel && el.metadata != removedTagData;
                });
                this._updateSingleTagsField(tags);
            }
            // Animate the removal.
            if (animate) {
                tag.fadeOut('fast').hide('blind', {direction: 'horizontal'}, 'fast', function(){
                    tag.remove();
                }).dequeue();
                /*tag.fadeOut('fast', function(){
                    tag.remove();
                }).dequeue();*/
            } else {
                tag.remove();
            }
            return true;
        },

        removeAll: function(silent) {
            // Removes all tags.
            silent = silent || false;
            var that = this;
            this._tagList = {};
            this.tagList.children('.tagit-choice').remove();
            $(this.options.singleFieldNode).val('');
            this._trigger('onTagChanged', null);
            if (!silent && this.options.singleField) {
            	$(this.options.singleFieldNode).trigger('query');
            }
        },
        
        initTagsFromString: function(tagstring, delimiter) {
            if (!tagstring) return;
            var that = this;
            delimiter = delimiter || this.options.singleFieldDelimiter;
            this.removeAll(true);
            var tags = this._fromSingleField(tagstring, delimiter);
            $.each(tags, function(index, tag) {
                if ('metadata' in tag && 'value' in tag) that.addTag(tag.value, tag.metadata, false, true);
                else that.addTag(tag, {}, false, true);
            });
        },
        
        addTagsFromString: function(tagstring, delimiter) {
            if (!tagstring) return;
            var that = this;
            delimiter = delimiter || this.options.singleFieldDelimiter;
            var tags = this._fromSingleField(tagstring, delimiter);
            $.each(tags, function(index, tag) {
                if ('metadata' in tag && 'value' in tag) that.addTag(tag.value, tag.metadata, false, true);
                else that.addTag(tag, {}, false, true);
            });
            $(this.options.singleFieldNode).trigger('query');
            this._trigger('onTagChanged', null);
        },

        _fromSingleField: function(tagstring, delimiter) {
            if (!tagstring) return;
            if (!delimiter) return;
            
            // Convert string to tag array.
        	var tags = tagstring.split(delimiter);
        	return _.map(tags, function(tag) {
        		var data = tag.split(':');
        		var disabled = false;
        		if (data[0][0] == '-') {
        			data[0] = data[0].slice(1);
        			disabled = true;
        		}
        		if (data.length == 1) return {value: tag, metadata: {}};
        		if (data.length == 2) return {
        		    value: (disabled ? '-' : '') + data[1],
        		    metadata: {
        		        id: 0,
        		        facet: data[0]
        		    }
        		};
        		return {
        			value: (disabled ? '-' : '') + data[2],
        			metadata: {
        				id: data[1],
        				facet: data[0]
        			}
        		};
        	});
        },

        _toSingleField: function(tags) {
            //$(this.options.singleFieldNode).val(tags.join(this.options.singleFieldDelimiter));
            return _.map(tags, function(tag) {
				return (tag.disabled ? '-' : '') +
				       (tag.metadata && tag.metadata.facet ?
				           tag.metadata.facet + ':' + (tag.metadata.id ?
				               tag.metadata.id + ':' : '') : '') + 
				       tag.value;
			}).join(this.options.singleFieldDelimiter);
        }

    });

})(jQuery);