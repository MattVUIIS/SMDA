function View(context, id, view_class, modality, submodality, name, panels) {
    this.context = context;
    this.id = id;
    this.view_class = view_class;
    this.modality = modality;
    this.submodality = submodality;
    this.key = this.modality +
        (this.submodality ? '.' + this.submodality : '');
    this.prefix = this.modality +
        (this.submodality ? '_' + this.submodality : '') +
        '_';
    this.name = name;
    this.active = false;
    this.selectable = true;
    this.show_alpha = false;
    let view_params = this.context.view_params;
    let alpha_name = this.prefix + '_a';
    this.alpha = alpha_name in view_params ?
        view_params[alpha_name] : this.context.max_alpha;
    this.context.setScopeVariable(alpha_name, this.alpha);
    this.panels = panels;
    this.panel_opt = null;
    this.layer_opt = null;
    this.img_url = null;
    this.empty = false;
    this.visible = true;
    this.bg_class = {};
    this.text_class = {};
    this.tooltip = '';
    //this.spinner_key = this.key;
    //this.spinner = this.context.createSpinnerElement(this.spinner_key,
    //    {color: '#333333', scale: 0.25});
    /*<span us-spinner="{color: '#333333', scale: 0.25}"
                style="position: relative; left: 12px; top: 1px"
                spinner-key="{{view_layer.spinner_key}}"
                spinner-start-active="true"></span>*/
}
View.prototype.loadResource = function(resource) {}
View.prototype.checkPanBounds = function(canvas) {}
View.prototype.getLayer = function() {
    return this.context.layers.indexOf(this.id);
}
View.prototype.activate = function() {
    //console.log('activate view ' + this.modality);
    this.active = true;
    this.show_alpha = true;
    for(let axis in this.panels) {
        if(this.panels[axis]) {
            let canvas = this.context.canvas[axis];
            //console.log('active views is: ' + JSON.stringify(canvas.active_views.map(x => x.modality)));
            canvas.activateView(this);
        }
    }
}
View.prototype.deactivate = function() {
    //console.log('deactivate view ' + this.modality);
    this.active = false;
    this.show_alpha = false;
    for(let axis in this.panels) {
        if(this.panels[axis]) {
            let canvas = this.context.canvas[axis];
            //console.log('active views is: ' + JSON.stringify(canvas.active_views.map(x => x.modality)));
            canvas.deactivateView(this);
        }
    }
}
View.prototype.setAlpha = function(alpha) {
    let view_params = this.context.view_params;
    let param_name = this.prefix + '_a';
    view_params[param_name] = this.alpha = Math.max(this.context.min_alpha,
        Math.min(this.context.max_alpha, alpha));
    this.context.setScopeVariable(param_name, this.alpha);
    return view_params;
}
View.prototype.setSlice = function(axis, slice) {
    let panel = this.panels[axis];
    if(panel) {
        return panel.setSlice(slice);
    }
    return this.context.view_params;
}
View.prototype._createPanelAttrib = function(attrib) {
    if(!attrib) {
        return null;
    }
    let panel_attrib = Object.assign({}, attrib);
    if(panel_attrib.rotate) {
        let [verb, angle] = panel_attrib.rotate.split(' ');
        angle = parseInt(angle, 10) * Math.PI / 180; //Convert degrees to radians
        panel_attrib.rotate = ((verb == 'right') ? -1 : 1) * angle;
    }
    return panel_attrib;
}
View.prototype.resetSlices = function() {
    for(let axis in this.panels) {
        let panel = this.panels[axis];
        if(panel) {
            panel.resetSlices();
        }
    }
    this.bg_class = {};
    this.text_class = {};
    this.tooltip = '';
}
View.prototype.drawScene = function(canvas) {
    let panel = this.panels[canvas.axis];
    if(panel) {
        panel.draw();
    }
}
View.prototype.getLayerImageURL = function() {
    return this.view_class.img_url;
}
View.prototype.getBackgroundClass = function() {
    return this.bg_class;
}
View.prototype.getTooltip = function() {
    return this.tooltip;
}
View.prototype.getTextClass = function() {
    return this.text_class;
}
View.prototype._sliceAvailableCSS = function() {
    delete this.bg_class['unavailable_view'];
    delete this.text_class['unavailable_view'];
    this.context.deactivateSpinner(this.spinner_key);
    this.tooltip = '';
}
View.prototype._sliceLoadingCSS = function() {
    delete this.bg_class['unavailable_view'];
    delete this.text_class['unavailable_view'];
    //this.context.activateSpinner(this.spinner_key);
    this.tooltip = 'Loading...';
}
View.prototype._sliceUnavailableCSS = function() {
    this.bg_class['unavailable_view'] = true;
    this.text_class['unavailable_view'] = true;
    //this.context.deactivateSpinner(this.spinner_key);
    this.tooltip = 'Slice unavailable';
}
View.prototype.onLoadedImage = function() {
    if('unavailable_view' in this.bg_class) {
        this._sliceAvailableCSS();
        //console.log('remove unavailable_view from ' + this.name);
    }
}
View.prototype.onLoadingImage = function() {
    //this._sliceLoadingCSS();
    this.onLoadedImage();
}
View.prototype.onMissingImage = function() {
    if(!('unavailable_view' in this.bg_class)) {
        this._sliceUnavailableCSS();
        //console.log('add unavailable_view to ' + this.name);
    }
}
