/*
    Encapsulates a WebGL context, a set of image slices, and their viewing
    configuration. This class has a dependency on jQuery.
*/
function ViewerContext(canvas_container, scope_funcs) {
    this.canvas_container = canvas_container;
    this.getSavedValue = scope_funcs.getSavedValue;
    this.setSavedValue = scope_funcs.setSavedValue;
    this.hasSavedValue = scope_funcs.hasSavedValue;
    this.getScopeVariable = scope_funcs.getScopeVariable;
    this.setScopeVariable = scope_funcs.setScopeVariable;
    this.createSpinnerElement = scope_funcs.createSpinnerElement;
    this.activateSpinner = scope_funcs.activateSpinner;
    this.deactivateSpinner = scope_funcs.deactivateSpinner;
    this.getSubjectInfo = scope_funcs.getSubjectInfo;
    this.updatePageState = scope_funcs.updatePageState;
    this.requestHTTP = scope_funcs.requestHTTP;
    this.subject_resources = {};
    this.subjects = [];
    this.modes = [];
    this.stains = [];
    this.canvas = {};
    this.canvas_n = 0;
    this.canvas_rows = [];
    this.panels = {};
    this.panel_n = 0;
    this.crosshair = {x: 0, y: 0, z: 0};
    this.proc_names = [];
    this.session_names = [];
    this.session_name = '';
    this.selectable_views = new Set();
    this.valid_views = new Set();
    this.views = {};
    this.view_classes = {};
    this.layers = [];
    this.toolset = new ViewerToolset(this);
    this.half_pi = Math.PI / 2.0;
    this.axes = ['coronal', 'axial', 'sagittal'];
    this.axis_prefixes = ['', 'ax_', 'sa_'];
    this.volume = {left: 0, right: 0, top: 0, bottom: 0, front: 0, back: 0,
        width: 0, height: 0, depth: 0};
    this.has_thickness = false;
    this.thickness = {
        coronal: 0,
        axial: 0,
        sagittal: 0
    };
    let tooltip = document.getElementById('mouseoverTooltip')

}
ViewerContext.prototype.setResource = function(resource, view_params) {
    //console.log('view params: ' + JSON.stringify(view_params));
    this.resource = resource;
    this.view_params = view_params;
    this.subjects = resource.subjects;
    this.subject_id = resource.id;
    this.subject_resources[this.subject_id] = this.resource;
    this.setScopeVariable('subject', this.subject_id);
    this.modes = Object.keys(this.resource.modes);
    /*console.log('subjects: ' + JSON.stringify(this.subjects));
    console.log('subject: ' + JSON.stringify(this.subject_id));
    console.log('modes: ' + JSON.stringify(this.modes));
    console.log('resource: ' + JSON.stringify(this.resource));*/
    return this.initializeViews(view_params);
}
ViewerContext.prototype.isViewActive = function(view) {
    return view in this.views && this.views[view].active;
}
ViewerContext.prototype.setCanvasElements = function() {
    let canvas_spaces = Math.pow(2, Math.ceil(Math.log2(this.canvas_n)));
    let canvas_row_n = Math.floor(Math.sqrt(canvas_spaces));
    let canvas_col_n = Math.ceil(canvas_spaces / canvas_row_n);
    let canvas_row = null;
    let i = 0;
    let row_i = 0;
    for(let axis in this.canvas) {
        let canvas = this.canvas[axis];
        if(i % canvas_col_n == 0) {
            canvas_row = {
                index: row_i,
                element: angular.element("<div class='panelRow'></div>"),
                canvas: [],
            };
            canvas_row.element.hide();
            this.canvas_rows.push(canvas_row);
            this.canvas_container.append(canvas_row.element);
            row_i++;
        }
        let canvas_parent = angular.element('<div class="panelParent"></div>');
        let spinner_parent = angular.element('<div class="panelSpinner"></div>');
        spinner_parent.append(canvas.spinner);
        canvas_parent.hide();
        canvas_parent.append(canvas.element);
        canvas_parent.append(spinner_parent);
        canvas_parent.append(canvas.tooltip);
        canvas_row.canvas.push(canvas);
        canvas_row.element.append(canvas_parent);
        canvas.setHTMLElementParents(canvas_parent, canvas_row);
        canvas.initializeGL();
        i++;
    }
    this.toolset.initialize();
}
ViewerContext.prototype.clearCanvasElements = function() {
    this.canvas_container.empty();
    this.canvas = {};
    this.canvas_n = 0;
    this.panels = {};
    this.panel_n = 0;
};
ViewerContext.prototype.getSubjects = function() {
    return this.subjects;
}
ViewerContext.prototype.initializeViews = function(view_params) {
    this.min_alpha = 0;
    this.max_alpha = 100;
    let convert_alpha = (x) => isNumber(x) ? Math.max(this.min_alpha, Math.min(
        this.max_alpha, x)) : this.max_alpha;
    view_params = this.view_params = {
        subject: this.subject_id,
        view: view_params.view || 'MR',
        layers: view_params.layers || '',
        slice: view_params.slice || 0,
        ax_slice: view_params.ax_slice || 0,
        sa_slice: view_params.sa_slice || 0,
        zoom: Number.isInteger(view_params.zoom) ? view_params.zoom : 1,
        ax_zoom: Number.isInteger(view_params.ax_zoom) ? view_params.ax_zoom : 1,
        sa_zoom: Number.isInteger(view_params.sa_zoom) ? view_params.sa_zoom : 1,
        px: view_params.px || '0',
        py: view_params.py || '0',
        pz: view_params.pz || '0',
        x: view_params.x || '0',
        y: view_params.y || '0',
        ax_x: view_params.ax_x || '0',
        ax_y: view_params.ax_y || '0',
        sa_x: view_params.sa_x || '0',
        sa_y: view_params.sa_y || '0',
        stain: view_params.stain || 'BDA',
        proc: view_params.proc || 'T2',
        session: view_params.session || 1,
        param: view_params.param || '',
        vivo: view_params.vivo || 'exvivo',
        Diffusion_tensor_vol: view_params.Diffusion_tensor_vol || '1',
        RA_vol: view_params.RA_vol || '1',
        VR_vol: view_params.VR_vol || '1',
        label: view_params.label || 'roi',
        glyph: view_params.glyph || 'DTI',
        block_a: convert_alpha(view_params.block_a),
        hist_a: convert_alpha(view_params.hist_a),
        MR_a: convert_alpha(view_params.MR_a),
        label_a: convert_alpha(view_params.label_a),
        glyph_a: convert_alpha(view_params.glyph_a),
    };
    this.crosshair = {
        x: parseFloatWithDefault(view_params.px),
        y: parseFloatWithDefault(view_params.py),
        z: parseFloatWithDefault(view_params.pz)
    };
    //Create canvases
    this.clearCanvasElements();
    this.canvas_n = 0;
    for(let i in this.axes) {
        let axis = this.axes[i];
        this.canvas[axis] = new ViewerCanvas(this, axis, this.axis_prefixes[i]);
        this.canvas_n++;
    }
    //Set up zoom and pan
    this.min_zoom = 1;
    this.max_zoom = 10;
    this.max_pan = 0.5;
    this.min_pan = -0.5;
    for(let i in this.axes) {
        let axis = this.axes[i];
        let axis_prefix = this.axis_prefixes[i];
        let axis_title_case = axis.charAt(0).toUpperCase() + axis.slice(1);
        //Zoom
        let zoom_name = axis_prefix + 'zoom';
        view_params[zoom_name] = this[zoom_name] = Math.max(this.min_zoom,
            Math.min(this.max_zoom, view_params[zoom_name]));
        this.setScopeVariable(zoom_name, this[zoom_name]);
        //Slice
        let slice_name = axis_prefix + 'slice';
        this[slice_name] = view_params[slice_name];
        this.setScopeVariable(slice_name, this[slice_name]);
        //Pan
        let pan_x_name = 'pan_' + axis_prefix + 'x';
        let pan_y_name = 'pan_' + axis_prefix + 'y';
        this[pan_x_name] = parseFloatWithDefault(view_params[axis_prefix + 'x']);
        this[pan_y_name] = parseFloatWithDefault(view_params[axis_prefix + 'y']);
        this.setScopeVariable(axis_prefix + 'x', this[pan_x_name] + '');
        this.setScopeVariable(axis_prefix + 'y', this[pan_y_name] + '');
    }
    //Create views
    this.session_names = [];
    this.session_name = view_params.vivo + '-' + view_params.session;
    this.max_level = 5;
    this.min_level = 2;
    this.mag_factor = 4;
    this.max_mag = Math.pow(this.mag_factor, this.max_level - this.min_level);
    let view_class = new ViewerViewClass(this, 'accessory-overlay', 'Accessory Overlays');
    view_class.setViews([
        new GlyphView(this, view_class, 'CSD', 'CSD glyphs'),
        new GlyphView(this, view_class, 'DTI', 'DTI glyphs'),
        new LabelView(this, view_class, 'roi', 'ROI Label'),
        new LabelView(this, view_class, 'BDAcount', 'BDA Count Label'),
        new LabelView(this, view_class, 'MR', 'MR Label'),
    ]);
    view_class.setViewDefault('label.BDAcount');
    this.addViewClass(view_class);
    this.has_thickness = false;
    view_class = new ViewerViewClass(this, 'mri', 'MRI');
    view_class.setViews([
        new MRView(this, view_class, 'T2', 'T2'),
        new MRView(this, view_class, 'Diffusion_tensor', 'Diffusion Tensor'),
        new MRView(this, view_class, 'FA', 'FA'),
        new MRView(this, view_class, 'MD', 'MD'),
        new MRView(this, view_class, 'Mean_B0', 'Mean B0'),
        new MRView(this, view_class, 'Mean_DW', 'Mean DW'),
        new MRView(this, view_class, 'RA', 'RA'),
        //new MRView(this, view_class, 'VEC1', 'VEC1'),
        new MRView(this, view_class, 'VR', 'VR'),
        new MRView(this, view_class, 'CMAP', 'CMAP'),
        new AggregateMRView(this, view_class, 't1-template', 't1'),
        new AggregateMRView(this, view_class, 't2-template', 't2'),
        new AggregateMRView(this, view_class, 'exvivo-fa-template', 'exvivo-fa'),
        new AggregateMRView(this, view_class, 'exvivo-structural-template', 'exvivo-structural'),
        new AggregateMRView(this, view_class, 'invivo-fa-template', 'invivo-fa'),
        new AggregateMRView(this, view_class, 'invivo-md-template', 'invivo-md'),
        new AggregateMRView(this, view_class, 'pd-template', 'pd'),
        new AggregateMRView(this, view_class, 'brainmask', 'brainmask'),
    ]);
    view_class.setViewDefault('MR.T2');
    view_class.setViewDefault('aggregateMR.t1-template');
    this.addViewClass(view_class);
    view_class = new ViewerViewClass(this, 'block', 'Block');
    view_class.setViews([
        new BlockView(this, view_class),
    ]);
    view_class.setViewDefault('block');
    this.addViewClass(view_class);
    view_class = new ViewerViewClass(this, 'hist', 'Histology');
    view_class.setViews([
        new HistView(this, view_class),
    ]);
    view_class.setViewDefault('hist');
    this.addViewClass(view_class);

    for(let view_class_name in this.view_classes) {
        let view_class = this.view_classes[view_class_name];
        view_class.loadResource();
    }

    this.setCanvasElements();
    this.setLayers(this.layers.slice());
    this.setLayers(view_params.layers.split(','));
    this.setViews(new Set(view_params.view.split(',')));

    for(let view_class_name in this.view_classes) {
        let view_class = this.view_classes[view_class_name];
        view_class.updateVisibilityFromViews();
    }

    this.drawScene();
    //console.log('new view params: ' + JSON.stringify(view_params));
    return view_params;
}
ViewerContext.prototype.setViews = function(views) {
    //Update the enabled/disabled views sets
    views = new Set(views);
    let views_enabled = new Set();
    for(let view of views) {
        if(this.valid_views.has(view)) {
            views_enabled.add(view);
            this.views[view].activate();
        }
    }
    let views_disabled = new Set();
    for(let view of this.valid_views) {
        if(!views_enabled.has(view)) {
            views_disabled.add(view);
            this.views[view].deactivate();
        }
    }

    //console.log('Views enabled: ' + Array.from(this.views_enabled));
    //console.log('Views disabled: ' + Array.from(this.views_disabled));
    this.view_params.view = this.view = Array.from(views_enabled).join(',');
    this.setScopeVariable('view', this.view);
    //console.log('set views ' + this.view);
    for(let axis in this.canvas) {
        this.checkSliceBounds(axis);
        this.checkPanBounds(axis);
    }

    return this.view_params;
}
ViewerContext.prototype._updateActiveViews = function() {
    let views_enabled = kvFilter(this.views,
        (k, v) => v.active).map(x => x[0]);
    this.setViews(Array.from(views_enabled));
}
ViewerContext.prototype.toggleView = function(view) {
    if(this.valid_views.has(view)) {
        //view.active was already toggled by the UI
        this._updateActiveViews();
    }
}
ViewerContext.prototype.toggleViewClass = function(view_class) {
    //view_class.active was already toggle by the UI
    view_class.updateVisibility();
    view_class.activateDefaultViews();
    this._updateActiveViews();
}
ViewerContext.prototype.toggleMinimap = function() {
    for(let axis in this.canvas) {
        this.canvas[axis].toggleMinimap();
    }
}
ViewerContext.prototype.setLayers = function(layers) {
    if(layers.length != this.layers.length) {
        console.log('invalid layers length: ' + layers.length + ':' + JSON.stringify(layers));
        return this.view_params; //No change
    }
    for(let i in layers) {
        let key = layers[i];
        if(!this.selectable_views.has(key)) {
            console.log('invalid selectable key: ' + key);
            return this.view_params; //No change
        }
    }
    this.layers.length = 0;
    for(let i in layers) {
        let key = layers[i];
        let view = this.views[key];
        view.layer = parseInt(i);
        this.layers.push(key);
    }
    //console.log('set layers to ' + JSON.stringify(this.layers));
    let layers_str = this.view_params.layers = this.layers.join(',');
    this.setScopeVariable('layers', layers_str);
    for(let axis in this.canvas) {
        let canvas = this.canvas[axis];
        canvas.sortViews();
    }
    this.updatePageState();
    return this.view_params;
}
ViewerContext.prototype.moveLayer = function(key, to) {
    let layers = this.layers.slice();
    let from = layers.indexOf(key);
    if(from < 0) {
        console.log('invalid layer ' + key);
        return this.view_params; //No change
    }
    key = layers.splice(from, 1)[0];
    if(to > from) to--;
    layers.splice(to, 0, key);
    return this.setLayers(layers);
}
ViewerContext.prototype.setNewSubject = function(subject_id) {
    if(!(subject_id in this.subject_resources)) { //Get the new subject data
        this.getSubjectInfo(subject_id, this.onNewSubjectReady.bind(this));
    }
    else {
        this.onNewSubjectReady(subject_id, this.subject_resources[subject_id]);
    }
}
ViewerContext.prototype.onNewSubjectReady = function(subject_id, resource) {
    this.view_params.subject = this.subject_id = subject_id;
    this.resource = resource;
    this.subject_resources[this.subject_id] = this.resource;
    this.has_thickness = false;
    this.modes.length = 0;
    let modes = this.modes;
    Object.keys(this.resource.modes).forEach(function(x) {
        modes.push(x);
    });
    this.setScopeVariable('subject', this.subject_id);
    let views_active = 0;
    for(let key in this.views) {
        let view = this.views[key];
        if(view.empty) {
            view.deactivate();
        }
    }
    //Update the visible layers
    this.session_names = [];
    for(let view_class_name in this.view_classes) {
        let view_class = this.view_classes[view_class_name];
        view_class.loadResource();
        view_class.updateVisibilityFromViews();
        view_class.activateDefaultViews();
    }
    for(let axis in this.canvas) {
        this.checkSliceBounds(axis);
    }
    this.updatePageState();
    return this.view_params;
}
ViewerContext.prototype.checkPanBounds = function(axis, axis_prefix) {
    let canvas = this.canvas[axis];
    axis_prefix = axis_prefix !== undefined ? axis_prefix :
        this.axis_prefixes[this.axes.indexOf(axis)];
    let pan_x_name = 'pan_' + axis_prefix + 'x';
    let pan_y_name = 'pan_' + axis_prefix + 'y';
    this[pan_x_name] = Math.min(this.max_pan, Math.max(this.min_pan, this[pan_x_name]));
    this[pan_y_name] = Math.min(this.max_pan, Math.max(this.min_pan, this[pan_y_name]));
    this.view_params[axis_prefix + 'x'] = this[pan_x_name] + '';
    this.view_params[axis_prefix + 'y'] = this[pan_y_name] + '';
    //Recalculate level, scale, and magnification
    let zoom_name = axis_prefix + 'zoom';
    let zoom_frac = (this[zoom_name] - this.min_zoom)
        / (this.max_zoom - this.min_zoom);
    let level_range = this.max_level - this.min_level;
    let prev_level = this[axis_prefix + 'level'];
    let level = this[axis_prefix + 'level'] = this.max_level - Math.floor(level_range * zoom_frac);
    let zoom_pa = (this.max_level - level) / level_range;
    let zoom_pb = (this.max_level - (level - 1)) / level_range;
    let prev_scale = this[axis_prefix + 'scale'];
    let scale = this[axis_prefix + 'scale'] = (1 + (this.mag_factor - 1)
        * (zoom_frac - zoom_pa) / (zoom_pb - zoom_pa)) || 1;
    this[axis_prefix + 'magnification'] = Math.pow(this.mag_factor, this.max_level - level);
    for(let other_axis in this.canvas) {
        this.canvas[other_axis].checkPanBounds();
    }
    this.updatePageState();
};
ViewerContext.prototype.checkSliceBounds = function(axis, axis_prefix) {
    let canvas = this.canvas[axis];
    axis_prefix = axis_prefix !== undefined ? axis_prefix :
        this.axis_prefixes[this.axes.indexOf(axis)];
    let slice_name = axis_prefix + 'slice';
    let min_slice_name = 'min_' + slice_name;
    let max_slice_name = 'max_' + slice_name;
    //console.log('setting ' + axis + ' slice bounds');
    let min_slice = this[min_slice_name] = this.resource.volume[axis][0];
    let max_slice = this[max_slice_name] = this.resource.volume[axis][1];
    //console.log(axis + ' min slice ' + min_slice + ' max slice ' + max_slice);
    //console.log('calling ' + slice_name + ' setSlice with ' + this[slice_name]);
    this.setSlice(axis, this[slice_name], axis_prefix);
    /*console.log(formattedReport('checkSliceBounds ' + axis, [
        {min_slice_name: min_slice_name, max_slice_name: max_slice_name,
        slice_name: slice_name, min_slice: this[min_slice_name],
        max_slice: this[max_slice_name], slice: this[slice_name]}
    ]));*/
}
ViewerContext.prototype.panCenter = function(axis) {
    let axis_prefix = this.axis_prefixes[this.axes.indexOf(axis)];
    let pan_x_name = 'pan_' + axis_prefix + 'x';
    let pan_y_name = 'pan_' + axis_prefix + 'y';
    this[pan_x_name] = this[pan_y_name] = 0;
    this.checkPanBounds(axis, axis_prefix);
    this.updatePageState();
    return this.view_params;
};
ViewerContext.prototype.setPan = function(axis, x, y) {
    let axis_prefix = this.axis_prefixes[this.axes.indexOf(axis)];
    let pan_x_name = 'pan_' + axis_prefix + 'x';
    let pan_y_name = 'pan_' + axis_prefix + 'y';
    x = parseFloatWithDefault(x);
    y = parseFloatWithDefault(y);
    this[pan_x_name] = x;
    this[pan_y_name] = y;
    this.checkPanBounds(axis, axis_prefix);
    this.updatePageState();
    return this.view_params;
};
ViewerContext.prototype.setCoronalPan = function(x, y) {
    return this.setPan('coronal', x, y);
}
ViewerContext.prototype.setAxialPan = function(x, y) {
    return this.setPan('axial', x, y);
}
ViewerContext.prototype.setSagittalPan = function(x, y) {
    return this.setPan('sagittal', x, y);
}
ViewerContext.prototype.addPan = function(axis, x, y) {
    //console.log('called addPan ' + axis + ' ' + x + ' ' + y);
    let axis_prefix = this.axis_prefixes[this.axes.indexOf(axis)];
    let zoom_name = axis_prefix + 'zoom';
    let zoom = this[zoom_name];
    let magnification = this[axis_prefix + 'magnification'];
    let scale = this[axis_prefix + 'scale'];
    let pan_x_name = 'pan_' + axis_prefix + 'x';
    let pan_y_name = 'pan_' + axis_prefix + 'y';
    x = parseFloatWithDefault(x);
    y = parseFloatWithDefault(y);
    if(!x && !y) {
        return this.view_params; // No change
    }
    this[pan_x_name] += x / magnification / scale;
    this[pan_y_name] += y / magnification / scale;
    this.checkPanBounds(axis, axis_prefix);
    this.updatePageState();
    return this.view_params;
};
ViewerContext.prototype.addCoronalPan = function(x, y) {
    return this.addPan('coronal', x, y);
}
ViewerContext.prototype.addAxialPan = function(x, y) {
    return this.addPan('axial', x, y);
}
ViewerContext.prototype.addSagittalPan = function(x, y) {
    return this.addPan('sagittal', x, y);
}
ViewerContext.prototype.setZoom = function(axis, zoom, axis_prefix) {
    axis_prefix = axis_prefix !== undefined ? axis_prefix :
        this.axis_prefixes[this.axes.indexOf(axis)];
    zoom = Number.isInteger(zoom) ? zoom : parseInt(zoom, 10);
    if(isNaN(zoom)) {
        return this.view_params; // No change
    }
    let zoom_name = axis_prefix + 'zoom';
    this.view_params[zoom_name] = this[zoom_name] =
        Math.max(this.min_zoom, Math.min(this.max_zoom, zoom));
    this.checkPanBounds(axis, axis_prefix);
    this.setScopeVariable(zoom_name, this[zoom_name]);
    this.updatePageState();
    return this.view_params;
};
ViewerContext.prototype.setCoronalZoom = function(zoom) {
    return this.setZoom('coronal', zoom);
}
ViewerContext.prototype.setAxialZoom = function(zoom) {
    return this.setZoom('axial', zoom);
}
ViewerContext.prototype.setSagittalZoom = function(zoom) {
    return this.setZoom('sagittal', zoom);
}
ViewerContext.prototype.incrementZoom = function(axis) {
    let axis_prefix = this.axis_prefixes[this.axes.indexOf(axis)];
    return this.setZoom(axis, this[axis_prefix + 'zoom'] + 1, axis_prefix);
}
ViewerContext.prototype.decrementZoom = function(axis) {
    let axis_prefix = this.axis_prefixes[this.axes.indexOf(axis)];
    return this.setZoom(axis, this[axis_prefix + 'zoom'] - 1, axis_prefix);
}
/*
    showInUI
    Return true if 'element' should be shown in the UI
*/
ViewerContext.prototype.showInUI = function(element) {
    switch(element) {
        case 'vol_crosshair':
            return true;
        case 'slice_controls':
            return false;
        case 'slice_thickness':
            return this.has_thickness;
    }
    return false;
}
/*
    setSlice
    axis - the axis slice to set
    slice - the slice index
    axis_prefix - the axis prefix (optional)
    crosshair_pos - the precise position of the crosshair to set. If not provided,
        calculate based on the slice index (optional)
    no_bounds - whether to perform a bounds check on the slices (optional)
*/
ViewerContext.prototype.setSlice = function(axis, slice, axis_prefix, crosshair_pos, no_bounds) {
    let prev = slice;
    slice = Number.isInteger(slice) ? slice : parseInt(slice, 10);
    if(isNaN(slice)) {
        console.log('could not set ' + axis + ' slice to ' + prev);
        return this.view_params; // No change
    }
    //console.log('crosshair_pos ' + crosshair_pos);
    axis_prefix = axis_prefix !== undefined ? axis_prefix :
        this.axis_prefixes[this.axes.indexOf(axis)];
    let slice_name = axis_prefix + 'slice';
    let min_slice = this['min_' + slice_name];
    let max_slice = this['max_' + slice_name];
    if(!no_bounds) {
        if(min_slice === null || max_slice === null) { //If there are no panels enabled on this axis
            return this.view_params;
        }
        slice = Math.max(min_slice, Math.min(max_slice, slice));
    }
    this.view_params[slice_name] = this[slice_name] = slice;
    //console.log('set ' + axis + ' slice to ' + this[slice_name]);
    this.setScopeVariable(slice_name, this[slice_name]);
    //Update the view bounds of all the panels
    for(let key in this.views) {
        let view = this.views[key];
        if(view.selectable) {
            view.setSlice(axis, slice);
        }
    }
    let canvas = this.canvas[axis];
    //Update the crosshair position, but only if the volume is defined
    if(this.volume.width || this.volume.height || this.volume.depth) {
        let slice_percent = crosshair_pos || (slice - min_slice) / (max_slice - min_slice) || 0;
        switch(axis) {
            case 'coronal': //World position is X and Y, Slice is Z
                this.crosshair.z = crosshair_pos ? crosshair_pos :
                    this.volume.back - slice_percent * this.volume.depth;
                this.view_params.pz = this.crosshair.z + '';
                break;
            case 'axial': //World position is X and Z, Slice is Y
                this.crosshair.y = crosshair_pos ? crosshair_pos :
                    this.volume.bottom + slice_percent * this.volume.height;
                this.view_params.py = this.crosshair.y + '';
                break;
            case 'sagittal': //World position is Y and Z, Slice is X
                this.crosshair.x = crosshair_pos ? crosshair_pos :
                    this.volume.left + slice_percent * this.volume.width;
                this.view_params.px = this.crosshair.x + '';
                break;
        }
    }
    this.updatePageState();
    return this.view_params;
}
ViewerContext.prototype.setCoronalSlice = function(slice) {
    return this.setSlice('coronal', slice);
}
ViewerContext.prototype.setAxialSlice = function(slice) {
    return this.setSlice('axial', slice);
}
ViewerContext.prototype.setSagittalSlice = function(slice) {
    return this.setSlice('sagittal', slice);
}
ViewerContext.prototype.incrementSlice = function(axis) {
    let axis_prefix = this.axis_prefixes[this.axes.indexOf(axis)];
    return this.setSlice(axis, this[axis_prefix + 'slice'] + 1, axis_prefix);
}
ViewerContext.prototype.decrementSlice = function(axis) {
    let axis_prefix = this.axis_prefixes[this.axes.indexOf(axis)];
    return this.setSlice(axis, this[axis_prefix + 'slice'] - 1, axis_prefix);
}
ViewerContext.prototype.getSlicePosition = function(axis) {
    let axis_prefix = this.axis_prefixes[this.axes.indexOf(axis)];
    let slice_name = axis_prefix + 'slice';
    let slice = this[slice_name];
    let min_slice = this['min_' + slice_name];
    let max_slice = this['max_' + slice_name];
    let mid_slice = Math.floor((min_slice + max_slice) / 2);
    let thickness = this.thickness[axis];
    let position = (slice - mid_slice) * thickness;
    return position;
}
ViewerContext.prototype.getCoronalSlicePosition = function() {
    return this.getSlicePosition('coronal');
}
ViewerContext.prototype.getAxialSlicePosition = function() {
    return this.getSlicePosition('axial');
}
ViewerContext.prototype.getSagittalSlicePosition = function() {
    return this.getSlicePosition('sagittal');
}
ViewerContext.prototype.setCrosshair = function(canvas, mos_pos_x, mos_pos_y) {
    let axis = canvas.axis;
    let axis_prefix = this.axis_prefixes[this.axes.indexOf(axis)];
    //console.log('called setCrosshair for canvas ' + canvas.axis);
    let pan_x = this['pan_' + axis_prefix + 'x'];
    let pan_y = this['pan_' + axis_prefix + 'y'];
    let magnification = this[axis_prefix + 'magnification'];
    let scale = this[axis_prefix + 'scale'];
    let zoom_factor = 1 / magnification / scale;
    let plane_x = Math.min(canvas.ortho_xoffset + canvas.ortho_xspan,
        Math.max(canvas.ortho_xoffset, mos_pos_x * zoom_factor + pan_x));
    let plane_y = Math.min(canvas.ortho_yoffset + canvas.ortho_yspan,
        Math.max(canvas.ortho_yoffset, mos_pos_y * zoom_factor + pan_y));
    //console.log('plane_x ' + plane_x + ' plane_y ' + plane_y);
    let plane_percent_x = Math.min(1, Math.max(0, plane_x - canvas.plane.left) / canvas.plane.width);
    let plane_percent_y = Math.min(1, Math.max(0, plane_y - canvas.plane.bottom) / canvas.plane.height);
    let co_slice = 0;
    let ax_slice = 0;
    let sa_slice = 0;
    let crosshair_x = 0;
    let crosshair_y = 0;
    //In OpenGL, positive Y is up but in the canvas, positive Y is down
    switch(axis) {
        case 'coronal': //World position is X and Y, Slice is Z
            sa_slice = Math.trunc(Math.round(this.min_sa_slice + plane_percent_x
                * (this.max_sa_slice - this.min_sa_slice)));
            ax_slice = Math.trunc(Math.round(this.min_ax_slice + plane_percent_y
                * (this.max_ax_slice - this.min_ax_slice)));
            crosshair_x = this.volume.left + plane_percent_x * this.volume.width;
            crosshair_y = this.volume.bottom + plane_percent_y * this.volume.height;
            //console.log(axis + ' crosshair_x: ' + crosshair_x + ', crosshair_y: ' + crosshair_y);
            this.setSlice('sagittal', sa_slice, undefined, crosshair_x, 'no_bounds');
            this.setSlice('axial', ax_slice, undefined, crosshair_y, 'no_bounds');
            break;
        case 'axial': //World position is X and Z, Slice is Y
            sa_slice = Math.trunc(Math.round(this.min_sa_slice + plane_percent_x
                * (this.max_sa_slice - this.min_sa_slice)));
            co_slice = Math.trunc(Math.round(this.min_slice + plane_percent_y
                * (this.max_slice - this.min_slice)));
            crosshair_x = this.volume.left + plane_percent_x * this.volume.width;
            crosshair_y = this.volume.back - plane_percent_y * this.volume.depth;
            //console.log(axis + ' crosshair_x: ' + crosshair_x + ', crosshair_y: ' + crosshair_y);
            this.setSlice('sagittal', sa_slice, undefined, crosshair_x, 'no_bounds');
            this.setSlice('coronal', co_slice, undefined, crosshair_y, 'no_bounds');
            break;
        case 'sagittal': //World position is Y and Z, Slice is X
            co_slice = Math.trunc(Math.round(this.min_slice + (1 - plane_percent_x)
                * (this.max_slice - this.min_slice)));
            ax_slice = Math.trunc(Math.round(this.min_ax_slice + plane_percent_y
                * (this.max_ax_slice - this.min_ax_slice)));
            crosshair_x = this.volume.back - (1 - plane_percent_x) * this.volume.depth;
            crosshair_y = this.volume.bottom + plane_percent_y * this.volume.height;
            //console.log(axis + ' crosshair_x: ' + crosshair_x + ', crosshair_y: ' + crosshair_y);
            this.setSlice('coronal', co_slice, undefined, crosshair_x, 'no_bounds');
            this.setSlice('axial', ax_slice, undefined, crosshair_y, 'no_bounds');
            break;
    }
    //console.log('set crosshair to: ' + JSON.stringify(this.crosshair));
    return this.view_params;
};
ViewerContext.prototype.crosshairCenter = function() {
    this.setCrosshair(this.canvas.coronal, 0, 0);
    this.setCrosshair(this.canvas.axial, 0, 0);
    this.setCrosshair(this.canvas.sagittal, 0, 0);
}
ViewerContext.prototype.getNumberOfActiveCanvas = function() {
    let n = 0;
    for(let axis in this.canvas) {
        if(this.canvas[axis].isActive()) {
            n++;
        }
    }
    return n;
}
ViewerContext.prototype.addView = function(view) {
    this.views[view.key] = view;
    if(view.name) {
        this.layers.push(view.key);
    }
    this.valid_views.add(view.key);
    if(view.selectable) {
        this.selectable_views.add(view.key);
    }
    return view;
}
ViewerContext.prototype.addViewClass = function(view_class) {
    this.view_classes[view_class.key] = view_class;
    for(let key in view_class.views) {
        let view = view_class.views[key];
        this.addView(view);
    }
    return view_class;
}
ViewerContext.prototype.updateVolume = function() {
    let coronal = this.canvas.coronal;
    let sagittal = this.canvas.sagittal;
    let axial = this.canvas.axial;
    this.volume.left = Math.max(
        coronal.plane.left != null ? coronal.plane.left : -Infinity,
        axial.plane.left != null ? axial.plane.left : -Infinity
    );
    this.volume.right = Math.min(
        coronal.plane.right != null ? coronal.plane.right : Infinity,
        axial.plane.right != null ? axial.plane.right : Infinity
    );
    this.volume.bottom = Math.max(
        coronal.plane.bottom != null ? coronal.plane.bottom : -Infinity,
        sagittal.plane.bottom != null ? sagittal.plane.bottom : -Infinity
    );
    this.volume.top = Math.min(
        coronal.plane.top != null ? coronal.plane.top : Infinity,
        sagittal.plane.top != null ? sagittal.plane.top : Infinity
    );
    this.volume.back = Math.max(
        axial.plane.bottom != null ? axial.plane.bottom : -Infinity,
        sagittal.plane.right != null ? sagittal.plane.right : -Infinity
    );
    this.volume.front = Math.min(
        axial.plane.top != null ? axial.plane.top : Infinity,
        sagittal.plane.left != null ? sagittal.plane.left : Infinity
    );
    this.volume.width = (this.volume.right - this.volume.left) || 0;
    this.volume.height = (this.volume.top - this.volume.bottom) || 0;
    this.volume.depth = (this.volume.back - this.volume.front) || 0;
    //console.log('volume: ' + JSON.stringify(this.volume));
}
ViewerContext.prototype.setSessionName = function(session_name) {
    let [vivo, session] = session_name.split('-', 2);
    this.view_params.session = session;
    this.view_params.vivo = vivo;
    //console.log('setSessionName ' + session_name);
    if('mri' in this.view_classes) {
        this.view_classes['mri'].setVivoAndSession(vivo, session, null);
    }
    if('accessory-overlay' in this.view_classes) {
        this.view_classes['accessory-overlay'].setVivoAndSession(vivo,
            session, null);
    }
}
ViewerContext.prototype.drawScene = function() {
    for(let axis in this.canvas) {
        this.canvas[axis].drawScene();
    }
};
